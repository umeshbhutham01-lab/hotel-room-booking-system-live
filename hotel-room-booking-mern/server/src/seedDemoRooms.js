import Room from "./models/Room.js";
import demoRooms from "./demoRooms.js";

export async function seedDemoRooms() {
  const existingRooms = await Room.find({}, "name").lean();
  const existingNames = new Set(existingRooms.map((room) => room.name));
  const missingRooms = demoRooms.filter((room) => !existingNames.has(room.name));

  if (missingRooms.length) await Room.insertMany(missingRooms);
  return missingRooms.length;
}
