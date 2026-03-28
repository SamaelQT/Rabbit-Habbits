const express     = require('express');
const router      = express.Router();
const Pet         = require('../models/Pet');
const UserPoints  = require('../models/UserPoints');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

// ── Shop catalog (static) ──
const SHOP_PETS = [
  { type:'rabbit',   name:'Thỏ Bông',        emoji:'🐰', price:50,  category:'animal', desc:'Thỏ nhỏ đáng yêu, thích ăn cà rốt' },
  { type:'cat',      name:'Mèo Mướp',        emoji:'🐱', price:60,  category:'animal', desc:'Mèo lười biếng nhưng dễ thương' },
  { type:'dog',      name:'Cún Con',          emoji:'🐶', price:60,  category:'animal', desc:'Cún trung thành, luôn vui vẻ' },
  { type:'hamster',  name:'Chuột Hamster',    emoji:'🐹', price:55,  category:'animal', desc:'Hamster tròn lăn, má phúng phính siêu cute' },
  { type:'bird',     name:'Chim Non',         emoji:'🐦', price:45,  category:'animal', desc:'Chim nhỏ hót vang, mang niềm vui mỗi ngày' },
  { type:'tree',     name:'Cây Kim Tiền',     emoji:'🌲', price:40,  category:'plant',  desc:'Hút tài lộc mạnh nhất, lá xanh dày thịnh vượng' },
  { type:'kim_ngan', name:'Cây Kim Ngân',     emoji:'🌳', price:50,  category:'plant',  desc:'Tượng trưng sự giàu có, đặt bàn làm việc chiêu tài' },
  { type:'ngoc_bich',name:'Cây Ngọc Bích',    emoji:'🪴', price:55,  category:'plant',  desc:'Lá xanh ngọc, tượng trưng tiền bạc và hòa hợp' },
  { type:'flower',   name:'Cây Phát Tài',     emoji:'🎋', price:45,  category:'plant',  desc:'Biểu tượng may mắn, phú quý, phát đạt' },
  { type:'van_loc',  name:'Cây Vạn Lộc',      emoji:'🌺', price:60,  category:'plant',  desc:'Lá hồng đỏ nổi bật, mang may mắn và thịnh vượng' },
  { type:'tree2',    name:'Cây Sen Đá',       emoji:'🌵', price:35,  category:'plant',  desc:'Sức khỏe dồi dào, bình an và trường thọ' },
  { type:'flower2',  name:'Hoa Mai',          emoji:'🌼', price:50,  category:'plant',  desc:'Hoa đặc trưng ngày Tết, mang may mắn cả năm' },
  { type:'flower3',  name:'Hoa Lan',          emoji:'🌺', price:55,  category:'plant',  desc:'Thanh cao, sang trọng, thu hút vận may' },
];

const SHOP_ITEMS = [
  { id:'food',       name:'Cà rốt',        emoji:'🥕', price:10, desc:'Thức ăn cơ bản cho thú cưng (+10 pts)', detail:'Phù hợp cho tất cả thú cưng. Cho ăn để giữ sức khỏe và tăng điểm.' },
  { id:'meat',       name:'Thịt tươi',      emoji:'🥩', price:18, desc:'Thức ăn cao cấp (+18 pts)', detail:'Thịt bò tươi ngon, đặc biệt cho chó và mèo. Tăng điểm nhanh hơn.' },
  { id:'fish',       name:'Cá hồi',         emoji:'🐟', price:15, desc:'Thức ăn yêu thích của mèo (+15 pts)', detail:'Mèo rất thích cá! Cho mèo ăn cá sẽ được thêm bonus điểm.' },
  { id:'seed',       name:'Hạt giống',      emoji:'🌻', price:12, desc:'Cho hamster & chim (+12 pts)', detail:'Hạt hướng dương và ngũ cốc, hamster và chim rất thích.' },
  { id:'treat',      name:'Bánh thưởng',    emoji:'🍪', price:20, desc:'Đồ ăn vặt đặc biệt (+20 pts)', detail:'Phần thưởng khi thú cưng ngoan! Tăng nhiều điểm nhất.' },
  { id:'water',      name:'Nước sạch',      emoji:'💧', price:8,  desc:'Cho thú cưng & cây uống (+8 pts)', detail:'Nước sạch cho thú uống hoặc tưới cây. Cần thiết mỗi ngày.' },
  { id:'fertilizer', name:'Phân bón',       emoji:'🌿', price:15, desc:'Bón phân cho cây (+15 pts)', detail:'Phân bón hữu cơ giúp cây phát triển nhanh hơn.' },
];

