import mongoose from "mongoose";

const bookingLockSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true }
}, { _id: false });

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: ["Standard", "Deluxe", "Suite"] },
  description: { type: String, default: "" },
  pricePerNight: { type: Number, required: true, min: 0 },
  capacity: { type: Number, required: true, min: 1 },
  image: { type: String, default: "" },
  amenities: [{ type: String }],
  bookingLocks: { type: [bookingLockSchema], default: [], select: false }
}, { timestamps: true });

export default mongoose.model("Room", roomSchema);
