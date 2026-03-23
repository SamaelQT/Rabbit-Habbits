const express     = require('express');
const router      = express.Router();
const Journal     = require('../models/Journal');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

// GET single date
router.get('/:date', async (req, res) => {
  try {
    const entry = await Journal.findOne({ userId: req.userId, date: req.params.date });
    res.json(entry || { mood: '', content: '' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET range — for history view (startDate to endDate)
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const q = { userId: req.userId };
    if(startDate && endDate) q.date = { $gte: startDate, $lte: endDate };
    const entries = await Journal.find(q).sort({ date: -1 });
    res.json(entries);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT upsert
router.put('/:date', async (req, res) => {
  try {
    const { mood, content } = req.body;
    const entry = await Journal.findOneAndUpdate(
      { userId: req.userId, date: req.params.date },
      { mood, content, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(entry);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
