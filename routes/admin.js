/**
 * Admin utilities — protected by ADMIN_SECRET env variable.
 * Usage: GET /api/admin/add-points?secret=<ADMIN_SECRET>&username=<user>&points=<n>
 *
 * REMOVE or disable ADMIN_SECRET from .env when not needed.
 */
const express    = require('express');
const router     = express.Router();
const User       = require('../models/User');
const UserPoints = require('../models/UserPoints');

// Guard: every request must supply the correct secret
router.use((req, res, next) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(503).json({ error: 'Admin endpoint disabled (no ADMIN_SECRET set)' });
  if (req.query.secret !== secret) return res.status(403).json({ error: 'Invalid secret' });
  next();
});

// GET /api/admin/add-points?secret=…&username=…&points=…
router.get('/add-points', async (req, res) => {
  try {
    const { username, points } = req.query;
    const amount = parseInt(points, 10);
    if (!username || isNaN(amount) || amount <= 0)
      return res.status(400).json({ error: 'Params: username (string), points (positive int)' });

    const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (!user) return res.status(404).json({ error: `User "${username}" not found` });

    let up = await UserPoints.findOne({ userId: user._id });
    if (!up) up = new UserPoints({ userId: user._id });

    const before = { points: up.points, totalEarned: up.totalEarned, level: up.level || 1 };
    const levelResult = up.addPoints(amount);
    await up.save();

    res.json({
      ok: true,
      user: user.username,
      displayName: user.displayName || null,
      before,
      after: { points: up.points, totalEarned: up.totalEarned, level: up.level },
      leveledUp: levelResult.leveledUp,
      addedPoints: amount,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/user-info?secret=…&username=…
router.get('/user-info', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } })
      .select('username displayName createdAt');
    if (!user) return res.status(404).json({ error: `User "${username}" not found` });
    const up = await UserPoints.findOne({ userId: user._id });
    res.json({ user, points: up?.points || 0, totalEarned: up?.totalEarned || 0, level: up?.level || 1 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
