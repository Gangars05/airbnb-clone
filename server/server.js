import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { User, Property, Booking } from './models.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads',
    filename: (_, f, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(f.originalname)),
  }),
  fileFilter: (_, f, cb) => cb(null, f.mimetype.startsWith('image/')),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(500).json({ message: e.message }));
const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const auth = (req, res, next) => {
  try {
    req.userId = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET).id;
    next();
  } catch { res.status(401).json({ message: 'Please log in to continue' }); }
};

// ---- Auth ----
app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ message: 'Name, email and a password of 6+ characters are required' });
  if (await User.findOne({ email })) return res.status(409).json({ message: 'That email is already registered' });
  const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: sign(user), user: { id: user._id, name, email: user.email } });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password)))
    return res.status(401).json({ message: 'Email or password is incorrect' });
  res.json({ token: sign(user), user: { id: user._id, name: user.name, email: user.email } });
}));

// ---- Properties ----
// GET /api/properties?location=&type=&minPrice=&maxPrice=&guests=&checkIn=&checkOut=
app.get('/api/properties', wrap(async (req, res) => {
  const { location, type, minPrice, maxPrice, guests, checkIn, checkOut } = req.query;
  const q = {};
  if (location) q.location = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (type) q.type = type;
  if (guests) q.guests = { $gte: +guests };
  if (minPrice || maxPrice) q.pricePerNight = { ...(minPrice && { $gte: +minPrice }), ...(maxPrice && { $lte: +maxPrice }) };
  if (checkIn && checkOut) {
    const busy = await Booking.find({ status: 'confirmed', checkIn: { $lt: new Date(checkOut) }, checkOut: { $gt: new Date(checkIn) } }).distinct('property');
    q._id = { $nin: busy };
  }
  res.json(await Property.find(q).sort('-createdAt').populate('owner', 'name'));
}));

app.get('/api/properties/mine', auth, wrap(async (req, res) => res.json(await Property.find({ owner: req.userId }).sort('-createdAt'))));

app.get('/api/properties/:id', wrap(async (req, res) => {
  const p = await Property.findById(req.params.id).populate('owner', 'name');
  if (!p) return res.status(404).json({ message: 'Property not found' });
  const booked = await Booking.find({ property: p._id, status: 'confirmed', checkOut: { $gt: new Date() } }).select('checkIn checkOut -_id');
  res.json({ ...p.toObject(), booked });
}));

app.post('/api/properties', auth, upload.array('images', 6), wrap(async (req, res) => {
  const { title, description, location, type, pricePerNight, guests } = req.body;
  if (!title || !location || !pricePerNight) return res.status(400).json({ message: 'Title, location and price are required' });
  const images = (req.files || []).map((f) => `/uploads/${f.filename}`);
  res.status(201).json(await Property.create({ owner: req.userId, title, description, location, type, pricePerNight, guests, images }));
}));

app.put('/api/properties/:id', auth, upload.array('images', 6), wrap(async (req, res) => {
  const p = await Property.findOne({ _id: req.params.id, owner: req.userId });
  if (!p) return res.status(404).json({ message: 'Listing not found' });
  ['title', 'description', 'location', 'type', 'pricePerNight', 'guests'].forEach((k) => req.body[k] !== undefined && (p[k] = req.body[k]));
  if (req.files?.length) p.images.push(...req.files.map((f) => `/uploads/${f.filename}`));
  res.json(await p.save());
}));

app.delete('/api/properties/:id', auth, wrap(async (req, res) => {
  const p = await Property.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!p) return res.status(404).json({ message: 'Listing not found' });
  await Booking.deleteMany({ property: p._id });
  res.json({ message: 'Listing deleted' });
}));

// ---- Bookings ----
app.post('/api/bookings', auth, wrap(async (req, res) => {
  const { property, checkIn, checkOut, guests } = req.body;
  const inD = new Date(checkIn), outD = new Date(checkOut);
  if (!(inD < outD) || inD < new Date(new Date().toDateString()))
    return res.status(400).json({ message: 'Choose a check-out date after a future check-in date' });
  const p = await Property.findById(property);
  if (!p) return res.status(404).json({ message: 'Property not found' });
  if (String(p.owner) === req.userId) return res.status(400).json({ message: "You can't book your own listing" });
  if (guests > p.guests) return res.status(400).json({ message: `This place sleeps up to ${p.guests} guests` });
  const clash = await Booking.exists({ property, status: 'confirmed', checkIn: { $lt: outD }, checkOut: { $gt: inD } });
  if (clash) return res.status(409).json({ message: 'Those dates are already booked' });
  const nights = Math.round((outD - inD) / 864e5);
  res.status(201).json(await Booking.create({ property, guest: req.userId, checkIn: inD, checkOut: outD, guests, totalPrice: nights * p.pricePerNight }));
}));

app.get('/api/bookings/mine', auth, wrap(async (req, res) =>
  res.json(await Booking.find({ guest: req.userId }).sort('-createdAt').populate('property', 'title location images'))));

app.get('/api/bookings/received', auth, wrap(async (req, res) => {
  const ids = await Property.find({ owner: req.userId }).distinct('_id');
  res.json(await Booking.find({ property: { $in: ids } }).sort('-createdAt').populate('property', 'title').populate('guest', 'name')); }));

app.patch('/api/bookings/:id/cancel', auth, wrap(async (req, res) => {
  const b = await Booking.findOne({ _id: req.params.id, guest: req.userId });
  if (!b) return res.status(404).json({ message: 'Booking not found' });
  b.status = 'cancelled';
  res.json(await b.save());
}));

mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(process.env.PORT || 5000, () => console.log('API running')))
  .catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
