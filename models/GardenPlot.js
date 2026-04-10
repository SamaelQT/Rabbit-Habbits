const mongoose = require('mongoose');

// Tracks which grid cells a user has purchased
const gardenPlotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  purchasedCells: [{
    row: { type: Number, required: true },
    col: { type: Number, required: true },
    purchasedAt: { type: Date, default: Date.now }
  }],
  migrationDone: { type: Boolean, default: false } // tracks old-plant refund migration
});

module.exports = mongoose.model('GardenPlot', gardenPlotSchema);
