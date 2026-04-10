const express      = require('express');
const router       = express.Router();
const mongoose     = require('mongoose');
const User         = require('../models/User');
const UserPoints   = require('../models/UserPoints');
const WeeklyChallenge = require('../models/WeeklyChallenge');
const Task         = require('../models/Task');
const { HabitLog } = require('../models/Habit');
const Journal      = require('../models/Journal');
const Goal         = require('../models/Goal');
const Message      = require('../models/Message');
const requireAuth  = require('../middleware/auth');

router.use(requireAuth);

// ═══ LEVEL SYSTEM ═══

const LEVEL_NAMES = [
  // ── Tier Người Thường (1-10) ──
  'Tân binh',          // 1
  'Khởi động',         // 2
  'Chăm chỉ',          // 3
  'Kiên trì',          // 4
  'Chiến binh',        // 5
  'Dũng sĩ',           // 6
  'Anh hùng',          // 7
  'Huyền thoại',       // 8
  'Bậc thầy',          // 9
  'Đại sư',            // 10
  // ── Tier Phi Thường (11-20) ──
  'Thiên tài',         // 11
  'Siêu nhân',         // 12
  'Thần thoại',        // 13
  'Bất tử',            // 14
  'Vũ trụ',            // 15
  'Thượng đế',         // 16
  'Huyền bí',          // 17
  'Vĩnh cửu',          // 18
  'Tối thượng',        // 19
  'Rabbit Master',     // 20
  // ── Tier Huyền Thoại (21-30) ──
  'Thiên Sứ',          // 21
  'Địa Linh',          // 22
  'Nhân Kiệt',         // 23
  'Hoàng Đế',          // 24
  'Thần Vương',        // 25
  'Thánh Nhân',        // 26
  'Tiên Giới',         // 27
  'Ma Vương',          // 28
  'Thần Long',         // 29
  'Ngũ Đế',            // 30
  // ── Tier Thần Thánh (31-40) ──
  'Cửu Thiên',         // 31
  'Vạn Thần',          // 32
  'Địa Tôn',           // 33
  'Thiên Tôn',         // 34
  'Vô Cực',            // 35
  'Hư Không',          // 36
  'Hỗn Độn',           // 37
  'Nguyên Thủy',       // 38
  'Khai Thiên',        // 39
  'Phán Trái Đất',     // 40
  // ── Tier Vũ Trụ (41-50) ──
  'Vũ Trụ Vương',      // 41
  'Đa Chiều',          // 42
  'Siêu Vũ Trụ',       // 43
  'Thái Cực',          // 44
  'Vô Biên',           // 45
  'Toàn Tri',          // 46
  'Toàn Năng',         // 47
  'Tuyệt Đối',         // 48
  'Hư Vô',             // 49
  'Rabbit God',        // 50
];

const LEVEL_EMOJIS = [
  // Tier Người Thường (1-10)
  '🌱','🌿','🍀','🌸','⚔️','🛡️','🦸','🏆','👑','💎',
  // Tier Phi Thường (11-20)
  '🌟','⚡','🐉','🔮','🌌','🏛️','🦅','💫','🌈','🐰',
  // Tier Huyền Thoại (21-30)
  '🌠','🗺️','🌊','👸','🔱','🕊️','🌺','😈','🐲','🏯',
  // Tier Thần Thánh (31-40)
  '☁️','🌀','⛰️','🌤️','♾️','🌑','🌪️','🌋','💥','🌍',
  // Tier Vũ Trụ (41-50)
  '🪐','🌐','🌌','☯️','♾️','👁️','⚡','💫','🌫️','🐰'
];

// Level-up rewards: free items given when reaching each level
const LEVEL_REWARDS = {
  // Tier Người Thường
  2:  { food: 3, water: 2 },
  3:  { food: 3, water: 3, seed: 2 },
  4:  { food: 5, water: 3, meat: 2 },
  5:  { food: 5, water: 5, treat: 2, fertilizer: 2 },
  6:  { food: 5, water: 5, meat: 3, fish: 3 },
  7:  { food: 8, water: 5, treat: 3, fertilizer: 3 },
  8:  { food: 8, water: 8, meat: 5, fish: 5, seed: 3 },
  9:  { food: 10, water: 8, treat: 5, fertilizer: 5 },
  10: { food: 10, water: 10, meat: 8, fish: 8, treat: 5, seed: 5, fertilizer: 5 },
  // Tier Phi Thường
  15: { food: 15, water: 15, meat: 10, fish: 10, treat: 8, seed: 8, fertilizer: 8 },
  20: { food: 20, water: 20, meat: 15, fish: 15, treat: 10, seed: 10, fertilizer: 10, coffee: 5 },
  // Tier Huyền Thoại
  25: { food: 25, water: 25, meat: 20, fish: 20, treat: 15, seed: 15, fertilizer: 15, coffee: 8, rose: 5 },
  30: { food: 30, water: 30, meat: 25, fish: 25, treat: 20, seed: 20, fertilizer: 20, coffee: 12, rose: 8, chocolate: 5 },
  // Tier Thần Thánh
  35: { food: 40, water: 40, meat: 30, fish: 30, treat: 25, seed: 25, fertilizer: 25, coffee: 15, rose: 12, chocolate: 8, star: 5 },
  40: { food: 50, water: 50, meat: 40, fish: 40, treat: 30, seed: 30, fertilizer: 30, coffee: 20, rose: 15, chocolate: 12, star: 8 },
  // Tier Vũ Trụ
  45: { food: 60, water: 60, meat: 50, fish: 50, treat: 40, seed: 40, fertilizer: 40, coffee: 25, rose: 20, chocolate: 18, star: 15 },
  50: { food: 99, water: 99, meat: 99, fish: 99, treat: 99, seed: 99, fertilizer: 99, coffee: 50, rose: 50, chocolate: 50, star: 50 },
};

