const mongoose = require('mongoose');

const dayPlanSchema = new mongoose.Schema({
  dayIndex: { type: Number, required: true }, // 0-based
  date:     { type: String, required: true }, // YYYY-MM-DD
  task:     { type: String, default: '' },    // what to do this day
  done:     { type: Boolean, default: false },
  missedAt: { type: Date, default: null },    // if day passed and not done
});

const goalSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:     { type: String, required: true, trim: true },
  emoji:     { type: String, default: '🎯' },
  color:     { type: String, default: '#b07fff' },
  totalDays: { type: Number, required: true, min: 1, max: 365 },
  startDate: { type: String, required: true }, // YYYY-MM-DD
  days:      [dayPlanSchema],
  completed: { type: Boolean, default: false },
  active:    { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});
goalSchema.index({ userId: 1, active: 1 });
module.exports = mongoose.model('Goal', goalSchema);
