const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:      { type: String, required: true, enum: ['rabbit','cat','dog','tree','flower','tree2','flower2','flower3'] },
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

// Check if neglected — animals die after 5 days without food, plants die after 7 days without water
petSchema.methods.checkHealth = function(freezeActive) {
  if (!this.alive) return { alive: false, warning: false, mood: 'dead' };
  if (freezeActive) return { alive: true, warning: false, mood: 'happy' };

  const now = new Date();
  const isAnimal = ['rabbit','cat','dog'].includes(this.type);
  const isPlant  = !isAnimal;

  // Death thresholds
  const ANIMAL_DEATH = 5 * 24 * 60 * 60 * 1000; // 5 days no food
  const PLANT_DEATH  = 7 * 24 * 60 * 60 * 1000; // 7 days no water
  // Warning thresholds
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

  let neglected = false;
  let timeSinceCare = 0;

  if (isAnimal) {
    const ref = this.lastFedAt || this.createdAt;
    timeSinceCare = now - ref;
    neglected = timeSinceCare > ANIMAL_DEATH;
  } else {
    const ref = this.lastWateredAt || this.createdAt;
    timeSinceCare = now - ref;
    neglected = timeSinceCare > PLANT_DEATH;
  }

  if (neglected) {
    this.alive = false;
    return { alive: false, warning: false, mood: 'dead' };
  }

  // Warning if 2+ days without care
  let warning = timeSinceCare > TWO_DAYS;

  // Determine mood based on care status
  let mood = 'happy';
  if (warning) {
    const daysSinceCare = timeSinceCare / (24 * 60 * 60 * 1000);
    if (isAnimal && daysSinceCare >= 4) mood = 'very_tired';
    else if (isAnimal && daysSinceCare >= 2) mood = 'tired';
    else if (!isAnimal && daysSinceCare >= 5) mood = 'very_wilted';
    else if (!isAnimal && daysSinceCare >= 2) mood = 'wilted';
  }

  return { alive: this.alive, warning, mood };
};

module.exports = mongoose.model('Pet', petSchema);
