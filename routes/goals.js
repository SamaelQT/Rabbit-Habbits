const express     = require('express');
const router      = express.Router();
const Goal        = require('../models/Goal');
const UserPoints  = require('../models/UserPoints');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

async function awardPts(userId, amount) {
  let up = await UserPoints.findOne({ userId });
  if (!up) up = new UserPoints({ userId });
  up.addPoints(amount);
  await up.save();
  return up.points;
}

async function deductPts(userId, amount) {
  let up = await UserPoints.findOne({ userId });
  if (!up) return 0;
  up.points = Math.max(0, up.points - amount);
  up.updatedAt = new Date();
  await up.save();
  return up.points;
}

// GET all active goals
router.get('/', async (req, res) => {
  try {
    const goals = await Goal.find({ userId: req.userId, active: true }).sort({ createdAt: -1 });
    const today = new Date(); today.setHours(0,0,0,0);
    for(const g of goals){
      let changed = false;
      for(const d of g.days){
        const dayDate = new Date(d.date + 'T00:00:00');
        if(!d.done && dayDate < today && !d.missedAt){
          d.missedAt = new Date();
          changed = true;
        }
      }
      if(changed) await g.save();
    }
    res.json(goals);
  } catch(e){
    console.error('Goals GET error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST create goal
router.post('/', async (req, res) => {
  try {
    const title      = String(req.body.title||'').trim();
    const emoji      = String(req.body.emoji||'🎯');
    const color      = String(req.body.color||'#b07fff');
    const totalDays  = parseInt(req.body.totalDays);
    const startDate  = String(req.body.startDate||'');

    if(!title)                       return res.status(400).json({ error: 'Thiếu tên mục tiêu' });
    if(!totalDays || totalDays < 1)  return res.status(400).json({ error: 'Số ngày không hợp lệ' });
    if(!startDate)                   return res.status(400).json({ error: 'Thiếu ngày bắt đầu' });

    // Generate day slots
    const dayTasksArr = Array.isArray(req.body.dayTasks) ? req.body.dayTasks : [];
    const days = [];
    for(let i = 0; i < totalDays; i++){
      const d = new Date(startDate + 'T00:00:00');
      d.setDate(d.getDate() + i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      days.push({ dayIndex: i, date: ds, task: String(dayTasksArr[i]||'').trim(), done: false });
    }

    const goal = new Goal({
      userId: req.userId, title, emoji, color, totalDays, startDate, days
    });
    await goal.save();
    res.status(201).json(goal);
  } catch(e){
    console.error('Goal create error:', e.message);
    res.status(400).json({ error: e.message });
  }
});

// PATCH update day task
router.patch('/:id/day/:dayIndex/task', async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.userId });
    if(!goal) return res.status(404).json({ error: 'Not found' });
    const day = goal.days.find(d => d.dayIndex === parseInt(req.params.dayIndex));
    if(!day) return res.status(404).json({ error: 'Day not found' });
    day.task = String(req.body.task||'');
    await goal.save();
    res.json(goal);
  } catch(e){ res.status(400).json({ error: e.message }); }
});

// PATCH toggle day done
router.patch('/:id/day/:dayIndex/toggle', async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.userId });
    if(!goal) return res.status(404).json({ error: 'Not found' });
    const day = goal.days.find(d => d.dayIndex === parseInt(req.params.dayIndex));
    if(!day) return res.status(404).json({ error: 'Day not found' });
    day.done = !day.done;
    if(day.done) day.missedAt = null;
    await goal.save();
    let pointsAwarded = 0, pointsDeducted = 0;
    if (day.done) {
      await awardPts(req.userId, 8);
      pointsAwarded = 8;
    } else {
      await deductPts(req.userId, 8);
      pointsDeducted = 8;
    }
    res.json({ ...goal.toObject(), pointsAwarded, pointsDeducted });
  } catch(e){ res.status(400).json({ error: e.message }); }
});

// DELETE (soft)
router.delete('/:id', async (req, res) => {
  try {
    await Goal.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { active: false });
    res.json({ ok: true });
  } catch(e){ res.status(500).json({ error: e.message }); }
});

module.exports = router;
