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
  coffee:     { type: Number, default: 0 },
  rose:       { type: Number, default: 0 },
  chocolate:  { type: Number, default: 0 },
  star:       { type: Number, default: 0 },
  // Garden inventory (seeds & pots bought from shop)
  gardenSeeds: { type: Map, of: Number, default: () => ({}) },
  gardenPots:  { type: Map, of: Number, default: () => ({}) },
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
  0,       // Lv1
  50,      // Lv2
  120,     // Lv3
  220,     // Lv4
  350,     // Lv5
  520,     // Lv6
  740,     // Lv7
  1020,    // Lv8
  1380,    // Lv9
  1820,    // Lv10
  2360,    // Lv11
  3020,    // Lv12
  3820,    // Lv13
  4780,    // Lv14
  5920,    // Lv15
  7260,    // Lv16
  8820,    // Lv17
  10620,   // Lv18
  12680,   // Lv19
  15000,   // Lv20
  // ── Tier Huyền Thoại (21-30) ──
  18000,   // Lv21
  21500,   // Lv22
  25500,   // Lv23
  30000,   // Lv24
  35200,   // Lv25
  41000,   // Lv26
  47500,   // Lv27
  54800,   // Lv28
  63000,   // Lv29
  72200,   // Lv30
  // ── Tier Thần Thánh (31-40) ──
  82500,   // Lv31
  94000,   // Lv32
  107000,  // Lv33
  121500,  // Lv34
  137500,  // Lv35
  155500,  // Lv36
  175500,  // Lv37
  198000,  // Lv38
  223000,  // Lv39
  251000,  // Lv40
  // ── Tier Vũ Trụ (41-50) ──
  282000,  // Lv41
  317000,  // Lv42
  356000,  // Lv43
  400000,  // Lv44
  449000,  // Lv45
  504000,  // Lv46
  566000,  // Lv47
  635000,  // Lv48
  712000,  // Lv49
  800000,  // Lv50
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
