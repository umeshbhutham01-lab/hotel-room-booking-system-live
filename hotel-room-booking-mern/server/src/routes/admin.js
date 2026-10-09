import { Router } from "express";
import Room from "../models/Room.js";
import Booking from "../models/Booking.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/summary", async (_req, res, next) => {
  try {
    const [rooms, bookings, confirmed, paid, users] = await Promise.all([
      Room.countDocuments(),
      Booking.countDocuments(),
      Booking.countDocuments({ status: "confirmed" }),
      Booking.aggregate([{ $match: { paymentStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$totalPrice" } } }]),
      (await import("../models/User.js")).default.countDocuments({ role: "user" })
    ]);
    res.json({ rooms, bookings, confirmed, paidRevenue: paid[0]?.total || 0, users });
  } catch (err) { next(err); }
});

router.post("/rooms", async (req, res, next) => {
  try {
    const { name, type, description, pricePerNight, capacity, image, amenities } = req.body;
    if (!name?.trim() || !["Standard", "Deluxe", "Suite"].includes(type) || Number(pricePerNight) < 0 || !Number.isInteger(Number(capacity)) || Number(capacity) < 1) {
      return res.status(400).json({ message: "Enter a name, valid room type, non-negative price, and positive capacity." });
    }
    const room = await Room.create({ name, type, description, pricePerNight: Number(pricePerNight), capacity: Number(capacity), image, amenities: Array.isArray(amenities) ? amenities : [] });
    res.status(201).json(room);
  } catch (err) { next(err); }
});

router.patch("/rooms/:id", async (req, res, next) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!room) return res.status(404).json({ message: "Room not found." });
    res.json(room);
  } catch (err) { next(err); }
});

router.delete("/rooms/:id", async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found." });
    const active = await Booking.exists({ room: room._id, status: { $in: ["pending_payment", "confirmed"] } });
    if (active) return res.status(409).json({ message: "Cannot delete a room with active bookings." });
    await room.deleteOne();
    res.json({ message: "Room deleted." });
  } catch (err) { next(err); }
});

export default router;
