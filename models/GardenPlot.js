const mongoose = require('mongoose');

// Tracks which grid cells a user has purchased, plus weather & ecosystem state
const gardenPlotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  purchasedCells: [{
    row: { type: Number, required: true },
    col: { type: Number, required: true },
    purchasedAt: { type: Date, default: Date.now }
  }],
  migrationDone: { type: Boolean, default: false }, // tracks old-plant refund migration

  // ── Tilled ground cells (prepared by cuốc, consumed on ground-plant) ───
  tilledCells: [{
    row: { type: Number, required: true },
    col: { type: Number, required: true },
  }],

  // ── Weather (changes every 12 real hours) ──────────────────────
  weather: {
    type: String,
    enum: ['sunny','cloudy','rainy','stormy','foggy','windy'],
    default: 'sunny'
  },
  weatherSetAt: { type: Date, default: Date.now },

  // ── Ecosystem (updates every 6 real hours) ─────────────────────
  ecosystem: {
    bees:          { type: Number, default: 0, min: 0, max: 5 },
    birds:         { type: Boolean, default: false },
    bats:          { type: Boolean, default: false },
    mushrooms:     { type: Number, default: 0, min: 0, max: 5 },
    worms:         { type: Number, default: 0, min: 0, max: 3 },
    lastEcoUpdate: { type: Date, default: null }
  }
});

module.exports = mongoose.model('GardenPlot', gardenPlotSchema);
