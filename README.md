# ✦ TaskFlow — Checklist Theo Dõi Công Việc

## Tính năng
- 📅 Lịch tháng có tô màu tuần hiện tại và ngày hôm nay
- 📋 Xem theo **Tuần** hoặc **Tháng** với từng cột ngày riêng biệt
- ✅ Thêm / xóa / tick hoàn thành task từng ngày
- 📊 Chart tiến độ % mỗi ngày (donut chart mini)
- 📈 Thống kê tuần / tháng / năm: tổng tasks, tỉ lệ hoàn thành
- 🏆 Top tasks xuất hiện thường xuyên nhất + tỉ lệ hoàn thành
- 💾 Lưu dữ liệu vào **MongoDB**

---

## Cài đặt

### 1. Yêu cầu
- [Node.js](https://nodejs.org) >= 18
- [MongoDB](https://www.mongodb.com/try/download/community) (local) hoặc [MongoDB Atlas](https://cloud.mongodb.com) (cloud)

### 2. Cài dependencies
```bash
cd taskflow
npm install
```

### 3. Cấu hình MongoDB
Mở file `.env` và sửa:

```env
# MongoDB local (mặc định)
MONGODB_URI=mongodb://localhost:27017/taskflow

# Hoặc MongoDB Atlas (cloud - khuyến nghị cho production)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/taskflow
```

### 4. Chạy server
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

### 5. Mở trình duyệt
```
http://localhost:3000
```

---

## Cấu trúc thư mục
```
taskflow/
├── server.js           # Express server chính
├── .env                # Biến môi trường (MongoDB URI, port)
├── models/
│   └── Task.js         # MongoDB schema
├── routes/
│   └── tasks.js        # API endpoints
└── public/
    ├── index.html      # Giao diện chính
    ├── css/
    │   └── style.css   # Styles
    └── js/
        └── app.js      # Logic frontend
```

## API Endpoints
| Method | URL | Mô tả |
|--------|-----|-------|
| GET | `/api/tasks?startDate=&endDate=` | Lấy tasks theo khoảng ngày |
| POST | `/api/tasks` | Tạo task mới |
| PATCH | `/api/tasks/:id/toggle` | Toggle hoàn thành |
| PATCH | `/api/tasks/:id` | Cập nhật tên task |
| DELETE | `/api/tasks/:id` | Xóa task |
| GET | `/api/tasks/stats?startDate=&endDate=` | Thống kê |

---

## Sắp ra mắt
- [ ] Drag & drop sắp xếp task
- [ ] Tags / nhãn màu cho task
- [ ] Nhắc nhở / deadline
- [ ] Export PDF báo cáo
- [ ] Dark/Light mode toggle
