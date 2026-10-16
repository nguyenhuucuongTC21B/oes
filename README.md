# 🎓 OES — Online Exam System (Vercel Serverless Edition)

Hệ thống thi trắc nghiệm trực tuyến **không dùng SQL**, được thiết kế riêng để chạy
**hoàn hảo trên [Vercel](https://vercel.com)**: toàn bộ dữ liệu phẳng được lưu trữ **vĩnh viễn
trên Google Drive** dưới dạng 3 file JSON (`users.json`, `exams.json`, `results.json`);
phần backend chạy dạng **serverless function** — không cần quản trị máy chủ, free tier
của Vercel đủ tổ chức thi cho hàng trăm thí sinh.

**Backend:** Node.js (Express chạy trên Vercel Functions) · **Frontend:** HTML5 + Tailwind CSS (CDN)
+ JavaScript thuần · **Dependency:** chỉ 2 gói (`express`, `googleapis`)

> 🧬 OES kế thừa 100% tính năng và bộ đề mẫu từ bản "online-exam-system" (Render edition):
> đăng ký/đăng nhập CCCD, giờ thi quy định, chấm điểm server-side, dashboard quản trị,
> banner đồng bộ Drive, chẩn đoán 5 mức, 3 bộ đề mẫu (2 × 50 câu ATTT + 81 câu Chuyển đổi số).

---

## 1. Kiến trúc tổng quan (Serverless)

```
                    ┌────────────────────────────────────────────────┐
                    │            GOOGLE DRIVE (vĩnh viễn)            │
                    │  users.json    exams.json    results.json      │
                    └──────────▲──────────────────┬──────────────────┘
        fetch-before-write     │                  │ lazy boot + refresh ≤15s
        + BASELINE-MERGE       │                  ▼
┌───────────────────────────────┴───────────────────────────────────────────────┐
│  VERCEL SERVERLESS FUNCTIONS (Node.js)  — 1 request = 1 lần gọi hàm           │
│  ┌────────────────┐  ┌───────────────────────────┐  ┌───────────────────────┐  │
│  │ public/ (tĩnh) │  │ api/index.js + src/       │  │ routes: auth / exam / │  │
│  │ 4 trang HTML   │◀▶│ RAM cache mỗi instance    │◀▶│ admin (scrypt, HMAC,  │  │
│  │ + JS thuần     │  │ + ghi ĐỒNG BỘ mỗi request │  │  chấm điểm server)    │  │
│  └────────────────┘  └───────────────────────────┘  └───────────────────────┘  │
│  Instance A ──┐ ghi liền trong request  ┌── Instance B (chạy song song)        │
│  (cache 15s) ─┴─────────────────────────┴─ (baseline-merge chống ghi đè chéo)  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Cấu trúc thư mục

```
oes/
├── api/
│   └── index.js                 # ĐIỂM VÀO VERCEL: lazy boot mỗi instance + export Express app
├── vercel.json                  # Cấu hình rewrite /api/* → function, maxDuration 30s
├── server.js                    # (Chỉ dùng local) init trước rồi listen
├── package.json
├── .env.example                 # Mẫu biến môi trường (local)
├── tools/
│   └── check-drive.js           # Công cụ: sinh .env từ file key + kiểm tra kết nối Drive
├── src/
│   ├── config.js                # Nạp .env + nhận diện môi trường serverless (VERCEL=1)
│   ├── app.js                   # Lắp ráp Express + middleware lazy-boot & làm tươi cache
│   ├── drive/
│   │   └── driveClient.js       # Google Drive API v3 qua Service Account (+ retry backoff)
│   ├── store/
│   │   └── dataStore.js         # RAM cache mỗi instance + BASELINE-MERGE khi ghi
│   ├── data/
│   │   └── sampleExams.js       # 3 bộ đề mẫu (tự nạp khi exams trống)
│   ├── middleware/
│   │   └── auth.js              # requireAuth / requireAdmin
│   ├── routes/
│   │   ├── auth.routes.js       # Đăng ký / Đăng nhập (rate-limit chống dò mật khẩu)
│   │   ├── exam.routes.js       # Xem đề, attempt token, nộp bài — chấm điểm trên server
│   │   ├── admin.routes.js      # Quản lý user, ra đề, can thiệp kết quả
│   │   └── public.routes.js     # /api/stats (trang chủ) + /api/health
│   └── utils/
│       ├── mutex.js             # Khóa luồng Mutex (promise-chain)
│       ├── crypto.js            # scrypt, HMAC token phiên + ATTEMPT TOKEN phiên thi
│       ├── examWindow.js        # Giờ thi quy định (openAt/closeAt, giờ VN)
│       ├── driveAdvice.js       # Ánh xạ lỗi Google → gợi ý sửa tiếng Việt
│       └── validate.js          # Kiểm tra dữ liệu (thông báo lỗi tiếng Việt)
└── public/                      # Vercel phục vụ THƯ MỤC NÀY ở gốc tên miền (miễn phí)
    ├── index.html               # Trang chủ tuyên truyền cổ động + nút "Tham gia"
    ├── login.html               # Đăng nhập / Đăng ký
    ├── quiz.html                # Làm bài: đếm ngược, palette câu hỏi, nộp bài
    ├── admin.html               # Dashboard quản trị
    └── assets/                  # css/base.css + js/ (common, home, auth, quiz, admin)
```

### Thiết kế 3 file dữ liệu

| File | Cấu trúc bản ghi |
|------|------------------|
| `users.json` | `{ cccd, phone, email, position, unit, passwordHash (scrypt), role: "user"/"admin", createdAt }` |
| `exams.json` | `{ id, title, description, category, durationMinutes, openAt?, closeAt?, questions: [{ id, text, options[], correctIndex }], createdBy, createdAt }` |
| `results.json` | `{ id, examId, examTitle, category, cccd, score (thang 10), correct, total, startedAt, durationSeconds, submittedAt, editedAt?, editedBy?, note? }` |

---

## 2. Cơ chế hoạt động quan trọng (thích nghi cho Serverless)

### a) Google Drive Service Account
- Kết nối bằng thư viện chính thức `googleapis` với **Service Account**, thông tin đọc từ biến
  môi trường (hỗ trợ Base64 / JSON thô / đường dẫn file key).
- Mỗi instance tự tải 3 file JSON về RAM ở **request đầu tiên** (lazy boot); file chưa có sẽ
  được tạo mới khi ghi đầu tiên. Lỗi tạm thời (429/5xx/mạng) tự **retry backoff 1s→2s→4s**.

### b) Ghi đồng bộ trong request + BASELINE-MERGE (chống mất dữ liệu đa instance)
Serverless KHÔNG có "vòng upload nền" như bản Render (instance có thể bị giải phóng ngay sau
khi trả response). Vì vậy OES đổi quy trình:
- **Mọi ghi dữ liệu đều `await saveNow()` ngay trong request** — Drive ghi xong mới trả kết
  quả cho người dùng. Không còn dữ liệu "chờ sync", không còn nỗi sợ instance ngủ.
- **fetch-before-write + baseline-merge:** trước mỗi lần upload, hệ thống tải bản mới nhất
  trên Drive về và hợp nhất theo "baseline" (danh sách id có tại lần nạp gần nhất):
  bản ghi instance khác vừa thêm → **giữ lại**; bản ghi ta đã xóa → **không đưa lại**;
  trùng id → bản ghi vừa sửa trong RAM thắng. Hai instance nộp bài cùng giây vẫn không
  mất bài của nhau.
- **Cache đọc có tuổi:** quá 15 giây, request kế tiếp tự tải lại từ Drive (middleware làm
  tươi) — các instance luôn thấy dữ liệu của nhau gần như tức thời.
- **Chống "RAM rỗng đè dữ liệu cũ":** nếu instance boot mà KHÔNG đọc được Drive (mạng/quyền
  lỗi), hệ thống cấm ghi cho tới khi đọc được bản cũ — không bao giờ sync xong lại mất dữ liệu.

### c) Bảo mật & công bằng thi cử
- Mật khẩu băm **scrypt + salt**; so sánh constant-time. Token phiên **HMAC-SHA256**, hạn 12 giờ.
- **Attempt token phiên thi (stateless):** POST `/start` trả về token HMAC
  `{ cccd, examId, startedAt }` (hạn 24 giờ) — client lưu localStorage và gửi lại khi vào lại
  hoặc nộp bài. Server không cần RAM chung (khớp serverless); thí sinh KHÔNG thể tự tăng thời
  gian vì sửa token là chữ ký sai. Refresh/đóng mở tab/đổi mạng — đồng hồ vẫn chạy đúng theo
  mốc `startedAt` do server ký.
- Đề gửi cho thí sinh **không chứa đáp án**; chấm điểm **100% trên server**.
- Giới hạn 6 lần đăng nhập sai / 15 phút **theo từng instance** (xem FAQ); CCCD/SDT/email kiểm
  tra định dạng.

### d) Giờ thi quy định (mở cửa theo lịch)
Mỗi đề thi có thể đặt 2 mốc giờ (giờ Việt Nam GMT+7):

| Mốc | Ý nghĩa | Bỏ trống |
|-----|---------|----------|
| **Mở cửa thi từ** (`openAt`) | Trước thời điểm này thí sinh bấm "Vào thi" bị từ chối (lỗi 423 kèm thông báo còn bao nhiêu phút nữa) | Đề mở cửa ngay |
| **Đóng cửa thi lúc** (`closeAt`) | Sau thời điểm này không nhận thí sinh mới vào bài | Không giới hạn giờ đóng |

- Cách đặt: **Admin → Đề thi → Ra đề thi mới / Sửa** → tích "⏰ Quy định giờ thi" → chọn ngày
  giờ bằng lịch (giờ VN). Khung giờ phải dài ít nhất bằng thời lượng làm bài.
- Thí sinh nhìn thấy trạng thái ngay trên danh sách đề: ⏰ chưa mở cửa / 🟢 đang mở (kèm giờ
  đóng) / 🔒 đã đóng. Tab mở chờ giờ thi **tự đổi trạng thái khi tới giờ** (không cần tải lại).
- Ai **đã vào bài trong khung giờ** (có attempt token) thì được làm hết thời lượng đề và nộp
  bình thường, kể cả nộp sau giờ đóng — cửa thi chỉ chặn người vào MỚI.
- Thời gian lưu ISO UTC; hiển thị luôn quy về **giờ Việt Nam**.

### e) Bộ đề mẫu 3 bộ (2 × 50 câu ATTT + 81 câu Chuyển đổi số)
- Lần chạy đầu tiên (hoặc khi `exams.json` còn trống `[]`), hệ thống **tự nạp 3 bộ đề mẫu**:
  - **Bộ đề số 1** — 50 câu ATTT (17 Nhận biết | 23 Thông hiểu & Áp dụng | 10 Vận dụng), 35 phút, mở cửa thi ngay;
  - **Bộ đề số 2** — 50 câu tương đương, có đặt lịch minh họa "giờ thi quy định": mở cửa 08:00 giờ VN ngày mai,
    đóng cửa 23:59 giờ VN sau 7 ngày;
  - **Bộ đề số 3** — 81 câu Chuyển đổi số & Kỹ năng số (75 trắc nghiệm + 6 tự luận ngắn), 60 phút, mở cửa thi ngay.
- Vị trí phương án đúng của cả 3 đề đã được cân bằng đều A/B/C/D (nội dung đáp án không đổi).
- Không bao giờ tự đè lên đề thi thật: chỉ nạp khi danh sách đề RỘNG HOÀN TOÀN.
- Nạp lại khi bị xóa nhầm: bấm nút **"⤓ Tải bộ đề mẫu"** trong tab Đề thi (Admin Dashboard) —
  chỉ thêm đề còn thiếu, không nhân đôi; hoặc chạy `node tools/seed-exams.js` trên máy local.

---

## 3. Thiết lập Google Drive API (Service Account) — hướng dẫn từng nút bấm

> Hướng dẫn dưới đây mô tả **từng nút bấm** trên giao diện Google Cloud Console và Google Drive
> (cập nhật 2025). Làm đúng thứ tự 8 bước, mỗi bước chỉ 1–3 phút. Mỗi bước có dòng
> "✅ Đối chiếu" để bạn biết đã làm thành công. Cuối mục là bảng xử lý 6 lỗi thường gặp.

### Bước 1 — Tạo Project trên Google Cloud

1. Đăng nhập Google bằng **tài khoản cá nhân** (`@gmail.com`) rồi mở: **https://console.cloud.google.com/**
2. Lần đầu vào, Google hỏi đồng ý điều khoản dịch vụ → tích chọn và nhấn **Agree / Continue**
   (nếu được hỏi quốc gia, chọn Vietnam).
3. Nhìn **thanh trên cùng** (ngay dưới chữ Google Cloud): có ô chọn project — có thể đang hiện
   chữ **"Select a project"** → nhấn vào ô đó.
4. Cửa sổ bật lên hiện danh sách project → nhấn nút **New Project** ở góc trên bên phải.
5. Điền form "New Project":
   - **Project name:** `he-thong-thi-truc-tuyen` (nên dùng tên không dấu, không khoảng trắng);
   - **Organization/Location:** giữ nguyên mặc định ("No organization");
   - **Không cần** thẻ tín dụng / Billing — Google Drive API dùng được trong gói miễn phí.
6. Nhấn **Create** → chờ 20–60 giây. Khi có thông báo (hình chiếc chuông góc trên phải) → nhấn **Select Project**.

✅ **Đối chiếu:** thanh trên cùng hiện đúng tên project `he-thong-thi-truc-tuyen`.

### Bước 2 — Bật (Enable) Google Drive API

1. Mở menu **☰** (góc trên bên trái) → **APIs & Services** → **Library**.
   (Hoặc truy cập thẳng: https://console.cloud.google.com/apis/library )
2. Trong ô tìm kiếm gõ `google drive` → chọn **Google Drive API**
   (dòng đầu tiên, logo hình tam giác vàng–xanh lục–hồng).
3. Nhấn nút xanh **Enable** và chờ vài giây.

✅ **Đối chiếu:** trang API hiện nút **Manage** và chữ "API enabled".

⚠️ **Bỏ qua bước này là nguyên nhân số 1** gây lỗi `403 SERVICE_DISABLED` khi chạy server.

### Bước 3 — Tạo Service Account

1. Menu ☰ → **APIs & Services** → **Credentials**. (https://console.cloud.google.com/apis/credentials )
2. Nhấn **+ Create Credentials** (hàng nút trên cùng) → chọn **Service account**.
3. Form "Create service account" gồm 3 màn:
   - **Service account details**:
     - *Service account name:* `exam-drive-bot`
     - *Service account ID:* Google tự điền — giữ nguyên
     - *Description:* `Bot luu du lieu thi` (có thể bỏ trống)
     → nhấn **Create and Continue**.
   - **Grant this service account access to project (optional):** không cần chọn gì → nhấn **Continue**.
   - **Grant users access to this service account (optional):** không cần chọn gì → nhấn **Done**.
4. Quay lại trang **Credentials**, mục **Service Accounts** hiện 1 dòng dạng:
   `exam-drive-bot@he-thong-thi-truc-tuyen.iam.gserviceaccount.com`

✅ **Đối chiếu:** thấy dòng email trên trong trang Credentials.

### Bước 4 — Tạo file key JSON

1. Trong trang **Credentials**, nhấn vào **email** của service account vừa tạo (dòng ở Bước 3).
2. Chuyển sang tab **Keys** (ngang hàng với Details / Permissions...).
3. Nhấn **Add key** → **Create new key**.
4. Chọn **JSON** → nhấn **Create** → trình duyệt **tự động tải về** một file `.json`
   (tên dạng `he-thong-thi-truc-tuyen-1a2b3c4d5e6f.json`) và Google hiện cảnh báo vàng
   "Private key saved to your computer" → chỉ cần nhấn **Close**.
5. Chuyển file vừa tải tới nơi an toàn (ví dụ đặt cạnh thư mục dự án) và **đổi tên thành
   `service-account.json`** cho dễ nhớ:
   - Windows thường lưu tại: `C:\Users\<TênBạn>\Downloads\`
   - macOS / Linux: `~/Downloads/`

> ⚠️ File key là **mật khẩu cấp hệ thống** — không commit lên Git, không chia sẻ công khai.
> Nếu nghi lộ key: vào tab Keys → xóa key cũ → tạo key mới (Bước 4 làm lại), key cũ tự vô hiệu.

### Bước 5 — Tìm email Service Account trong file key (trường `client_email`)

File key là file văn bản thuần, mở bằng trình soạn thảo bất kỳ:

| Hệ điều hành | Cách mở |
|---|---|
| Windows | Chuột phải file → **Open with → Notepad**. Hoặc mở CMD gõ: `notepad "%USERPROFILE%\Downloads\service-account.json"` |
| macOS | Terminal gõ: `open -a TextEdit ~/Downloads/service-account.json` |
| Linux | Terminal gõ: `nano ~/Downloads/service-account.json` (hoặc gedit) |

Nội dung file (rút gọn) trông như sau:

```json
{
  "type": "service_account",
  "project_id": "he-thong-thi-truc-tuyen",
  "private_key_id": "9f8e7d6c5b4a3210fedcba9876543210abcdef12",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n",
  "client_email": "exam-drive-bot@he-thong-thi-truc-tuyen.iam.gserviceaccount.com",
  "client_id": "112233445566778899000",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth"
}
```

👉 Dòng **`client_email`** (thứ 5) chính là **email của bot**. Copy **toàn bộ giá trị giữa hai dấu
ngoặc kép** — ví dụ trên là `exam-drive-bot@he-thong-thi-truc-tuyen.iam.gserviceaccount.com`.
Email có quy tắc nhận biết: `<tên-bot>@<project-id>.iam.gserviceaccount.com`.

> 💡 Không muốn mở file tay? Chạy luôn công cụ của dự án (Bước 8) — nó tự in email này ra màn hình:
> `node tools/check-drive.js "đường-dẫn-đến-service-account.json"`

### Bước 6 — Tạo thư mục Drive, lấy Folder ID và SHARE cho Service Account

Đây là bước quan trọng nhất — làm chậm từng ý nhỏ:

**6a. Tạo thư mục**

1. Mở **https://drive.google.com/** bằng chính tài khoản Google ở Bước 1.
2. Góc trên trái nhấn **+ New** (Mới) → **New folder** (Thư mục mới) → đặt tên
   `He-thong-thi-truc-tuyen` → **Create**.
3. **Nhấp đúp** vào thư mục để mở bên trong.

**6b. Lấy Folder ID**

- Khi đã ở trong thư mục, nhìn **thanh địa chỉ trình duyệt**:
  `https://drive.google.com/drive/folders/1AbCdEf_GhIjKlMnOpQrStUvWxYz123456`
- **Folder ID = toàn bộ đoạn sau chữ `/folders/`** → ví dụ trên là `1AbCdEf_GhIjKlMnOpQrStUvWxYz123456`
- Copy riêng đoạn đó (KHÔNG kèm `https://drive.google.com/drive/folders/`, KHÔNG có khoảng trắng đầu/cuối).

**6c. Chia sẻ (Share) thư mục cho Service Account — bước "Share" bạn cần làm**

1. Đang **ở bên trong thư mục** (đã nhấp đúp), nhìn **góc trên bên phải**: có nút **Share**
   (biểu tượng hình người). Nhấn vào nút đó.
   - *Không thấy chữ "Share"?* Giao diện mới rút gọn thành **biểu tượng hình người có dấu ✚**
     ngay cạnh khung tên thư mục — di chuột vào sẽ hiện tooltip "Share".
   - *Cách chắc chắn đúng thứ 2:* quay ra danh sách Drive, **chuột phải** vào tên thư mục →
     **Share** → **Share**.
2. Cửa sổ **"Share 'He-thong-thi-truc-tuyen'"** hiện ra:
   - Gõ email Service Account (lấy ở Bước 5) vào ô **"Add people, groups and calendar events"**:
     `exam-drive-bot@he-thong-thi-truc-tuyen.iam.gserviceaccount.com`
   - Email bot **không có gợi ý autocomplete** (khác email người thường) — chuyện bình thường.
     Gõ đủ rồi **nhấn Enter**: email chuyển thành một "thẻ" (chip) nằm trong ô nhập.
   - **Quan trọng:** cạnh ô nhập có menu thả xuống chọn quyền — mặc định **Viewer** →
     nhấn đổi thành **Editor**. (Để Viewer thì bot chỉ đọc được, server sẽ KHÔNG ghi được file.)
3. Nhấn nút **Send** (một số máy hiện chữ **Share**) ở góc dưới phải cửa sổ.
   ("Notify people" tích hay bỏ đều được — bot không có hộp thư.)
4. Kiểm tra lại: mở lại cửa sổ Share → mục **People with access** phải xuất hiện dòng
   `exam-drive-bot@...` kèm nhãn **Editor**.

✅ **Đối chiếu:** email bot hiện trong "People with access" với quyền Editor.

> ⚠️ Tài khoản Google **của tổ chức** (công ty/trường, đuôi khác @gmail.com) có thể bị chính sách
> chặn chia sẻ ra ngoài tổ chức. Nếu không share được hoặc server vẫn bị từ chối quyền:
> tạo thư mục bằng **tài khoản @gmail.com cá nhân** — chắc chắn hoạt động.

### Bước 7 — Mã hóa file key thành Base64

Base64 chỉ là cách biến file JSON thành **một chuỗi ký tự dài duy nhất** để dán được vào biến môi
trường (biến môi trường khó chứa nguyên một file JSON nhiều dòng):

**Windows (PowerShell):**

1. Nhấn phím Windows, gõ `powershell`, mở **Windows PowerShell**.
2. Chạy lệnh (sửa đường dẫn cho đúng nơi bạn để file — nhớ giữ ngoặc kép):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\Ten\Downloads\service-account.json")) | Set-Clipboard
   ```
   Chuỗi Base64 đã nằm trong clipboard — dán thẳng vào Vercel Environment Variables / file `.env`.
   Muốn in ra màn hình xem trước: bỏ `| Set-Clipboard`.

**macOS:**

```bash
base64 -i ~/Downloads/service-account.json | pbcopy
```

**Linux:**

```bash
base64 -w0 ~/Downloads/service-account.json
```

Chuỗi có thể dài **2.000+ ký tự nằm trên MỘT dòng** — hoàn toàn bình thường.

⚠️ **Ba lỗi hay gặp nhất ở bước này:**
- **Copy thiếu / đứt dòng** → server báo lỗi `JSON.parse` / `Unexpected token`. Luôn dùng
  `| Set-Clipboard` (Windows) hoặc `| pbcopy` (macOS) để copy trọn vẹn; khi dán vào `.env`,
  chuỗi phải nằm trên đúng 1 dòng.
- **Dùng nhầm `certutil -encode` trên CMD** — lệnh đó chèn thêm dòng `-----BEGIN CERTIFICATE-----`
  làm hỏng dữ liệu → **không dùng**.
- **Dán nhầm ô**: Base64 chỉ đi vào `GOOGLE_SERVICE_ACCOUNT_JSON`; Folder ID (Bước 6b) đi vào
  `GOOGLE_DRIVE_FOLDER_ID` — hai biến tách biệt, đừng hoán đổi.

### Bước 8 — Kiểm tra tự động (khuyên dùng trước khi deploy)

```bash
cd oes
npm install

# Lần 1: đọc file key -> in email Service Account -> sinh .env -> mã hóa Base64
node tools/check-drive.js "đường-dẫn-đến-service-account.json"

# Sau khi điền GOOGLE_DRIVE_FOLDER_ID vào .env — lần 2: test kết nối THẬT tới Drive
node tools/check-drive.js
```

Lần chạy thứ 2 kiểm tra tuần tự 5 mức — script in rõ bước nào đạt (✓), bước nào lỗi (✗) kèm
**cách sửa đúng theo mã lỗi Google trả về**:

| Mức | Kiểm tra gì | Thường lỗi khi |
|---|---|---|
| 1/5 | Đọc key, đủ `client_email` + `private_key` | Base64 / JSON hỏng |
| 2/5 | Nạp thư viện googleapis | Chưa chạy `npm install` |
| 3/5 | Liệt kê nội dung thư mục (quyền ĐỌC) | Chưa bật Drive API / sai Folder ID / chưa Share |
| 4/5 | Tạo + ghi đè file test (quyền GHI) | Share rồi nhưng để quyền Viewer |
| 5/5 | Xóa file test (dọn dẹp) | — |

Khi cả 5 mức đều ✓ → cấu hình đã đúng 100%. Copy 3 biến từ `.env`
(`SESSION_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_FOLDER_ID`) sang Vercel là xong.

### Bước 9 — Kiểm tra Drive NGAY TRÊN VERCEL (không cần máy local)

> `check-drive.js` chỉ chạy được trên máy bạn. Còn trên Vercel thì sao? OES có sẵn
> **nút kiểm tra Drive chạy trực tiếp trên server** — chính là 5 mức giống
> Bước 8 nhưng thực hiện bởi chính serverless function đang chạy hệ thống:

1. Mở `https://<ten-project>.vercel.app/admin.html` và đăng nhập Admin.
2. Nhìn **banner trạng thái đồng bộ** ngay đầu trang:
   - 🔴 **Đỏ** "CHẾ ĐỘ CỤC BỘ" → server chưa kết nối Drive (thiếu/sai biến môi trường).
   - 🟡 **Vàng** "Có N file chưa đồng bộ" → env có khai báo nhưng lệnh ghi lên Drive THẤT BẠI
     (banner sẽ in **Lỗi gần nhất** cụ thể, ví dụ `403 The caller does not have permission`).
   - 🟢 **Xanh** "Dữ liệu đã đồng bộ an toàn" → mọi thứ OK.
3. Bấm **"🔍 Kiểm tra Drive ngay"** → một bảng chẩn đoán hiện ra với 5 mức kiểm tra,
   mức nào FAIL sẽ có ô **"Cách sửa"** viết đúng nút bấm / đúng biến cần sửa.
4. Sửa xong (theo gợi ý) → bấm **"Kiểm tra lại"** trong bảng → tới khi hiện
   **"✅ Kết nối Google Drive: TỐT"** → bấm **"⟳ Đồng bộ ngay"** trên banner để đẩy toàn bộ
   dữ liệu đang chờ lên Drive. Nếu server đang kẹt ở chế độ local mà chẩn đoán PASS,
   server **tự kết nối lại Drive mà không cần restart**.

**Sửa biến môi trường trên Vercel như thế nào?** Vercel Dashboard → chọn project → tab
**Settings → Environment Variables** → sửa/tạo biến (chọn Environment: Production, Preview,
Development) → bấm **Save** → sang tab **Deployments** → bấm nút **⋯** ở deployment mới nhất →
**Redeploy** → chờ ~1 phút deploy xong rồi đăng nhập lại Admin để kiểm tra lại.

> ⚠️ Lưu ý: sửa biến môi trường trên Vercel **bắt buộc phải Redeploy** — chỉ bấm Save
> không làm serverless function chạy lại với giá trị mới. Deploy Vercel nhanh (~1 phút),
> sau deploy đăng nhập lại Admin và bấm "Kiểm tra lại" để xác nhận.

> 💡 **Mức 4 báo "Service Accounts do not have storage quota"?** Đây là giới hạn của Google:
> Service Account không có dung lượng riêng nên KHÔNG tự tạo được file mới, nhưng **CẬP NHẬT
> được file có sẵn**. Cách xử lý: tạo sẵn 3 file trong thư mục bằng **File upload** (kéo thả
> file `.json` từ máy vào thư mục — KHÔNG tạo bằng Google Docs), đặt đúng tên chữ thường
> `users.json` / `exams.json` / `results.json`, nội dung mỗi file chỉ cần `[]`. Bấm "Kiểm tra
> lại" — mức 4 sẽ tự chuyển sang kiểm tra cập nhật file có sẵn và hiện ✅ nếu mọi thứ ổn.
> Server tự nhận các file này ngay ở request kế tiếp, không cần deploy lại.

### Bảng xử lý 6 lỗi thường gặp

| Thông báo lỗi (log server / script) | Nguyên nhân | Cách xử lý |
|---|---|---|
| `403 SERVICE_DISABLED` / "Google Drive API has not been used..." | Chưa bật Drive API | Làm lại Bước 2, chờ 1–2 phút rồi chạy lại |
| `403 The caller does not have permission` | Chưa Share thư mục, hoặc share quyền Viewer; hoặc tài khoản tổ chức chặn chia sẻ ngoài | Làm lại 6c với quyền **Editor**; nếu là tài khoản tổ chức → chuyển sang @gmail.com cá nhân |
| `404 File not found: <id>` | `GOOGLE_DRIVE_FOLDER_ID` sai (copy cả URL, dư khoảng trắng, thư mục đã xóa) | Lấy lại ở Bước 6b — chỉ lấy đoạn sau `/folders/` |
| `401 invalid_grant` / `invalid_client` / lỗi JWT | Base64 hỏng (copy thiếu, thừa dòng trống) hoặc key đã bị xóa/thu hồi | Tạo lại key (Bước 4) + mã hóa lại (Bước 7, dùng Set-Clipboard / pbcopy) |
| `403 storageQuotaExceeded` / "Service Accounts do not have storage quota" | Service Account KHÔNG có dung lượng riêng — KHÔNG tự tạo được file MỚI (giới hạn của Google, không phải lỗi cấu hình) | Tạo sẵn 3 file THUẦN đúng tên `users.json`, `exams.json`, `results.json` trong thư mục Drive: **bấm New → File upload** (hoặc kéo thả file .json từ máy) — KHÔNG dùng New → Google Docs; nội dung mỗi file chỉ cần `[]`. Cập nhật file có sẵn thì KHÔNG tốn quota — hệ thống chạy bình thường. Mức 4 của "Kiểm tra Drive ngay" sẽ tự nhận diện và xác nhận |
| Log in `CHE DO CUC BO` (local mode) | Thiếu 1 trong 2 biến Google | Kiểm tra `.env` (local) hoặc **Environment Variables** (Vercel) đã khai báo đủ 2 biến chưa |

---

## 4. Biến môi trường

| Biến | Bắt buộc | Ý nghĩa |
|------|----------|---------|
| `SESSION_SECRET` | ✅ | Khóa ký token phiên + attempt token. Script `check-drive.js` tự sinh; hoặc tự tạo: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ (prod) | File key Service Account dạng **Base64** (khuyên dùng) hoặc JSON thô 1 dòng — sinh ở mục 3, Bước 7. |
| `GOOGLE_DRIVE_FOLDER_ID` | ✅ (prod) | ID thư mục Drive lưu 3 file JSON — lấy ở mục 3, Bước 6b. |
| `ADMIN_CCCDS` | tùy chọn | Danh sách CCCD được cấp quyền Admin khi đăng ký, phân cách bởi dấu phẩy. |
| `DATA_FILE_SUFFIX` | tùy chọn | Hậu tố tên file dữ liệu để chạy NHIỀU BẢN chung 1 thư mục Drive: đặt `Vercel` → hệ thống dùng `usersVercel.json`, `examsVercel.json`, `resultsVercel.json`. Trên Vercel nếu không đặt, hệ thống TỰ mặc định `Vercel`; chạy local / render.com không đặt → giữ tên gốc `users.json`... |
| `PORT` | — | Chỉ dùng khi chạy local (Vercel tự quản lý). |

Ví dụ giá trị (minh họa):

```dotenv
SESSION_SECRET=7f3a9c1e5d8b... (chuỗi hex 96 ký tự, script tự sinh)
GOOGLE_SERVICE_ACCOUNT_JSON=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Iiwi... (chuỗi Base64 1 dòng dài)
GOOGLE_DRIVE_FOLDER_ID=1AbCdEf_GhIjKlMnOpQrStUvWxYz123456
ADMIN_CCCDS=012345678901
```

> 💡 **Chế độ dev:** nếu bỏ trống 2 biến Google, hệ thống chạy **chế độ cục bộ** — dữ liệu ghi
> vào `./data/`. Tiện để phát triển giao diện mà chưa cần Drive. ⚠️ Trên Vercel bắt buộc cấu
> hình Drive: chế độ cục bộ ghi vào `/tmp` sẽ mất khi instance giải phóng.

---

## 5. Chạy thử trên máy local

```bash
cd oes
npm install

# (Khuyên dùng) Sinh .env từ file key + kiểm tra Drive — xem mục 3, Bước 8:
node tools/check-drive.js "đường-dẫn-đến-service-account.json"

# (Chỉ khi KHÔNG dùng script trên) tạo .env thủ công:
cp .env.example .env        # điền SESSION_SECRET (+ biến Google nếu muốn)

npm start                   # hoặc: npm run dev (tự restart khi sửa code)
```

Mở `http://localhost:3000`:

1. **Người dùng ĐẦU TIÊN đăng ký khi hệ thống trống sẽ tự động là Admin** (hoặc khai báo `ADMIN_CCCDS`).
2. Đăng nhập Admin → `admin.html` → **Đề thi → Ra đề thi mới** (thêm câu hỏi, đánh dấu đáp án đúng).
3. Đăng ký thêm tài khoản thí sinh → `quiz.html` → **Vào thi** → làm bài → nộp bài → xem điểm.
4. Admin vào **Bảng điểm** xem chi tiết theo hạng mục, sửa/xóa kết quả khi cần.

---

## 6. Deploy lên Vercel

### Cách A — Qua GitHub (khuyên dùng, có CI/CD tự động)

1. **Đẩy mã nguồn OES lên một repo GitHub** (đẩy cả thư mục, không cần node_modules —
   file `.gitignore` đã loại sẵn).
2. Đăng nhập [vercel.com](https://vercel.com) bằng tài khoản GitHub → **Add New… → Project**
   → bấm **Import** ở repo vừa tạo.
3. Màn hình cấu hình:
   - **Framework Preset:** để `Other` (OES tự cấu hình bằng `vercel.json`).
   - **Root Directory:** để mặc định (./).
   - **Build Command / Output Directory:** bỏ trống (không cần build).
   - **Install Command:** để mặc định (`npm install`).
4. Kéo xuống **Environment Variables** → thêm từng biến (mục 4):
   `SESSION_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_FOLDER_ID`
   (và tùy chọn `ADMIN_CCCDS`). ⚠️ Chuỗi Base64 dài 2000+ ký tự dán vào ô Value
   vẫn nằm trên 1 dòng — bình thường.
5. Bấm **Deploy** → chờ ~1 phút → mở `https://<ten-project>.vercel.app`.
6. **Kiểm chứng sau deploy:** đăng ký tài khoản đầu tiên (tự thành Admin) → mở
   `/admin.html` → banner đồng bộ phải màu XANH, hoặc bấm **"🔍 Kiểm tra Drive ngay"**
   (mục 3, Bước 9) cho tới khi 5/5 mức đều ✓.

Từ giờ **mỗi lần `git push` là Vercel tự deploy phiên bản mới** — cập nhật đề/bản vá
chỉ mất 1 phút, không cần restart gì.

#### Cập nhật bản vá vào repo ĐÃ có sẵn (quan trọng khi sửa lỗi deploy)

Redeploy trên Vercel chỉ build lại **code đang nằm trên GitHub** — nó không thể thay code
bằng cách nào khác. Vì vậy khi nhận bộ zip OES mới (ví dụ bản sửa lỗi "Invalid export /
FUNCTION_INVOCATION_FAILED"), phải đưa file mới lên repo trước:

1. Giải nén `oes-vercel.zip` ra máy.
2. Mở repo GitHub của bạn (vd `nguyenhuucuongTC21B/oes`) → **Add file → Upload files**.
3. Kéo thả **toàn bộ file + thư mục** trong bản giải nén vào ô upload (GitHub tự ghi đè
   file trùng tên; nếu bị chặn vì "exceeds 100 files" thì upload theo từng đợt nhỏ).
4. Gõ nội dung commit (vd `Update OES R4 - fix session het han`) → **Commit changes**.
5. Vercel tự deploy commit mới — kiểm tra mã commit trong deployment phải **khác** mã cũ.
6. Mở `<domain>/api/health` — thấy `"build": "OES-VERCEL-R5"` là bản vá đã chạy thật.

### Cách B — Vercel CLI (không cần GitHub)

```bash
npm install -g vercel      # hoặc: npx vercel

cd oes
vercel                     # lần đầu: đăng nhập + trả lời vài câu (Framework: Other)
vercel env add SESSION_SECRET production          # dán giá trị rồi Enter
vercel env add GOOGLE_SERVICE_ACCOUNT_JSON production
vercel env add GOOGLE_DRIVE_FOLDER_ID production
vercel --prod              # deploy bản chính thức
```

### Đặc thù vận hành trên Vercel (đọc kỹ trước giờ thi)

- **Free Hobby tier là đủ dùng:** serverless function 1024 MB, thời lượng tối đa 30 giây/request
  (đã cấu hình trong `vercel.json`), băng lượng tĩnh miễn phí. Không cần UptimeRobot —
  không có trạng thái nào nằm ngoài Drive.
- **Cold start nhẹ:** request đầu tiên của mỗi instance chậm hơn ~1–3 giây (nạp googleapis +
  tải dữ liệu Drive). Các request tiếp theo trong instance đang ấm chạy nhanh bình thường.
  Không còn hiện tượng "ngủ 15 phút mất RAM" như Render Free.
- **Nhiều instance chạy song song:** Vercel tự scale. OES xử lý bằng baseline-merge khi ghi
  (mục 2b) + làm tươi cache đọc 15 giây — các thí sinh không bao giờ ghi đè mất bài của nhau.
- **Rate-limit đăng nhập (6 lần/15 phút) áp dụng theo từng instance** — tổng thực tế có thể
  cao hơn một chút; vẫn đủ chặn dò mật khẩu thủ công.
- **⚠️ BẮT BUỘC hoàn thành mục 3 (8 bước Drive) TRƯỚC khi ra đề thật.** Trên serverless,
  dữ liệu KHÔNG được lưu ở bất kỳ đâu khác ngoài Drive: nếu Drive chưa cấu hình đúng và
  instance giải phóng, dữ liệu mới nhập sẽ mất. Kiểm tra bằng banner trạng thái + nút
  "Kiểm tra Drive ngay" trong `/admin.html` — phải XANH trước giờ thi.
- **Đổi tên miền riêng:** Settings → Domains → Add — Vercel cấp HTTPS tự động.
- Log server: tab **Deployments → deployment mới nhất → Functions/Logs** — tìm dòng
  `[store] Da ghi xxx.json len Google Drive` sau mỗi lần lưu để giám sát sync.

---

## 7. Câu hỏi nhanh (Vercel edition)

**Chạy song song bản Vercel và bản render.com chung một thư mục Drive?** Từ bản R5, hệ thống
tự tách dữ liệu theo hậu tố tên file (`DATA_FILE_SUFFIX`, xem bảng biến môi trường mục 4):
bản Vercel ghi/đọc `usersVercel.json`, `examsVercel.json`, `resultsVercel.json` còn bản
render.com tiếp tục dùng `users.json`, `exams.json`, `results.json` — hai bên KHÔNG ghi đè
dữ liệu của nhau dù cùng trỏ vào một thư mục Drive. Lưu ý bắt buộc: Service Account không có
dung lượng riêng nên bạn cần TẠO SẴN trong thư mục Drive 3 file `usersVercel.json`,
`examsVercel.json`, `resultsVercel.json` (upload từ máy, nội dung mỗi file chỉ cần `[]`).
Muốn khởi điểm với dữ liệu sẵn có của bản render.com: tải file gốc về, đổi tên thêm hậu tố
`Vercel`, upload lại vào cùng thư mục. Đăng ký người dùng mới trên một bản KHÔNG xuất hiện
trên bản kia; bài nộp, đề thi cũng tách biệt hoàn toàn.

**Cách xác minh bản code mới đã chạy thật trên Vercel?** Mở `<domain>/api/health` — nếu JSON
chứa `"build": "OES-VERCEL-R5"` tức bản sửa lỗi "Invalid export / FUNCTION_INVOCATION_FAILED"
đã được deploy thành công. Nếu thấy 404, JSON khác, hoặc không có trường `build` → Vercel
vẫn đang chạy **code cũ trong repo GitHub** (xem câu tiếp theo).

**Vercel vẫn báo lỗi cũ dù tôi đã Redeploy — sửa thế nào?** Redeploy chỉ build lại **code
hiện có trên GitHub**, không thay được code. Bạn phải đưa file mới lên repo: tải
`oes-vercel.zip` mới nhất → giải nén → mở repo GitHub → **Add file → Upload files** → kéo thả
**toàn bộ file/thư mục** trong bản giải nén (ghi đè lên file cũ) → gõ Commit changes → bấm
**Commit changes**. Vercel tự deploy commit mới (kiểm tra: mã commit trên Vercel phải **khác**
cũ). Nếu vẫn lỗi sau khi commit mới đã deploy: vào **Dashboard → project → deployment mới
nhất → tab Runtime Logs**, tìm dòng `ERROR` đầu tiên (kèm Request ID nếu có) và gửi nội dung đó.

**Log Vercel báo "Invalid export found in module ... The default export must be a function or server" và site 500?**
Đây là lỗi của bản OES trước 15/10/2026 (đã sửa 3 lớp): (1) `api/index.js` giờ export hàm
`handler(req, res)` định nghĩa ngay trong file; (2) `src/app.js` giờ export thẳng hàm
`createApp` (không còn object `{ createApp }`) — module bị runtime "truy vết" đến luôn pass;
(3) `vercel.json` dùng cấu hình `builds` + `routes` truyền thống — Vercel không còn tự nhận
dạng "backend framework" nên hết các cảnh báo internal rewrites. Kèm cơ chế phòng thủ: kể cả
entrypoint cũ re-export thẳng `src/app.js` làm handler, `createApp` vẫn tự nhận `(req, res)`
và chạy được. Nếu bạn tự chỉnh code, nhớ giữ nguyên quy tắc: **export của mọi file trong
`api/` phải là hàm được định nghĩa ngay trong file đó, không re-export module khác**.

**Truy cập ra "500 FUNCTION_INVOCATION_FAILED" (có Request ID kiểu hkg1::...)?** Nghĩa là
function bị crash lúc chạy. Thứ tự kiểm tra: (1) mở `<domain>/api/health` — không có
`"build": "OES-VERCEL-R5"` ⇒ repo chưa có code mới, cập nhật lại theo câu trên; (2) đã có
marker mà lỗi ở request cụ thể ⇒ vào Dashboard → deployment mới nhất → **Runtime Logs**, lọc
theo Request ID đó, đọc dòng lỗi đầu tiên: nếu là lỗi khởi tạo Drive (thiếu/misent env var)
→ sửa Environment Variables rồi Redeploy; bản code mới cũng trả trang JSON chẩn đoán
`OES_INITIALIZATION_FAILED` kèm `message` chi tiết thay vì 500 trắng hoàn toàn.

**Log nhắc "SESSION_SECRET chua duoc cau hinh"?** Từ bản R4, nếu chưa đặt `SESSION_SECRET`,
hệ thống TỰ phái sinh khóa ký ổn định từ `GOOGLE_SERVICE_ACCOUNT_JSON` nên phiên đăng nhập
VẪN hoạt động bình thường qua các instance (không còn lỗi "Phiên đăng nhập hết hạn hoặc
không hợp lệ" lúc có lúc không). Tuy vậy vẫn khuyến nghị đặt `SESSION_SECRET` (chuỗi ngẫu
nhiên dài bất kỳ) trong Project → Settings → Environment Variables để khóa không phụ thuộc
vào nội dung Service Account — xong **nhớ Redeploy** (Deployments → nút ⋯ → Redeploy) vì
env mới chỉ áp dụng cho deployment mới.

**Ra 1 đề nhưng danh sách hiện 3 đề giống nhau?** Do bấm nút "Lưu đề thi" nhiều lần khi
request đầu tiên còn chờ (cold start 1–3 giây, tưởng là không ăn nên bấm tiếp). OES đã:
(1) khóa nút và hiện "Đang lưu..." khi đang gửi; (2) server từ chối tạo đề trùng tên +
hạng mục trong vòng 2 phút (lỗi 409). Các đề trùng cũ: vào "Đề thi → Xóa" từng đề thừa.

**Không xem được nội dung / không sửa được đề thi?** Card đề thi có 3 nút **Xem đề** (xem
toàn bộ câu hỏi, đáp án đúng tô xanh) — **Sửa** (mở lại form ra đề điền sẵn nội dung, sửa
xong bấm "Cập nhật đề thi") — **Xóa**.

**Đề thi có bị "biến mất" như bản Render Free nữa không?** Không — nguyên nhân cũ là Render
ngủ 15 phút xóa sạch RAM + đĩa tạm. Trên Vercel, OES **ghi Drive ngay trong từng request**,
không có dữ liệu chờ sync, không có trạng thái ngoài Drive. Đề thi/tài khoản/điểm chỉ có thể
"mất" nếu Drive chưa cấu hình đúng — kiểm tra bằng banner + "Kiểm tra Drive ngay" trong Admin.

**Banner vàng "Có N file chưa đồng bộ" báo nguyên nhân gì?** Banner in thẳng **Lỗi gần nhất**
do server ghi nhận (ví dụ `403 The caller does not have permission` → thiếu Share / sai quyền;
`DECODER routines::unsupported` → chuỗi Base64 key bị hỏng khi copy). Bấm "Kiểm tra Drive ngay"
để xem đủ 5 mức kèm ô "Cách sửa" cho từng mức. Sửa env xong nhớ **Redeploy**.

**Hai thí sinh nộp bài cùng lúc (khác instance) có mất bài không?** Không. Lần ghi nào cũng
tải bản mới nhất về, **hợp nhất theo baseline** rồi mới upload (mục 2b) — bài nộp/đăng ký của
instance khác được giữ nguyên; lệnh xóa của Admin vẫn "dính"; trùng id thì bản mới thắng.

**Sửa cấu hình xong rồi, dữ liệu có tự lên Drive không?** Có — request ghi tiếp theo sẽ
thử lại toàn bộ quy trình (fetch-before-write + merge). Và vì hệ thống **cấm upload đè** khi
chưa đọc được bản cũ trên Drive, không bao giờ có chuyện sync fix xong lại làm mất dữ liệu cũ.

**Thí sinh refresh trang / tắt máy giữa chừng thì sao?** Attempt token (hạn 24 giờ) nằm trong
localStorage của trình duyệt thí sinh: vào lại đề, server kế tục đúng `startedAt` gốc — đồng
hồ không được reset, không thể gian lận thời gian (mục 2c). Lưu ý: nếu thí sinh **xóa lịch sử
duyệt web/đổi thiết bị** thì vào lại được coi như lượt mới (phải qua cửa thi nếu đề có lịch).

**Giới hạn đăng nhập sai 6 lần/15 phút có "chung nhau" giữa các thí sinh không?** Không —
đếm theo cặp (CCCD + IP) và theo từng instance; mỗi thí sinh bị đếm riêng.

**Đổi nội dung trang chủ / tên cuộc thi / hạn thi?** Sửa trực tiếp `public/index.html`
và hằng số `DEADLINE` trong `public/assets/js/home.js`.

**Cách đặt "đề thi 01 mở cửa 14:00 ngày 15/10/2026"?** Admin → Đề thi → Sửa đề → tích
"⏰ Quy định giờ thi" → chọn `14:00 15/10/2026` trong ô "Mở cửa thi từ" (giờ VN) → Cập nhật
đề thi. Thí sinh chỉ bấm được "Vào thi" từ thời điểm đó; trước giờ mở, thẻ đề hiển thị
"⏳ Chưa mở cửa" kèm giờ mở. Để cuộc thi kết thúc đúng hạn, đặt thêm "Đóng cửa thi lúc".

**Đặt giờ thi xong mà thí sinh báo không vào được bài?** Đối chiếu 3 điểm: (1) khung giờ có
dài ít nhất bằng thời lượng đề không — server từ chối lưu khung giờ ngắn hơn; (2) đã bấm
"Cập nhật đề thi" và thấy thông báo "Mở cửa từ ..."; (3) giờ hiển thị là **giờ Việt Nam
(GMT+7)** — nếu admin đặt lịch ở nước ngoài, ô lịch vẫn quy về giờ VN.

**Bộ đề mẫu tự xuất hiện là gì?** 3 bộ đề mẫu (2 đề × 50 câu ATTT + 1 đề 81 câu Chuyển đổi
số, gồm cả trắc nghiệm và tự luận ngắn) được nạp sẵn lần đầu chạy (hoặc khi exams.json trống)
để Ban Tổ chức có ngay dữ liệu dùng thử — xem mục 2e. Có thể sửa/xóa tự do; xóa nhầm thì bấm
"⤓ Tải bộ đề mẫu" để nạp lại (không nhân đôi, chỉ nạp những đề còn thiếu).

**File .json rỗng 0 byte tự tạo trong Drive có gây lỗi nữa không?** Không. Hệ thống
**chấp nhận file rỗng** coi như dữ liệu trống và ghi dữ liệu vào bình thường — vì vậy cách
tạo sẵn 3 file `users.json`, `exams.json`, `results.json` nội dung `[]` (hoặc rỗng hoàn toàn)
là hợp lệ.

**Muốn nhiều Admin?** Đăng ký tài khoản rồi Admin hiện tại vào "Người dùng → Sửa → Quyền hạn
→ Admin", hoặc khai báo `ADMIN_CCCDS` trước khi người đó đăng ký.

**Đăng ký / nộp bài báo lỗi Drive?** Mở `https://<ten-project>.vercel.app/api/health` — nếu
`"mode":"drive"` và có `lastError` sẽ thấy nguyên nhân chính xác. Đăng ký/nộp bài **không bị
chặn** khi Drive lỗi — dữ liệu giữ trong RAM instance và request kế tiếp tự thử lại; nhưng
bạn vẫn phải hoàn thành mục 3 (8 bước) rồi **Redeploy** để dữ liệu được lưu vĩnh viễn.

**Bị lỗi khi kết nối Drive / chưa làm được bước Share?** Xem mục 3: hướng dẫn từng nút bấm
(8 bước) kèm dấu hiệu đối chiếu, bảng xử lý lỗi thường gặp, và nút "Kiểm tra Drive ngay"
chạy trực tiếp trên server (Bước 9).

**Quota Google Drive?** Service Account được 750 GB/ngày upload — với file JSON vài chục KB,
hệ thống hàng nghìn thí sinh vẫn dư sức. Vercel Hobby: 100 GB băng thông/tháng cho tài liệu
tĩnh — đủ cho hàng trăm thí sinh thi cùng lúc.

**Chi phí Vercel?** Hobby (miễn phí) đủ cho cuộc thi quy mô trường/huyện. Pro chỉ cần khi
muốn nhiều thành viên team, domain nâng cao hoặc giới hạn function cao hơn.