// GET /api/gamification/level — current level info
router.get('/level', async (req, res) => {
  try {
    const up = await UserPoints.findOne({ userId: req.userId });
    if (!up) return res.json({ level: 1, totalEarned: 0, thresholds: UserPoints.LEVEL_THRESHOLDS, names: LEVEL_NAMES, emojis: LEVEL_EMOJIS });

    // Ensure level is calculated
    up.calcLevel();
    await up.save();

    const lvl = up.level || 1;
    const thresholds = UserPoints.LEVEL_THRESHOLDS;
    const currentThreshold = thresholds[lvl - 1] || 0;
    const nextThreshold = thresholds[lvl] || null;

    res.json({
      level: lvl,
      name: LEVEL_NAMES[lvl - 1] || LEVEL_NAMES[LEVEL_NAMES.length - 1],
      emoji: LEVEL_EMOJIS[lvl - 1] || LEVEL_EMOJIS[LEVEL_EMOJIS.length - 1],
      totalEarned: up.totalEarned,
      currentThreshold,
      nextThreshold,
      thresholds,
      names: LEVEL_NAMES,
      emojis: LEVEL_EMOJIS
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ WEEKLY CHALLENGES ═══

// Challenge templates
const CHALLENGE_POOL = [
  // Tasks
  { id: 'tasks_5',       title: 'Hoàn thành 5 tasks',             emoji: '✅', type: 'tasks',   target: 5,  reward: 25 },
  { id: 'tasks_10',      title: 'Hoàn thành 10 tasks',            emoji: '📋', type: 'tasks',   target: 10, reward: 50 },
  { id: 'tasks_15',      title: 'Hoàn thành 15 tasks',            emoji: '🔥', type: 'tasks',   target: 15, reward: 80 },
  { id: 'tasks_high_3',  title: 'Hoàn thành 3 task ưu tiên cao',  emoji: '🔴', type: 'tasks_high', target: 3, reward: 40 },
  { id: 'tasks_high_5',  title: 'Hoàn thành 5 task ưu tiên cao',  emoji: '💪', type: 'tasks_high', target: 5, reward: 70 },
  // Habits
  { id: 'habits_daily_5', title: 'Check habit 5 ngày liên tiếp',  emoji: '🐇', type: 'habits_days', target: 5, reward: 40 },
  { id: 'habits_daily_7', title: 'Check habit 7 ngày (cả tuần!)', emoji: '🏆', type: 'habits_days', target: 7, reward: 60 },
  { id: 'habits_total_10',title: 'Hoàn thành 10 habit logs',      emoji: '🐰', type: 'habits_total', target: 10, reward: 45 },
  // Journal
  { id: 'journal_3',     title: 'Viết nhật ký 3 ngày',            emoji: '📝', type: 'journal', target: 3,  reward: 30 },
  { id: 'journal_5',     title: 'Viết nhật ký 5 ngày',            emoji: '📖', type: 'journal', target: 5,  reward: 50 },
  { id: 'journal_7',     title: 'Viết nhật ký mỗi ngày trong tuần', emoji: '📚', type: 'journal', target: 7, reward: 80 },
  // Goals
  { id: 'goals_3',       title: 'Hoàn thành 3 ngày mục tiêu',    emoji: '🎯', type: 'goals',   target: 3,  reward: 35 },
  { id: 'goals_5',       title: 'Hoàn thành 5 ngày mục tiêu',    emoji: '🎯', type: 'goals',   target: 5,  reward: 55 },
  // Points
  { id: 'earn_30',       title: 'Kiếm 30 điểm trong tuần',       emoji: '⭐', type: 'points',  target: 30, reward: 20 },
  { id: 'earn_80',       title: 'Kiếm 80 điểm trong tuần',       emoji: '💰', type: 'points',  target: 80, reward: 50 },
];

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function pickRandomChallenges(count = 3) {
  const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
  // Pick from different types
  const picked = [];
  const usedTypes = new Set();
  for (const c of shuffled) {
    const baseType = c.type.split('_')[0]; // 'tasks', 'habits', 'journal', etc
    if (picked.length >= count) break;
    if (usedTypes.size < count && usedTypes.has(baseType)) continue;
    usedTypes.add(baseType);
    picked.push({ ...c, progress: 0, completed: false, claimedAt: null });
  }
  // Fill remaining if not enough diverse types
  while (picked.length < count) {
    const c = shuffled.find(s => !picked.some(p => p.id === s.id));
    if (!c) break;
    picked.push({ ...c, progress: 0, completed: false, claimedAt: null });
  }
  return picked;
}

// GET /api/gamification/weekly — get or create this week's challenges
router.get('/weekly', async (req, res) => {
  try {
    const weekStart = getWeekStart(new Date());
    let wc = await WeeklyChallenge.findOne({ userId: req.userId, weekStart });

    if (!wc) {
      wc = await WeeklyChallenge.create({
        userId: req.userId,
        weekStart,
        challenges: pickRandomChallenges(3)
      });
    }

    // Calculate progress for each challenge
    const weekStartDate = new Date(weekStart);
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const wsStr = weekStart;
    const weStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth()+1).padStart(2,'0')}-${String(weekEnd.getDate()).padStart(2,'0')}`;

    // Gather data for progress calculation
    const [tasks, habitLogs, journals, goals] = await Promise.all([
      Task.find({ userId: req.userId, date: { $gte: wsStr, $lt: weStr } }),
      HabitLog.find({ userId: req.userId, date: { $gte: wsStr, $lt: weStr }, done: true }),
      Journal.find({ userId: req.userId, date: { $gte: wsStr, $lt: weStr } }),
      Goal.find({ userId: req.userId })
    ]);

    const completedTasks = tasks.filter(t => t.completed);
    const highPriorityCompleted = completedTasks.filter(t => t.priority === 3);

    // Count unique habit log days
    const habitDays = new Set(habitLogs.map(l => l.date)).size;

    // Count journal entries
    const journalCount = journals.length;

    // Count completed goal days this week
    let goalDaysCompleted = 0;
    for (const g of goals) {
      if (!g.days) continue;
      for (const d of g.days) {
        if (d.done && d.date >= wsStr && d.date < weStr) goalDaysCompleted++;
      }
    }

    // Calculate points earned this week (approximate from completed tasks/habits)
    const taskPoints = completedTasks.reduce((sum, t) => sum + ([5,5,8,12][t.priority] || 5), 0);
    const habitPoints = habitLogs.length * 5;
    const goalPoints = goalDaysCompleted * 8;
    const weeklyPointsEarned = taskPoints + habitPoints + goalPoints;

    // Update progress
    let changed = false;
    for (const c of wc.challenges) {
      let newProgress = 0;
      switch (c.type) {
        case 'tasks':       newProgress = completedTasks.length; break;
        case 'tasks_high':  newProgress = highPriorityCompleted.length; break;
        case 'habits_days': newProgress = habitDays; break;
        case 'habits_total':newProgress = habitLogs.length; break;
        case 'journal':     newProgress = journalCount; break;
        case 'goals':       newProgress = goalDaysCompleted; break;
        case 'points':      newProgress = weeklyPointsEarned; break;
      }
      if (newProgress !== c.progress) {
        c.progress = newProgress;
        if (newProgress >= c.target && !c.completed) {
          c.completed = true;
        }
        changed = true;
      }
    }
    if (changed) await wc.save();

    res.json({
      weekStart: wc.weekStart,
      challenges: wc.challenges,
      pool: CHALLENGE_POOL // for reference
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gamification/weekly/claim  { challengeId }
router.post('/weekly/claim', async (req, res) => {
  try {
    const { challengeId } = req.body;
    const weekStart = getWeekStart(new Date());
    const wc = await WeeklyChallenge.findOne({ userId: req.userId, weekStart });
    if (!wc) return res.status(404).json({ error: 'Không tìm thấy thách thức tuần này' });

    const challenge = wc.challenges.find(c => c.id === challengeId);
    if (!challenge) return res.status(404).json({ error: 'Thách thức không tồn tại' });
    if (!challenge.completed) return res.status(400).json({ error: 'Chưa hoàn thành thách thức!' });
    if (challenge.claimedAt) return res.status(400).json({ error: 'Đã nhận thưởng rồi!' });

    challenge.claimedAt = new Date();
    await wc.save();

    // Award points
    let up = await UserPoints.findOne({ userId: req.userId });
    if (!up) up = await UserPoints.create({ userId: req.userId, points: 0 });
    const levelResult = up.addPoints(challenge.reward);
    await up.save();

    res.json({
      reward: challenge.reward,
      points: up.points,
      totalEarned: up.totalEarned,
      level: up.level,
      leveledUp: levelResult.leveledUp,
      oldLevel: levelResult.oldLevel,
      newLevel: levelResult.newLevel,
      challenges: wc.challenges
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ FRIENDS & LEADERBOARD ═══

// Generate unique friend code on first request
async function ensureFriendCode(user) {
  if (user.friendCode) return user.friendCode;
  const code = user.username.toUpperCase().slice(0, 4) + Math.random().toString(36).slice(2, 6).toUpperCase();
  user.friendCode = code;
  await user.save();
  return code;
}

// GET /api/gamification/friend-code
router.get('/friend-code', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const code = await ensureFriendCode(user);
    res.json({ friendCode: code });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gamification/friend-request  { friendCode }
router.post('/friend-request', async (req, res) => {
  try {
    const { friendCode } = req.body;
    if (!friendCode) return res.status(400).json({ error: 'Nhập mã bạn bè!' });

    const target = await User.findOne({ friendCode: friendCode.toUpperCase() });
    if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng với mã này' });
    if (target._id.toString() === req.userId) return res.status(400).json({ error: 'Không thể kết bạn với chính mình!' });

    const me = await User.findById(req.userId);

    // Check if already friends
    if (me.friends.some(f => f.toString() === target._id.toString())) {
      return res.status(400).json({ error: 'Đã là bạn bè rồi!' });
    }

    // Check if already sent request
    if (target.friendRequests.some(r => r.from.toString() === req.userId)) {
      return res.status(400).json({ error: 'Đã gửi lời mời rồi!' });
    }

    // Check if target already sent us a request → auto accept
    const incomingReq = me.friendRequests.find(r => r.from.toString() === target._id.toString());
    if (incomingReq) {
      // Auto accept — add each other as friends
      me.friends.push(target._id);
      target.friends.push(me._id);
      me.friendRequests = me.friendRequests.filter(r => r.from.toString() !== target._id.toString());
      await me.save();
      await target.save();
      return res.json({ ok: true, accepted: true, message: 'Đã kết bạn thành công!' });
    }

    target.friendRequests.push({ from: me._id });
    await target.save();
    res.json({ ok: true, message: 'Đã gửi lời mời kết bạn!' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gamification/friend-requests — incoming requests
router.get('/friend-requests', async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('friendRequests.from', 'username displayName');
    res.json(user.friendRequests || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gamification/friend-accept  { userId }
router.post('/friend-accept', async (req, res) => {
  try {
    const { userId: friendId } = req.body;
    const me = await User.findById(req.userId);
    const friend = await User.findById(friendId);
    if (!friend) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    const reqIdx = me.friendRequests.findIndex(r => r.from.toString() === friendId);
    if (reqIdx === -1) return res.status(400).json({ error: 'Không có lời mời từ người này' });

    me.friendRequests.splice(reqIdx, 1);
    if (!me.friends.some(f => f.toString() === friendId)) me.friends.push(friendId);
    if (!friend.friends.some(f => f.toString() === req.userId)) friend.friends.push(req.userId);

    await me.save();
    await friend.save();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gamification/friend-reject  { userId }
router.post('/friend-reject', async (req, res) => {
  try {
    const { userId: friendId } = req.body;
    const me = await User.findById(req.userId);
    me.friendRequests = me.friendRequests.filter(r => r.from.toString() !== friendId);
    await me.save();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gamification/friend-remove  { userId }
router.post('/friend-remove', async (req, res) => {
  try {
    const { userId: friendId } = req.body;
    const me = await User.findById(req.userId);
    const friend = await User.findById(friendId);

    me.friends = me.friends.filter(f => f.toString() !== friendId);
    if (friend) friend.friends = friend.friends.filter(f => f.toString() !== req.userId);

    await me.save();
    if (friend) await friend.save();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gamification/leaderboard — friends leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const friendIds = [...(me.friends || []), me._id];

    // Get points for all friends + self
    const pointsDocs = await UserPoints.find({ userId: { $in: friendIds } });
    const pointsMap = {};
    for (const p of pointsDocs) pointsMap[p.userId.toString()] = p;

    // Get streak info for all (we'll use totalEarned as proxy — real streak needs tasks query)
    const users = await User.find({ _id: { $in: friendIds } }).select('username displayName');

    const board = users.map(u => {
      const up = pointsMap[u._id.toString()];
      return {
        userId: u._id,
        username: u.username,
        displayName: u.displayName || u.username,
        isMe: u._id.toString() === req.userId,
        level: up?.level || 1,
        totalEarned: up?.totalEarned || 0,
        points: up?.points || 0,
        badges: (up?.badges || []).length
      };
    });

    // Sort by totalEarned desc
    board.sort((a, b) => b.totalEarned - a.totalEarned);

    // Add rank
    board.forEach((b, i) => b.rank = i + 1);

    res.json(board);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gamification/friends-list
router.get('/friends-list', async (req, res) => {
  try {
    const me = await User.findById(req.userId).populate('friends', 'username displayName lastSeen');
    const today     = todayKey();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    // Which friends already got fire today
    const sentToday = (me.sentFires || [])
      .filter(s => s.sentAt.toISOString().slice(0, 10) === today)
      .map(s => s.to.toString());
    const onlineThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
    const isActive = d => d === today || d === yesterday;
    const friends = (me.friends || []).map(f => {
      const fid = f._id.toString();
      const streakEntry = (me.fireStreaks || []).find(s => s.with?.toString() === fid);
      const myFireStreak = (streakEntry && isActive(streakEntry.lastSentDate)) ? streakEntry.streak : 0;
      return {
        _id: f._id,
        username: f.username,
        displayName: f.displayName,
        fireSentToday: sentToday.includes(fid),
        isOnline: f.lastSeen && f.lastSeen > onlineThreshold,
        myFireStreak,
      };
    });
    res.json(friends);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ FIRE SYSTEM ═══

const FIRE_MESSAGES = [
  'đã truyền lửa ý chí chiến đấu cho bạn! Hãy bùng cháy nào!',
  'gửi đến bạn ngọn lửa bất diệt — tiến lên không dừng!',
  'muốn nhắn với bạn: Bạn mạnh hơn mọi trở ngại! 💪',
  'thấy bạn đang cố gắng và cảm thấy rất tự hào về bạn!',
  'tin tưởng bạn sẽ chinh phục mọi thử thách hôm nay!',
  'gửi năng lượng tích cực đến bạn — đừng bao giờ bỏ cuộc!',
  'nhắn với bạn: Mỗi ngày nhỏ tích thành thành công lớn!',
  'truyền cho bạn ý chí của người chiến binh — xông lên!',
  'muốn bạn biết: Sự kiên trì của bạn thật đáng ngưỡng mộ!',
  'thổi bùng ngọn lửa trong tim bạn — hôm nay là ngày của bạn!',
  'gửi đến bạn: Khó khăn chỉ là bậc thang dẫn đến thành công!',
  'tin rằng bạn đang trên đúng con đường — cứ tiếp tục đi!',
  'chia sẻ với bạn: Người chiến thắng không bao giờ bỏ cuộc!',
  'truyền lửa đam mê cho bạn — hãy làm điều bạn yêu thích!',
  'nhắn với bạn: Streak của bạn không được phép tắt! 🔥',
  'gửi năng lượng mặt trời cho bạn — rực rỡ lên nào!',
  'muốn bạn nhớ: Từng bước nhỏ đều có giá trị!',
  'truyền đến bạn tinh thần Rabbit Habits — kiên trì bền bỉ!',
  'nhắn với bạn: Hôm nay dù khó, ngày mai sẽ tự hào!',
  'gửi đến bạn: Thói quen tốt tạo nên cuộc đời tốt!',
  'thấy bạn đang làm rất tốt — đừng để ngọn lửa tắt!',
  'truyền cho bạn: Mỗi task hoàn thành là một chiến thắng!',
  'nhắn với bạn: Ngay cả thỏ con cũng biết kiên trì! 🐰',
  'gửi năng lượng vũ trụ cho bạn — phá vỡ giới hạn đi!',
  'muốn bạn biết: Bạn đang truyền cảm hứng cho tôi!',
  'truyền lửa hy vọng cho bạn — ánh sáng luôn ở phía trước!',
  'nhắn với bạn: Sức mạnh thật sự đến từ sự kiên định!',
  'gửi đến bạn: Đừng so sánh, hãy cạnh tranh với chính mình!',
  'thấy bạn cần thêm lửa — đây, nhận hết đi! 🔥🔥🔥',
  'truyền cho bạn: Kỷ luật hôm nay, tự do ngày mai!',
  'nhắn với bạn: Streak dài nhất bắt đầu từ một ngày!',
  'gửi năng lượng chiến binh cho bạn — không lùi bước!',
  'muốn bạn nghe: Bạn đã xa hơn hôm qua rồi đó!',
  'truyền lửa nhiệt huyết cho bạn — cháy hết mình đi!',
  'nhắn với bạn: Thành công không ồn ào, cứ âm thầm mà tiến!',
  'gửi đến bạn: Mọi chuyên gia đều từng là người mới bắt đầu!',
  'thấy bạn xứng đáng được tiếp lửa — đây nhé! ✨',
  'truyền cho bạn tinh thần không bao giờ bỏ cuộc!',
  'nhắn với bạn: Hôm nay cố gắng, tương lai cảm ơn!',
  'gửi năng lượng tích cực vô hạn cho bạn — hãy đón nhận!',
  'muốn bạn biết: Tôi tin bạn làm được điều vĩ đại!',
  'truyền lửa chiến đấu cho bạn — đây là ngày bạn tỏa sáng!',
  'nhắn với bạn: Mỗi thói quen tốt là một viên gạch xây thành công!',
  'gửi đến bạn: Đừng đếm ngày, hãy làm cho ngày có ý nghĩa!',
  'thấy bạn đang chăm chỉ — xứng đáng được tiếp thêm lửa! 🏆',
  'truyền cho bạn: Sóng to mới thấy lái giỏi — cứ tiến lên!',
  'nhắn với bạn: Bạn không đơn độc, tôi luôn ở đây cổ vũ!',
  'gửi năng lượng phượng hoàng cho bạn — vươn lên từ tro tàn!',
  'muốn bạn nhớ: Mệt thì nghỉ nhưng đừng bỏ cuộc nhé!',
  'truyền hết năng lượng của mình cho bạn — dùng đi nào! 💫',
];

// Helper: today's date string in UTC (YYYY-MM-DD)
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// POST /api/gamification/send-fire  { toUserId }
router.post('/send-fire', async (req, res) => {
  try {
    const { toUserId } = req.body;
    if (!toUserId) return res.status(400).json({ error: 'Thiếu người nhận' });

    const me = await User.findById(req.userId).select('username displayName friends sentFires');
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    // Must be friends
    if (!me.friends.some(f => f.toString() === toUserId)) {
      return res.status(400).json({ error: 'Chỉ bạn bè mới nhận được lửa!' });
    }

    // Purge stale sentFires (older than today)
    const today = todayKey();
    me.sentFires = (me.sentFires || []).filter(s => s.sentAt.toISOString().slice(0, 10) === today);

    // Check daily limit: 1 fire per friend per day
    const alreadySent = me.sentFires.some(s => s.to.toString() === toUserId);
    if (alreadySent) {
      return res.status(429).json({ error: 'Đã gửi lửa cho bạn này hôm nay rồi! Ngày mai hãy gửi tiếp nhé 🔥' });
    }

    const target = await User.findById(toUserId);
    if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    // Pick random message
    const message = FIRE_MESSAGES[Math.floor(Math.random() * FIRE_MESSAGES.length)];
    const fromName = me.displayName || me.username;

    // Keep only last 20 fires per recipient
    if (target.receivedFires.length >= 20) {
      target.receivedFires = target.receivedFires.slice(-19);
    }
    target.receivedFires.push({ from: me._id, fromName, message });
    await target.save();

    // Record that I sent fire today
    me.sentFires.push({ to: toUserId, sentAt: new Date() });

    // ── Update fire streak toward this friend ──
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (!me.fireStreaks) me.fireStreaks = [];
    const myStreakEntry = me.fireStreaks.find(s => s.with?.toString() === toUserId);
    if (myStreakEntry) {
      if (myStreakEntry.lastSentDate === yesterday) {
        myStreakEntry.streak += 1;
      } else if (myStreakEntry.lastSentDate !== today) {
        myStreakEntry.streak = 1;
      }
      // if lastSentDate === today: already counted this day, no change
      myStreakEntry.lastSentDate = today;
    } else {
      me.fireStreaks.push({ with: toUserId, streak: 1, lastSentDate: today });
    }

    await me.save();

    res.json({ ok: true, message });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gamification/fire-streak/:friendId — mutual fire streak between me and a friend
router.get('/fire-streak/:friendId', async (req, res) => {
  try {
    const { friendId } = req.params;
    const today     = todayKey();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const [me, friend] = await Promise.all([
      User.findById(req.userId).select('fireStreaks'),
      User.findById(friendId).select('fireStreaks displayName username')
    ]);
    if (!friend) return res.status(404).json({ error: 'Không tìm thấy bạn bè' });

    const myEntry     = (me.fireStreaks     || []).find(s => s.with?.toString() === friendId);
    const theirEntry  = (friend.fireStreaks || []).find(s => s.with?.toString() === req.userId);

    // Streak only counts if they sent fire today or yesterday (still active)
    const isActive = d => d === today || d === yesterday;
    const myStreak    = (myEntry    && isActive(myEntry.lastSentDate))   ? myEntry.streak    : 0;
    const theirStreak = (theirEntry && isActive(theirEntry.lastSentDate)) ? theirEntry.streak : 0;
    const mutual      = Math.min(myStreak, theirStreak);

    res.json({ myStreak, theirStreak, mutual });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gamification/fires — get my unseen fires
router.get('/fires', async (req, res) => {
  try {
    const me = await User.findById(req.userId).select('receivedFires sentFires');
    const today = todayKey();
    const sentToday = new Set((me.sentFires || [])
      .filter(s => s.sentAt.toISOString().slice(0, 10) === today)
      .map(s => s.to.toString()));
    const fires = (me.receivedFires || []).filter(f => !f.seen).map(f => ({
      ...f.toObject(),
      alreadySentBack: sentToday.has(f.from.toString())
    }));
    res.json(fires);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gamification/fires/seen — mark all fires as seen
router.post('/fires/seen', async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    me.receivedFires.forEach(f => { f.seen = true; });
    await me.save();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gamification/notifications — badge counts (includes unread messages)
router.get('/notifications', async (req, res) => {
  try {
    const [me, messageCount] = await Promise.all([
      User.findById(req.userId).select('friendRequests receivedFires receivedGifts'),
      Message.countDocuments({ to: req.userId, seen: false })
    ]);
    const requestCount = (me.friendRequests || []).length;
    const fireCount    = (me.receivedFires  || []).filter(f => !f.seen).length;
    const giftCount    = (me.receivedGifts  || []).filter(g => !g.seen).length;
    res.json({ requestCount, fireCount, giftCount, messageCount, total: requestCount + fireCount + giftCount + messageCount });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ GIFT SYSTEM ═══

// Catalog of giftable items (must match shop.js SHOP_ITEMS ids)
const GIFT_ITEMS = [
  { id:'food',      name:'Cà rốt',          emoji:'🥕' },
  { id:'meat',      name:'Thịt tươi',        emoji:'🥩' },
  { id:'fish',      name:'Cá hồi',           emoji:'🐟' },
  { id:'seed',      name:'Hạt giống',        emoji:'🌻' },
  { id:'treat',     name:'Bánh thưởng',      emoji:'🍪' },
  { id:'water',     name:'Nước sạch',        emoji:'💧' },
  { id:'fertilizer',name:'Phân bón',         emoji:'🌿' },
  { id:'coffee',    name:'Cà phê',           emoji:'☕' },
  { id:'rose',      name:'Hoa hồng',         emoji:'🌹' },
  { id:'chocolate', name:'Socola',           emoji:'🍫' },
  { id:'star',      name:'Ngôi sao may mắn', emoji:'⭐' },
];

// POST /api/gamification/gift-item  { toUserId, itemId, qty }
router.post('/gift-item', async (req, res) => {
  try {
    const { toUserId, itemId, qty: rawQty } = req.body;
    const qty = parseInt(rawQty) || 1;
    if (!toUserId || !itemId) return res.status(400).json({ error: 'Thiếu thông tin quà tặng' });
    if (qty < 1 || qty > 20) return res.status(400).json({ error: 'Số lượng phải từ 1 đến 20' });

    const item = GIFT_ITEMS.find(i => i.id === itemId);
    if (!item) return res.status(400).json({ error: 'Vật phẩm không hợp lệ' });

    const me = await User.findById(req.userId).select('friends username displayName');
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    // Must be friends
    if (!me.friends.some(f => f.toString() === toUserId)) {
      return res.status(400).json({ error: 'Chỉ bạn bè mới nhận được quà!' });
    }

    const recipient = await User.findById(toUserId);
    if (!recipient) return res.status(404).json({ error: 'Không tìm thấy người nhận' });

    // Deduct from sender's inventory
    const senderUP = await UserPoints.findOne({ userId: req.userId });
    if (!senderUP) return res.status(400).json({ error: 'Không có vật phẩm trong kho!' });
    if ((senderUP[itemId] || 0) < qty) return res.status(400).json({ error: `Không đủ ${item.name} trong kho!` });
    senderUP[itemId] -= qty;
    await senderUP.save();

    // Add to recipient's inventory
    let recipientUP = await UserPoints.findOne({ userId: toUserId });
    if (!recipientUP) recipientUP = await UserPoints.create({ userId: toUserId });

    // Special effect: star = random bonus points (10–100 per star)
    let bonusPoints = 0;
    if (itemId === 'star') {
      for (let i = 0; i < qty; i++) {
        bonusPoints += 10 + Math.floor(Math.random() * 91);
      }
      recipientUP.addPoints(bonusPoints);
    } else {
      recipientUP[itemId] = (recipientUP[itemId] || 0) + qty;
    }
    await recipientUP.save();

    // Record gift notification
    const fromName = me.displayName || me.username;
    recipient.receivedGifts = recipient.receivedGifts || [];
    recipient.receivedGifts.push({ from: me._id, fromName, itemId: item.id, itemName: item.name, itemEmoji: item.emoji, qty, bonusPoints });
    await recipient.save();

    res.json({ ok: true, [itemId]: senderUP[itemId] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gamification/gifts — unseen received gifts
router.get('/gifts', async (req, res) => {
  try {
    const me = await User.findById(req.userId).select('receivedGifts');
    const unseen = (me.receivedGifts || []).filter(g => !g.seen);
    res.json(unseen);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gamification/gifts/seen
router.post('/gifts/seen', async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    (me.receivedGifts || []).forEach(g => { g.seen = true; });
    await me.save();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ ACHIEVEMENT STATS ═══
// Returns detailed stats needed for the achievement page progress bars
router.get('/achievement-stats', async (req, res) => {
  try {
    const [up, tasks, habitLogs, journals, goals, pets] = await Promise.all([
      UserPoints.findOne({ userId: req.userId }),
      Task.countDocuments({ userId: req.userId, completed: true }),
      HabitLog.find({ userId: req.userId, done: true }),
      Journal.countDocuments({ userId: req.userId }),
      Goal.find({ userId: req.userId }),
      mongoose.model('Pet').find({ userId: req.userId, alive: true })
    ]);

    // Calculate max habit streak
    let maxHabitStreak = 0;
    // Group habit logs by habitId and calculate streak
    const habitGroups = {};
    for (const log of habitLogs) {
      const key = log.habitId.toString();
      if (!habitGroups[key]) habitGroups[key] = [];
      habitGroups[key].push(log.date);
    }
    for (const dates of Object.values(habitGroups)) {
      dates.sort();
      let streak = 1, maxS = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i-1]);
        const curr = new Date(dates[i]);
        const diff = (curr - prev) / 86400000;
        if (diff === 1) { streak++; maxS = Math.max(maxS, streak); }
        else if (diff > 1) streak = 1;
      }
      maxHabitStreak = Math.max(maxHabitStreak, maxS);
    }

    // Global streak
    let globalMaxStreak = 0;
    const allCompletedDates = new Set();
    const allTasks = await Task.find({ userId: req.userId, completed: true }).select('date');
    allTasks.forEach(t => allCompletedDates.add(t.date));
    habitLogs.forEach(l => allCompletedDates.add(l.date));
    const sortedDates = [...allCompletedDates].sort();
    if (sortedDates.length > 0) {
      let streak = 1;
      globalMaxStreak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i-1]);
        const curr = new Date(sortedDates[i]);
        const diff = (curr - prev) / 86400000;
        if (diff === 1) { streak++; globalMaxStreak = Math.max(globalMaxStreak, streak); }
        else if (diff > 1) streak = 1;
      }
    }

    // Goal days completed
    let goalDays = 0;
    for (const g of goals) {
      if (!g.days) continue;
      goalDays += g.days.filter(d => d.done).length;
    }

    // Care total
    let careTotal = 0;
    for (const p of pets) {
      careTotal += (p.timesFed || 0) + (p.timesWatered || 0) + (p.timesFertilized || 0);
    }
    // Also count dead pets' care
    const deadPets = await mongoose.model('Pet').find({ userId: req.userId, alive: false });
    for (const p of deadPets) {
      careTotal += (p.timesFed || 0) + (p.timesWatered || 0) + (p.timesFertilized || 0);
    }

    res.json({
      tasks: tasks,
      streak: globalMaxStreak,
      pets: pets.length,
      points: up?.totalEarned || 0,
      goals: goalDays,
      habit_streak: maxHabitStreak,
      care: careTotal,
      journal: journals,
      level: up?.level || 1,
      totalEarned: up?.totalEarned || 0,
      badges: (up?.badges || []).length,
      totalBadges: (up?.badges || []).map(b => b.id)
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ MESSAGING ═══

// GET /api/gamification/conversations — list recent conversations
router.get('/conversations', async (req, res) => {
  try {
    const me = await User.findById(req.userId).select('friends');
    const friendIds = (me.friends || []).map(f => f.toString());

    // Get last message + unread count for each friend
    const conversations = [];
    for (const fid of friendIds) {
      const lastMsg = await Message.findOne({
        $or: [
          { from: req.userId, to: fid },
          { from: fid, to: req.userId }
        ]
      }).sort({ createdAt: -1 }).limit(1);

      const unread = await Message.countDocuments({ from: fid, to: req.userId, seen: false });

      const friend = await User.findById(fid).select('username displayName lastSeen');
      if (!friend) continue;

      conversations.push({
        friendId: fid,
        friendName: friend.displayName || friend.username,
        lastMessage: lastMsg ? { content: lastMsg.content, fromMe: lastMsg.from.toString() === req.userId, createdAt: lastMsg.createdAt } : null,
        unread,
        isOnline: friend.lastSeen && friend.lastSeen > new Date(Date.now() - 5 * 60 * 1000)
      });
    }

    // Sort: unread first, then by last message time
    conversations.sort((a, b) => {
      if (a.unread > 0 && b.unread === 0) return -1;
      if (a.unread === 0 && b.unread > 0) return 1;
      const aTime = a.lastMessage?.createdAt || 0;
      const bTime = b.lastMessage?.createdAt || 0;
      return new Date(bTime) - new Date(aTime);
    });

    res.json(conversations);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gamification/messages/:friendId?before=&limit=
router.get('/messages/:friendId', async (req, res) => {
  try {
    const { friendId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 30, 50);
    const before = req.query.before;

    // Must be friends
    const me = await User.findById(req.userId).select('friends');
    if (!me.friends.some(f => f.toString() === friendId)) {
      return res.status(403).json({ error: 'Không phải bạn bè!' });
    }

    const query = {
      $or: [
        { from: req.userId, to: friendId },
        { from: friendId, to: req.userId }
      ]
    };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(query).sort({ createdAt: -1 }).limit(limit);

    // Mark incoming messages as seen
    await Message.updateMany(
      { from: friendId, to: req.userId, seen: false },
      { seen: true }
    );

    res.json(messages.reverse());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gamification/messages  { toUserId, content }
router.post('/messages', async (req, res) => {
  try {
    const { toUserId, content } = req.body;
    if (!toUserId || !content?.trim()) return res.status(400).json({ error: 'Thiếu nội dung tin nhắn' });
    if (content.length > 500) return res.status(400).json({ error: 'Tin nhắn quá dài (tối đa 500 ký tự)' });

    const me = await User.findById(req.userId).select('friends username displayName');
    if (!me.friends.some(f => f.toString() === toUserId)) {
      return res.status(403).json({ error: 'Chỉ bạn bè mới nhắn tin được!' });
    }

    const msg = await Message.create({
      from: req.userId,
      to: toUserId,
      content: content.trim()
    });

    res.json(msg);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gamification/unread-messages — total unread count
router.get('/unread-messages', async (req, res) => {
  try {
    const count = await Message.countDocuments({ to: req.userId, seen: false });
    res.json({ count });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
