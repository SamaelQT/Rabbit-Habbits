const express     = require('express');
const router      = express.Router();
const { Habit, HabitLog } = require('../models/Habit');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const habits = await Habit.find({ userId: req.userId, active: true }).sort({ order: 1, createdAt: 1 });
    res.json(habits);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const h = new Habit({ userId: req.userId, name: req.body.name, emoji: req.body.emoji||'🐰', color: req.body.color||'#b07fff' });
    await h.save();
    res.status(201).json(h);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Habit.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { active: false });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/logs', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const logs = await HabitLog.find({ userId: req.userId, date: { $gte: startDate, $lte: endDate } });
    res.json(logs);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/logs/toggle', async (req, res) => {
  try {
    const { habitId, date } = req.body;
    let log = await HabitLog.findOne({ userId: req.userId, habitId, date });
    if(log){ log.done = !log.done; await log.save(); }
    else { log = await HabitLog.create({ userId: req.userId, habitId, date, done: true }); }
    res.json(log);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const habits = await Habit.find({ userId: req.userId, active: true });
    const logs   = await HabitLog.find({ userId: req.userId, date: { $gte: startDate, $lte: endDate } });
    const start  = new Date(startDate+'T00:00:00'), end = new Date(endDate+'T00:00:00');
    const totalDays = Math.round((end-start)/86400000)+1;
    const result = habits.map(h => {
      const doneDays = logs.filter(l => String(l.habitId)===String(h._id) && l.done).length;
      return { _id: h._id, name: h.name, emoji: h.emoji, color: h.color, totalDays, doneDays,
               rate: totalDays > 0 ? Math.round((doneDays/totalDays)*100) : 0 };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
