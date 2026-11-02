# Stayhaus: Airbnb Clone (MERN)

## Run it
1. Start MongoDB locally, or use an Atlas URI.
2. Server: `cd server && cp .env.example .env && npm install && npm run dev`  (API on :5000)
3. Client: `cd client && npm install && npm run dev`  (app on :5173, proxies /api to :5000)

## Features
- JWT auth (register, login, protected routes)
- Listings: create, edit, delete, multi-image upload (Multer, saved to server/uploads)
- Search and filters: location, type, price range, guests, date availability
- Bookings: date selection, overlap check, total price, cancel
- Dashboard: my listings, my trips, bookings at my places
- Responsive layout (mobile, tablet, desktop)

## API
POST /api/auth/register, /api/auth/login
GET /api/properties, /api/properties/:id, /api/properties/mine
POST/PUT/DELETE /api/properties(/:id)
POST /api/bookings, GET /api/bookings/mine, /api/bookings/received, PATCH /api/bookings/:id/cancel

To use Cloudinary instead of local disk, swap the Multer storage in server.js for multer-storage-cloudinary.
