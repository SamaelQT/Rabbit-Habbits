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
// Serve Chart.js from npm (ensures correct file even without static copy)
app.get('/js/chart.umd.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js'));
});

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/tasks',   require('./routes/tasks'));
app.use('/api/habits',  require('./routes/habits'));
app.use('/api/journal', require('./routes/journal'));
app.use('/api/goals',   require('./routes/goals'));
app.use('/api/shop',    require('./routes/shop'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/stats',        require('./routes/stats'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/garden',       require('./routes/garden'));

app.get('/auth.html', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'auth.html')));
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🐰 Rabbit Habits: http://localhost:${PORT}`));
  })
  .catch(err => console.error('❌ MongoDB:', err.message));
