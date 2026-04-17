const express     = require('express');
const router      = express.Router();
const mongoose    = require('mongoose');
const GardenPlot  = require('../models/GardenPlot');
const GardenPlant = require('../models/GardenPlant');
const UserPoints  = require('../models/UserPoints');
const Pet         = require('../models/Pet');
const User        = require('../models/User');
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

// ═══════════════════════════════════════════════════════
// WEATHER SYSTEM
// ═══════════════════════════════════════════════════════

const WEATHER_TYPES = [
  { id:'sunny',  label:'Nắng đẹp',  emoji:'☀️',  desc:'Nước bay hơi nhanh hơn, cây phát triển tốt.',    prob:0.35 },
  { id:'cloudy', label:'Nhiều mây', emoji:'⛅',   desc:'Thời tiết trung tính, không ảnh hưởng đặc biệt.', prob:0.25 },
  { id:'rainy',  label:'Mưa nhẹ',   emoji:'🌧️',  desc:'Mưa tự tưới nước, nhưng sâu xuất hiện nhiều hơn.',prob:0.20 },
  { id:'stormy', label:'Giông bão', emoji:'⛈️',  desc:'Cây dễ bị thương, lá rụng nhiều, nhưng mưa lớn tưới no.',prob:0.05 },
  { id:'foggy',  label:'Sương mù',  emoji:'🌫️', desc:'Sâu xuất hiện nhiều, cây lớn chậm hơn.',          prob:0.10 },
  { id:'windy',  label:'Gió mạnh',  emoji:'💨',  desc:'Lá dễ rụng, nước bay hơi nhanh hơn chút.',       prob:0.05 },
];

function rollWeather() {
  const r = Math.random();
  let cum = 0;
  for (const w of WEATHER_TYPES) {
    cum += w.prob;
    if (r < cum) return w.id;
  }
  return 'sunny';
}

function getWeatherInfo(id) {
  return WEATHER_TYPES.find(w => w.id === id) || WEATHER_TYPES[0];
}

