import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import crypto from "node:crypto";
import roomRoutes from "./routes/rooms.js";
import bookingRoutes from "./routes/bookings.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import Booking from "./models/Booking.js";

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));

// Razorpay webhook signature must be computed from the exact raw request bytes.
app.post("/api/payments/razorpay-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ message: "Webhook secret is not configured." });
    const signature = req.headers["x-razorpay-signature"];
    const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature || "");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).send("Invalid signature");
    const event = JSON.parse(req.body.toString("utf8"));
    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (payment?.order_id) {
        await Booking.findOneAndUpdate(
          { razorpayOrderId: payment.order_id, status: "pending_payment" },
          { $set: { status: "confirmed", paymentStatus: "paid", razorpayPaymentId: payment.id } }
        );
      }
    } else if (event.event === "payment.failed") {
      const payment = event.payload?.payment?.entity;
      if (payment?.order_id) {
        await Booking.findOneAndUpdate(
          { razorpayOrderId: payment.order_id, status: "pending_payment" },
          { $set: { paymentStatus: "failed" } }
        );
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Razorpay webhook error:", err.message);
    res.status(500).json({ message: "Webhook processing failed." });
  }
});

app.use(express.json({ limit: "100kb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", message: "Hotel Booking API is running" }));
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 11000) return res.status(409).json({ message: "This record already exists." });
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hotel_booking")
  .then(() => app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`)))
  .catch((err) => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
