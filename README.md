# EMSO - Hệ thống Quản lý Nội dung Phân tán

EMSO là hệ thống quản lý nội dung phân tán cho phép hợp tác đa người dùng thông minh với khả năng quản lý người dùng nâng cao và phân bổ nội dung động.

## Công nghệ sử dụng

- **Frontend**: React với Vite, TailwindCSS, Shadcn UI
- **Backend**: Node.js + Express
- **Database**: PostgreSQL với Drizzle ORM
- **Xử lý tin nhắn**: Kafka (tùy chọn)
- **Xác thực**: Passport.js
- **Quản lý trạng thái**: React Query + SWR

## Yêu cầu hệ thống

- Node.js 20.x trở lên
- PostgreSQL 15.x trở lên
- (Tùy chọn) Kafka server cho xử lý tin nhắn phân tán

## Triển khai Production

### 1. Chuẩn bị môi trường

#### 1.1. Biến môi trường

Tạo file `.env` với các thông tin kết nối:

```
# Database
DATABASE_URL=postgres://username:password@hostname:5432/database_name
PGUSER=username
PGPASSWORD=password
PGHOST=hostname
PGDATABASE=database_name
PGPORT=5432

# Session
SESSION_SECRET=change_me_to_a_secure_random_string

# Kafka (nếu sử dụng)
KAFKA_ENABLED=false
KAFKA_BROKERS=kafka-broker:9092
KAFKA_TOPIC=content-process
KAFKA_GROUP_ID=emso-processor
```

#### 1.2. Cài đặt dependencies

```bash
npm install
```

#### 1.3. Thiết lập cấu trúc database

```bash
npm run db:push
```

#### 1.4. Tạo tài khoản admin đầu tiên

Tài khoản admin mặc định được tạo tự động với:
- Username: `admin`
- Password: `admin123`

Bạn nên đổi mật khẩu ngay khi đăng nhập lần đầu.

### 2. Build ứng dụng

```bash
npm run build
```

### 3. Khởi chạy trong môi trường Production

```bash
npm run start
```

Ứng dụng sẽ chạy ở cổng 5000 mặc định. Điều này có thể được điều chỉnh qua biến môi trường `PORT`.

### 4. Triển khai với Process Manager

Khuyến nghị sử dụng pm2 để quản lý quy trình trong môi trường sản xuất:

```bash
npm install -g pm2
pm2 start dist/server/index.js --name emso
```

Cấu hình pm2 để khởi động lại dịch vụ khi server restart:

```bash
pm2 startup
pm2 save
```

### 5. Cấu hình Reverse Proxy

#### Với Nginx:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6. Cấu hình HTTPS

Để bảo mật, nên cấu hình HTTPS sử dụng Let's Encrypt:

```bash
sudo certbot --nginx -d yourdomain.com
```

### 7. Thiết lập Kafka (nếu sử dụng)

Nếu sử dụng chức năng xử lý tin nhắn phân tán, cấu hình Kafka:

1. Kết nối đến Kafka broker
2. Cấu hình `KAFKA_ENABLED=true` trong file .env
3. Xác nhận các biến môi trường Kafka đã được thiết lập chính xác

### 8. Sao lưu dữ liệu

Cấu hình sao lưu tự động cho PostgreSQL:

```bash
pg_dump -U username -d database_name -f /path/to/backups/emso_backup_$(date +%Y%m%d).sql
```

Thiết lập một cron job để tự động hóa việc sao lưu:

```
0 2 * * * /path/to/backup_script.sh
```

## Bảo mật

1. Thay đổi `SESSION_SECRET` để đảm bảo an toàn
2. Tạo mật khẩu mạnh cho tài khoản admin
3. Giới hạn truy cập vào cơ sở dữ liệu
4. Cài đặt tường lửa để giới hạn kết nối đến máy chủ
5. Định kỳ cập nhật phần mềm và dependencies

## Kiểm tra Hệ thống

### Endpoint kiểm tra trạng thái

Truy cập `/api/health` để xác nhận API đang hoạt động.

### Quy trình kiểm tra

1. Đăng nhập vào hệ thống với tài khoản admin
2. Đảm bảo dashboard hiển thị chính xác
3. Tạo một nội dung mới và phân công cho một editor
4. Kiểm tra các editor có thể nhìn thấy nội dung được gán
5. Kiểm tra quá trình xử lý Kafka (nếu được kích hoạt)

## Quản lý người dùng

### Vai trò:

1. **Admin**: Có toàn quyền, quản lý người dùng và phân công nội dung
2. **Editor**: Xử lý nội dung được gán
3. **Viewer**: Chỉ có thể xem nội dung (không thể chỉnh sửa)

### Quy trình làm việc

1. Người dùng đăng ký tài khoản mới (trạng thái mặc định: "pending")
2. Admin phê duyệt tài khoản (thay đổi trạng thái thành "active")
3. Admin gán vai trò phù hợp (admin, editor, viewer)
4. Người dùng có thể đăng nhập và tương tác với hệ thống theo quyền hạn

## API Kafka 

Hệ thống có thể tích hợp với Kafka để xử lý nội dung phân tán. Tin nhắn được định dạng:

```json
{
  "externalId": "unique-external-id",
  "source": "external-source",
  "categories": "category1,category2",
  "labels": "label1,label2",
  "sourceVerification": "verified|unverified"
}
```

## Khắc phục sự cố

### Database không kết nối

1. Kiểm tra kết nối PostgreSQL: `pg_isready -h [host] -p [port]`
2. Xác nhận biến môi trường DATABASE_URL chính xác

### Vấn đề phiên làm việc

1. Kiểm tra SESSION_SECRET đã được cấu hình đúng
2. Xóa session trong database nếu cần

### Lỗi Kafka

1. Kiểm tra kết nối với Kafka broker
2. Xác nhận chủ đề và nhóm ID được cấu hình chính xác

## Tính năng hệ thống

- Quản lý người dùng nâng cao với phê duyệt admin
- Giao diện dashboard dành riêng cho từng vai trò
- Phân công nội dung tự động hoặc thủ công
- Quản lý danh mục và nhãn với tính năng nhập nhiều nhãn
- Quản lý người dùng giả cho phần bình luận
- Xác minh nguồn nội dung
- Tích hợp Kafka (tùy chọn)
- Biểu đồ phân phối nội dung trực quan
- API RESTful đầy đủ

## Liên hệ hỗ trợ

Nếu bạn gặp vấn đề khi triển khai hoặc sử dụng hệ thống, vui lòng liên hệ:

- **Email**: support@emso.vn
- **Hotline**: 0987 654 321