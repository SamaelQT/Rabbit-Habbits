const mongoose = require('mongoose');

const weeklyChallengeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weekStart: { type: String, required: true }, // 'YYYY-MM-DD' (Monday)
  challenges: [{
    id:        String,
    title:     String,
    emoji:     String,
    desc:      String,
    type:      String, // 'tasks', 'habits', 'journal', 'goals', 'streak', 'points'
    target:    Number,
    progress:  { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    reward:    { type: Number, default: 0 },
    claimedAt: { type: Date, default: null }
  }],
  createdAt: { type: Date, default: Date.now }
});

weeklyChallengeSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyChallenge', weeklyChallengeSchema);
