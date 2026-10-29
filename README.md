1. Giới thiệu và tính năng
# Moji — Realtime Chat App

Moji là ứng dụng nhắn tin thời gian thực, hỗ trợ trò chuyện trực tiếp và trò chuyện nhóm. Ứng dụng gồm frontend React và backend Node.js/Express, sử dụng MongoDB để lưu trữ dữ liệu và Socket.IO để cập nhật tin nhắn theo thời gian thực.

## Tính năng

- Đăng ký, đăng nhập và đăng xuất
- Xác thực hai yếu tố (2FA)
- Tìm kiếm, gửi và xử lý lời mời kết bạn
- Nhắn tin trực tiếp và trò chuyện nhóm
- Cập nhật tin nhắn, trạng thái trực tuyến và chỉ báo đang nhập theo thời gian thực
- Xem trạng thái đã đọc và số tin nhắn chưa đọc
- Quản lý thông tin cá nhân và ảnh đại diện
2. Công nghệ sử dụng
## Công nghệ

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- Axios
- Socket.IO Client

### Backend
- Node.js
- Express
- MongoDB và Mongoose
- Socket.IO
- JWT
- Cloudinary
- Swagger UI

3. Cấu trúc dự án
## Cấu trúc dự án

```text
Moji_RealtimeChatApp/
├── backend/
│   ├── src/
│   │   ├── controllers/   # Xử lý nghiệp vụ
│   │   ├── middlewares/   # Middleware xác thực, upload và socket
│   │   ├── models/        # Mô hình dữ liệu MongoDB
│   │   ├── routes/        # Các API routes
│   │   ├── socket/        # Socket.IO
│   │   └── server.js      # Điểm khởi chạy backend
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/    # Giao diện và các thành phần UI
    │   ├── pages/         # Các trang chính
    │   ├── services/      # Gọi API
    │   ├── stores/        # State management
    │   └── App.tsx
    └── package.json
```

4. Cài đặt và cấu hình backend

## Cài đặt và chạy ứng dụng

### Yêu cầu

- Node.js và npm
- MongoDB
- Tài khoản Cloudinary nếu muốn sử dụng chức năng tải ảnh lên

### Backend

a. Cài dependencies:

   ```powershell
   cd backend
   npm install
   ```

b. Tạo file `.env` trong thư mục `backend` và cấu hình các biến môi trường:

   ```env
   PORT=5001
   MONGODB_CONNECTIONSTRING=<mongodb-connection-string>
   CLIENT_URL=http://localhost:5173
   ACCESS_TOKEN_SECRET=<long-random-secret>
   CLOUDINARY_CLOUD_NAME=<your-cloud-name>
   CLOUDINARY_API_KEY=<your-api-key>
   CLOUDINARY_API_SECRET=<your-api-secret>
   TWO_FACTOR_ENCRYPTION_KEY=<optional-encryption-key>
   ```

c. Chạy backend ở chế độ phát triển:
   ```powershell
   npm run dev
   ```

Backend mặc định chạy tại `http://localhost:5001`.

5. Cấu hình và chạy frontend
### Frontend

a. Mở terminal mới và cài dependencies:

   ```powershell
   cd frontend
   npm install
   ```

b. Kiểm tra cấu hình frontend trong `.env.development`:

   ```env
   VITE_API_URL=http://localhost:5001/api
   VITE_SOCKET_URL=http://localhost:5001
   ```

c. Chạy frontend:

   ```powershell
   npm run dev
   ```

Frontend mặc định chạy tại `http://localhost:5173`.

6. Tài liệu API
## Tài liệu API

Khi backend đang chạy, mở Swagger UI tại:

[http://localhost:5001/api-docs](http://localhost:5001/api-docs)
