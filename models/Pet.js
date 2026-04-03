const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:      { type: String, required: true, enum: ['rabbit','cat','dog','hamster','bird','tree','flower','tree2','flower2','flower3','kim_ngan','ngoc_bich','van_loc'] },
  variant:   { type: Number, default: 0, min: 0, max: 9 },  // 0-9: which variant of this species
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
  alive:          { type: Boolean, default: true },
  hidden:         { type: Boolean, default: false },
  lastPenaltyDay: { type: Number, default: 0 },   // day index (ms/DAY) of last health penalty
  createdAt:      { type: Date, default: Date.now }
});

// Calculate level from totalPoints (every 50 pts = 1 level, max 10)
petSchema.methods.calcLevel = function() {
  this.level = Math.min(10, 1 + Math.floor(this.totalPoints / 50));
  return this.level;
};

// Check if neglected — called every time pets are loaded
petSchema.methods.checkHealth = function(freezeActive) {
  if (!this.alive) return { alive: false, warning: false };
  if (freezeActive) return { alive: true, warning: false };

  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;
  const isAnimal = ['rabbit','cat','dog','hamster','bird'].includes(this.type);
  const isPlant  = ['tree','flower','tree2','flower2','flower3','kim_ngan','ngoc_bich','van_loc'].includes(this.type);

  // Reference point: last care, or creation date
  let lastCare = null;
  if (isAnimal) lastCare = this.lastFedAt || this.createdAt;
  if (isPlant)  lastCare = this.lastWateredAt || this.createdAt;

  const daysSince = lastCare ? (now - lastCare) / DAY : 0;

  // Health degrades: -10 pts per day after 3 days neglect
  if (daysSince > 3) {
    const neglectDays = Math.floor(daysSince - 3);
    // Apply penalty proportional to neglect (avoid re-applying on every load)
    // Use a hidden field to track last penalty date
    const lastPenaltyDay = this.lastPenaltyDay || 0;
    const todayDay = Math.floor(now / DAY);
    if (todayDay > lastPenaltyDay) {
      const missedDays = Math.min(todayDay - lastPenaltyDay, neglectDays);
      this.totalPoints = Math.max(0, this.totalPoints - (10 * missedDays));
      this.lastPenaltyDay = todayDay;
      this.calcLevel();
    }
  }

  // Die after 7 days without any care (regardless of whether ever cared for)
  if (daysSince > 7) {
    this.alive = false;
  }

  // Warning if 2+ days without care
  const warning = daysSince > 2;

  return { alive: this.alive, warning, daysSince: Math.floor(daysSince) };
};

module.exports = mongoose.model('Pet', petSchema);
