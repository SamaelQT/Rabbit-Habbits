const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');

const SECRET = process.env.JWT_SECRET || 'rabbit-habits-secret-2024';
const COOKIE_OPTS = { httpOnly: true, maxAge: 7*24*60*60*1000, sameSite: 'lax' };

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    if(!username || !email || !password)
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
    if(password.length < 6)
      return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự' });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if(exists) return res.status(400).json({
      error: exists.email === email.toLowerCase()
        ? 'Email này đã được đăng ký'
        : 'Tên người dùng đã tồn tại'
    });

    const user = await User.create({ username, email, password, displayName: displayName || username });
    const token = jwt.sign({ id: user._id, username: user.username }, SECRET, { expiresIn: '7d' });
    res.cookie('rh_token', token, COOKIE_OPTS);
    res.status(201).json({ ok: true, user: { id: user._id, username: user.username, displayName: user.displayName } });
  } catch(e) {
    if(e.code === 11000) return res.status(400).json({ error: 'Email hoặc tên đăng nhập đã tồn tại' });
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body; // login = username or email
    if(!login || !password) return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });

    const user = await User.findOne({
      $or: [{ email: login.toLowerCase() }, { username: login }]
    });
    if(!user) return res.status(401).json({ error: 'Không tìm thấy tài khoản' });

    const ok = await user.comparePassword(password);
    if(!ok) return res.status(401).json({ error: 'Mật khẩu không đúng' });

    const token = jwt.sign({ id: user._id, username: user.username }, SECRET, { expiresIn: '7d' });
    res.cookie('rh_token', token, COOKIE_OPTS);
    res.json({ ok: true, user: { id: user._id, username: user.username, displayName: user.displayName } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('rh_token');
  res.json({ ok: true });
});

// GET /api/auth/me — check session
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.rh_token;
    if(!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
    const payload = jwt.verify(token, SECRET);
    const user = await User.findById(payload.id).select('-password');
    if(!user) return res.status(401).json({ error: 'Tài khoản không tồn tại' });
    res.json({ user: { id: user._id, username: user.username, displayName: user.displayName } });
  } catch(e) { res.status(401).json({ error: 'Phiên đăng nhập hết hạn' }); }
});

module.exports = router;

// PATCH /api/auth/profile — update display name
router.patch('/profile', async (req, res) => {
  try {
    const token = req.cookies?.rh_token;
    if(!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
    const jwt  = require('jsonwebtoken');
    const SECRET = process.env.JWT_SECRET || 'rabbit-habits-secret-2024';
    const payload = jwt.verify(token, SECRET);
    const User = require('../models/User');
    const user = await User.findByIdAndUpdate(
      payload.id,
      { displayName: String(req.body.displayName||'').trim() },
      { new: true }
    );
    res.json({ ok: true, user: { id: user._id, username: user.username, displayName: user.displayName } });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/auth/password — change password
router.patch('/password', async (req, res) => {
  try {
    const token = req.cookies?.rh_token;
    if(!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
    const jwt    = require('jsonwebtoken');
    const bcrypt = require('bcryptjs');
    const SECRET = process.env.JWT_SECRET || 'rabbit-habits-secret-2024';
    const payload = jwt.verify(token, SECRET);
    const User = require('../models/User');
    const user = await User.findById(payload.id);
    if(!user) return res.status(404).json({ error: 'Tài khoản không tồn tại' });
    const ok = await user.comparePassword(req.body.currentPassword);
    if(!ok) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    if(!req.body.newPassword || req.body.newPassword.length < 6)
      return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 6 ký tự' });
    user.password = req.body.newPassword;
    await user.save();
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});
