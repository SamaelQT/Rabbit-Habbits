# 🐰 Rabbit Habits

Nền tảng năng suất cá nhân và gamification bằng tiếng Việt. Theo dõi thói quen, mục tiêu dài hạn, nhật ký cảm xúc và nhận thưởng thú cưng khi duy trì chuỗi ngày tốt.

---

## Tính năng

### ✅ Tasks & Năng suất
- Tạo, hoàn thành, xoá task với 4 mức độ ưu tiên
- Tiền thưởng điểm tăng theo level của người dùng (×1.1 mỗi level)
- Thống kê tuần/tháng/năm: tỉ lệ hoàn thành, top tasks, giờ làm việc hiệu quả
- Thông báo nhắc nhở task **quá hạn** (từ 7 ngày trước chưa hoàn thành)

### 🐇 Thói quen (Habits)
- Theo dõi thói quen hàng ngày với streak
- Heatmap lịch sử, biểu đồ xu hướng 8 tuần, phân tích ngày tốt nhất

### 🎯 Mục tiêu dài hạn (Goals)
- Tạo mục tiêu nhiều ngày với kế hoạch từng ngày
- Mục tiêu đã kết thúc (dù bỏ lỡ một vài ngày) có thể lưu vào **Kho lưu trữ**
- Thống kê kho: tổng mục tiêu, ngày hoàn thành, tỉ lệ TB, mục tiêu hoàn hảo

### 📓 Nhật ký (Journal)
- Ghi lại tâm trạng và nội dung mỗi ngày
- Biểu đồ xu hướng cảm xúc 30 ngày, phân tích theo ngày trong tuần

### 🐾 Thú cưng (Pets)
- 13 loại thú cưng: 5 động vật, 8 cây cối
- Mỗi loài có **10 biến thể** (tên + emoji riêng); cây cối có tint màu CSS
- Thú cưng phát triển theo điểm tích lũy (10 giai đoạn)
- Thú cưng bị bệnh nếu bị bỏ bê 3+ ngày liên tiếp, có thể chết nếu quá lâu
- Thú cưng di chuyển dọc cạnh/góc màn hình, tránh che cursor người dùng

### 🎮 Gamification
- Hệ thống level dựa trên tổng điểm tích lũy
- Thử thách tuần (weekly challenges) với nhiệm vụ ngẫu nhiên
- Bảng xếp hạng bạn bè
- Huy hiệu thành tích (badges)
- Cửa hàng: mua thú cưng, vật phẩm chăm sóc, streak freeze card

### 👥 Bạn bè & Cộng đồng
- Kết bạn qua mã bạn bè
- **Truyền lửa** (🔥): gửi một trong 50 câu động viên ngẫu nhiên cho bạn; bạn nhận hiệu ứng lửa toàn màn hình
  - Người nhận có thể gửi lại lửa 1 lần; người gửi đầu tiên chỉ thấy nút Đóng (tránh vòng lặp vô hạn)
- **Chuỗi lửa bạn bè** (Fire Streak): đếm số ngày liên tiếp 2 người đã truyền lửa cho nhau
  - 6 cấp độ ngọn lửa theo Duolingo (mốc 10/20/30/40/50+ ngày)
  - Hiển thị trong header cửa sổ chat với animation ngọn lửa tương ứng
- **Nhắn tin**: chat trực tiếp với từng người bạn (polling mỗi 4 giây)

### 🔔 Hệ thống Thông báo
- **Chuông thông báo** (header) tổng hợp mọi loại cảnh báo với badge đếm:
  - 👥 Lời mời kết bạn chờ phê duyệt
  - 🔥 Lửa nhận được chưa xem (kèm nội dung câu động viên)
  - 💬 Tin nhắn chưa đọc (click mở chat ngay)
  - 💀 Thú cưng/Cây đã chết
  - 🐾 Thú cưng cần chăm sóc (sức khỏe < 70%)
  - ⚠️ Task quá hạn từ 7 ngày trước chưa hoàn thành
  - 📋 Task hôm nay chưa xong
  - 🎁 Quà chưa mở
- Badge cập nhật tự động mỗi 45 giây và sau mỗi thao tác (hoàn thành task, log thói quen…)

### 📊 Thống kê & Phân tích
- Báo cáo tuần (tasks, streak, tâm trạng)
- So sánh tuần này vs tuần trước
- Biểu đồ cảm xúc 30 ngày
- Phân tích giờ làm việc hiệu quả
- Thống kê kho mục tiêu đã hoàn thành

---

## Cài đặt

### Yêu cầu
- Node.js ≥ 18
- MongoDB Atlas (hoặc MongoDB local)

### Cài dependencies
```bash
npm install
```

### Cấu hình `.env`
```env
PORT=3000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/rabbit-habits
JWT_SECRET=your_secret_key
```

### Chạy
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Mở trình duyệt: `http://localhost:3000`

---

## Cấu trúc thư mục
```
rabbit-habits/
├── server.js
├── .env
├── models/
│   ├── User.js          # + fireStreaks[] cho chuỗi lửa bạn bè
│   ├── Task.js
│   ├── Habit.js + HabitLog.js
│   ├── Goal.js
│   ├── Journal.js
│   ├── Pet.js
│   ├── UserPoints.js
│   └── Message.js
├── routes/
│   ├── auth.js
│   ├── tasks.js         # + GET /overdue
│   ├── habits.js
│   ├── journal.js
│   ├── goals.js
│   ├── shop.js
│   └── gamification.js  # + GET /fire-streak/:friendId
├── middleware/
│   └── auth.js
└── public/
    ├── index.html
    ├── auth.html
    ├── css/style.css
    └── js/app.js
```

## API chính
| Method | Prefix | Mô tả |
|--------|--------|-------|
| `*` | `/api/auth` | Đăng ký, đăng nhập, đăng xuất |
| `*` | `/api/tasks` | CRUD tasks, thống kê, giờ hiệu quả |
| `GET` | `/api/tasks/overdue` | Tasks chưa xong từ 7 ngày trước |
| `*` | `/api/habits` | CRUD habits, log hàng ngày |
| `*` | `/api/goals` | CRUD goals, toggle ngày, kho lưu trữ |
| `*` | `/api/journal` | Nhật ký tâm trạng |
| `*` | `/api/shop` | Thú cưng, vật phẩm, điểm |
| `*` | `/api/gamification` | Level, thử thách, bạn bè, truyền lửa, nhắn tin |
| `GET` | `/api/gamification/fire-streak/:friendId` | Chuỗi lửa giữa 2 người bạn |
| `GET` | `/api/gamification/notifications` | Badge counts (incl. messageCount) |
