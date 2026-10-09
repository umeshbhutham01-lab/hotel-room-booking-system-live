import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  guestName: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  guests: { type: Number, required: true, min: 1 },
  totalPrice: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["pending_payment", "confirmed", "cancelled"], default: "pending_payment" },
  paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded", "failed"], default: "unpaid" },
  paymentProvider: { type: String, default: "razorpay" },
  razorpayOrderId: { type: String, default: "" },
  razorpayPaymentId: { type: String, default: "" },
  rating: { type: Number, min: 1, max: 5, default: null },
  cancelledAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model("Booking", bookingSchema);
