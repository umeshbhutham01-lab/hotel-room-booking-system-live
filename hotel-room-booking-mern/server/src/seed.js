import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import { seedDemoRooms } from "./seedDemoRooms.js";

dotenv.config();

try {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required. Set it in server/.env before running the seed script.");
  }
  await mongoose.connect(process.env.MONGO_URI);
  const seededRooms = await seedDemoRooms();
  console.log(`${seededRooms} missing demo rooms added.`);
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
