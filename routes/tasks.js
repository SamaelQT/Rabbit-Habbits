const express     = require('express');
const router      = express.Router();
const Task        = require('../models/Task');
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

router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, date } = req.query;
    let query = { userId: req.userId };
    if(date) query.date = date;
    else if(startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
    const tasks = await Task.find(query).sort({ priority: -1, createdAt: 1 });
    res.json(tasks);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const task = new Task({ userId: req.userId, title: req.body.title, date: req.body.date, priority: req.body.priority || 0 });
    await task.save();
    res.status(201).json(task);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if(!task) return res.status(404).json({ error: 'Not found' });
    task.completed   = !task.completed;
    task.completedAt = task.completed ? new Date() : null;
    await task.save();
    let pointsAwarded = 0;
    if (task.completed) {
      // Points based on priority: 0=5, 1=5, 2=8, 3=12
      const pts = [5, 5, 8, 12][task.priority] || 5;
      await awardPts(req.userId, pts);
      pointsAwarded = pts;
    }
    res.json({ ...task.toObject(), pointsAwarded });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const update = {};
    if(req.body.title    !== undefined) update.title    = req.body.title;
    if(req.body.priority !== undefined) update.priority = req.body.priority;
    const task = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, update, { new: true });
    if(!task) return res.status(404).json({ error: 'Not found' });
    res.json(task);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if(!task) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const tasks = await Task.find({ userId: req.userId, date: { $gte: startDate, $lte: endDate } });
    const byDate = {};
    tasks.forEach(t => {
      if(!byDate[t.date]) byDate[t.date] = { total: 0, completed: 0 };
      byDate[t.date].total++;
      if(t.completed) byDate[t.date].completed++;
    });
    const freq = {};
    tasks.forEach(t => {
      const key = t.title.toLowerCase().trim();
      if(!freq[key]) freq[key] = { title: t.title, total: 0, completed: 0, dates: [] };
      freq[key].total++;
      if(t.completed) freq[key].completed++;
      if(!freq[key].dates.includes(t.date)) freq[key].dates.push(t.date);
    });
    const allSorted = Object.values(freq).filter(t=>t.total>=2).sort((a,b)=>b.total-a.total);
    const top3Keys  = new Set(allSorted.slice(0,3).map(t=>t.title.toLowerCase().trim()));
    const last3 = []; for(let i=0;i<3;i++){ const d=new Date(); d.setDate(d.getDate()-i); last3.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); }
    const freqList = allSorted.filter(t=>{
      const k=t.title.toLowerCase().trim();
      return top3Keys.has(k) || t.dates.some(d=>last3.includes(d));
    }).slice(0,10);
    const total = tasks.length, completed = tasks.filter(t => t.completed).length;
    res.json({ overall: { total, completed, rate: total > 0 ? Math.round((completed/total)*100) : 0 }, byDate, topTasks: freqList });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/streak', async (req, res) => {
  try {
    const { title } = req.query;
    const key   = title.toLowerCase().trim();
    const tasks = await Task.find({ userId: req.userId, completed: true }).sort({ date: 1 });
    const dates = [...new Set(tasks.filter(t => t.title.toLowerCase().trim() === key).map(t => t.date))].sort();
    if(!dates.length) return res.json({ currentStreak: 0, maxStreak: 0 });
    const streaks = []; let curLen = 1, prev = new Date(dates[0]+'T00:00:00');
    for(let i = 1; i < dates.length; i++){
      const d = new Date(dates[i]+'T00:00:00'), diff = Math.round((d-prev)/86400000);
      if(diff === 1){ curLen++; } else { streaks.push(curLen); curLen = 1; }
      prev = d;
    }
    streaks.push(curLen);
    const maxStreak = Math.max(...streaks);
    const todayStr  = new Date().toISOString().split('T')[0];
    const yest      = new Date(); yest.setDate(yest.getDate()-1);
    const yesterStr = yest.toISOString().split('T')[0];
    const last      = dates[dates.length-1];
    const currentStreak = (last===todayStr||last===yesterStr) ? streaks[streaks.length-1] : 0;
    res.json({ currentStreak, maxStreak });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/global-streak', async (req, res) => {
  try {
    const tasks  = await Task.find({ userId: req.userId, completed: true }).sort({ date: 1 });
    const dates  = [...new Set(tasks.map(t => t.date))].sort();
    if(!dates.length) return res.json({ currentStreak: 0, maxStreak: 0 });
    let maxS = 1, curS = 1, prev = new Date(dates[0]+'T00:00:00');
    for(let i = 1; i < dates.length; i++){
      const d = new Date(dates[i]+'T00:00:00'), diff = Math.round((d-prev)/86400000);
      if(diff===1){ curS++; maxS=Math.max(maxS,curS); } else curS=1;
      prev = d;
    }
    const today = new Date().toISOString().split('T')[0];
    const yest  = new Date(); yest.setDate(yest.getDate()-1);
    const last  = dates[dates.length-1];
    res.json({ currentStreak: (last===today||last===yest.toISOString().split('T')[0]) ? curS : 0, maxStreak: maxS });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/heatmap', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const tasks = await Task.find({ userId: req.userId, date: { $gte: startDate, $lte: endDate } });
    const byDate = {};
    tasks.forEach(t => {
      if(!byDate[t.date]) byDate[t.date] = { total: 0, completed: 0 };
      byDate[t.date].total++;
      if(t.completed) byDate[t.date].completed++;
    });
    res.json(byDate);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
