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
    await h.save(); res.status(201).json(h);
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

// Basic stats (used by charts)
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const habits = await Habit.find({ userId: req.userId, active: true });
    const logs   = await HabitLog.find({ userId: req.userId, date: { $gte: startDate, $lte: endDate } });
    const start  = new Date(startDate+'T00:00:00'), end = new Date(endDate+'T00:00:00');
    const totalDays = Math.round((end-start)/86400000)+1;
    const result = habits.map(h => {
      const doneDays = logs.filter(l => String(l.habitId)===String(h._id) && l.done).length;
      return { _id: h._id, name: h.name, emoji: h.emoji, color: h.color,
               totalDays, doneDays, rate: totalDays > 0 ? Math.round((doneDays/totalDays)*100) : 0 };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Deep analytics — streak, best day, consistency score
router.get('/analytics', async (req, res) => {
  try {
    const habits = await Habit.find({ userId: req.userId, active: true });
    const allLogs = await HabitLog.find({ userId: req.userId, done: true }).sort({ date: 1 });

    const result = habits.map(h => {
      const hLogs = allLogs.filter(l => String(l.habitId) === String(h._id));
      const dates = [...new Set(hLogs.map(l => l.date))].sort();

      // Current & max streak
      let curStreak = 0, maxStreak = 0, runStreak = 0;
      let prev = null;
      for(const ds of dates) {
        const d = new Date(ds + 'T00:00:00');
        if(prev) {
          const diff = Math.round((d - prev) / 86400000);
          runStreak = diff === 1 ? runStreak + 1 : 1;
        } else runStreak = 1;
        maxStreak = Math.max(maxStreak, runStreak);
        prev = d;
      }
      const todayStr = new Date().toISOString().split('T')[0];
      const yest = new Date(); yest.setDate(yest.getDate()-1);
      const last = dates[dates.length-1];
      curStreak = (last === todayStr || last === yest.toISOString().split('T')[0]) ? runStreak : 0;

      // Best day of week (0=Sun)
      const dayCount = Array(7).fill(0);
      hLogs.forEach(l => { const d = new Date(l.date+'T00:00:00'); dayCount[d.getDay()]++; });
      const bestDay = dayCount.indexOf(Math.max(...dayCount));

      // Weekly completion for last 8 weeks
      const weeklyData = [];
      const now = new Date(); now.setHours(0,0,0,0);
      for(let w = 7; w >= 0; w--) {
        const wStart = new Date(now); wStart.setDate(now.getDate() - now.getDay() - w*7 + 1);
        const wEnd   = new Date(wStart); wEnd.setDate(wStart.getDate() + 6);
        const wDone  = hLogs.filter(l => l.date >= wStart.toISOString().split('T')[0] && l.date <= wEnd.toISOString().split('T')[0]).length;
        weeklyData.push({ week: w, done: wDone, total: 7, rate: Math.round((wDone/7)*100) });
      }

      return {
        _id: h._id, name: h.name, emoji: h.emoji, color: h.color,
        totalDone: dates.length, curStreak, maxStreak, bestDay,
        weeklyData
      };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
