# Hotel Room Booking System (MERN)

A starter full-stack hotel room booking application built with MongoDB, Express, React, and Node.js.

## Deployment

The frontend is hosted on Vercel, the Express API on Render, and MongoDB on MongoDB Atlas (or another hosted MongoDB service).

1. Create a hosted MongoDB database and copy its connection string.
2. In Vercel, import this repository and set the project **Root Directory** to `hotel-room-booking-mern/client`. Use `npm run build` as the build command and `dist` as the output directory.
3. Deploy the API using the `render.yaml` Blueprint at the repository root. Set `MONGO_URI`, `CLIENT_URL`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET` in the Render service environment. Render generates `JWT_SECRET` for the service. The `CLIENT_URL` value is the Vercel site's origin, with no path or trailing slash.
4. After the API is deployed, set Vercel's `VITE_API_URL` environment variable to the public Render API URL with `/api` appended (for example, `https://your-api.onrender.com/api`) and redeploy the frontend.
5. Set `CLIENT_URL` in Render to the Vercel site's origin and redeploy the API so browser requests from the frontend are allowed.

`VITE_API_URL` is public frontend configuration; never put credentials in it. Keep MongoDB, JWT, and payment credentials only in Render's environment settings.

## Features
- Browse hotel rooms
- Filter rooms by type
- Create a booking with guest details and check-in/check-out dates
- Prevent overlapping bookings for the same room, including simultaneous booking attempts
- Let guests rate paid, confirmed bookings and show room rating averages
- View bookings (demo listing)
- REST API with Express and MongoDB/Mongoose
- Responsive React UI

> This is a learning/demo project. Before production, add authentication, authorization, payment verification, input validation, rate limiting, and robust overlapping-booking checks.

## Requirements
- Node.js 18+
- MongoDB local instance or MongoDB Atlas connection string

## 1. Run the backend
```bash
cd server
cp .env.example .env
# Edit MONGO_URI if needed
npm install
npm run dev
```
Backend runs at http://localhost:5000

## 2. Run the frontend
Open a second terminal:
```bash
cd client
npm install
npm run dev
```
Frontend runs at http://localhost:5173

## API
- `GET /api/rooms` — list rooms; optional `?type=Deluxe`
- `GET /api/rooms/:id` — room details
- `POST /api/bookings` — create booking
- `POST /api/bookings/:id/rating` — rate a paid, confirmed booking from 1 to 5 stars
- `GET /api/bookings` — list bookings for demo/admin use
- `GET /api/health` — API status

## Example booking body
```json
{
  "room": "ROOM_MONGODB_ID",
  "guestName": "Umesh",
  "email": "umesh@example.com",
  "checkIn": "2026-11-01",
  "checkOut": "2026-11-03",
  "guests": 2
}
```

## Seed demo rooms
After starting the backend, run:
```bash
npm run seed
```
from the `server` directory.
