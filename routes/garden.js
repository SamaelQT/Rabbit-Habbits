const express     = require('express');
const router      = express.Router();
const mongoose    = require('mongoose');
const GardenPlot  = require('../models/GardenPlot');
const GardenPlant = require('../models/GardenPlant');
const UserPoints  = require('../models/UserPoints');
const Pet         = require('../models/Pet');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

// ═══════════════════════════════════════════════════════
// STATIC CATALOGS
// ═══════════════════════════════════════════════════════

const GAME_DAY_HOURS = 12; // 1 game day = 12 real hours
const GRID_ROWS = 6;
const GRID_COLS = 5;

// stage cycles per category
// harvestable plants: fruiting → readyToHarvest = true, player must harvest
// ornamentals:        dormant → back to leafing automatically
const CYCLES = {
  vegetable: ['seed','sprout','leafing','growing','flowering','fruiting'],
  fruit:     ['seed','sprout','leafing','growing','flowering','fruiting'],
  flower:    ['seed','sprout','leafing','flowering','dormant'],
  fengshui:  ['seed','sprout','leafing','flowering','dormant'],
};

const PLANT_TYPES = [
  // ── PHONG THỦY (size: small / medium) ──────────────────────
  { id:'kim_tien',  name:'Cây Kim Tiền',    emoji:'🌿', category:'fengshui', size:'medium',
    price:40, stages:{seed:1,sprout:2,leafing:5,flowering:6,dormant:2},
    harvestable:false, harvestItem:null, waterDecay:7, nutrientDecay:4,
    desc:'Cây phong thủy hút tài lộc, lá tròn xanh bóng mang may mắn' },

  { id:'kim_ngan',  name:'Cây Kim Ngân',    emoji:'🌳', category:'fengshui', size:'medium',
    price:50, stages:{seed:1,sprout:3,leafing:6,flowering:7,dormant:3},
    harvestable:false, harvestItem:null, waterDecay:6, nutrientDecay:4,
    desc:'Tượng trưng sự giàu có, đặt bàn làm việc chiêu tài' },

  { id:'ngoc_bich', name:'Cây Ngọc Bích',   emoji:'🎍', category:'fengshui', size:'medium',
    price:55, stages:{seed:1,sprout:3,leafing:7,flowering:8,dormant:3},
    harvestable:false, harvestItem:null, waterDecay:6, nutrientDecay:5,
    desc:'Lá xanh ngọc, tượng trưng tiền bạc và hòa hợp' },

  { id:'phat_tai',  name:'Cây Phát Tài',    emoji:'🎋', category:'fengshui', size:'medium',
    price:45, stages:{seed:1,sprout:2,leafing:5,flowering:5,dormant:2},
    harvestable:false, harvestItem:null, waterDecay:7, nutrientDecay:4,
    desc:'Biểu tượng may mắn, phú quý, phát đạt' },

  { id:'truc_may',  name:'Trúc May Mắn',    emoji:'🪴', category:'fengshui', size:'small',
    price:30, stages:{seed:1,sprout:2,leafing:4,flowering:4,dormant:2},
    harvestable:false, harvestItem:null, waterDecay:8, nutrientDecay:3,
    desc:'Tre trúc nhỏ xinh, mang lại bình an và may mắn' },

  { id:'sen_da',    name:'Cây Sen Đá',       emoji:'🌵', category:'fengshui', size:'small',
    price:25, stages:{seed:1,sprout:2,leafing:6,flowering:5,dormant:3},
    harvestable:false, harvestItem:null, waterDecay:3, nutrientDecay:2,
    desc:'Sức khỏe dồi dào, rất dễ chăm, chịu khô hạn tốt' },

  // ── RAU (size: small) ────────────────────────────────────────
  { id:'ca_chua',   name:'Cà Chua',          emoji:'🍅', category:'vegetable', size:'small',
    price:20, stages:{seed:1,sprout:2,leafing:2,growing:3,flowering:2,fruiting:3},
    harvestable:true, harvestItem:'food', harvestPoints:8, waterDecay:10, nutrientDecay:7,
    desc:'Cà chua chín đỏ, thu hoạch được thức ăn cho thú cưng' },

  { id:'dua_leo',   name:'Dưa Leo',          emoji:'🥒', category:'vegetable', size:'small',
    price:20, stages:{seed:1,sprout:2,leafing:2,growing:4,flowering:2,fruiting:3},
    harvestable:true, harvestItem:'food', harvestPoints:8, waterDecay:11, nutrientDecay:7,
    desc:'Dưa leo xanh mát, cần tưới nhiều nước' },

  { id:'cai_xanh',  name:'Cải Xanh',         emoji:'🥬', category:'vegetable', size:'small',
    price:15, stages:{seed:1,sprout:1,leafing:2,growing:3,flowering:2,fruiting:2},
    harvestable:true, harvestItem:'food', harvestPoints:6, waterDecay:9, nutrientDecay:6,
    desc:'Rau cải ngọt mau thu hoạch, rất dễ trồng' },

  { id:'ca_rot',    name:'Cà Rốt',           emoji:'🥕', category:'vegetable', size:'small',
    price:18, stages:{seed:1,sprout:2,leafing:3,growing:4,flowering:2,fruiting:4},
    harvestable:true, harvestItem:'food', harvestPoints:8, waterDecay:8, nutrientDecay:6,
    desc:'Cà rốt ngọt bùi, rất được thỏ yêu thích' },

  { id:'hanh_la',   name:'Hành Lá',          emoji:'🧅', category:'vegetable', size:'small',
    price:12, stages:{seed:1,sprout:1,leafing:2,growing:2,flowering:1,fruiting:2},
    harvestable:true, harvestItem:'seed', harvestPoints:5, waterDecay:7, nutrientDecay:5,
    desc:'Hành lá nhanh thu hoạch nhất, chu kỳ ngắn' },

  { id:'rau_muong', name:'Rau Muống',        emoji:'🌱', category:'vegetable', size:'small',
    price:12, stages:{seed:1,sprout:1,leafing:2,growing:2,flowering:1,fruiting:2},
    harvestable:true, harvestItem:'food', harvestPoints:5, waterDecay:10, nutrientDecay:5,
    desc:'Rau muống tươi, cần nhiều nước, lớn rất nhanh' },

  // ── ĂN QUẢ (size: medium / large) ───────────────────────────
  { id:'dau_tay',   name:'Dâu Tây',          emoji:'🍓', category:'fruit', size:'small',
    price:45, stages:{seed:2,sprout:3,leafing:4,growing:5,flowering:4,fruiting:5},
    harvestable:true, harvestItem:'treat', harvestPoints:15, waterDecay:9, nutrientDecay:7,
    desc:'Dâu tây ngọt chua, quý hiếm và ngon miệng' },

  { id:'chanh',     name:'Cây Chanh',        emoji:'🍋', category:'fruit', size:'medium',
    price:50, stages:{seed:2,sprout:3,leafing:5,growing:7,flowering:5,fruiting:8},
    harvestable:true, harvestItem:'food', harvestPoints:18, waterDecay:8, nutrientDecay:6,
    desc:'Chanh tươi chua ngọt, trồng một lần thu hoạch nhiều mùa' },

  { id:'oi',        name:'Cây Ổi',           emoji:'🍈', category:'fruit', size:'large',
    price:55, stages:{seed:2,sprout:4,leafing:6,growing:8,flowering:6,fruiting:10},
    harvestable:true, harvestItem:'treat', harvestPoints:20, waterDecay:8, nutrientDecay:7,
    desc:'Ổi thơm ngon, cây lớn cần chậu rộng để phát triển' },

  { id:'cam',       name:'Cây Cam',          emoji:'🍊', category:'fruit', size:'large',
    price:60, stages:{seed:2,sprout:4,leafing:7,growing:9,flowering:7,fruiting:10},
    harvestable:true, harvestItem:'treat', harvestPoints:22, waterDecay:8, nutrientDecay:7,
    desc:'Cam chín vàng óng, mọng nước, thú cưng rất thích' },

  { id:'xoai',      name:'Cây Xoài',         emoji:'🥭', category:'fruit', size:'large',
    price:70, stages:{seed:3,sprout:5,leafing:8,growing:10,flowering:8,fruiting:12},
    harvestable:true, harvestItem:'treat', harvestPoints:25, waterDecay:7, nutrientDecay:7,
    desc:'Xoài ngọt đặc trưng, cây lớn đẹp, quả nhiều' },

  { id:'chuoi',     name:'Cây Chuối',        emoji:'🍌', category:'fruit', size:'large',
    price:65, stages:{seed:2,sprout:4,leafing:7,growing:9,flowering:7,fruiting:10},
    harvestable:true, harvestItem:'food', harvestPoints:22, waterDecay:9, nutrientDecay:8,
    desc:'Chuối vàng ngọt bùi, cây nhanh cho trái nhất trong nhóm to' },

  // ── HOA (size: small / medium / large) ─────────────────────
  { id:'huong_duong',name:'Hướng Dương',     emoji:'🌻', category:'flower', size:'medium',
    price:35, stages:{seed:1,sprout:2,leafing:4,flowering:7,dormant:2},
    harvestable:false, harvestItem:null, waterDecay:8, nutrientDecay:5,
    desc:'Hoa hướng dương rực rỡ, luôn quay về phía mặt trời' },

  { id:'hoa_hong',  name:'Hoa Hồng',         emoji:'🌹', category:'flower', size:'medium',
    price:40, stages:{seed:1,sprout:2,leafing:4,flowering:6,dormant:2},
    harvestable:true, harvestItem:'rose', harvestPoints:12, waterDecay:8, nutrientDecay:6,
    desc:'Hoa hồng tươi thắm, thu hoạch được hoa tặng bạn bè' },

  { id:'tulip',     name:'Hoa Tulip',        emoji:'🌷', category:'flower', size:'small',
    price:30, stages:{seed:1,sprout:2,leafing:3,flowering:5,dormant:2},
    harvestable:false, harvestItem:null, waterDecay:7, nutrientDecay:4,
    desc:'Tulip sắc màu rực rỡ, thanh lịch và sang trọng' },

  { id:'cuc_vang',  name:'Hoa Cúc Vàng',    emoji:'🌼', category:'flower', size:'small',
    price:25, stages:{seed:1,sprout:2,leafing:3,flowering:5,dormant:2},
    harvestable:false, harvestItem:null, waterDecay:7, nutrientDecay:4,
    desc:'Cúc vàng tươi sáng, biểu tượng của niềm vui' },

  { id:'lavender',  name:'Hoa Lavender',     emoji:'💜', category:'flower', size:'small',
    price:35, stages:{seed:1,sprout:2,leafing:4,flowering:6,dormant:3},
    harvestable:false, harvestItem:null, waterDecay:5, nutrientDecay:4,
    desc:'Lavender tím thơm nhẹ, giúp thư giãn và dễ chịu' },

  { id:'hoa_giay',  name:'Hoa Giấy',         emoji:'🌸', category:'flower', size:'large',
    price:45, stages:{seed:1,sprout:3,leafing:5,flowering:8,dormant:3},
    harvestable:false, harvestItem:null, waterDecay:6, nutrientDecay:5,
    desc:'Hoa giấy đỏ rực, leo giàn đẹp, nở hoa quanh năm' },
];

