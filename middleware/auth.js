const jwt    = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'rabbit-habits-secret-2024';

module.exports = function requireAuth(req, res, next){
  try {
    const token = req.cookies?.rh_token;
    if(!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
    const payload = jwt.verify(token, SECRET);
    req.userId = payload.id;
    next();
  } catch(e) { res.status(401).json({ error: 'Phiên đăng nhập hết hạn' }); }
};
