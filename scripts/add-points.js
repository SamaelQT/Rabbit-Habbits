/**
 * One-time script: add points to a specific user
 * Usage: node scripts/add-points.js <username> <points>
 */
require('dotenv').config();
const mongoose = require('mongoose');

// ── inline threshold array (mirrors UserPoints.js) ──
const LEVEL_THRESHOLDS = [
  0,50,120,220,350,520,740,1020,1380,1820,
  2360,3020,3820,4780,5920,7260,8820,10620,12680,15000,
  18000,21500,25500,30000,35200,41000,47500,54800,63000,72200,
  82500,94000,107000,121500,137500,155500,175500,198000,223000,251000,
  282000,317000,356000,400000,449000,504000,566000,635000,712000,800000,
];

function calcLevel(totalEarned) {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalEarned >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
  }
  return Math.min(level, LEVEL_THRESHOLDS.length);
}

async function main() {
  const username  = process.argv[2];
  const addAmount = parseInt(process.argv[3], 10);

  if (!username || isNaN(addAmount) || addAmount <= 0) {
    console.error('Usage: node scripts/add-points.js <username> <points>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const User       = require('../models/User');
  const UserPoints = require('../models/UserPoints');

  const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
  if (!user) {
    console.error(`❌ User "${username}" not found`);
    process.exit(1);
  }

  let up = await UserPoints.findOne({ userId: user._id });
  if (!up) {
    up = new UserPoints({ userId: user._id });
    console.log('  (Created new UserPoints record)');
  }

  const before = { points: up.points, totalEarned: up.totalEarned, level: up.level || 1 };

  up.points      += addAmount;
  up.totalEarned += addAmount;
  up.updatedAt    = new Date();
  const newLevel  = calcLevel(up.totalEarned);
  const leveledUp = newLevel > before.level;
  up.level        = newLevel;

  await up.save();

  console.log(`\n👤 User      : ${user.username} (${user.displayName || '—'})`);
  console.log(`💰 Points    : ${before.points} → ${up.points}  (+${addAmount})`);
  console.log(`⭐ Total     : ${before.totalEarned} → ${up.totalEarned}`);
  console.log(`🏆 Level     : ${before.level} → ${up.level}${leveledUp ? '  🎉 LEVEL UP!' : ''}`);

  await mongoose.disconnect();
  console.log('\n✅ Done');
}

main().catch(e => { console.error(e); process.exit(1); });