const POT_TYPES = [
  { id:'pot_s',  name:'Chậu Đất Nhỏ',  emoji:'🪴', size:'small',  price:20,
    desc:'Phù hợp cây nhỏ. Cây vừa/lớn sẽ bị bó rễ, chậm lớn.' },
  { id:'pot_m',  name:'Chậu Gốm',      emoji:'🏺', size:'medium', price:40,
    desc:'Phù hợp cây vừa. Đa năng nhất cho hầu hết loại cây.' },
  { id:'pot_l',  name:'Chậu Gỗ',       emoji:'🪵', size:'large',  price:80,
    desc:'Phù hợp cây to. Cây nhỏ dễ bị úng rễ vì quá ẩm.' },
  { id:'pot_xl', name:'Chậu Sứ Lớn',   emoji:'🏛️', size:'xl',    price:150,
    desc:'Cây ăn quả lớn. Bonus +5% tốc độ tất cả cây. Đẹp nhất.' },
];

// ── Helpers ─────────────────────────────────────────────────
function cellPrice(row, col) {
  // Distance from center (2.5, 2) using Chebyshev
  const dr = Math.abs(row - 2.5), dc = Math.abs(col - 2);
  const dist = Math.max(dr, dc);
  if (dist <= 1) return 80;
  if (dist <= 2) return 50;
  return 30;
}

