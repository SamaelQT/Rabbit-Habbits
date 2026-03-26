const express     = require('express');
const router      = express.Router();
const Pet         = require('../models/Pet');
const UserPoints  = require('../models/UserPoints');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

// ── Shop catalog (static) ──
const SHOP_PETS = [
  { type:'rabbit', name:'Thỏ Bông',      emoji:'🐰', price:50,  category:'animal', desc:'Thỏ nhỏ đáng yêu, thích ăn cà rốt' },
  { type:'cat',    name:'Mèo Mướp',      emoji:'🐱', price:60,  category:'animal', desc:'Mèo lười biếng nhưng dễ thương' },
  { type:'dog',    name:'Cún Con',        emoji:'🐶', price:60,  category:'animal', desc:'Cún trung thành, luôn vui vẻ' },
  { type:'tree',   name:'Cây Kim Tiền',   emoji:'🪴', price:40,  category:'plant',  desc:'Mang tới tài lộc, thịnh vượng cho gia chủ' },
  { type:'flower', name:'Cây Phát Tài',   emoji:'🎋', price:45,  category:'plant',  desc:'Biểu tượng may mắn, phú quý, phát đạt' },
  { type:'tree2',  name:'Cây Sen Đá',     emoji:'🪷', price:35,  category:'plant',  desc:'Sức khỏe dồi dào, bình an và trường thọ' },
  { type:'flower2',name:'Hoa Mai',        emoji:'🌼', price:50,  category:'plant',  desc:'Hoa đặc trưng ngày Tết, mang may mắn cả năm' },
  { type:'flower3',name:'Hoa Lan',        emoji:'🌺', price:55,  category:'plant',  desc:'Thanh cao, sang trọng, thu hút vận may' },
];

const SHOP_ITEMS = [
  { id:'food',       name:'Thức ăn',   emoji:'🥕', price:10, desc:'Cho thú cưng ăn (+10 điểm pet)' },
  { id:'water',      name:'Nước uống', emoji:'💧', price:8,  desc:'Cho thú cưng/cây uống nước (+8 điểm pet)' },
  { id:'fertilizer', name:'Phân bón',  emoji:'🌿', price:15, desc:'Bón phân cho cây (+15 điểm pet)' },
];

const STREAK_FREEZE_PRICE = 100;

// Pet growth stages
const GROWTH_STAGES = {
  rabbit:  ['🥚','🐣','🐰','🐰','🐇','🐇','🐇','🐇','🐇','🐇'],
  cat:     ['🥚','🐣','🐱','🐱','😺','😺','😸','😸','😸','😸'],
  dog:     ['🥚','🐣','🐶','🐶','🐕','🐕','🦮','🦮','🦮','🦮'],
  tree:    ['🌱','🌱','🪴','🪴','🪴','🪴','🪴','🪴','🪴','🪴'],
  flower:  ['🌱','🌱','🌿','🌿','🎋','🎋','🎋','🎋','🎋','🎋'],
  tree2:   ['🌱','🌱','🪴','🪴','🪷','🪷','🪷','🪷','🪷','🪷'],
  flower2: ['🌱','🌱','🌿','🌿','🌼','🌼','🌼','🌼','🌼','🌼'],
  flower3: ['🌱','🌱','🌿','🌿','🌺','🌺','🌺','🌺','🌺','🌺'],
};

// ── Get or create user points ──
async function getUP(userId) {
  let up = await UserPoints.findOne({ userId });
  if (!up) up = await UserPoints.create({ userId, points: 0 });
  return up;
}

// ═══ POINTS ═══

