const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  from:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  to:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  content: { type: String, required: true, maxlength: 500 },
  seen:    { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Compound index for efficient conversation queries
messageSchema.index({ from: 1, to: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
