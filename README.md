# 📧 Email Checker System

Hệ thống đơn giản giúp quản lý danh sách email và đảm bảo mỗi email chỉ được người dùng sử dụng **1 lần duy nhất**. Dữ liệu được lưu bằng SQLite, hiển thị qua server-side rendering bằng Node.js + EJS.

## ✨ Tính năng chính

### 👤 Trang Người Dùng (`/`)
- Tự động hiển thị **1 email khả dụng** (`status = available`)
- Nút **Copy** để đánh dấu email đó là đã sử dụng
- Sau khi copy, email biến mất khỏi danh sách
- Không preload danh sách email → bảo mật tránh bị scrape

### 🛠️ Trang Quản Trị (`/admin`)
- Hiển thị danh sách tất cả email
- Thông tin gồm: ID, email, trạng thái, thời gian copy, IP copy
- Chức năng quản lý:
  - ➕ Thêm email mới
  - 🗑️ Xóa email
  - 🔄 Reset trạng thái email về "khả dụng"
  - 📊 Thống kê tổng quan

## 🧱 Kiến trúc hệ thống

- **Backend**: Node.js + Express
- **Frontend**: EJS (Server-side rendering)
- **Database**: SQLite
- **UI Framework**: Bootstrap 5
- **Icons**: Font Awesome

## 📂 Cấu trúc thư mục

```
email_checks/
├── app.js                 # Main application file
├── package.json           # Dependencies and scripts
├── database/
│   ├── database.js        # Database connection and queries
│   └── emails.db          # SQLite database file (auto-created)
├── routes/
│   ├── user.js           # User routes (homepage)
│   └── admin.js          # Admin routes
├── views/
│   ├── layout.ejs        # Main layout template
│   ├── index.ejs         # Homepage template
│   ├── error.ejs         # Error page template
│   └── admin/
│       └── index.ejs     # Admin dashboard template
├── public/
│   ├── css/
│   │   └── style.css     # Custom styles
│   └── js/
│       └── main.js       # Frontend JavaScript
└── scripts/
    ├── init-db.js        # Database initialization
    └── seed.js           # Sample data seeding
```

## 🚀 Cài đặt và Chạy

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Khởi tạo cơ sở dữ liệu
```bash
npm run init-db
```

### 3. (Tùy chọn) Thêm dữ liệu mẫu
```bash
npm run seed
```

### 4. Chạy ứng dụng
```bash
# Development mode với nodemon
npm run dev

# Production mode
npm start
```

### 5. Truy cập ứng dụng
- **Trang người dùng**: http://localhost:3000
- **Trang quản trị**: http://localhost:3000/admin

## 🗄️ Database Schema

### Bảng `emails`
| Column     | Type     | Description                    |
|------------|----------|--------------------------------|
| id         | INTEGER  | Primary key (auto increment)  |
| email      | TEXT     | Email address (unique)         |
| status     | TEXT     | 'available' hoặc 'used'        |
| copied_at  | DATETIME | Thời gian copy (null nếu chưa) |
| copied_ip  | TEXT     | IP address của người copy     |
| created_at | DATETIME | Thời gian tạo                 |
| updated_at | DATETIME | Thời gian cập nhật cuối       |

## 🔐 Bảo mật

- **Rate Limiting**: Giới hạn 100 requests/15 phút mỗi IP
- **No Email Preloading**: Chỉ hiển thị 1 email tại một thời điểm
- **IP Tracking**: Ghi lại IP address khi copy email
- **Input Validation**: Kiểm tra format email hợp lệ
- **SQL Injection Protection**: Sử dụng parameterized queries

## 📝 API Endpoints

### User Routes
- `GET /` - Hiển thị homepage với 1 email khả dụng
- `POST /copy` - Đánh dấu email là đã sử dụng

### Admin Routes
- `GET /admin` - Hiển thị admin dashboard
- `POST /admin/add` - Thêm email mới
- `POST /admin/delete` - Xóa email
- `POST /admin/reset` - Reset trạng thái email

## 🎨 Giao diện

- **Responsive Design**: Tương thích mobile và desktop
- **Bootstrap 5**: UI components hiện đại
- **Font Awesome**: Icons đẹp mắt
- **Custom CSS**: Animations và effects
- **Dark Mode Ready**: Hỗ trợ dark mode

## 🔧 Cấu hình

### Environment Variables
```bash
# Port (default: 3000)
PORT=3000

# Node environment
NODE_ENV=development
```

### Tùy chỉnh Rate Limiting
Trong `app.js`, sửa đổi:
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // requests per windowMs
});
```

## 📈 Mở rộng trong tương lai

- [ ] **Authentication**: Thêm đăng nhập cho admin
- [ ] **Export Excel**: Xuất danh sách email ra file .xlsx
- [ ] **Bulk Import**: Import danh sách email từ file
- [ ] **Statistics Dashboard**: Biểu đồ thống kê chi tiết
- [ ] **Email Validation**: Kiểm tra email có tồn tại thực sự
- [ ] **API Documentation**: Swagger/OpenAPI docs
- [ ] **Docker Support**: Containerization
- [ ] **Backup/Restore**: Sao lưu và khôi phục dữ liệu

## 🐛 Troubleshooting

### Database không khởi tạo được
```bash
# Xóa database cũ và tạo lại
rm database/emails.db
npm run init-db
```

### Port đã được sử dụng
```bash
# Thay đổi port
PORT=3001 npm start
```

### Lỗi permission trên macOS/Linux
```bash
# Cấp quyền thực thi cho scripts
chmod +x scripts/*.js
```

## 📄 License

MIT License - Xem file [LICENSE](LICENSE) để biết thêm chi tiết.

## 🤝 Đóng góp

1. Fork project
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📞 Liên hệ

- **Issues**: [GitHub Issues](https://github.com/yourusername/email-checker/issues)
- **Email**: your.email@example.com

---

⭐ **Nếu project hữu ích, hãy cho một Star nhé!** ⭐
