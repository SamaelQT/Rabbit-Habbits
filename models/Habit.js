const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:    { type: String, required: true, trim: true },
  emoji:   { type: String, default: '🐰' },
  color:   { type: String, default: '#b07fff' },
  order:    { type: Number, default: 0 },
  active:   { type: Boolean, default: true },
  category: { type: String, enum: ['work','health','learning','personal','other'], default: 'other' },
  createdAt: { type: Date, default: Date.now }
});

const habitLogSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true, index: true },
  date:    { type: String, required: true, index: true },
  done:    { type: Boolean, default: false }
});
habitLogSchema.index({ userId: 1, habitId: 1, date: 1 }, { unique: true });

module.exports = {
  Habit:    mongoose.model('Habit', habitSchema),
  HabitLog: mongoose.model('HabitLog', habitLogSchema)
};
