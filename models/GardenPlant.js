const mongoose = require('mongoose');

const gardenPlantSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  row:          { type: Number, required: true },
  col:          { type: Number, required: true },
  plantTypeId:  { type: String, required: true },  // references static PLANT_TYPES catalog
  potTypeId:    { type: String, required: true },   // references static POT_TYPES catalog

  // Lifecycle
  plantedAt:        { type: Date, default: Date.now },
  stageStartedAt:   { type: Date, default: Date.now },
  lastTickAt:       { type: Date, default: Date.now },
  stage: {
    type: String,
    enum: ['seed','sprout','leafing','growing','flowering','fruiting','dormant'],
    default: 'seed'
  },
  cycleCount: { type: Number, default: 0 }, // full lifecycle loops completed

  // Health & environment
  health:        { type: Number, default: 100, min: 0, max: 100 },
  waterLevel:    { type: Number, default: 70,  min: 0, max: 100 },
  nutrientLevel: { type: Number, default: 70,  min: 0, max: 100 },
  bugs:          { type: Number, default: 0,   min: 0, max: 10  },
  deadLeaves:    { type: Number, default: 0,   min: 0, max: 10  },
  isAlive:       { type: Boolean, default: true },

  // Care timestamps
  lastWateredAt:    { type: Date, default: null },
  lastFertilizedAt: { type: Date, default: null },
  lastBugCaughtAt:  { type: Date, default: null },
  lastLeafRemovedAt:{ type: Date, default: null },

  // Harvest
  harvestCount:   { type: Number, default: 0 },
  lastHarvestedAt:{ type: Date, default: null },
  readyToHarvest: { type: Boolean, default: false }
});

// Compound index so we can look up plant by position
gardenPlantSchema.index({ userId: 1, row: 1, col: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('GardenPlant', gardenPlantSchema);
