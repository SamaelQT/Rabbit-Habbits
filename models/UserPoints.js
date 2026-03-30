const mongoose = require('mongoose');

const userPointsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  points: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  // Level system
  level: { type: Number, default: 1 },
  // Streak freeze
  streakFreezes: { type: Number, default: 0 },       // cards owned
  freezeActiveUntil: { type: Date, default: null },   // current freeze expiry
  // Inventory items
  food:       { type: Number, default: 0 },
  meat:       { type: Number, default: 0 },
  fish:       { type: Number, default: 0 },
  seed:       { type: Number, default: 0 },
  treat:      { type: Number, default: 0 },
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

// Level thresholds: level N requires LEVEL_THRESHOLDS[N-1] total points
// Exponential curve: each level needs more points
const LEVEL_THRESHOLDS = [
  0,      // Lv1: 0
  50,     // Lv2: 50
  120,    // Lv3: 120
  220,    // Lv4: 220
  350,    // Lv5: 350
  520,    // Lv6: 520
  740,    // Lv7: 740
  1020,   // Lv8: 1020
  1380,   // Lv9: 1380
  1820,   // Lv10: 1820
  2360,   // Lv11
  3020,   // Lv12
  3820,   // Lv13
  4780,   // Lv14
  5920,   // Lv15
  7260,   // Lv16
  8820,   // Lv17
  10620,  // Lv18
  12680,  // Lv19
  15000,  // Lv20
];

userPointsSchema.statics.LEVEL_THRESHOLDS = LEVEL_THRESHOLDS;

userPointsSchema.methods.calcLevel = function() {
  let newLevel = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (this.totalEarned >= LEVEL_THRESHOLDS[i]) { newLevel = i + 1; break; }
  }
  if (newLevel > LEVEL_THRESHOLDS.length) newLevel = LEVEL_THRESHOLDS.length;
  const oldLevel = this.level || 1;
  this.level = newLevel;
  return { oldLevel, newLevel, leveledUp: newLevel > oldLevel };
};

userPointsSchema.methods.addPoints = function(amount) {
  this.points += amount;
  this.totalEarned += amount;
  this.updatedAt = new Date();
  return this.calcLevel();
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