const STREAK_FREEZE_PRICE = 100;

// Pet growth stages
const GROWTH_STAGES = {
  rabbit:   ['🥚','🐣','🐰','🐰','🐇','🐇','🐇','🐇','🐇','🐇'],
  cat:      ['🥚','🐣','🐱','🐱','😺','😺','😸','😸','😸','😸'],
  dog:      ['🥚','🐣','🐶','🐶','🐕','🐕','🐕','🐕','🐕','🐕'],
  hamster:  ['🥚','🐣','🐹','🐹','🐹','🐹','🐹','🐹','🐹','🐹'],
  bird:     ['🥚','🐣','🐤','🐤','🐦','🐦','🐦','🐦','🐦','🐦'],
  tree:     ['🌱','🌱','🌿','🌿','🌲','🌲','🌲','🌲','🌲','🌲'],
  kim_ngan: ['🌱','🌱','🌿','🌿','🌳','🌳','🌳','🌳','🌳','🌳'],
  ngoc_bich:['🌱','🌱','🌿','🌿','🪴','🪴','🪴','🪴','🪴','🪴'],
  flower:   ['🌱','🌱','🌿','🌿','🎋','🎋','🎋','🎋','🎋','🎋'],
  van_loc:  ['🌱','🌱','🌿','🌿','🌺','🌺','🌺','🌺','🌺','🌺'],
  tree2:    ['🌱','🌱','🌿','🌿','🌵','🌵','🌵','🌵','🌵','🌵'],
  flower2:  ['🌱','🌱','🌿','🌿','🌼','🌼','🌼','🌼','🌼','🌼'],
  flower3:  ['🌱','🌱','🌿','🌿','🌺','🌺','🌺','🌺','🌺','🌺'],
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
      meat: up.meat || 0,
      fish: up.fish || 0,
      seed: up.seed || 0,
      treat: up.treat || 0,
      water: up.water,
      fertilizer: up.fertilizer,
      streakFreezes: up.streakFreezes,
      freezeActive: up.isFreezeActive(),
      freezeActiveUntil: up.freezeActiveUntil,
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
    const FOOD_ACTIONS = ['food','meat','fish','seed','treat'];
    if (![...FOOD_ACTIONS,'water','fertilizer'].includes(action))
      return res.status(400).json({ error: 'Hành động không hợp lệ' });

    const pet = await Pet.findOne({ _id: petId, userId: req.userId });
    if (!pet) return res.status(404).json({ error: 'Không tìm thấy pet' });
    if (!pet.alive) return res.status(400).json({ error: 'Pet đã mất rồi 😢' });

    const up = await getUP(req.userId);
    if ((up[action] || 0) < 1) {
      const names = { food:'cà rốt', meat:'thịt', fish:'cá', seed:'hạt giống', treat:'bánh thưởng', water:'nước', fertilizer:'phân bón' };
      return res.status(400).json({ error: `Không còn ${names[action] || action}!` });
    }

    // Consume item
    up[action] -= 1;
    await up.save();

    // Apply care — favorite food gives +8 bonus pts
    const FAVORITE_FOOD = {
      rabbit:'food', cat:'fish', dog:'meat', hamster:'seed', bird:'seed',
      tree:'fertilizer', kim_ngan:'fertilizer', ngoc_bich:'fertilizer',
      flower:'fertilizer', van_loc:'fertilizer', tree2:'fertilizer',
      flower2:'fertilizer', flower3:'fertilizer',
    };
    const POINTS = { food:10, meat:18, fish:15, seed:12, treat:20, water:8, fertilizer:15 };
    const isFavorite = FAVORITE_FOOD[pet.type] === action;
    const pointsGain = (POINTS[action] || 10) + (isFavorite ? 8 : 0);
    pet.totalPoints += pointsGain;
    pet.calcLevel();
    const now = new Date();

    if (FOOD_ACTIONS.includes(action)) {
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
      inventory: { food: up.food, meat: up.meat||0, fish: up.fish||0, seed: up.seed||0, treat: up.treat||0, water: up.water, fertilizer: up.fertilizer },
      pointsGain, isFavorite
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ BADGES ═══

const BADGES_CATALOG = [
  // ═══ TASKS (15) ═══
  { id: 'first_task',     name: 'Bước đầu tiên',       emoji: '⭐',  desc: 'Hoàn thành 1 task đầu tiên',     requirement: 'Hoàn thành 1 task', check: 'tasks', threshold: 1 },
  { id: 'task_5',         name: 'Khởi động',            emoji: '🌟',  desc: 'Hoàn thành 5 tasks',             requirement: 'Hoàn thành 5 tasks', check: 'tasks', threshold: 5 },
  { id: 'task_10',        name: 'Chăm chỉ',             emoji: '✨',  desc: 'Hoàn thành 10 tasks',            requirement: 'Hoàn thành 10 tasks', check: 'tasks', threshold: 10 },
  { id: 'task_25',        name: 'Kiên trì',             emoji: '💪',  desc: 'Hoàn thành 25 tasks',            requirement: 'Hoàn thành 25 tasks', check: 'tasks', threshold: 25 },
  { id: 'task_50',        name: 'Siêu năng suất',       emoji: '💫',  desc: 'Hoàn thành 50 tasks',            requirement: 'Hoàn thành 50 tasks', check: 'tasks', threshold: 50 },
  { id: 'task_75',        name: 'Chiến binh',           emoji: '⚔️', desc: 'Hoàn thành 75 tasks',            requirement: 'Hoàn thành 75 tasks', check: 'tasks', threshold: 75 },
  { id: 'task_100',       name: 'Huyền thoại',          emoji: '🏆',  desc: 'Hoàn thành 100 tasks',           requirement: 'Hoàn thành 100 tasks', check: 'tasks', threshold: 100 },
  { id: 'task_200',       name: 'Bền bỉ phi thường',    emoji: '🦾',  desc: 'Hoàn thành 200 tasks',           requirement: 'Hoàn thành 200 tasks', check: 'tasks', threshold: 200 },
  { id: 'task_300',       name: 'Máy nghiền việc',      emoji: '⚙️', desc: 'Hoàn thành 300 tasks',           requirement: 'Hoàn thành 300 tasks', check: 'tasks', threshold: 300 },
  { id: 'task_500',       name: 'Không gì cản nổi',     emoji: '👑',  desc: 'Hoàn thành 500 tasks',           requirement: 'Hoàn thành 500 tasks', check: 'tasks', threshold: 500 },
  { id: 'task_750',       name: 'Siêu nhân năng suất',  emoji: '🦸',  desc: 'Hoàn thành 750 tasks',           requirement: 'Hoàn thành 750 tasks', check: 'tasks', threshold: 750 },
  { id: 'task_1000',      name: 'Thiên sứ kỷ luật',     emoji: '👼',  desc: 'Hoàn thành 1000 tasks',          requirement: 'Hoàn thành 1000 tasks', check: 'tasks', threshold: 1000 },
  { id: 'task_1500',      name: 'Huyền thoại bất tử',   emoji: '🐉',  desc: 'Hoàn thành 1500 tasks',          requirement: 'Hoàn thành 1500 tasks', check: 'tasks', threshold: 1500 },
  { id: 'task_2000',      name: 'Thần thoại',           emoji: '🌌',  desc: 'Hoàn thành 2000 tasks',          requirement: 'Hoàn thành 2000 tasks', check: 'tasks', threshold: 2000 },
  { id: 'task_5000',      name: 'Bất khả chiến bại',    emoji: '🏛️', desc: 'Hoàn thành 5000 tasks',          requirement: 'Hoàn thành 5000 tasks', check: 'tasks', threshold: 5000 },

  // ═══ STREAKS (15) ═══
  { id: 'streak_3',       name: 'Tia lửa',              emoji: '🕯️', desc: 'Streak 3 ngày liên tiếp',        requirement: '3 ngày liên tiếp', check: 'streak', threshold: 3 },
  { id: 'streak_5',       name: 'Ngọn nến',             emoji: '🔆',  desc: 'Streak 5 ngày liên tiếp',        requirement: '5 ngày liên tiếp', check: 'streak', threshold: 5 },
  { id: 'streak_7',       name: 'Tuần lửa',             emoji: '🔥',  desc: 'Streak 7 ngày liên tiếp',        requirement: '7 ngày liên tiếp', check: 'streak', threshold: 7 },
  { id: 'streak_10',      name: 'Bền bỉ',               emoji: '🌟',  desc: 'Streak 10 ngày liên tiếp',       requirement: '10 ngày liên tiếp', check: 'streak', threshold: 10 },
  { id: 'streak_14',      name: 'Hai tuần thép',         emoji: '⚡',  desc: 'Streak 14 ngày liên tiếp',       requirement: '14 ngày liên tiếp', check: 'streak', threshold: 14 },
  { id: 'streak_21',      name: 'Ba tuần vàng',          emoji: '🥇',  desc: 'Streak 21 ngày liên tiếp',       requirement: '21 ngày liên tiếp', check: 'streak', threshold: 21 },
  { id: 'streak_30',      name: 'Tháng thép',            emoji: '💎',  desc: 'Streak 30 ngày liên tiếp',       requirement: '30 ngày liên tiếp', check: 'streak', threshold: 30 },
  { id: 'streak_45',      name: 'Ý chí sắt đá',         emoji: '🗡️', desc: 'Streak 45 ngày liên tiếp',       requirement: '45 ngày liên tiếp', check: 'streak', threshold: 45 },
  { id: 'streak_60',      name: 'Hai tháng thần kỳ',    emoji: '🌊',  desc: 'Streak 60 ngày liên tiếp',       requirement: '60 ngày liên tiếp', check: 'streak', threshold: 60 },
  { id: 'streak_90',      name: 'Quý vàng',              emoji: '💠',  desc: 'Streak 90 ngày liên tiếp',       requirement: '90 ngày liên tiếp', check: 'streak', threshold: 90 },
  { id: 'streak_120',     name: 'Bốn tháng kiên cường', emoji: '🛡️', desc: 'Streak 120 ngày liên tiếp',      requirement: '120 ngày liên tiếp', check: 'streak', threshold: 120 },
  { id: 'streak_180',     name: 'Nửa năm huyền thoại',  emoji: '🌋',  desc: 'Streak 180 ngày liên tiếp',      requirement: '180 ngày liên tiếp', check: 'streak', threshold: 180 },
  { id: 'streak_270',     name: 'Chín tháng thần thánh',emoji: '🏔️', desc: 'Streak 270 ngày liên tiếp',      requirement: '270 ngày liên tiếp', check: 'streak', threshold: 270 },
  { id: 'streak_365',     name: 'Một năm hoàn hảo',     emoji: '🌍',  desc: 'Streak 365 ngày — trọn 1 năm!',  requirement: '365 ngày liên tiếp', check: 'streak', threshold: 365 },
  { id: 'streak_500',     name: 'Siêu nhân kỷ luật',    emoji: '🦅',  desc: 'Streak 500 ngày liên tiếp',      requirement: '500 ngày liên tiếp', check: 'streak', threshold: 500 },

  // ═══ PETS & PLANTS (15) ═══
  { id: 'first_pet',      name: 'Chủ nhân đầu tiên',    emoji: '🐾',  desc: 'Mua thú cưng/cây đầu tiên',     requirement: 'Mua 1 thú cưng hoặc cây', check: 'pets', threshold: 1 },
  { id: 'pet_2',          name: 'Bạn đồng hành',        emoji: '🤝',  desc: 'Sở hữu 2 thú cưng/cây',         requirement: 'Mua 2 thú cưng hoặc cây', check: 'pets', threshold: 2 },
  { id: 'pet_3',          name: 'Nhà sưu tập nhỏ',      emoji: '🎪',  desc: 'Sở hữu 3 thú cưng/cây',         requirement: 'Mua 3 thú cưng hoặc cây', check: 'pets', threshold: 3 },
  { id: 'pet_5',          name: 'Vườn thú mini',        emoji: '🏡',  desc: 'Sở hữu 5 thú cưng/cây',         requirement: 'Mua 5 thú cưng hoặc cây', check: 'pets', threshold: 5 },
  { id: 'pet_7',          name: 'Trang trại nhỏ',       emoji: '🌾',  desc: 'Sở hữu 7 thú cưng/cây',         requirement: 'Mua 7 thú cưng hoặc cây', check: 'pets', threshold: 7 },
  { id: 'pet_10',         name: 'Vương quốc động vật',  emoji: '🦁',  desc: 'Sở hữu 10 thú cưng/cây',        requirement: 'Mua 10 thú cưng hoặc cây', check: 'pets', threshold: 10 },
  { id: 'pet_13',         name: 'Sưu tập trọn bộ',     emoji: '🎭',  desc: 'Sở hữu tất cả 13 loại',         requirement: 'Mua đủ 13 loại', check: 'pets', threshold: 13 },

  // ═══ POINTS (15) ═══
  { id: 'points_50',      name: 'Hạt giống',            emoji: '🌰',  desc: 'Kiếm được 50 điểm',             requirement: 'Tích lũy 50 điểm', check: 'points', threshold: 50 },
  { id: 'points_100',     name: 'Tiết kiệm',            emoji: '💵',  desc: 'Kiếm được 100 điểm',            requirement: 'Tích lũy 100 điểm', check: 'points', threshold: 100 },
  { id: 'points_250',     name: 'Kho báu nhỏ',          emoji: '💰',  desc: 'Kiếm được 250 điểm',            requirement: 'Tích lũy 250 điểm', check: 'points', threshold: 250 },
  { id: 'points_500',     name: 'Tỷ phú nhỏ',           emoji: '🏦',  desc: 'Kiếm được 500 điểm',            requirement: 'Tích lũy 500 điểm', check: 'points', threshold: 500 },
  { id: 'points_1000',    name: 'Đại gia',               emoji: '🤑',  desc: 'Kiếm được 1000 điểm',           requirement: 'Tích lũy 1000 điểm', check: 'points', threshold: 1000 },
  { id: 'points_2000',    name: 'Triệu phú',             emoji: '💎',  desc: 'Kiếm được 2000 điểm',           requirement: 'Tích lũy 2000 điểm', check: 'points', threshold: 2000 },
  { id: 'points_5000',    name: 'Tỷ phú',                emoji: '🏰',  desc: 'Kiếm được 5000 điểm',           requirement: 'Tích lũy 5000 điểm', check: 'points', threshold: 5000 },
  { id: 'points_10000',   name: 'Huyền thoại giàu có',  emoji: '👑',  desc: 'Kiếm được 10000 điểm',          requirement: 'Tích lũy 10000 điểm', check: 'points', threshold: 10000 },

  // ═══ GOALS (10) ═══
  { id: 'first_goal',     name: 'Có chí hướng',          emoji: '🎯',  desc: 'Hoàn thành 1 ngày mục tiêu',    requirement: 'Hoàn thành 1 ngày mục tiêu', check: 'goals', threshold: 1 },
  { id: 'goals_5',        name: 'Bền chí',               emoji: '🏹',  desc: 'Hoàn thành 5 ngày mục tiêu',    requirement: 'Hoàn thành 5 ngày mục tiêu', check: 'goals', threshold: 5 },
  { id: 'goals_10',       name: 'Quyết tâm',             emoji: '🎖️', desc: 'Hoàn thành 10 ngày mục tiêu',   requirement: 'Hoàn thành 10 ngày mục tiêu', check: 'goals', threshold: 10 },
  { id: 'goals_25',       name: 'Chiến lược gia',        emoji: '🧠',  desc: 'Hoàn thành 25 ngày mục tiêu',   requirement: 'Hoàn thành 25 ngày mục tiêu', check: 'goals', threshold: 25 },
  { id: 'goals_50',       name: 'Nhà chinh phục',        emoji: '🗻',  desc: 'Hoàn thành 50 ngày mục tiêu',   requirement: 'Hoàn thành 50 ngày mục tiêu', check: 'goals', threshold: 50 },
  { id: 'goals_100',      name: 'Bậc thầy mục tiêu',    emoji: '🏛️', desc: 'Hoàn thành 100 ngày mục tiêu',  requirement: 'Hoàn thành 100 ngày mục tiêu', check: 'goals', threshold: 100 },

  // ═══ HABITS (15) ═══
  { id: 'habit_streak_3', name: 'Thói quen mới',         emoji: '🌱',  desc: 'Streak thói quen 3 ngày',       requirement: '3 ngày liền 1 thói quen', check: 'habit_streak', threshold: 3 },
  { id: 'habit_streak_5', name: 'Đang hình thành',       emoji: '🌿',  desc: 'Streak thói quen 5 ngày',       requirement: '5 ngày liền 1 thói quen', check: 'habit_streak', threshold: 5 },
  { id: 'habit_streak_7', name: 'Thói quen vững',        emoji: '🐇',  desc: 'Streak thói quen 7 ngày',       requirement: '7 ngày liền 1 thói quen', check: 'habit_streak', threshold: 7 },
  { id: 'habit_streak_14',name: 'Nếp sống mới',          emoji: '🌸',  desc: 'Streak thói quen 14 ngày',      requirement: '14 ngày liền 1 thói quen', check: 'habit_streak', threshold: 14 },
  { id: 'habit_streak_21',name: 'Thói quen đã thành',    emoji: '🎋',  desc: 'Streak thói quen 21 ngày',      requirement: '21 ngày liền 1 thói quen', check: 'habit_streak', threshold: 21 },
  { id: 'habit_streak_30',name: 'Bậc thầy thói quen',   emoji: '🧘',  desc: 'Streak thói quen 30 ngày',      requirement: '30 ngày liền 1 thói quen', check: 'habit_streak', threshold: 30 },
  { id: 'habit_streak_60',name: 'Kỷ luật thép',          emoji: '⚔️', desc: 'Streak thói quen 60 ngày',      requirement: '60 ngày liền 1 thói quen', check: 'habit_streak', threshold: 60 },
  { id: 'habit_streak_90',name: 'Đạo quán thói quen',   emoji: '🏯',  desc: 'Streak thói quen 90 ngày',      requirement: '90 ngày liền 1 thói quen', check: 'habit_streak', threshold: 90 },
  { id: 'habit_streak_180',name:'Nửa năm bất bại',      emoji: '🐲',  desc: 'Streak thói quen 180 ngày',     requirement: '180 ngày liền 1 thói quen', check: 'habit_streak', threshold: 180 },
  { id: 'habit_streak_365',name:'Năm hoàn hảo',          emoji: '🌍',  desc: 'Streak thói quen 365 ngày',     requirement: '365 ngày liền 1 thói quen', check: 'habit_streak', threshold: 365 },

  // ═══ CARE (10) ═══
  { id: 'care_5',         name: 'Tay mới',               emoji: '🤲',  desc: 'Chăm sóc 5 lần',               requirement: 'Chăm sóc tổng 5 lần', check: 'care', threshold: 5 },
  { id: 'care_10',        name: 'Người chăm sóc',        emoji: '💝',  desc: 'Chăm sóc 10 lần',              requirement: 'Chăm sóc tổng 10 lần', check: 'care', threshold: 10 },
  { id: 'care_25',        name: 'Yêu thương',            emoji: '💗',  desc: 'Chăm sóc 25 lần',              requirement: 'Chăm sóc tổng 25 lần', check: 'care', threshold: 25 },
  { id: 'care_50',        name: 'Bàn tay vàng',          emoji: '🌈',  desc: 'Chăm sóc 50 lần',              requirement: 'Chăm sóc tổng 50 lần', check: 'care', threshold: 50 },
  { id: 'care_100',       name: 'Thiên thần hộ mệnh',   emoji: '😇',  desc: 'Chăm sóc 100 lần',             requirement: 'Chăm sóc tổng 100 lần', check: 'care', threshold: 100 },
  { id: 'care_200',       name: 'Bậc thầy nuôi dưỡng',  emoji: '🌻',  desc: 'Chăm sóc 200 lần',             requirement: 'Chăm sóc tổng 200 lần', check: 'care', threshold: 200 },
  { id: 'care_500',       name: 'Thánh chăm sóc',       emoji: '👼',  desc: 'Chăm sóc 500 lần',             requirement: 'Chăm sóc tổng 500 lần', check: 'care', threshold: 500 },

  // ═══ JOURNAL (8) ═══
  { id: 'journal_1',      name: 'Nhật ký đầu tay',      emoji: '📝',  desc: 'Viết nhật ký đầu tiên',         requirement: 'Viết 1 nhật ký', check: 'journal', threshold: 1 },
  { id: 'journal_7',      name: 'Tuần ký',              emoji: '📒',  desc: 'Viết 7 nhật ký',                requirement: 'Viết 7 nhật ký', check: 'journal', threshold: 7 },
  { id: 'journal_14',     name: 'Người kể chuyện',      emoji: '📖',  desc: 'Viết 14 nhật ký',               requirement: 'Viết 14 nhật ký', check: 'journal', threshold: 14 },
  { id: 'journal_30',     name: 'Nhà văn mini',         emoji: '✍️', desc: 'Viết 30 nhật ký',               requirement: 'Viết 30 nhật ký', check: 'journal', threshold: 30 },
  { id: 'journal_60',     name: 'Biên niên sử',         emoji: '📚',  desc: 'Viết 60 nhật ký',               requirement: 'Viết 60 nhật ký', check: 'journal', threshold: 60 },
  { id: 'journal_100',    name: 'Đại sư ký ức',         emoji: '🏆',  desc: 'Viết 100 nhật ký',              requirement: 'Viết 100 nhật ký', check: 'journal', threshold: 100 },
  { id: 'journal_200',    name: 'Nhà sử học',           emoji: '🗂️', desc: 'Viết 200 nhật ký',              requirement: 'Viết 200 nhật ký', check: 'journal', threshold: 200 },
  { id: 'journal_365',    name: 'Nhật ký trọn năm',     emoji: '📜',  desc: 'Viết 365 nhật ký',              requirement: 'Viết 365 nhật ký', check: 'journal', threshold: 365 },
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
