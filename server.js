require('dotenv').config();
const express      = require('express');
const mongoose     = require('mongoose');
const cors         = require('cors');
const path         = require('path');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Auth routes (no middleware)
app.use('/api/auth', require('./routes/auth'));

// Protected API routes
app.use('/api/tasks',  require('./routes/tasks'));
app.use('/api/habits', require('./routes/habits'));

// Serve auth page
app.get('/auth.html', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'auth.html')));

// All other routes → main app
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🐰 Rabbit Habits: http://localhost:${PORT}`));
  })
  .catch(err => console.error('❌ MongoDB error:', err.message));
