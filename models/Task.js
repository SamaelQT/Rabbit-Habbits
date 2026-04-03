const mongoose = require('mongoose');
const taskSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:     { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
  priority:  { type: Number, default: 0, min: 0, max: 3 },
  date:      { type: String, required: true, index: true },
  completedAt: { type: Date, default: null },
  category:    { type: String, enum: ['work','health','sport','shopping','learning','personal','other'], default: 'other' },
  createdAt:   { type: Date, default: Date.now }
});
taskSchema.index({ userId: 1, date: 1 });
module.exports = mongoose.model('Task', taskSchema);
