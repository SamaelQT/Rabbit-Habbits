const mongoose = require('mongoose');
const journalSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:    { type: String, required: true },           // YYYY-MM-DD
  mood:    { type: String, default: '' },              // emoji
  content: { type: String, default: '', maxlength: 2000 },
  updatedAt: { type: Date, default: Date.now }
});
journalSchema.index({ userId: 1, date: 1 }, { unique: true });
module.exports = mongoose.model('Journal', journalSchema);
