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

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/tasks',   require('./routes/tasks'));
app.use('/api/habits',  require('./routes/habits'));
app.use('/api/journal', require('./routes/journal'));
app.use('/api/goals',   require('./routes/goals'));

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
