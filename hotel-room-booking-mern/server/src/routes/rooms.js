import { Router } from "express";
import Booking from "../models/Booking.js";
import Room from "../models/Room.js";

const router = Router();

async function addRatingSummaries(rooms) {
  if (!rooms.length) return [];
  const summaries = await Booking.aggregate([
    {
      $match: {
        room: { $in: rooms.map((room) => room._id) },
        status: "confirmed",
        paymentStatus: "paid",
        rating: { $gte: 1, $lte: 5 }
      }
    },
    { $group: { _id: "$room", average: { $avg: "$rating" }, count: { $sum: 1 } } }
  ]);
  const byRoomId = new Map(summaries.map((summary) => [summary._id.toString(), summary]));
  return rooms.map((room) => {
    const summary = byRoomId.get(room._id.toString());
    return {
      ...room.toObject(),
      ratingAverage: summary ? Math.round(summary.average * 10) / 10 : null,
      ratingCount: summary?.count || 0
    };
  });
}

router.get("/", async (req, res, next) => {
  try {
    const filter = req.query.type && req.query.type !== "All" ? { type: req.query.type } : {};
    const rooms = await Room.find(filter).sort({ pricePerNight: 1 });
    res.json(await addRatingSummaries(rooms));
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json((await addRatingSummaries([room]))[0]);
  } catch (err) { next(err); }
});

export default router;
