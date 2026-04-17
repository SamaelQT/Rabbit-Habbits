/**
 * Migration: xóa tất cả pet loại cây, hoàn tiền, gửi system notification
 * Usage: node scripts/refund-plants.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const PLANT_COSTS = {
  tree:      40,
  kim_ngan:  50,
  ngoc_bich: 55,
  flower:    45,
  van_loc:   60,
  tree2:     35,
  flower2:   50,
  flower3:   55,
};
const PLANT_TYPES = Object.keys(PLANT_COSTS);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const User       = require('../models/User');
  const UserPoints = require('../models/UserPoints');
  const Pet        = require('../models/Pet');

  // 1. Tìm tất cả plant pets
  const plantPets = await Pet.find({ type: { $in: PLANT_TYPES } });
  console.log(`🌿 Tìm thấy ${plantPets.length} pet cây cối`);

  // 2. Nhóm theo userId để tính tổng điểm hoàn
  const refundMap = {};
  for (const pet of plantPets) {
    const uid = pet.userId.toString();
    if (!refundMap[uid]) refundMap[uid] = 0;
    refundMap[uid] += PLANT_COSTS[pet.type] || 0;
  }

  const affectedUserIds = Object.keys(refundMap);
  console.log(`👤 ${affectedUserIds.length} user sẽ được hoàn tiền`);

  // 3. Hoàn điểm cho từng user
  for (const uid of affectedUserIds) {
    const refund = refundMap[uid];
    let up = await UserPoints.findOne({ userId: uid });
    if (!up) {
      up = new UserPoints({ userId: uid });
    }
    const before = up.points;
    up.points += refund;
    await up.save();
    console.log(`  💰 ${uid}: +${refund} pts (${before} → ${up.points})`);
  }

  // 4. Xóa tất cả plant pets
  const deleteResult = await Pet.deleteMany({ type: { $in: PLANT_TYPES } });
  console.log(`🗑️  Đã xóa ${deleteResult.deletedCount} pet cây cối`);

  // 5. Gửi system notification cho TẤT CẢ user
  const sysMsg = '🌿 Cây cối giờ chỉ xuất hiện trong tab Vườn — không còn chạy trên màn hình. Nếu bạn từng mua cây, điểm đã được hoàn lại tự động.';
  const notifEntry = { message: sysMsg, emoji: '🌿', createdAt: new Date(), seen: false };

  const updateAll = await User.updateMany(
    {},
    { $push: { systemNotifications: notifEntry } }
  );
  console.log(`📢 Đã gửi thông báo cho ${updateAll.modifiedCount} user`);

  await mongoose.disconnect();
  console.log('\n✅ Done');
}

main().catch(e => { console.error(e); process.exit(1); });
