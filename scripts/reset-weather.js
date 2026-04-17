/**
 * Force weather + ecosystem refresh for all gardens (or a specific user).
 * Optionally pin a specific weather type for testing.
 *
 * Usage:
 *   node scripts/reset-weather.js                  — random weather, all users
 *   node scripts/reset-weather.js <username>        — random weather, one user
 *   node scripts/reset-weather.js <username> stormy — pin specific weather
 *
 * Weather IDs: sunny | cloudy | rainy | stormy | foggy | windy
 */
require('dotenv').config();
const mongoose = require('mongoose');

const WEATHER_TYPES = ['sunny','cloudy','rainy','stormy','foggy','windy'];
const WEATHER_LABELS = {
  sunny:'☀️  Nắng đẹp', cloudy:'⛅ Nhiều mây', rainy:'🌧️  Mưa nhẹ',
  stormy:'⛈️  Giông bão', foggy:'🌫️ Sương mù', windy:'💨 Gió mạnh',
};

async function main() {
  const username   = process.argv[2] || null;
  const pinWeather = process.argv[3] || null;

  if (pinWeather && !WEATHER_TYPES.includes(pinWeather)) {
    console.error(`❌ Unknown weather "${pinWeather}". Valid: ${WEATHER_TYPES.join(', ')}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const GardenPlot = require('../models/GardenPlot');
  const User       = require('../models/User');

  let query = {};
  if (username) {
    const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (!user) { console.error(`❌ User "${username}" not found`); process.exit(1); }
    query = { userId: user._id };
    console.log(`👤 Targeting user: ${user.username}`);
  } else {
    console.log('👥 Targeting all users');
  }

  const gardens = await GardenPlot.find(query);
  if (!gardens.length) { console.log('⚠️  No gardens found'); process.exit(0); }

  let updated = 0;
  for (const g of gardens) {
    const newWeather = pinWeather || WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
    const old = g.weather || 'sunny';
    g.weather      = newWeather;
    g.weatherSetAt = new Date();
    // Force ecosystem recalculation on next load
    if (g.ecosystem) g.ecosystem.lastEcoUpdate = null;
    await g.save();
    console.log(`  🌤️  ${old.padEnd(7)} → ${WEATHER_LABELS[newWeather]}`);
    updated++;
  }

  console.log(`\n✅ Updated ${updated} garden(s). Reload the garden page to see the new weather.`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
