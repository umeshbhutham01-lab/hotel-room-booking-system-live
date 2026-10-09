import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Room from "./models/Room.js";
import User from "./models/User.js";

dotenv.config();
const rooms = [
  { name: "Classic Comfort", type: "Standard", description: "A welcoming room for relaxed city stays.", pricePerNight: 2499, capacity: 2, image: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80", amenities: ["Wi-Fi", "Air conditioning", "Queen bed"] },
  { name: "Oceanview Deluxe", type: "Deluxe", description: "A spacious room with thoughtful details and premium comfort.", pricePerNight: 4299, capacity: 3, image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80", amenities: ["Wi-Fi", "Breakfast", "King bed", "Mini fridge"] },
  { name: "Signature Suite", type: "Suite", description: "Extra space to unwind, work, or celebrate a special occasion.", pricePerNight: 6999, capacity: 4, image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80", amenities: ["Wi-Fi", "Breakfast", "Living area", "King bed"] },
  { name: "Garden Deluxe", type: "Deluxe", description: "A calm retreat with warm design and modern amenities.", pricePerNight: 3899, capacity: 3, image: "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80", amenities: ["Wi-Fi", "Air conditioning", "Work desk"] }
];

try {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hotel_booking");
  if (await Room.countDocuments() === 0) await Room.insertMany(rooms);
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@haven.local").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  if (adminPassword && adminPassword.length >= 12) {
    const exists = await User.findOne({ email: adminEmail });
    if (!exists) await User.create({ name: "Hotel Administrator", email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 12), role: "admin" });
    console.log(`Admin account ensured for ${adminEmail}`);
  } else {
    console.log("Admin not created: set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in server/.env, then run npm run seed again.");
  }
  console.log("Demo rooms are ready.");
} catch (err) { console.error(err); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
