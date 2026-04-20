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

### 🌿 Vườn Sinh Thái (Garden)
Mini-game trồng cây với cơ chế lazy tick (tính toán khi mở app, không cần cron job):

**Chu kỳ thời gian**
- 1 ngày game = 12 giờ thực
- 5 pha ngày: Sáng sớm 🌅 / Buổi trưa ☀️ / Buổi chiều 🌤️ / Chiều tối 🌇 / Ban đêm 🌙 (7:30–19:30)

**Lưới vườn — nền cỏ + chậu**
- Lưới 6×5 (30 ô), 6 ô trung tâm mở sẵn
- Mua thêm ô theo khoảng cách Chebyshev: trung tâm 80đ / vùng giữa 50đ / ngoài rìa 30đ
- Nền ô là thảm cỏ CSS với ngọn cỏ ngẫu nhiên; cây trồng trong chậu (không trực tiếp trên đất)
- Z-index theo hàng: cây hàng trước che hàng sau — tạo độ sâu 3D giả

**30 loài cây — 10 kiểu hình CSS**
| Nhóm | Loài | Kích thước | Thu hoạch |
|------|------|-----------|-----------|
| Phong thủy | Kim tiền, Kim ngân, Trúc may, Sen đá, Ngọc bích, Phát tài | S / M | ✗ (trang trí) |
| Rau lá / gia vị | Rau muống, Cải xanh, Hành lá | S | ✓ food / seed |
| Rau quả | Cà chua, Dưa leo, Cà rốt, Dâu tây | S / M | ✓ food / seed |
| Ăn quả | Chanh, Ổi, Cam, Xoài, Chuối | M / L | ✓ food / treat |
| Hoa nhỏ | Tulip, Cúc vàng, Lavender | S / M | ✗ cây cảnh |
| Hoa lớn | Hoa hồng, Hướng dương, Hoa giấy | M / L | ✓ rose (Hoa Hồng) |

Mỗi loài được vẽ hoàn toàn bằng CSS shapes — không dùng emoji hay ảnh.

**4 loại chậu CSS**
| Chậu | Kích thước | Giá | Hình dáng |
|------|-----------|-----|----------|
| Chậu Đất Nhỏ | S | 20đ | Hình thang đất nung |
| Chậu Gốm | M | 40đ | Gốm bo tròn |
| Chậu Gỗ | L | 80đ | Gỗ có vân |
| Chậu Sứ Lớn | XL | 150đ | Sứ trắng hoa văn xanh |

- **Khớp kích thước**: cây × chậu khớp → +20% tốc độ; lệch 1 → -15%; lệch 2 → -40%

**Vòng đời cây**
- Rau/Quả: seed → sprout → leafing → growing → flowering → fruiting (→ thu hoạch thủ công)
- Hoa/Phong thủy: seed → sprout → leafing → flowering → dormant (→ tự vòng lại leafing)

**Chăm sóc & sức khỏe**
- 4 chỉ số: 💧 Nước / 🌿 Dinh dưỡng / 🐛 Sâu bệnh / 🍂 Lá héo
- Nước cạn → mất máu; sâu ≥ 3 → mất máu nặng; máu = 0 → cây chết
- Hành động: Tưới nước / Bón phân / Bắt sâu / Gỡ lá héo / Thu hoạch / Nhổ bỏ
- Panel chăm sóc hiển thị: loài cây, loại cây, giai đoạn, thời gian đến giai đoạn tiếp theo

**Cơ chế che bóng (Shading)**
- Cây `large` khi đủ lớn (growing → dormant) sẽ che 8 ô xung quanh
- Cây bị che: tốc độ phát triển giảm 25–75%; mất máu nếu bị che quá nặng
- Buộc người chơi cân nhắc bố cục khi trồng cây lớn

**Thời tiết — thay đổi mỗi 6 giờ**
- 6 loại: Nắng ☀️ / Có mây ⛅ / Mưa 🌧️ / Giông bão ⛈️ / Sương mù 🌫️ / Gió 💨
- Mỗi loại thời tiết thay đổi animation cây (sway), màu nền lưới và hiệu ứng toàn trang
- Dev endpoint: `POST /api/garden/dev/weather/:type` để thay đổi thời tiết tức thì (không cần restart)

**Hệ sinh thái Canvas 2D**
- Canvas overlay phủ toàn lưới vườn, render bằng `requestAnimationFrame`
- **Sinh vật thường trú** (theo data hệ sinh thái): Ong 🐝, Chim 🐦, Dơi 🦇, Sâu 🐛, Giun 🪱
- **Khách vãng lai** (ngẫu nhiên mỗi 18s): Bướm, Chuồn chuồn, Sên, Ếch, Mèo
- **Hạt lá / sparkle / giọt nước** bay theo hàng cây và trạng thái cây
- Canvas tạm dừng khi chuyển tab, tự khởi động lại khi quay về vườn

**Hiệu ứng visual states**
- Đất: khô / bình thường / ẩm / ướt (màu + texture CSS)
- Cây: bị bóng che (desaturate), thiếu nước (sepia), bệnh (opacity giảm), chết (grayscale)

**Tích hợp hệ thống**
- Thu hoạch cho vật phẩm vào túi đồ (food, treat, seed, rose)
- Trả điểm khi thu hoạch
- Di cư thú cưng cây cũ → hoàn tiền 70% + tự động chuyển sang vườn
- Bạn bè thăm vườn: xem vườn bạn bè với CSS plants đầy đủ, tặng tưới nước (+3đ)

**Kế hoạch tiếp theo**
- Hệ sinh thái tương tác: mưa tăng độ ẩm, ong giúp cây ra hoa, sâu gây bệnh
- Mùa & biến đổi khí hậu theo tháng

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
│   ├── Message.js
│   ├── GardenPlot.js    # Lưới ô vườn đã mua của user
│   └── GardenPlant.js   # Cây đang trồng (stage, health, water…)
├── routes/
│   ├── auth.js
│   ├── tasks.js         # + GET /overdue
│   ├── habits.js
│   ├── journal.js
│   ├── goals.js
│   ├── shop.js
│   ├── gamification.js  # + GET /fire-streak/:friendId
│   └── garden.js        # Vườn Sinh Thái — catalog, plots, plant CRUD, care actions
├── middleware/
│   └── auth.js
└── public/
    ├── index.html
    ├── auth.html
    ├── css/
    │   ├── style.css
    │   ├── garden.css         # Layout, panel, thời tiết, hiệu ứng trang vườn
    │   └── garden-plants.css  # CSS plants — 10 archetypes × 6 stages, chậu, đất, shading
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
| `GET` | `/api/garden` | Lấy toàn bộ state vườn (plots + plants, tự tick) |
| `GET` | `/api/garden/catalog` | Danh sách 24 cây và 4 chậu |
| `POST` | `/api/garden/plots/buy` | Mua ô vườn |
| `POST` | `/api/garden/plant` | Trồng cây vào ô |
| `POST` | `/api/garden/water/:id` | Tưới nước |
| `POST` | `/api/garden/fertilize/:id` | Bón phân |
| `POST` | `/api/garden/catch-bug/:id` | Bắt sâu |
| `POST` | `/api/garden/remove-leaf/:id` | Gỡ lá héo |
| `POST` | `/api/garden/harvest/:id` | Thu hoạch (cây harvestable) |
| `DELETE` | `/api/garden/plant/:id` | Nhổ bỏ cây |
| `POST` | `/api/garden/dev/weather/:type` | (Dev) Đổi thời tiết tức thì (sunny/cloudy/rainy/stormy/foggy/windy) |