function getPotMult(plantSize, potSize) {
  const idx = { small:0, medium:1, large:2, xl:3 };
  const pi = idx[plantSize] ?? 1, pot = idx[potSize] ?? 1;
  const diff = Math.abs(pi - pot);
  if (potSize === 'xl') return diff === 0 ? 1.25 : diff === 1 ? 1.05 : 0.8;
  if (diff === 0) return 1.2;
  if (diff === 1) return 0.85;
  if (diff === 2) return 0.6;
  return 0.4;
}

function getNextStage(stage, plantType) {
  const cat   = plantType.category;
  const cycle = CYCLES[cat] || CYCLES.fengshui;
  const idx   = cycle.indexOf(stage);
  if (idx === -1) return cycle[0];
  const next  = cycle[(idx + 1) % cycle.length];
  return next;
}

function getPlantType(id) { return PLANT_TYPES.find(p => p.id === id) || null; }
function getPotType(id)   { return POT_TYPES.find(p => p.id === id) || null;   }

function getGameTime() {
  const now = new Date();
  const h   = now.getHours() + now.getMinutes() / 60;
  let phase, label, icon;
  if      (h >= 7.5  && h < 10)  { phase='morning';   label='Sáng sớm';  icon='🌅'; }
  else if (h >= 10   && h < 14)  { phase='noon';      label='Buổi trưa'; icon='☀️'; }
  else if (h >= 14   && h < 17)  { phase='afternoon'; label='Buổi chiều';icon='🌤️'; }
  else if (h >= 17   && h < 19.5){ phase='evening';   label='Chiều tối'; icon='🌇'; }
  else                            { phase='night';     label='Ban đêm';   icon='🌙'; }
  return { hour: Math.round(h * 10) / 10, phase, label, icon };
}

