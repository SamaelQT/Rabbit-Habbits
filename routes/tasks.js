const express     = require('express');
const router      = express.Router();
const Task        = require('../models/Task');
const UserPoints  = require('../models/UserPoints');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

async function awardPts(userId, amount) {
  let up = await UserPoints.findOne({ userId });
  if (!up) up = new UserPoints({ userId });
  const levelResult = up.addPoints(amount);
  await up.save();
  return { points: up.points, level: up.level, levelResult };
}

async function deductPts(userId, amount) {
  let up = await UserPoints.findOne({ userId });
  if (!up) return 0;
  up.points = Math.max(0, up.points - amount);
  up.updatedAt = new Date();
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
    const task = new Task({ userId: req.userId, title: req.body.title, date: req.body.date, priority: req.body.priority || 0, category: req.body.category || 'other' });
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
    // Base points by priority, scaled by user level (+10% per level above 1)
    const basePts = [5, 5, 8, 12][task.priority] || 5;
    let up = await UserPoints.findOne({ userId: req.userId });
    if (!up) up = new UserPoints({ userId: req.userId });
    const levelBonus = 1 + ((up.level || 1) - 1) * 0.1;
    const pts = Math.round(basePts * levelBonus);
    let pointsAwarded = 0, pointsDeducted = 0, leveledUp = false, oldLevel = 0, newLevel = 0;
    if (task.completed) {
      const result = await awardPts(req.userId, pts);
      pointsAwarded = pts;
      if (result.levelResult) {
        leveledUp = result.levelResult.leveledUp;
        oldLevel = result.levelResult.oldLevel;
        newLevel = result.levelResult.newLevel;
      }
    } else {
      await deductPts(req.userId, pts);
      pointsDeducted = pts;
    }
    res.json({ ...task.toObject(), pointsAwarded, pointsDeducted, leveledUp, oldLevel, newLevel });
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

// Group similar task titles by keyword overlap
function groupSimilarTasks(freqItems) {
  // Vietnamese stop words to ignore
  const STOP = new Set(['và','hoặc','với','cho','của','các','những','một','hai','ba','để','đã','đang','sẽ','không','có','là','từ','đến','trong','ngoài','trên','dưới','về','bị','được']);

  function getKeywords(title) {
    return title.toLowerCase().trim().split(/\s+/).filter(w => w.length >= 2 && !STOP.has(w));
  }

  function similarity(a, b) {
    const kA = getKeywords(a), kB = getKeywords(b);
    if (kA.length === 0 || kB.length === 0) return 0;
    const setB = new Set(kB);
    const shared = kA.filter(w => setB.has(w)).length;
    // Jaccard-like: shared / min(len) — more forgiving for short titles
    return shared / Math.min(kA.length, kB.length);
  }

  const groups = [];
  const used = new Set();

  for (let i = 0; i < freqItems.length; i++) {
    if (used.has(i)) continue;
    const group = { ...freqItems[i], members: [freqItems[i].title], dates: [...freqItems[i].dates] };
    used.add(i);

    for (let j = i + 1; j < freqItems.length; j++) {
      if (used.has(j)) continue;
      if (similarity(freqItems[i].title, freqItems[j].title) >= 0.5) {
        group.total += freqItems[j].total;
        group.completed += freqItems[j].completed;
        freqItems[j].dates.forEach(d => { if (!group.dates.includes(d)) group.dates.push(d); });
        group.members.push(freqItems[j].title);
        used.add(j);
      }
    }

    // Use the most frequent title as the group title, add member count
    if (group.members.length > 1) {
      group.title = group.members[0] + ` (+${group.members.length - 1})`;
      group.isGroup = true;
      group.groupTitles = group.members;
    }
    groups.push(group);
  }
  return groups;
}

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

    // Group similar tasks by keyword overlap
    const grouped = groupSimilarTasks(allSorted);
    grouped.sort((a,b) => b.total - a.total);

    const top3Keys  = new Set(grouped.slice(0,3).map(t=>t.title.toLowerCase().trim()));
    const last3 = []; for(let i=0;i<3;i++){ const d=new Date(); d.setDate(d.getDate()-i); last3.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); }
    const freqList = grouped.filter(t=>{
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

// Weekly/monthly report summary
router.get('/report', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const tasks = await Task.find({ userId: req.userId, date: { $gte: startDate, $lte: endDate } });
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Streak within this period
    const completedDates = [...new Set(tasks.filter(t => t.completed).map(t => t.date))].sort();
    let maxStreak = 0, curStreak = 0;
    for (let i = 0; i < completedDates.length; i++) {
      if (i === 0) { curStreak = 1; }
      else {
        const prev = new Date(completedDates[i-1] + 'T00:00:00');
        const curr = new Date(completedDates[i] + 'T00:00:00');
        if (Math.round((curr - prev) / 86400000) === 1) curStreak++;
        else curStreak = 1;
      }
      maxStreak = Math.max(maxStreak, curStreak);
    }

    // Points earned in period
    const pointsEarned = tasks.filter(t => t.completed).reduce((sum, t) => {
      return sum + ([5, 5, 8, 12][t.priority] || 5);
    }, 0);

    // By priority breakdown
    const byPriority = [0, 0, 0, 0];
    const byPriorityDone = [0, 0, 0, 0];
    tasks.forEach(t => {
      byPriority[t.priority || 0]++;
      if (t.completed) byPriorityDone[t.priority || 0]++;
    });

    // Active days (days with at least 1 completed task)
    const activeDays = completedDates.length;
    // Total days in range
    const rangeStart = new Date(startDate + 'T00:00:00');
    const rangeEnd = new Date(endDate + 'T00:00:00');
    const totalDays = Math.round((rangeEnd - rangeStart) / 86400000) + 1;

    res.json({ total, completed, rate, maxStreak, pointsEarned, byPriority, byPriorityDone, activeDays, totalDays });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Productive hours analysis — which hour of day user completes most tasks
router.get('/productive-hours', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { userId: req.userId, completed: true, completedAt: { $ne: null } };
    if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
    const tasks = await Task.find(query);
    const byHour = new Array(24).fill(0);
    tasks.forEach(t => {
      if (t.completedAt) {
        const h = new Date(t.completedAt).getHours();
        byHour[h]++;
      }
    });
    // Find peak hours (top 3)
    const indexed = byHour.map((count, hour) => ({ hour, count }));
    const sorted = [...indexed].sort((a, b) => b.count - a.count);
    const peakHours = sorted.filter(h => h.count > 0).slice(0, 3);
    res.json({ byHour, peakHours, totalCompleted: tasks.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
