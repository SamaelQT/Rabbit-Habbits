const mongoose = require('mongoose');

const userPointsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  points: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  // Streak freeze
  streakFreezes: { type: Number, default: 0 },       // cards owned
  freezeActiveUntil: { type: Date, default: null },   // current freeze expiry
  // Inventory items
  food:       { type: Number, default: 0 },
  water:      { type: Number, default: 0 },
  fertilizer: { type: Number, default: 0 },
  // Badges earned
  badges: [{
    id:     String,
    name:   String,
    emoji:  String,
    desc:   String,
    earnedAt: { type: Date, default: Date.now }
  }],
  updatedAt: { type: Date, default: Date.now }
});

userPointsSchema.methods.addPoints = function(amount) {
  this.points += amount;
  this.totalEarned += amount;
  this.updatedAt = new Date();
};

userPointsSchema.methods.spendPoints = function(amount) {
  if (this.points < amount) return false;
  this.points -= amount;
  this.updatedAt = new Date();
  return true;
};

userPointsSchema.methods.isFreezeActive = function() {
  if (!this.freezeActiveUntil) return false;
  return new Date() < this.freezeActiveUntil;
};

module.exports = mongoose.model('UserPoints', userPointsSchema);