// Returns true if gardenDoc was modified (caller should save)
function updateWeather(gardenDoc) {
  const now   = Date.now();
  const setAt = gardenDoc.weatherSetAt ? new Date(gardenDoc.weatherSetAt).getTime() : 0;
  if (now - setAt > 6 * 3_600_000) {
    gardenDoc.weather      = rollWeather();
    gardenDoc.weatherSetAt = new Date(now);
    // Force ecosystem recalculation on weather change
    if (gardenDoc.ecosystem) gardenDoc.ecosystem.lastEcoUpdate = null;
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════
// ECOSYSTEM SYSTEM
// ═══════════════════════════════════════════════════════

// Updates ecosystem creature presence based on current plant states + time of day + weather.
// Returns true if gardenDoc.ecosystem was modified.
function updateEcosystem(gardenDoc, plants, gameTime, weather = 'sunny') {
  const now     = Date.now();
  const eco     = gardenDoc.ecosystem || {};
  const lastUpd = eco.lastEcoUpdate ? new Date(eco.lastEcoUpdate).getTime() : 0;

  // Rate-limit to every 6 real hours
  if (now - lastUpd < 6 * 3_600_000) return false;

  const alive    = plants.filter(p => p.isAlive);
  const blooming = alive.filter(p => ['flowering','fruiting'].includes(p.stage));
  const sick     = alive.filter(p => p.health < 40 || p.deadLeaves >= 5);
  const buggy    = alive.filter(p => p.bugs > 0);
  const lush     = alive.filter(p => p.waterLevel > 60 && p.nutrientLevel > 60);

  // ── Weather-based chance modifiers ───────────────────────────
  let beeChanceMult  = 1;
  let birdChanceMult = 1;
  let batChanceMult  = 1;
  let mushChanceMult = 1;
  let wormChanceMult = 1;
  let forceNoBees    = false;
  let forceNoBirds   = false;
  let forceNoBats    = false;

  switch (weather) {
    case 'sunny':
      beeChanceMult  = 1.35; // Bees love sunshine
      wormChanceMult = 0.85; // Soil dries, fewer worms
      break;
    case 'cloudy':
      beeChanceMult  = 0.85; // Overcast, less flower activity
      break;
    case 'rainy':
      beeChanceMult  = 0.70; // Bees avoid rain
      forceNoBirds   = true;  // Birds hide from rain
      wormChanceMult = 1.50; // Worms love wet soil
      mushChanceMult = 1.40; // Mushrooms thrive in moisture
      break;
    case 'stormy':
      forceNoBees    = true;  // Storm drives away bees
      forceNoBirds   = true;  // Birds shelter from storm
      forceNoBats    = true;  // Bats shelter too
      wormChanceMult = 1.70; // Worms flood to surface
      mushChanceMult = 1.70; // Mushrooms surge after storm
      break;
    case 'foggy':
      beeChanceMult  = 0.55; // Fog disorients bees
      mushChanceMult = 1.60; // Fog is mushroom paradise
      break;
    case 'windy':
      beeChanceMult  = 0.65; // Wind disrupts bee flight
      birdChanceMult = 0.70; // Birds struggle in wind
      break;
  }

  // ── Ong (Bees): appear near flowering plants ─────────────────
  if (forceNoBees) {
    eco.bees = 0;
  } else if (blooming.length > 0) {
    const chance = Math.min(0.85, 0.25 * blooming.length * beeChanceMult);
    if (Math.random() < chance) eco.bees = Math.min(5, (eco.bees || 0) + 1);
  } else {
    eco.bees = Math.max(0, (eco.bees || 0) - 1);
  }

  // ── Chim (Birds): appear in morning if bugs present ──────────
  if (forceNoBirds) {
    eco.birds = false;
  } else if (gameTime.phase === 'morning' && buggy.length > 0) {
    eco.birds = Math.random() < 0.45 * birdChanceMult;
  } else if (['evening','night'].includes(gameTime.phase)) {
    eco.birds = false;
  }

  // ── Dơi (Bats): appear at night ──────────────────────────────
  if (forceNoBats) {
    eco.bats = false;
  } else if (gameTime.phase === 'night') {
    eco.bats = Math.random() < 0.4 * batChanceMult;
  } else if (gameTime.phase !== 'evening') {
    eco.bats = false;
  }

  // ── Nấm (Mushrooms): appear near sick/struggling plants ──────
  if (sick.length > 0 || weather === 'rainy' || weather === 'stormy' || weather === 'foggy') {
    const baseChance = sick.length > 0 ? 0.30 : 0.12;
    if (Math.random() < baseChance * mushChanceMult) {
      eco.mushrooms = Math.min(5, (eco.mushrooms || 0) + 1);
    }
  } else {
    eco.mushrooms = Math.max(0, (eco.mushrooms || 0) - 1);
  }

  // ── Giun (Worms): appear when soil is lush or wet ────────────
  const wormThreshold = weather === 'rainy' || weather === 'stormy' ? 1 : 2;
  if (lush.length >= wormThreshold) {
    if (Math.random() < 0.35 * wormChanceMult) eco.worms = Math.min(3, (eco.worms || 0) + 1);
  } else {
    eco.worms = Math.max(0, (eco.worms || 0) - 1);
  }

  eco.lastEcoUpdate   = new Date(now);
  gardenDoc.ecosystem = eco;
  return true;
}

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
function applyTick(plant, plantType, potType, weather = 'sunny', ecosystem = {}) {
  if (!plant.isAlive) return false;

  const now       = Date.now();
  const lastTick  = plant.lastTickAt ? new Date(plant.lastTickAt).getTime() : now;
  const hoursElapsed = Math.min((now - lastTick) / 3_600_000, 48); // cap 48h
  if (hoursElapsed < 0.25) return false; // skip < 15 min

  const gameDays = hoursElapsed / GAME_DAY_HOURS;
  const baseMult = getPotMult(plantType.size, potType?.size || 'medium');

  // ── Weather modifiers ────────────────────────────────────
  let waterDecayMult  = 1;
  let bugChanceMult   = 1;
  let autoWaterPerGD  = 0;   // auto-water from rain (per game day)
  let stormDmgPerGD   = 0;   // storm health damage
  let leafChanceBase  = 0.08;

  switch (weather) {
    case 'sunny':  waterDecayMult = 1.3;                                        break;
    case 'cloudy': /* neutral */                                                 break;
    case 'rainy':  waterDecayMult = 0.5; autoWaterPerGD = 8;  bugChanceMult = 1.2; break;
    case 'stormy': waterDecayMult = 0.5; autoWaterPerGD = 15; bugChanceMult = 1.5;
                   stormDmgPerGD  = 4;   leafChanceBase = 0.18;                 break;
    case 'foggy':  bugChanceMult  = 1.6; waterDecayMult = 0.9;                  break;
    case 'windy':  waterDecayMult = 1.1; leafChanceBase = 0.14;                 break;
  }

  // ── Ecosystem modifiers ──────────────────────────────────
  // Birds & bats reduce bug chance; worms reduce nutrient decay
  if (ecosystem.birds) bugChanceMult *= 0.55;
  if (ecosystem.bats)  bugChanceMult *= 0.50;
  const wormNutrMult = ecosystem.worms > 0 ? Math.max(0.6, 1 - (ecosystem.worms * 0.13)) : 1;

  // Bees boost speed on flowering/fruiting stages
  const beesSpeedBonus = (ecosystem.bees || 0) * 0.04; // +4% per bee
  const inBloom = ['flowering','fruiting'].includes(plant.stage);
  const speedMult = baseMult * (inBloom ? (1 + beesSpeedBonus) : 1);

  // ── Water decay (weather-modified) ──────────────────────
  plant.waterLevel = Math.max(0, plant.waterLevel - plantType.waterDecay * waterDecayMult * gameDays);

  // ── Auto-water from rain ─────────────────────────────────
  if (autoWaterPerGD > 0) {
    plant.waterLevel = Math.min(100, plant.waterLevel + autoWaterPerGD * gameDays);
  }

  // ── Nutrient decay (worm-modified) ──────────────────────
  plant.nutrientLevel = Math.max(0, plant.nutrientLevel - plantType.nutrientDecay * wormNutrMult * gameDays);

  // ── Bug spawn ────────────────────────────────────────────
  if (Math.random() < 0.15 * bugChanceMult * gameDays) {
    plant.bugs = Math.min(10, plant.bugs + 1);
  }

  // ── Birds / bats eat existing bugs ──────────────────────
  if (plant.bugs > 0) {
    if (ecosystem.birds && Math.random() < 0.40 * gameDays) plant.bugs = Math.max(0, plant.bugs - 1);
    if (ecosystem.bats  && Math.random() < 0.45 * gameDays) plant.bugs = Math.max(0, plant.bugs - 1);
  }

  // ── Dead leaves accumulate (weather-modified) ────────────
  if (Math.random() < leafChanceBase * gameDays) {
    plant.deadLeaves = Math.min(10, plant.deadLeaves + 1);
  }

  // ── Health penalties ─────────────────────────────────────
  let dmg = stormDmgPerGD * gameDays;
  if (plant.waterLevel    < 20)  dmg += 6  * gameDays;
  if (plant.waterLevel   === 0)  dmg += 12 * gameDays;
  if (plant.nutrientLevel < 20)  dmg += 3  * gameDays;
  if (plant.bugs          >= 3)  dmg += 8  * gameDays;
  if (plant.bugs          >= 6)  dmg += 15 * gameDays;
  if (plant.deadLeaves    >= 5)  dmg += 5  * gameDays;

  // ── Health recovery if all good ──────────────────────────
  if (plant.waterLevel > 60 && plant.nutrientLevel > 60 && plant.bugs === 0) {
    plant.health = Math.min(100, plant.health + 2 * gameDays);
  }

  plant.health = Math.max(0, plant.health - dmg);

  if (plant.health <= 0) {
    plant.isAlive    = false;
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
        plant.readyToHarvest = true;
      } else {
        plant.stage          = next;
        plant.stageStartedAt = new Date(now);
        plant.readyToHarvest = false;
        if (next === 'seed') plant.cycleCount++;
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
    }

    // 2. Update weather + ecosystem (may mark gardenDoc dirty)
    const gameTime = getGameTime();
    updateWeather(gardenDoc);
    const plants = await GardenPlant.find({ userId: uid });
    updateEcosystem(gardenDoc, plants, gameTime, gardenDoc.weather || 'sunny');
    await gardenDoc.save();

    // 3. Apply tick to each plant using current weather + ecosystem
    const weather = gardenDoc.weather || 'sunny';
    const eco     = gardenDoc.ecosystem || {};
    const dirty   = [];
    for (const p of plants) {
      const pt  = getPlantType(p.plantTypeId);
      const pot = getPotType(p.potTypeId);
      if (!pt) continue;
      const changed = applyTick(p, pt, pot, weather, eco);
      if (changed) dirty.push(p.save());
    }
    if (dirty.length) await Promise.all(dirty);

    // 4. Build cell price grid
    const cellPrices = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      cellPrices[r] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        cellPrices[r][c] = cellPrice(r, c);
      }
    }

    // 5. Enrich plants with type info
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
      gameTime,
      weather,
      weatherInfo: getWeatherInfo(weather),
      ecosystem: eco,
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

    // Check & deduct from inventory (seeds and pots bought in shop)
    const up = await UserPoints.findOne({ userId: req.userId });
    const seedCount = (up?.gardenSeeds?.get(plantTypeId)) || 0;
    const potCount  = (up?.gardenPots?.get(potTypeId))    || 0;
    if (seedCount < 1) {
      return res.status(400).json({ error: `Bạn chưa có hạt giống ${pt.name}. Hãy mua trong Cửa hàng!` });
    }
    if (potCount < 1) {
      return res.status(400).json({ error: `Bạn chưa có ${pot.name}. Hãy mua trong Cửa hàng!` });
    }
    up.gardenSeeds.set(plantTypeId, seedCount - 1);
    up.gardenPots.set(potTypeId,  potCount  - 1);
    up.markModified('gardenSeeds');
    up.markModified('gardenPots');
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
      gardenSeeds: Object.fromEntries(up.gardenSeeds),
      gardenPots:  Object.fromEntries(up.gardenPots),
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

// ══════════════════════════════════════════════════════════════
// MUSHROOM HARVEST
// ══════════════════════════════════════════════════════════════

// POST /api/garden/mushroom-harvest — harvest mushrooms from ecosystem
router.post('/mushroom-harvest', async (req, res) => {
  try {
    const uid = req.userId;
    const gardenDoc = await GardenPlot.findOne({ userId: uid });
    const mushrooms = gardenDoc?.ecosystem?.mushrooms || 0;
    if (mushrooms === 0) return res.status(400).json({ error: 'Không có nấm để thu hoạch' });

    // 2 nấm → 1 phân bón; mỗi nấm = 3 điểm
    const fertilizer = Math.max(1, Math.floor(mushrooms / 2));
    const pts        = mushrooms * 3;

    gardenDoc.ecosystem.mushrooms = 0;
    await gardenDoc.save();

    const up = await UserPoints.findOne({ userId: uid });
    if (up) {
      up.fertilizer  = (up.fertilizer  || 0) + fertilizer;
      up.points      = (up.points      || 0) + pts;
      up.totalEarned = (up.totalEarned || 0) + pts;
      await up.save();
    }

    res.json({ success: true, mushrooms, fertilizer, pts, points: up?.points,
               inventory: { fertilizer: up?.fertilizer } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// FRIEND GARDEN — view & gift
// ══════════════════════════════════════════════════════════════

// ── Friendship helpers ─────────────────────────────────────────────────────
// Friendship level labels based on score
function getFriendshipLevel(score) {
  if (score >= 100) return { level: 5, label: 'Tri kỷ',      emoji: '💞' };
  if (score >=  60) return { level: 4, label: 'Thân thiết',  emoji: '💛' };
  if (score >=  30) return { level: 3, label: 'Bạn tốt',     emoji: '💚' };
  if (score >=  10) return { level: 2, label: 'Bạn bè',      emoji: '🤝' };
  if (score >=   1) return { level: 1, label: 'Quen biết',   emoji: '👋' };
  return { level: 0, label: 'Xa lạ', emoji: '🌱' };
}

// Upsert friendship score for both users (+scoreA for uid on friendId's side, +scoreB vice-versa)
async function _updateFriendship(uid, friendId, scoreInc, visitInc, giftInc) {
  const update = (doc, otherId) => {
    let entry = (doc.friendshipLevels || []).find(e => e.with?.toString() === otherId.toString());
    if (!entry) {
      doc.friendshipLevels = doc.friendshipLevels || [];
      doc.friendshipLevels.push({ with: otherId, score: 0, totalVisits: 0, totalGifts: 0 });
      entry = doc.friendshipLevels[doc.friendshipLevels.length - 1];
    }
    entry.score          = (entry.score       || 0) + scoreInc;
    entry.totalVisits    = (entry.totalVisits  || 0) + visitInc;
    entry.totalGifts     = (entry.totalGifts   || 0) + giftInc;
    entry.lastInteractAt = new Date();
  };
  const [userDoc, friendDoc] = await Promise.all([
    User.findById(uid).select('friendshipLevels'),
    User.findById(friendId).select('friendshipLevels'),
  ]);
  if (userDoc)   { update(userDoc,   friendId); await userDoc.save(); }
  if (friendDoc) { update(friendDoc, uid);      await friendDoc.save(); }
}

// GET /api/garden/friend/:friendId — read-only view of a friend's garden
router.get('/friend/:friendId', async (req, res) => {
  try {
    const uid      = req.userId;
    const friendId = req.params.friendId;

    // Must be friends
    const me = await User.findById(uid).select('friends displayName username friendshipLevels');
    if (!me?.friends?.map(f => f.toString()).includes(friendId)) {
      return res.status(403).json({ error: 'Chỉ có thể xem vườn của bạn bè' });
    }

    const [friendUser, gardenDoc, plants, friendUp] = await Promise.all([
      User.findById(friendId).select('displayName username receivedGardenVisits friendshipLevels'),
      GardenPlot.findOne({ userId: friendId }),
      GardenPlant.find({ userId: friendId }),
      UserPoints.findOne({ userId: friendId }).select('points level'),
    ]);
    if (!friendUser) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    // ── Record visit (rate-limit: once per hour per visitor) ────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentVisit = (friendUser.receivedGardenVisits || []).find(
      v => v.from?.toString() === uid.toString() && v.visitedAt > oneHourAgo
    );
    if (!recentVisit) {
      friendUser.receivedGardenVisits = friendUser.receivedGardenVisits || [];
      // Keep max 30 visits
      if (friendUser.receivedGardenVisits.length >= 30) {
        friendUser.receivedGardenVisits.sort((a, b) => b.visitedAt - a.visitedAt);
        friendUser.receivedGardenVisits = friendUser.receivedGardenVisits.slice(0, 29);
      }
      friendUser.receivedGardenVisits.push({
        from:      uid,
        fromName:  me.displayName || me.username || 'Bạn bè',
        visitedAt: new Date(),
        seen:      false,
      });
      await friendUser.save();
      // Update friendship score (+1 score, +1 visit)
      _updateFriendship(uid, friendId, 1, 1, 0).catch(() => {});
    }

    // ── Friendship level for this pair ──────────────────────────────────────
    const fsEntry = (me.friendshipLevels || []).find(e => e.with?.toString() === friendId.toString());
    const fsScore  = fsEntry?.score || 0;
    const fsInfo   = getFriendshipLevel(fsScore);

    const cellPrices = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      cellPrices[r] = [];
      for (let c = 0; c < GRID_COLS; c++) cellPrices[r][c] = cellPrice(r, c);
    }

    const enriched = plants.map(p => ({
      ...p.toObject(),
      plantType: getPlantType(p.plantTypeId),
      potType:   getPotType(p.potTypeId),
    }));

    res.json({
      friend: {
        _id: friendId,
        displayName: friendUser.displayName,
        username:    friendUser.username,
        level:       friendUp?.level || 1,
      },
      friendship: { score: fsScore, ...fsInfo },
      purchasedCells: gardenDoc?.purchasedCells || [],
      plants:    enriched,
      gridConfig:{ rows: GRID_ROWS, cols: GRID_COLS },
      cellPrices,
      gameTime:  getGameTime(),
      weather:   gardenDoc?.weather     || 'sunny',
      weatherInfo: getWeatherInfo(gardenDoc?.weather || 'sunny'),
      ecosystem: gardenDoc?.ecosystem   || {},
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/garden/friend/:friendId/water/:plantId — gift 1 water to friend's plant
router.post('/friend/:friendId/water/:plantId', async (req, res) => {
  try {
    const uid      = req.userId;
    const { friendId, plantId } = req.params;

    // Must be friends
    const me = await User.findById(uid).select('friends');
    if (!me?.friends?.map(f => f.toString()).includes(friendId)) {
      return res.status(403).json({ error: 'Chỉ có thể tặng cho bạn bè' });
    }

    // Visitor needs ≥1 water item
    const myUp = await UserPoints.findOne({ userId: uid });
    if (!myUp || myUp.water < 1) {
      return res.status(400).json({ error: 'Cần 1 💧 nước để tặng' });
    }

    // Target plant must belong to friend and be alive
    const plant = await GardenPlant.findOne({ _id: plantId, userId: friendId });
    if (!plant || !plant.isAlive) return res.status(404).json({ error: 'Không tìm thấy cây' });

    // Deduct visitor's water, water the plant, reward friend 3 pts
    myUp.water--;
    plant.waterLevel    = Math.min(100, plant.waterLevel + 35);
    plant.lastWateredAt = new Date();
    plant.health        = Math.min(100, plant.health + 2);

    const friendUp = await UserPoints.findOne({ userId: friendId });
    if (friendUp) {
      friendUp.points      = (friendUp.points      || 0) + 3;
      friendUp.totalEarned = (friendUp.totalEarned || 0) + 3;
    }

    await Promise.all([myUp.save(), plant.save(), friendUp?.save()].filter(Boolean));
    // Update friendship score (+1 gift)
    _updateFriendship(uid, friendId, 1, 0, 1).catch(() => {});

    res.json({ success: true, waterLevel: plant.waterLevel, health: plant.health, points: myUp.points });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/garden/friend/:friendId/gift-rose — gift 1 rose to friend
router.post('/friend/:friendId/gift-rose', async (req, res) => {
  try {
    const uid      = req.userId;
    const friendId = req.params.friendId;

    // Must be friends
    const me = await User.findById(uid).select('friends displayName username');
    if (!me?.friends?.map(f => f.toString()).includes(friendId)) {
      return res.status(403).json({ error: 'Chỉ có thể tặng cho bạn bè' });
    }

    // Visitor needs ≥1 rose
    const myUp = await UserPoints.findOne({ userId: uid });
    if (!myUp || (myUp.rose || 0) < 1) {
      return res.status(400).json({ error: 'Bạn chưa có 🌹 hoa hồng để tặng. Hãy trồng Hoa Hồng và thu hoạch!' });
    }

    const friendUser = await User.findById(friendId).select('displayName username');
    if (!friendUser) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    const friendUp = await UserPoints.findOne({ userId: friendId });
    if (!friendUp) return res.status(404).json({ error: 'Không tìm thấy dữ liệu bạn bè' });

    // Deduct rose from visitor, add to friend
    myUp.rose = (myUp.rose || 0) - 1;
    friendUp.rose = (friendUp.rose || 0) + 1;
    // Bonus 5 pts for friend
    friendUp.addPoints(5);

    // Record gift notification on friend
    const senderName = me.displayName || me.username || 'Bạn bè';
    friendUser.receivedGifts = friendUser.receivedGifts || [];
    if (friendUser.receivedGifts.length >= 50) friendUser.receivedGifts.shift();
    friendUser.receivedGifts.push({
      from:      uid,
      fromName:  senderName,
      itemId:    'rose',
      itemName:  'Hoa hồng',
      itemEmoji: '🌹',
      qty:       1,
      bonusPoints: 5,
      seen:      false,
    });

    await Promise.all([myUp.save(), friendUp.save(), friendUser.save()]);
    // Friendship score: rose gift = +3
    _updateFriendship(uid, friendId, 3, 0, 1).catch(() => {});

    res.json({ success: true, myRose: myUp.rose, myPoints: myUp.points });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/garden/dev/weather/:type — force weather for current user (testing)
router.post('/dev/weather/:type', async (req, res) => {
  try {
    const VALID = ['sunny','cloudy','rainy','stormy','foggy','windy','random'];
    const type  = req.params.type;
    if (!VALID.includes(type)) return res.status(400).json({ error: `Invalid type. Use: ${VALID.join(', ')}` });

    const uid = req.userId;
    let gardenDoc = await GardenPlot.findOne({ userId: uid });
    if (!gardenDoc) gardenDoc = new GardenPlot({ userId: uid, purchasedCells: [] });

    gardenDoc.weather      = type === 'random' ? rollWeather() : type;
    gardenDoc.weatherSetAt = new Date();
    if (gardenDoc.ecosystem) gardenDoc.ecosystem.lastEcoUpdate = null;
    await gardenDoc.save();

    const info = getWeatherInfo(gardenDoc.weather);
    res.json({ ok: true, weather: gardenDoc.weather, label: info.label, emoji: info.emoji });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