// GET /api/shop/points — current points & inventory
router.get('/points', async (req, res) => {
  try {
    const up = await getUP(req.userId);
    res.json({
      points: up.points,
      totalEarned: up.totalEarned,
      food: up.food,
      water: up.water,
      fertilizer: up.fertilizer,
      streakFreezes: up.streakFreezes,
      freezeActive: up.isFreezeActive(),
      badges: up.badges
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ SHOP CATALOG ═══

// GET /api/shop/catalog
router.get('/catalog', (req, res) => {
  res.json({ pets: SHOP_PETS, items: SHOP_ITEMS, streakFreezePrice: STREAK_FREEZE_PRICE });
});

// ═══ BUY PET ═══

// POST /api/shop/buy-pet  { type }
router.post('/buy-pet', async (req, res) => {
  try {
    const { type } = req.body;
    const catalog = SHOP_PETS.find(p => p.type === type);
    if (!catalog) return res.status(400).json({ error: 'Loại pet không hợp lệ' });

    const up = await getUP(req.userId);
    if (!up.spendPoints(catalog.price)) return res.status(400).json({ error: 'Không đủ điểm!' });

    const pet = new Pet({
      userId: req.userId,
      type: catalog.type,
      name: catalog.name,
      emoji: GROWTH_STAGES[type][0]
    });
    await pet.save();
    await up.save();

    res.json({ pet, points: up.points });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ BUY ITEMS ═══

// POST /api/shop/buy-item  { itemId, qty }
router.post('/buy-item', async (req, res) => {
  try {
    const { itemId, qty = 1 } = req.body;
    const catalog = SHOP_ITEMS.find(i => i.id === itemId);
    if (!catalog) return res.status(400).json({ error: 'Vật phẩm không hợp lệ' });

    const totalCost = catalog.price * qty;
    const up = await getUP(req.userId);
    if (!up.spendPoints(totalCost)) return res.status(400).json({ error: 'Không đủ điểm!' });

    up[itemId] += qty;
    await up.save();

    res.json({ points: up.points, [itemId]: up[itemId] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ BUY STREAK FREEZE ═══

// POST /api/shop/buy-freeze
router.post('/buy-freeze', async (req, res) => {
  try {
    const up = await getUP(req.userId);
    if (!up.spendPoints(STREAK_FREEZE_PRICE)) return res.status(400).json({ error: 'Không đủ điểm! Cần 100 điểm' });

    up.streakFreezes += 1;
    await up.save();

    res.json({ points: up.points, streakFreezes: up.streakFreezes });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/activate-freeze
router.post('/activate-freeze', async (req, res) => {
  try {
    const up = await getUP(req.userId);
    if (up.streakFreezes < 1) return res.status(400).json({ error: 'Không có thẻ freeze!' });
    if (up.isFreezeActive()) return res.status(400).json({ error: 'Đã có freeze đang hoạt động!' });

    up.streakFreezes -= 1;
    // Freeze lasts 24 hours
    up.freezeActiveUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await up.save();

    res.json({ freezeActive: true, freezeActiveUntil: up.freezeActiveUntil, streakFreezes: up.streakFreezes });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ MY PETS ═══

// GET /api/shop/pets
router.get('/pets', async (req, res) => {
  try {
    const pets = await Pet.find({ userId: req.userId }).sort({ createdAt: -1 });
    const up = await getUP(req.userId);
    const freezeActive = up.isFreezeActive();

    const result = [];
    for (const pet of pets) {
      const health = pet.checkHealth(freezeActive);
      if (health.alive !== pet.alive || pet.isModified()) {
        await pet.save();
      }
      const stage = GROWTH_STAGES[pet.type] || [];
      const stageEmoji = stage[Math.min(pet.level - 1, stage.length - 1)] || pet.emoji;
      result.push({
        _id: pet._id,
        type: pet.type,
        name: pet.name,
        emoji: stageEmoji,
        totalPoints: pet.totalPoints,
        level: pet.level,
        alive: pet.alive,
        warning: health.warning,
        lastFedAt: pet.lastFedAt,
        lastWateredAt: pet.lastWateredAt,
        lastFertilized: pet.lastFertilized,
        timesFed: pet.timesFed,
        timesWatered: pet.timesWatered,
        timesFertilized: pet.timesFertilized,
        createdAt: pet.createdAt
      });
    }
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ FEED / WATER / FERTILIZE ═══

// POST /api/shop/care  { petId, action: 'food'|'water'|'fertilizer' }
router.post('/care', async (req, res) => {
  try {
    const { petId, action } = req.body;
    if (!['food','water','fertilizer'].includes(action))
      return res.status(400).json({ error: 'Hành động không hợp lệ' });

    const pet = await Pet.findOne({ _id: petId, userId: req.userId });
    if (!pet) return res.status(404).json({ error: 'Không tìm thấy pet' });
    if (!pet.alive) return res.status(400).json({ error: 'Pet đã mất rồi 😢' });

    const up = await getUP(req.userId);
    if (up[action] < 1) return res.status(400).json({ error: `Không còn ${action === 'food' ? 'thức ăn' : action === 'water' ? 'nước' : 'phân bón'}!` });

    // Consume item
    up[action] -= 1;
    await up.save();

    // Apply care
    const pointsGain = action === 'food' ? 10 : action === 'water' ? 8 : 15;
    pet.totalPoints += pointsGain;
    pet.calcLevel();
    const now = new Date();

    if (action === 'food') {
      pet.lastFedAt = now;
      pet.timesFed += 1;
    } else if (action === 'water') {
      pet.lastWateredAt = now;
      pet.timesWatered += 1;
    } else {
      pet.lastFertilized = now;
      pet.timesFertilized += 1;
    }
    await pet.save();

    const stage = GROWTH_STAGES[pet.type] || [];
    const stageEmoji = stage[Math.min(pet.level - 1, stage.length - 1)] || pet.emoji;

    res.json({
      pet: { ...pet.toObject(), emoji: stageEmoji },
      inventory: { food: up.food, water: up.water, fertilizer: up.fertilizer },
      pointsGain
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ BADGES ═══

const BADGES_CATALOG = [
  // Tasks
  { id: 'first_task',     name: 'Bước đầu tiên',    emoji: '⭐',  desc: 'Hoàn thành 1 task đầu tiên',          requirement: 'Hoàn thành 1 task bất kỳ', check: 'tasks', threshold: 1 },
  { id: 'task_10',        name: 'Chăm chỉ',          emoji: '🌟',  desc: 'Đã hoàn thành 10 tasks',              requirement: 'Hoàn thành tổng cộng 10 tasks', check: 'tasks', threshold: 10 },
  { id: 'task_50',        name: 'Siêu năng suất',    emoji: '💫',  desc: 'Đã hoàn thành 50 tasks',              requirement: 'Hoàn thành tổng cộng 50 tasks', check: 'tasks', threshold: 50 },
  { id: 'task_100',       name: 'Huyền thoại',       emoji: '🏆',  desc: 'Đã hoàn thành 100 tasks',             requirement: 'Hoàn thành tổng cộng 100 tasks', check: 'tasks', threshold: 100 },
  { id: 'task_500',       name: 'Không gì cản nổi',  emoji: '👑',  desc: 'Đã hoàn thành 500 tasks',             requirement: 'Hoàn thành tổng cộng 500 tasks', check: 'tasks', threshold: 500 },
  // Streaks
  { id: 'streak_3',       name: 'Tia lửa',           emoji: '🕯️', desc: 'Giữ streak 3 ngày liên tiếp',         requirement: 'Hoàn thành task 3 ngày liên tiếp', check: 'streak', threshold: 3 },
  { id: 'streak_7',       name: 'Tuần lửa',          emoji: '🔥',  desc: 'Giữ streak 7 ngày liên tiếp',         requirement: 'Hoàn thành task 7 ngày liên tiếp', check: 'streak', threshold: 7 },
  { id: 'streak_14',      name: 'Hai tuần thép',     emoji: '⚡',  desc: 'Giữ streak 14 ngày liên tiếp',        requirement: 'Hoàn thành task 14 ngày liên tiếp', check: 'streak', threshold: 14 },
  { id: 'streak_30',      name: 'Tháng thép',        emoji: '💎',  desc: 'Giữ streak 30 ngày liên tiếp',        requirement: 'Hoàn thành task 30 ngày liên tiếp', check: 'streak', threshold: 30 },
  // Pets
  { id: 'first_pet',      name: 'Chủ nhân đầu tiên', emoji: '🐾',  desc: 'Đã mua thú cưng/cây đầu tiên',       requirement: 'Mua 1 thú cưng hoặc cây từ cửa hàng', check: 'pets', threshold: 1 },
  { id: 'pet_3',          name: 'Nhà sưu tập nhỏ',   emoji: '🎪',  desc: 'Sở hữu 3 thú cưng/cây',              requirement: 'Mua tổng cộng 3 thú cưng hoặc cây', check: 'pets', threshold: 3 },
  { id: 'pet_5',          name: 'Vườn thú mini',     emoji: '🏡',  desc: 'Sở hữu 5 thú cưng/cây',              requirement: 'Mua tổng cộng 5 thú cưng hoặc cây', check: 'pets', threshold: 5 },
  // Points
  { id: 'points_100',     name: 'Tiết kiệm',         emoji: '💵',  desc: 'Đã kiếm được tổng 100 điểm',          requirement: 'Tích lũy tổng cộng 100 điểm', check: 'points', threshold: 100 },
  { id: 'points_500',     name: 'Tỷ phú nhỏ',        emoji: '💰',  desc: 'Đã kiếm được tổng 500 điểm',          requirement: 'Tích lũy tổng cộng 500 điểm', check: 'points', threshold: 500 },
  { id: 'points_1000',    name: 'Đại gia',            emoji: '🤑',  desc: 'Đã kiếm được tổng 1000 điểm',         requirement: 'Tích lũy tổng cộng 1000 điểm', check: 'points', threshold: 1000 },
  // Goals
  { id: 'first_goal',     name: 'Có chí hướng',      emoji: '🎯',  desc: 'Hoàn thành ngày đầu trong mục tiêu',  requirement: 'Hoàn thành 1 ngày trong mục tiêu dài hạn', check: 'goals', threshold: 1 },
  // Habits
  { id: 'habit_streak_3', name: 'Thói quen mới',     emoji: '🌱',  desc: 'Giữ thói quen 3 ngày liên tiếp',      requirement: 'Duy trì 1 thói quen 3 ngày liền', check: 'habit_streak', threshold: 3 },
  { id: 'habit_streak_7', name: 'Thói quen vững',    emoji: '🐇',  desc: 'Giữ thói quen 7 ngày liên tiếp',      requirement: 'Duy trì 1 thói quen 7 ngày liền', check: 'habit_streak', threshold: 7 },
  { id: 'habit_streak_30',name: 'Bậc thầy thói quen',emoji: '🧘',  desc: 'Giữ thói quen 30 ngày liên tiếp',     requirement: 'Duy trì 1 thói quen 30 ngày liền', check: 'habit_streak', threshold: 30 },
  // Care
  { id: 'care_10',        name: 'Người chăm sóc',    emoji: '💝',  desc: 'Đã chăm sóc thú cưng/cây 10 lần',    requirement: 'Cho ăn/tưới nước/bón phân tổng 10 lần', check: 'care', threshold: 10 },
  { id: 'care_50',        name: 'Bàn tay vàng',      emoji: '🌈',  desc: 'Đã chăm sóc thú cưng/cây 50 lần',    requirement: 'Cho ăn/tưới nước/bón phân tổng 50 lần', check: 'care', threshold: 50 },
];

// GET /api/shop/badges-catalog
router.get('/badges-catalog', (req, res) => {
  res.json(BADGES_CATALOG);
});

// POST /api/shop/check-badges  { stats: { tasks, streak, pets, points, goals, habit_streak } }
router.post('/check-badges', async (req, res) => {
  try {
    const { stats } = req.body;
    const up = await getUP(req.userId);
    const existingIds = new Set(up.badges.map(b => b.id));
    const newBadges = [];

    for (const badge of BADGES_CATALOG) {
      if (existingIds.has(badge.id)) continue;
      const val = stats[badge.check] || 0;
      if (val >= badge.threshold) {
        const b = { id: badge.id, name: badge.name, emoji: badge.emoji, desc: badge.desc };
        up.badges.push(b);
        newBadges.push(b);
      }
    }

    if (newBadges.length > 0) await up.save();
    res.json({ newBadges, allBadges: up.badges });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/add-points  { amount } — for testing
router.post('/add-points', async (req, res) => {
  try {
    const amount = parseInt(req.body.amount) || 0;
    if (amount <= 0) return res.status(400).json({ error: 'Số điểm không hợp lệ' });
    const up = await getUP(req.userId);
    up.addPoints(amount);
    await up.save();
    res.json({ points: up.points, totalEarned: up.totalEarned });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ AWARD POINTS (internal helper, called from other routes) ═══
// Exported for use by task/habit/goal routes
router.awardPoints = async function(userId, amount) {
  const up = await getUP(userId);
  up.addPoints(amount);
  await up.save();
  return up.points;
};

module.exports = router;