// ── Growth Tick (lazy — runs on every GET /api/garden) ──────
function applyTick(plant, plantType, potType) {
  if (!plant.isAlive) return false;

  const now       = Date.now();
  const lastTick  = plant.lastTickAt ? new Date(plant.lastTickAt).getTime() : now;
  const hoursElapsed = Math.min((now - lastTick) / 3_600_000, 48); // cap 48h to prevent huge jumps
  if (hoursElapsed < 0.25) return false; // skip if less than 15 min

  const gameDays = hoursElapsed / GAME_DAY_HOURS;
  const speedMult = getPotMult(plantType.size, potType?.size || 'medium');

  // ── Water decay ──────────────────────────────────────────
  plant.waterLevel = Math.max(0, plant.waterLevel - plantType.waterDecay * gameDays);

  // ── Nutrient decay ───────────────────────────────────────
  plant.nutrientLevel = Math.max(0, plant.nutrientLevel - plantType.nutrientDecay * gameDays);

  // ── Bug spawn (~15% chance per game day) ─────────────────
  if (Math.random() < 0.15 * gameDays) {
    plant.bugs = Math.min(10, plant.bugs + 1);
  }

  // ── Dead leaves accumulate slowly ────────────────────────
  if (Math.random() < 0.08 * gameDays) {
    plant.deadLeaves = Math.min(10, plant.deadLeaves + 1);
  }

  // ── Health penalties ─────────────────────────────────────
  let dmg = 0;
  if (plant.waterLevel    < 20) dmg += 6  * gameDays;
  if (plant.waterLevel    ===0) dmg += 12 * gameDays;
  if (plant.nutrientLevel < 20) dmg += 3  * gameDays;
  if (plant.bugs          >= 3)  dmg += 8  * gameDays;
  if (plant.bugs          >= 6)  dmg += 15 * gameDays;
  if (plant.deadLeaves    >= 5)  dmg += 5  * gameDays;

  // ── Health recovery if all good ──────────────────────────
  if (plant.waterLevel > 60 && plant.nutrientLevel > 60 && plant.bugs === 0) {
    plant.health = Math.min(100, plant.health + 2 * gameDays);
  }

  plant.health = Math.max(0, plant.health - dmg);

  if (plant.health <= 0) {
    plant.isAlive = false;
    plant.lastTickAt = new Date(now);
    return true;
  }

  // ── Stage advancement (only if health > 20) ──────────────
  if (plant.health > 20) {
    const hoursSinceStage = (now - new Date(plant.stageStartedAt).getTime()) / 3_600_000;
    const gameDaysInStage = (hoursSinceStage / GAME_DAY_HOURS) * speedMult;
    const stageDuration   = plantType.stages[plant.stage] || 99;

    if (gameDaysInStage >= stageDuration) {
      const next = getNextStage(plant.stage, plantType);

      if (plantType.harvestable && plant.stage === 'fruiting') {
        // Must wait for player to harvest — don't auto-advance
        plant.readyToHarvest = true;
      } else {
        plant.stage         = next;
        plant.stageStartedAt= new Date(now);
        plant.readyToHarvest= false;
        if (next === 'seed') plant.cycleCount++; // completed a full cycle (vegetable restart)
      }
    }
  }

  plant.lastTickAt = new Date(now);
  return true;
}

