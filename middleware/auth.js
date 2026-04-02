const jwt    = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'rabbit-habits-secret-2024';
const User   = require('../models/User');

module.exports = function requireAuth(req, res, next){
  try {
    const token = req.cookies?.rh_token;
    if(!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
    const payload = jwt.verify(token, SECRET);
    req.userId = payload.id;
    // Update lastSeen (fire-and-forget, throttle to ~30s to reduce writes)
    const now = Date.now();
    if (!req._lastSeenUpdated) {
      User.findByIdAndUpdate(payload.id, { lastSeen: new Date(now) }).catch(() => {});
    }
    next();
  } catch(e) { res.status(401).json({ error: 'Phiên đăng nhập hết hạn' }); }
};
