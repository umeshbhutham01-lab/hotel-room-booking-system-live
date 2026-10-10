# Hotel Room Booking System (MERN)

A starter full-stack hotel room booking application built with MongoDB, Express, React, and Node.js.

## Deployment

The frontend is hosted on Vercel, the Express API on Render, and MongoDB on MongoDB Atlas (or another hosted MongoDB service).

1. Create a MongoDB Atlas database user and copy the cluster connection string. In the URI, specify the `hotel_booking` database and replace the username, password, and cluster host with your Atlas values. URL-encode any reserved characters in the password. In Atlas **Network Access**, allow connections from your Render service's outbound IP addresses; if your Render plan does not provide fixed outbound IPs, allow `0.0.0.0/0` (less restrictive). The API automatically inserts the four demo rooms when the connected database has no rooms.
2. In Vercel, import this repository and set the project **Root Directory** to `hotel-room-booking-mern/client`. Use `npm run build` as the build command and `dist` as the output directory.
3. Deploy the API using the root `render.yaml` Blueprint, which configures the `hotel-room-booking-mern/server` directory, build command, and start command. Set `MONGO_URI`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET` in the Render service environment; Render generates `JWT_SECRET`. `MONGO_URI` must be the complete Atlas connection string, with the correct database user/password and database name. The `CLIENT_URL` value is the Vercel site's origin, with no path or trailing slash.
4. After the API is deployed, set Vercel's `VITE_API_URL` environment variable to the public Render API URL with `/api` appended (for example, `https://your-api.onrender.com/api`) and redeploy the frontend.
5. Set `CLIENT_URL` in Render to the Vercel site's origin and redeploy the API so browser requests from the frontend are allowed.

`VITE_API_URL` is public frontend configuration; never put credentials in it. Keep MongoDB, JWT, and payment credentials only in Render's environment settings for production. For local development, copy `server/.env.example` to `server/.env` and set the real `MONGO_URI` there; `.env` is ignored by Git and must not be committed. The example URI is a template, not a working connection string.

Room listings, guest bookings, and payment use the API. If the API is unavailable, the site displays four demo rooms that support a local-only booking confirmation; these demo bookings are not stored and do not collect payment. Guests can book database-backed rooms without creating an account; a secure booking access token is used to verify payment and release an unpaid reservation. Set Razorpay test keys in Render to enable test checkout; the booking form identifies test mode and no real payment is collected. Use live keys only when ready to accept real payments.

## Features
- Browse hotel rooms
- Filter rooms by type
- Book a database-backed room without creating an account
- Try a local-only demo booking when the API is unavailable
- Complete payment through Razorpay Checkout in test mode
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
# Replace the MONGO_URI template with your local or Atlas connection string
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
