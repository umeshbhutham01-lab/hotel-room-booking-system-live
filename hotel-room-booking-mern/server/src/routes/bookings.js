import { Router } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import { optionalAuth, requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const error = new Error("Razorpay is not configured. Add your test API keys to server/.env.");
    error.status = 503;
    throw error;
  }
  // Lazy import is not needed; the package is loaded at module scope below.
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}
import Razorpay from "razorpay";

function hasBookingAccess(req, booking) {
  if (req.user && booking.user && booking.user.equals(req.user._id)) return true;
  const token = req.headers["x-booking-access-token"];
  if (typeof token !== "string" || !booking.guestAccessTokenHash) return false;
  const suppliedHash = crypto.createHash("sha256").update(token).digest();
  const storedHash = Buffer.from(booking.guestAccessTokenHash, "hex");
  return suppliedHash.length === storedHash.length && crypto.timingSafeEqual(suppliedHash, storedHash);
}

function publicBooking(booking) {
  const result = booking.toObject();
  delete result.guestAccessTokenHash;
  return result;
}

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).populate("room").sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) { next(err); }
});

router.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const bookings = await Booking.find().populate("room").populate("user", "name email").sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) { next(err); }
});

router.post("/", optionalAuth, async (req, res, next) => {
  try {
    const { room: roomId, guestName, email, checkIn, checkOut, guests } = req.body;
    if (!mongoose.isValidObjectId(roomId)) return res.status(400).json({ message: "Please select a valid room." });
    if (!guestName?.trim() || !email?.trim() || !checkIn || !checkOut) {
      return res.status(400).json({ message: "Please complete all required fields." });
    }
    const start = new Date(`${checkIn}T00:00:00.000Z`);
    const end = new Date(`${checkOut}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ message: "Check-out must be after check-in." });
    }
    if (start < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z")) {
      return res.status(400).json({ message: "Check-in cannot be in the past." });
    }
    const guestCount = Number(guests);
    if (!Number.isInteger(guestCount) || guestCount < 1) return res.status(400).json({ message: "Guests must be at least 1." });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: "Room not found." });
    if (guestCount > room.capacity) return res.status(400).json({ message: `This room accommodates up to ${room.capacity} guests.` });

    const conflict = await Booking.findOne({
      room: roomId,
      status: { $in: ["confirmed", "pending_payment"] },
      checkIn: { $lt: end },
      checkOut: { $gt: start }
    });
    if (conflict) return res.status(409).json({ message: "Already booked — someone has booked this room for those dates." });

    const nights = Math.ceil((end - start) / 86400000);
    const totalPrice = nights * room.pricePerNight;
    const razorpay = getRazorpay();
    const bookingId = new mongoose.Types.ObjectId();
    const bookingToken = crypto.randomBytes(32).toString("hex");
    const guestAccessTokenHash = crypto.createHash("sha256").update(bookingToken).digest("hex");
    const reservedRoom = await Room.findOneAndUpdate(
      {
        _id: room._id,
        bookingLocks: {
          $not: {
            $elemMatch: { checkIn: { $lt: end }, checkOut: { $gt: start } }
          }
        }
      },
      { $push: { bookingLocks: { booking: bookingId, checkIn: start, checkOut: end } } },
      { new: true }
    );
    if (!reservedRoom) {
      return res.status(409).json({ message: "Already booked — someone has booked this room for those dates." });
    }

    let order;
    let booking;
    try {
      order = await razorpay.orders.create({
        amount: Math.round(totalPrice * 100),
        currency: "INR",
        receipt: `hb_${Date.now()}_${bookingId.toString().slice(-6)}`,
        notes: {
          roomId: room._id.toString(),
          ...(req.user ? { userId: req.user._id.toString() } : {})
        }
      });

      booking = await Booking.create({
        _id: bookingId, room: room._id, ...(req.user ? { user: req.user._id } : {}),
        guestAccessTokenHash, guestName: guestName.trim(),
        email: email.trim().toLowerCase(), checkIn: start, checkOut: end,
        guests: guestCount, totalPrice, status: "pending_payment",
        paymentStatus: "unpaid", razorpayOrderId: order.id
      });
    } catch (err) {
      try {
        await Room.updateOne({ _id: room._id }, { $pull: { bookingLocks: { booking: bookingId } } });
      } catch (cleanupError) {
        console.error("Failed to release room date lock after booking creation error:", cleanupError.message);
      }
      throw err;
    }

    res.status(201).json({
      booking: publicBooking(booking),
      bookingToken,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentMode: process.env.RAZORPAY_KEY_ID.startsWith("rzp_test_") ? "test" : "live"
    });
  } catch (err) { next(err); }
});

router.post("/:id/verify-payment", optionalAuth, async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const booking = await Booking.findById(req.params.id).select("+guestAccessTokenHash");
    if (!booking || !hasBookingAccess(req, booking)) return res.status(404).json({ message: "Booking not found." });
    if (booking.razorpayOrderId !== razorpay_order_id) return res.status(400).json({ message: "Payment order does not match this booking." });
    if (!razorpay_payment_id || !razorpay_signature) return res.status(400).json({ message: "Payment verification details are missing." });

    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(razorpay_signature);
    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      return res.status(400).json({ message: "Payment signature verification failed." });
    }

    // Re-check the booking overlap after payment to reduce race-related double booking risk.
    const conflict = await Booking.findOne({
      _id: { $ne: booking._id }, room: booking.room,
      status: { $in: ["confirmed", "pending_payment"] },
      checkIn: { $lt: booking.checkOut }, checkOut: { $gt: booking.checkIn }
    });
    if (conflict) {
      booking.paymentStatus = "paid";
      booking.razorpayPaymentId = razorpay_payment_id;
      await booking.save();
      return res.status(409).json({ message: "Payment was verified, but the room dates were taken concurrently. Contact the hotel for a refund.", bookingId: booking._id });
    }

    booking.status = "confirmed";
    booking.paymentStatus = "paid";
    booking.razorpayPaymentId = razorpay_payment_id;
    await booking.save();
    res.json({ message: "Payment verified and booking confirmed.", booking: publicBooking(booking) });
  } catch (err) { next(err); }
});

router.post("/:id/cancel", optionalAuth, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).select("+guestAccessTokenHash");
    if (!booking || (req.user?.role !== "admin" && !hasBookingAccess(req, booking))) {
      return res.status(404).json({ message: "Booking not found." });
    }
    if (booking.status === "cancelled") return res.status(400).json({ message: "This booking is already cancelled." });
    if (booking.status === "confirmed" && booking.paymentStatus === "paid") {
      return res.status(400).json({ message: "This booking has been paid. Automatic refunds are not enabled; contact the hotel administrator to process a refund." });
    }
    await Room.updateOne({ _id: booking.room }, { $pull: { bookingLocks: { booking: booking._id } } });
    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    await booking.save();
    res.json({ message: "Booking cancelled.", booking: publicBooking(booking) });
  } catch (err) { next(err); }
});

router.post("/:id/rating", requireAuth, async (req, res, next) => {
  try {
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Choose a rating from 1 to 5 stars." });
    }
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (booking.status !== "confirmed" || booking.paymentStatus !== "paid") {
      return res.status(400).json({ message: "Only paid, confirmed bookings can be rated." });
    }
    booking.rating = rating;
    await booking.save();
    res.json({ message: "Thanks for rating your room.", booking });
  } catch (err) { next(err); }
});

export default router;
