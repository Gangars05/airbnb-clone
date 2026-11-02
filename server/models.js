import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const User = model('User', new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
}, { timestamps: true }));

export const Property = model('Property', new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: String,
  location: { type: String, required: true, index: true },
  type: { type: String, enum: ['house', 'apartment', 'villa', 'cabin', 'room'], default: 'house' },
  pricePerNight: { type: Number, required: true, min: 1 },
  guests: { type: Number, default: 2 },
  images: [String],
}, { timestamps: true }));

export const Booking = model('Booking', new Schema({
  property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
  guest: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  guests: { type: Number, default: 1 },
  totalPrice: Number,
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
}, { timestamps: true }));
