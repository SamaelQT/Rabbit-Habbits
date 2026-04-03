const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const Task       = require('../models/Task');
const { Habit, HabitLog } = require('../models/Habit');
const Goal       = require('../models/Goal');
const User       = require('../models/User');
const UserPoints = require('../models/UserPoints');

router.use(auth);

// GET /api/stats/journey — all-time summary
router.get('/journey', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('createdAt');
    const up   = await UserPoints.findOne({ userId: req.userId });
    const totalTasksDone     = await Task.countDocuments({ userId: req.userId, completed: true });
    const totalHabitDays     = await HabitLog.countDocuments({ userId: req.userId, done: true });
    const totalGoalsArchived = await Goal.countDocuments({ userId: req.userId, completed: true, active: false });
    const joinedAt  = user.createdAt;
    const daysSince = Math.floor((Date.now() - joinedAt) / 86400000);
    res.json({
      daysSince,
      joinedAt,
      totalTasksDone,
      totalHabitDays,
      totalGoalsArchived,
      totalEarned: up?.totalEarned || 0,
      level: up?.level || 1
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/stats/monthly — last 12 months scores
router.get('/monthly', async (req, res) => {
  try {
    const months = [];
    const now    = new Date();
    for (let i = 11; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const start = key + '-01';
      const endD  = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const end   = `${key}-${String(endD.getDate()).padStart(2, '0')}`;
      const [tasksDone, habitDays] = await Promise.all([
        Task.countDocuments({ userId: req.userId, completed: true, date: { $gte: start, $lte: end } }),
        HabitLog.countDocuments({ userId: req.userId, done: true, date: { $gte: start, $lte: end } }),
      ]);
      const goals = await Goal.find({ userId: req.userId });
      let goalDays = 0;
      goals.forEach(g => {
        goalDays += g.days.filter(day => day.done && day.date >= start && day.date <= end).length;
      });
      const score = tasksDone * 3 + habitDays * 2 + goalDays * 5;
      months.push({ month: key, score, tasksDone, habitDays, goalDays });
    }
    res.json(months);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/stats/balance?month=YYYY-MM — category breakdown for a given month (default: current)
router.get('/balance', async (req, res) => {
  try {
    const CATS = ['work', 'health', 'sport', 'shopping', 'learning', 'personal', 'other'];
    // Determine date range
    let start, end;
    if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
      const [y, m] = req.query.month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      start = `${req.query.month}-01`;
      end   = `${req.query.month}-${String(lastDay).padStart(2, '0')}`;
    } else {
      const now = new Date();
      const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      start = `${y}-${m}-01`;
      end   = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    }
    const tasks     = await Task.find({ userId: req.userId, completed: true, date: { $gte: start, $lte: end } });
    const habits    = await Habit.find({ userId: req.userId });
    const habitLogs = await HabitLog.find({ userId: req.userId, done: true, date: { $gte: start, $lte: end } });
    const habitCatMap = {};
    habits.forEach(h => { habitCatMap[h._id.toString()] = h.category || 'other'; });
    const counts = {};
    CATS.forEach(c => { counts[c] = 0; });
    tasks.forEach(t => { counts[t.category || 'other']++; });
    habitLogs.forEach(l => { counts[habitCatMap[l.habitId.toString()] || 'other']++; });
    res.json({ month: start.slice(0, 7), counts });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