// ══════════════════════════════════════════════════════════════
// MIGRATION — refund old plant pets
// ══════════════════════════════════════════════════════════════
async function migrateOldPlants(userId) {
  const PLANT_PET_TYPES = ['tree','flower','tree2','flower2','flower3','kim_ngan','ngoc_bich','van_loc'];
  const REFUND_RATE = 0.7; // 70% refund

  const ORIGINAL_PRICES = {
    tree:40, kim_ngan:50, ngoc_bich:55, flower:45,
    van_loc:60, tree2:35, flower2:50, flower3:55,
  };

  const oldPlants = await Pet.find({ userId, type: { $in: PLANT_PET_TYPES } });
  if (!oldPlants.length) return 0;

  let refund = 0;
  for (const p of oldPlants) {
    refund += Math.floor((ORIGINAL_PRICES[p.type] || 40) * REFUND_RATE);
  }
  await Pet.deleteMany({ userId, type: { $in: PLANT_PET_TYPES } });

  // Credit points
  let up = await UserPoints.findOne({ userId });
  if (!up) up = new UserPoints({ userId });
  up.points     = (up.points     || 0) + refund;
  up.totalEarned= (up.totalEarned|| 0) + refund;
  await up.save();

  return refund;
}

// ══════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/garden — full garden state (runs tick, handles migration)
router.get('/', async (req, res) => {
  try {
    const uid = req.userId;

    // 1. Migration: refund old plant pets (runs once)
    let migrationMsg = null;
    let gardenDoc = await GardenPlot.findOne({ userId: uid });
    if (!gardenDoc) {
      gardenDoc = new GardenPlot({ userId: uid, purchasedCells: [] });
    }
    if (!gardenDoc.migrationDone) {
      const refunded = await migrateOldPlants(uid);
      gardenDoc.migrationDone = true;
      if (refunded > 0) migrationMsg = refunded;
      await gardenDoc.save();
    }

    // 2. Load plants + apply tick
    const plants = await GardenPlant.find({ userId: uid });
    const dirty  = [];
    for (const p of plants) {
      const pt  = getPlantType(p.plantTypeId);
      const pot = getPotType(p.potTypeId);
      if (!pt) continue;
      const changed = applyTick(p, pt, pot);
      if (changed) dirty.push(p.save());
    }
    if (dirty.length) await Promise.all(dirty);

    // 3. Build cell price grid
    const cellPrices = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      cellPrices[r] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        cellPrices[r][c] = cellPrice(r, c);
      }
    }

    // 4. Enrich plants with type info
    const enriched = plants.map(p => ({
      ...p.toObject(),
      plantType: getPlantType(p.plantTypeId),
      potType:   getPotType(p.potTypeId),
    }));

    res.json({
      purchasedCells: gardenDoc.purchasedCells,
      plants: enriched,
      gridConfig: { rows: GRID_ROWS, cols: GRID_COLS },
      cellPrices,
      gameTime: getGameTime(),
      migrationRefund: migrationMsg,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/garden/catalog — plant + pot catalog for shop
router.get('/catalog', (req, res) => {
  res.json({ plants: PLANT_TYPES, pots: POT_TYPES });
});

// POST /api/garden/plots/buy — purchase a grid cell
router.post('/plots/buy', async (req, res) => {
  try {
    const { row, col } = req.body;
    if (row == null || col == null || row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) {
      return res.status(400).json({ error: 'Ô đất không hợp lệ' });
    }

    let gardenDoc = await GardenPlot.findOne({ userId: req.userId });
    if (!gardenDoc) gardenDoc = new GardenPlot({ userId: req.userId, purchasedCells: [] });

    const already = gardenDoc.purchasedCells.find(c => c.row === row && c.col === col);
    if (already) return res.status(400).json({ error: 'Ô này đã được mua rồi' });

    const price = cellPrice(row, col);
    const up    = await UserPoints.findOne({ userId: req.userId });
    if (!up || up.points < price) {
      return res.status(400).json({ error: `Không đủ điểm (cần ${price} điểm)` });
    }

    up.points -= price;
    await up.save();
    gardenDoc.purchasedCells.push({ row, col });
    await gardenDoc.save();

    res.json({ success: true, points: up.points, cell: { row, col, price } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/garden/plant — plant a plant in a purchased cell
router.post('/plant', async (req, res) => {
  try {
    const { row, col, plantTypeId, potTypeId } = req.body;
    const pt  = getPlantType(plantTypeId);
    const pot = getPotType(potTypeId);
    if (!pt)  return res.status(400).json({ error: 'Loại cây không hợp lệ' });
    if (!pot) return res.status(400).json({ error: 'Loại chậu không hợp lệ' });

    // Verify cell is purchased
    const gardenDoc = await GardenPlot.findOne({ userId: req.userId });
    const owned = gardenDoc?.purchasedCells.find(c => c.row === row && c.col === col);
    if (!owned) return res.status(400).json({ error: 'Bạn chưa mua ô đất này' });

    // Check cell is empty
    const existing = await GardenPlant.findOne({ userId: req.userId, row, col });
    if (existing && existing.isAlive) {
      return res.status(400).json({ error: 'Ô này đã có cây rồi' });
    }

    // Deduct cost (plant + pot)
    const totalCost = pt.price + pot.price;
    const up = await UserPoints.findOne({ userId: req.userId });
    if (!up || up.points < totalCost) {
      return res.status(400).json({ error: `Không đủ điểm (cần ${totalCost} điểm)` });
    }
    up.points -= totalCost;
    await up.save();

    // Remove dead plant in slot if any
    if (existing) await GardenPlant.deleteOne({ _id: existing._id });

    const plant = new GardenPlant({
      userId: req.userId, row, col,
      plantTypeId, potTypeId,
      plantedAt: new Date(), stageStartedAt: new Date(), lastTickAt: new Date(),
      waterLevel: 70, nutrientLevel: 70,
    });
    await plant.save();

    res.status(201).json({
      success: true, points: up.points,
      plant: { ...plant.toObject(), plantType: pt, potType: pot }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/garden/water/:id — water a plant (costs 1 water item or points)
router.post('/water/:id', async (req, res) => {
  try {
    const plant = await GardenPlant.findOne({ _id: req.params.id, userId: req.userId });
    if (!plant || !plant.isAlive) return res.status(404).json({ error: 'Không tìm thấy cây' });

    // Use water item from inventory if available, otherwise cost 2 pts
    const up = await UserPoints.findOne({ userId: req.userId });
    let usedItem = false;
    if (up && up.water > 0) {
      up.water--;
      usedItem = true;
    } else {
      if (!up || up.points < 2) return res.status(400).json({ error: 'Cần 1 nước 💧 hoặc 2 điểm' });
      up.points -= 2;
    }

    plant.waterLevel    = Math.min(100, plant.waterLevel + 40);
    plant.lastWateredAt = new Date();
    // Recover health a bit
    plant.health = Math.min(100, plant.health + 3);
    await Promise.all([plant.save(), up.save()]);

    res.json({ success: true, waterLevel: plant.waterLevel, health: plant.health,
               points: up.points, usedItem });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/garden/fertilize/:id — fertilize
router.post('/fertilize/:id', async (req, res) => {
  try {
    const plant = await GardenPlant.findOne({ _id: req.params.id, userId: req.userId });
    if (!plant || !plant.isAlive) return res.status(404).json({ error: 'Không tìm thấy cây' });

    const up = await UserPoints.findOne({ userId: req.userId });
    let usedItem = false;
    if (up && up.fertilizer > 0) {
      up.fertilizer--;
      usedItem = true;
    } else {
      if (!up || up.points < 3) return res.status(400).json({ error: 'Cần 1 phân bón 🌿 hoặc 3 điểm' });
      up.points -= 3;
    }

    plant.nutrientLevel    = Math.min(100, plant.nutrientLevel + 45);
    plant.lastFertilizedAt = new Date();
    plant.health = Math.min(100, plant.health + 2);
    await Promise.all([plant.save(), up.save()]);

    res.json({ success: true, nutrientLevel: plant.nutrientLevel, health: plant.health,
               points: up.points, usedItem });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/garden/catch-bug/:id — catch bugs
router.post('/catch-bug/:id', async (req, res) => {
  try {
    const plant = await GardenPlant.findOne({ _id: req.params.id, userId: req.userId });
    if (!plant || !plant.isAlive) return res.status(404).json({ error: 'Không tìm thấy cây' });
    if (plant.bugs === 0) return res.status(400).json({ error: 'Cây không có sâu' });

    const caught = Math.min(plant.bugs, 3); // catch up to 3 at once
    plant.bugs         = Math.max(0, plant.bugs - caught);
    plant.lastBugCaughtAt = new Date();
    // Small points reward for bug catching
    const up = await UserPoints.findOne({ userId: req.userId });
    if (up) { up.points += caught; await up.save(); }
    await plant.save();

    res.json({ success: true, bugs: plant.bugs, caught, points: up?.points });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/garden/remove-leaf/:id — remove dead leaves
router.post('/remove-leaf/:id', async (req, res) => {
  try {
    const plant = await GardenPlant.findOne({ _id: req.params.id, userId: req.userId });
    if (!plant || !plant.isAlive) return res.status(404).json({ error: 'Không tìm thấy cây' });
    if (plant.deadLeaves === 0) return res.status(400).json({ error: 'Cây không có lá hư' });

    const removed = plant.deadLeaves;
    plant.deadLeaves       = 0;
    plant.lastLeafRemovedAt = new Date();
    plant.health = Math.min(100, plant.health + 2);
    await plant.save();

    res.json({ success: true, deadLeaves: 0, removed, health: plant.health });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/garden/harvest/:id — harvest fruit/veg
router.post('/harvest/:id', async (req, res) => {
  try {
    const plant = await GardenPlant.findOne({ _id: req.params.id, userId: req.userId });
    if (!plant || !plant.isAlive) return res.status(404).json({ error: 'Không tìm thấy cây' });

    const pt = getPlantType(plant.plantTypeId);
    if (!pt?.harvestable)       return res.status(400).json({ error: 'Cây này không thu hoạch được' });
    if (!plant.readyToHarvest)  return res.status(400).json({ error: 'Cây chưa sẵn sàng thu hoạch' });

    // Award item + points
    const up = await UserPoints.findOne({ userId: req.userId });
    if (up) {
      if (pt.harvestItem && up[pt.harvestItem] !== undefined) {
        up[pt.harvestItem] = (up[pt.harvestItem] || 0) + 1;
      }
      const pts = pt.harvestPoints || 10;
      up.points      += pts;
      up.totalEarned = (up.totalEarned || 0) + pts;
      await up.save();
    }

    plant.harvestCount++;
    plant.lastHarvestedAt = new Date();
    plant.readyToHarvest  = false;
    // Restart cycle: vegetable goes back to seed, fruit tree goes back to flowering
    const isFruitTree = pt.category === 'fruit' && (pt.size === 'large' || pt.size === 'medium');
    plant.stage          = isFruitTree ? 'flowering' : 'seed';
    plant.stageStartedAt = new Date();
    plant.cycleCount++;
    await plant.save();

    res.json({
      success: true,
      harvestItem: pt.harvestItem,
      harvestPoints: pt.harvestPoints || 10,
      points: up?.points,
      inventory: up ? { [pt.harvestItem]: up[pt.harvestItem] } : {},
      plant: { ...plant.toObject(), plantType: pt }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/garden/plant/:id — remove/uproot a plant (partial refund)
router.delete('/plant/:id', async (req, res) => {
  try {
    const plant = await GardenPlant.findOne({ _id: req.params.id, userId: req.userId });
    if (!plant) return res.status(404).json({ error: 'Không tìm thấy cây' });

    const pt = getPlantType(plant.plantTypeId);
    // 50% refund if uprooted early, 30% if already dead
    const refundRate  = plant.isAlive ? 0.5 : 0.3;
    const refund      = Math.floor((pt?.price || 0) * refundRate);

    const up = await UserPoints.findOne({ userId: req.userId });
    if (up && refund > 0) {
      up.points += refund;
      await up.save();
    }

    await GardenPlant.deleteOne({ _id: plant._id });
    res.json({ success: true, refund, points: up?.points });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
