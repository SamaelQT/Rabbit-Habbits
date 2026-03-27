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
  { id:'food',         name:'Thức ăn',        emoji:'🥕', price:10,  desc:'Cho thú cưng ăn (+10 điểm pet). Thú cưng cần ăn mỗi 5 ngày.' },
  { id:'water',        name:'Nước uống',       emoji:'💧', price:8,   desc:'Cho thú cưng/cây uống nước (+8 điểm pet). Cây cần nước mỗi 7 ngày.' },
  { id:'fertilizer',   name:'Phân bón',        emoji:'🌿', price:15,  desc:'Bón phân cho cây giúp cây lớn nhanh hơn (+15 điểm pet).' },
  { id:'streak_freeze',name:'Streak Freeze',   emoji:'❄️', price:100, desc:'Bảo vệ streak & thú cưng khỏi bị phạt trong 24h khi không dùng app được.', special:true },
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

// POST /api/shop/buy-item handles streak_freeze specially
// (handled in buy-item route below)

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

    // Streak freeze handled specially
    if (itemId === 'streak_freeze') {
      const totalCost = catalog.price * qty;
      const up = await getUP(req.userId);
      if (!up.spendPoints(totalCost)) return res.status(400).json({ error: 'Không đủ điểm! Cần 100 điểm mỗi thẻ' });
      up.streakFreezes += qty;
      await up.save();
      return res.json({ points: up.points, streakFreezes: up.streakFreezes });
    }

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
  // ─── Tasks ───
  { id: 'first_task',      name: 'Bước đầu tiên',      emoji: '⭐',  desc: 'Hoàn thành task đầu tiên trong cuộc đời!',         requirement: '✅ Hoàn thành 1 task bất kỳ', check: 'tasks', threshold: 1 },
  { id: 'task_10',         name: 'Chăm chỉ',            emoji: '🌟',  desc: 'Đã hoàn thành 10 tasks, đang đi đúng hướng!',      requirement: '✅ Hoàn thành tổng cộng 10 tasks', check: 'tasks', threshold: 10 },
  { id: 'task_50',         name: 'Siêu năng suất',      emoji: '💫',  desc: '50 tasks xong! Bạn là người chăm chỉ thực sự.',    requirement: '✅ Hoàn thành tổng cộng 50 tasks', check: 'tasks', threshold: 50 },
  { id: 'task_100',        name: 'Huyền thoại',         emoji: '🏆',  desc: '100 tasks! Thành tích đáng nể đây!',               requirement: '✅ Hoàn thành tổng cộng 100 tasks', check: 'tasks', threshold: 100 },
  { id: 'task_200',        name: 'Thánh chăm chỉ',      emoji: '🌈',  desc: '200 tasks hoàn thành — bạn không biết mệt là gì!', requirement: '✅ Hoàn thành tổng cộng 200 tasks', check: 'tasks', threshold: 200 },
  { id: 'task_500',        name: 'Không gì cản nổi',    emoji: '👑',  desc: '500 tasks! Bạn thực sự phi thường.',               requirement: '✅ Hoàn thành tổng cộng 500 tasks', check: 'tasks', threshold: 500 },
  { id: 'task_1000',       name: 'Vô địch thiên hạ',    emoji: '🌍',  desc: '1000 tasks! Bạn là huyền thoại của mọi huyền thoại.',requirement: '✅ Hoàn thành tổng cộng 1000 tasks', check: 'tasks', threshold: 1000 },

  // ─── Streaks ───
  { id: 'streak_3',        name: 'Tia lửa',             emoji: '🕯️', desc: 'Streak 3 ngày đầu tiên, lửa đã bắt đầu bùng cháy!',requirement: '🔥 Hoàn thành task 3 ngày liên tiếp', check: 'streak', threshold: 3 },
  { id: 'streak_7',        name: 'Tuần lửa',            emoji: '🔥',  desc: 'Cả tuần không nghỉ! Streak 7 ngày!',               requirement: '🔥 Hoàn thành task 7 ngày liên tiếp', check: 'streak', threshold: 7 },
  { id: 'streak_14',       name: 'Hai tuần thép',       emoji: '⚡',  desc: '14 ngày liên tiếp — bạn thực sự kiên định!',       requirement: '🔥 Hoàn thành task 14 ngày liên tiếp', check: 'streak', threshold: 14 },
  { id: 'streak_30',       name: 'Tháng thép',          emoji: '💎',  desc: 'Cả tháng không gián đoạn! Streak 30 ngày!',        requirement: '🔥 Hoàn thành task 30 ngày liên tiếp', check: 'streak', threshold: 30 },
  { id: 'streak_60',       name: 'Hai tháng thép',      emoji: '🔱',  desc: 'Streak 60 ngày! Ý chí thép không gì lay chuyển!',  requirement: '🔥 Hoàn thành task 60 ngày liên tiếp', check: 'streak', threshold: 60 },
  { id: 'streak_100',      name: 'Trăm ngày huyền thoại',emoji: '☀️', desc: 'Streak 100 ngày! Bạn đã vượt qua giới hạn bản thân.',requirement: '🔥 Hoàn thành task 100 ngày liên tiếp', check: 'streak', threshold: 100 },

  // ─── Pets ───
  { id: 'first_pet',       name: 'Chủ nhân đầu tiên',  emoji: '🐾',  desc: 'Đã có thú cưng/cây đầu tiên, hành trình bắt đầu!', requirement: '🛒 Mua 1 thú cưng hoặc cây từ cửa hàng', check: 'pets', threshold: 1 },
  { id: 'pet_3',           name: 'Nhà sưu tập nhỏ',    emoji: '🎪',  desc: 'Đã có 3 thú cưng/cây! Ngôi nhà ấm áp hơn rồi.',   requirement: '🛒 Sở hữu tổng cộng 3 thú cưng hoặc cây', check: 'pets', threshold: 3 },
  { id: 'pet_5',           name: 'Vườn thú mini',       emoji: '🏡',  desc: '5 thú cưng/cây! Nhà bạn như một vườn thú nhỏ!',   requirement: '🛒 Sở hữu tổng cộng 5 thú cưng hoặc cây', check: 'pets', threshold: 5 },
  { id: 'pet_10',          name: 'Nông trại hạnh phúc', emoji: '🌻',  desc: '10 thú cưng/cây! Bạn là người chăm chỉ nhất!',    requirement: '🛒 Sở hữu tổng cộng 10 thú cưng hoặc cây', check: 'pets', threshold: 10 },

  // ─── Points ───
  { id: 'points_100',      name: 'Tiết kiệm',           emoji: '💵',  desc: 'Đã tích lũy được 100 điểm đầu tiên!',              requirement: '⭐ Tích lũy tổng cộng 100 điểm', check: 'points', threshold: 100 },
  { id: 'points_500',      name: 'Tỷ phú nhỏ',          emoji: '💰',  desc: '500 điểm — đang trên đà làm giàu!',               requirement: '⭐ Tích lũy tổng cộng 500 điểm', check: 'points', threshold: 500 },
  { id: 'points_1000',     name: 'Đại gia',              emoji: '🤑',  desc: '1000 điểm! Xứng đáng là đại gia rồi đó!',         requirement: '⭐ Tích lũy tổng cộng 1000 điểm', check: 'points', threshold: 1000 },
  { id: 'points_2000',     name: 'Phú quý song toàn',   emoji: '💎',  desc: '2000 điểm! Giàu và giỏi, bạn có cả hai!',         requirement: '⭐ Tích lũy tổng cộng 2000 điểm', check: 'points', threshold: 2000 },
  { id: 'points_5000',     name: 'Vua điểm số',          emoji: '👑',  desc: '5000 điểm! Bạn là vua của mọi thứ!',              requirement: '⭐ Tích lũy tổng cộng 5000 điểm', check: 'points', threshold: 5000 },

  // ─── Goals ───
  { id: 'first_goal',      name: 'Có chí hướng',        emoji: '🎯',  desc: 'Đã bắt đầu hành trình mục tiêu dài hạn!',         requirement: '🎯 Hoàn thành 1 ngày trong mục tiêu dài hạn', check: 'goals', threshold: 1 },
  { id: 'goal_10',         name: 'Kiên trì theo đuổi',  emoji: '🚀',  desc: '10 ngày trong mục tiêu dài hạn, tuyệt vời!',      requirement: '🎯 Hoàn thành 10 ngày trong mục tiêu dài hạn', check: 'goals', threshold: 10 },
  { id: 'goal_30',         name: 'Chinh phục mục tiêu', emoji: '🏅',  desc: '30 ngày trong mục tiêu! Bạn thực sự kiên định!',  requirement: '🎯 Hoàn thành 30 ngày trong mục tiêu dài hạn', check: 'goals', threshold: 30 },

  // ─── Habits ───
  { id: 'habit_streak_3',  name: 'Thói quen mới',       emoji: '🌱',  desc: 'Bắt đầu xây dựng thói quen tốt — 3 ngày liền!',   requirement: '🐰 Duy trì 1 thói quen 3 ngày liên tiếp', check: 'habit_streak', threshold: 3 },
  { id: 'habit_streak_7',  name: 'Thói quen vững',      emoji: '🐇',  desc: 'Thói quen đang thành hình — 7 ngày rồi đó!',      requirement: '🐰 Duy trì 1 thói quen 7 ngày liên tiếp', check: 'habit_streak', threshold: 7 },
  { id: 'habit_streak_14', name: 'Thói quen bền vững',  emoji: '💪',  desc: 'Hai tuần giữ thói quen! Bạn đang thay đổi cuộc đời.',requirement: '🐰 Duy trì 1 thói quen 14 ngày liên tiếp', check: 'habit_streak', threshold: 14 },
  { id: 'habit_streak_30', name: 'Bậc thầy thói quen',  emoji: '🧘',  desc: 'Cả tháng giữ thói quen — bạn là bậc thầy rồi!',   requirement: '🐰 Duy trì 1 thói quen 30 ngày liên tiếp', check: 'habit_streak', threshold: 30 },
  { id: 'habit_streak_60', name: 'Thói quen trọn đời',  emoji: '🌳',  desc: 'Streak thói quen 60 ngày! Thực sự phi thường!',    requirement: '🐰 Duy trì 1 thói quen 60 ngày liên tiếp', check: 'habit_streak', threshold: 60 },

  // ─── Care (pet/plant care actions) ───
  { id: 'care_10',         name: 'Người chăm sóc',      emoji: '💝',  desc: 'Đã chăm sóc thú cưng/cây 10 lần — đang học cách yêu thương!', requirement: '🌿 Cho ăn/tưới nước/bón phân tổng 10 lần', check: 'care', threshold: 10 },
  { id: 'care_50',         name: 'Bàn tay vàng',        emoji: '🌈',  desc: '50 lần chăm sóc — thú cưng rất biết ơn bạn!',    requirement: '🌿 Cho ăn/tưới nước/bón phân tổng 50 lần', check: 'care', threshold: 50 },
  { id: 'care_100',        name: 'Người nuôi dưỡng',    emoji: '🌸',  desc: '100 lần chăm sóc! Bạn thực sự yêu thương chúng!', requirement: '🌿 Cho ăn/tưới nước/bón phân tổng 100 lần', check: 'care', threshold: 100 },
  { id: 'care_200',        name: 'Thánh chăm sóc',      emoji: '👼',  desc: '200 lần chăm sóc! Bạn là thần hộ mệnh của thú cưng!',requirement: '🌿 Cho ăn/tưới nước/bón phân tổng 200 lần', check: 'care', threshold: 200 },
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
