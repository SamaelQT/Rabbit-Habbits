const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:      { type: String, required: true, enum: ['rabbit','cat','dog','hamster','bird','tree','flower','tree2','flower2','flower3','kim_ngan','ngoc_bich','van_loc'] },
  name:      { type: String, required: true, maxlength: 30 },
  emoji:     { type: String, default: '🐰' },
  // Growth & health
  totalPoints: { type: Number, default: 0 },   // accumulated from feeding/watering
  level:       { type: Number, default: 1 },    // grows with totalPoints
  // Care tracking
  lastFedAt:      { type: Date, default: null },
  lastWateredAt:  { type: Date, default: null },
  lastFertilized: { type: Date, default: null },
  // Stats
  timesFed:       { type: Number, default: 0 },
  timesWatered:   { type: Number, default: 0 },
  timesFertilized:{ type: Number, default: 0 },
  // State
  alive:     { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Calculate level from totalPoints (every 50 pts = 1 level, max 10)
petSchema.methods.calcLevel = function() {
  this.level = Math.min(10, 1 + Math.floor(this.totalPoints / 50));
  return this.level;
};

// Check if neglected (3 days without care)
petSchema.methods.checkHealth = function(freezeActive) {
  if (!this.alive) return { alive: false, warning: false };
  if (freezeActive) return { alive: true, warning: false };

  const now = new Date();
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
  const isAnimal = ['rabbit','cat','dog','hamster','bird'].includes(this.type);
  const isPlant  = ['tree','flower','tree2','flower2','flower3','kim_ngan','ngoc_bich','van_loc'].includes(this.type);

  let neglected = false;
  if (isAnimal && this.lastFedAt) {
    neglected = (now - this.lastFedAt) > THREE_DAYS;
  } else if (isAnimal && !this.lastFedAt) {
    neglected = (now - this.createdAt) > THREE_DAYS;
  }
  if (isPlant && this.lastWateredAt) {
    neglected = (now - this.lastWateredAt) > THREE_DAYS;
  } else if (isPlant && !this.lastWateredAt) {
    neglected = (now - this.createdAt) > THREE_DAYS;
  }

  if (neglected) {
    // Lose 10 points per check when neglected
    this.totalPoints = Math.max(0, this.totalPoints - 10);
    this.calcLevel();
    if (this.totalPoints <= 0 && this.timesFed + this.timesWatered > 0) {
      this.alive = false;
    }
  }

  // Warning if 2+ days without care
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  let warning = false;
  if (isAnimal) {
    const ref = this.lastFedAt || this.createdAt;
    warning = (now - ref) > TWO_DAYS;
  } else if (isPlant) {
    const ref = this.lastWateredAt || this.createdAt;
    warning = (now - ref) > TWO_DAYS;
  }

  return { alive: this.alive, warning };
};

module.exports = mongoose.model('Pet', petSchema);
