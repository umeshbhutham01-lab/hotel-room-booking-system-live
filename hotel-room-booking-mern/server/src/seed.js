import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Room from "./models/Room.js";
import User from "./models/User.js";
import demoRooms from "./demoRooms.js";

dotenv.config();

try {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hotel_booking");
  if (await Room.countDocuments() === 0) await Room.insertMany(demoRooms);
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
