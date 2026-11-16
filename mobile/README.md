# RAI² Mobile Companion (iOS & Android)

Ứng dụng di động chính thức của hệ điều hành **RAI² First OS** (https://rai2.si). Cho phép người dùng theo dõi và tương tác với các Agent, duyệt workspace, phê duyệt yêu cầu (approvals), đàm thoại AI thời gian thực (Live Calls qua WebRTC) và nhận thông báo mọi lúc mọi nơi.

---

## Cấu trúc thư mục

- `ios/`: Ứng dụng native iOS viết bằng **Swift & SwiftUI** (hỗ trợ Live Activities, Dynamic Island, Widgets, SSE Stream, WebRTC audio).
- `android/`: Ứng dụng native Android viết bằng **Kotlin & Jetpack Compose** (hỗ trợ Background Service, WebRTC, Share Sheet, Local Notifications).
- `LICENSE`: Giấy phép Apache License 2.0.
- `NOTICE`: Ghi nhận quyền tác giả gốc và các bên thứ ba hợp lệ.
- `LEGAL_COMPLIANCE.md`: Hồ sơ pháp lý và quy chuẩn thương mại hóa.

---

## Hướng dẫn Build ứng dụng

### 1. iOS (Yêu cầu macOS & Xcode 15+)

Dự án iOS sử dụng [XcodeGen](https://github.com/yonaskolb/XcodeGen) để tự động sinh file `.xcodeproj` sạch từ `project.yml`:

```bash
cd mobile/ios

# Cài đặt XcodeGen (nếu chưa có)
brew install xcodegen

# Tạo file dự án Xcode
xcodegen generate

# Mở dự án trong Xcode
open RAI2Companion.xcodeproj
```

Hoặc chạy Unit Tests:
```bash
swift test
```

### 2. Android (Yêu cầu Android Studio Iguana+ & JDK 17+)

Dự án Android sử dụng Gradle tiêu chuẩn:

```bash
cd mobile/android

# Build Debug APK
./gradlew assembleDebug

# Chạy Unit Tests
./gradlew testDebugUnitTest

# Build Release APK (unsigned hoặc cấu hình qua keystore.properties)
./gradlew assembleRelease
```

---

## Cơ chế kết nối với RAI² Backend

Ứng dụng di động kết nối an toàn với máy chủ RAI² thông qua module `companion` (cổng mặc định `8810` qua kết nối loopback, LAN, Tailscale hoặc HTTPS công khai).
1. Người dùng quét mã QR được tạo từ giao diện web hoặc terminal của RAI² (`pair --phone`).
2. Điện thoại trao đổi chứng chỉ bảo mật mã hóa đầu cuối (HPKE).
3. Sau khi kết nối thành công, phiên làm việc được duy trì qua SSE (Server-Sent Events) và WebRTC cho kênh đàm thoại giọng nói.
