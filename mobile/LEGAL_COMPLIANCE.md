# HỒ SƠ PHÁP LÝ & BẢO HỘ THƯƠNG MẠI HÓA (LEGAL COMPLIANCE MANUAL)
**Dự án: RAI² Mobile Companion (iOS & Android)**  
**Đơn vị sở hữu phái sinh: RAIFIRST (https://raifirst.si / https://rai2.si)**  
**Giấy phép nền tảng: Apache License, Version 2.0**

---

## 1. CĂN CỨ PHÁP LÝ QUỐC TẾ (APACHE LICENSE 2.0)

Mã nguồn ứng dụng di động (iOS SwiftUI & Android Jetpack Compose) được kế thừa hợp pháp từ nền tảng mã nguồn mở được phát hành theo giấy phép **Apache License, Version 2.0**. Dưới các điều khoản quy định:

1. **Quyền thương mại hóa không giới hạn (Section 2 - Grant of Copyright License)**:
   - Cho phép vĩnh viễn, toàn cầu, miễn phí bản quyền (royalty-free), không hủy ngang quyền tái tạo, tạo tác phẩm phái sinh (Derivative Works), hiển thị công khai, cấp phép lại (sublicense) và phân phối dưới dạng mã nguồn hoặc mã nhị phân đóng gói (Binary/App).
   - Đơn vị phát triển được quyền bán ứng dụng thu tiền một lần, thu phí thuê bao định kỳ (Subscription) hoặc phân phối kèm dịch vụ SaaS của **RAI² First OS**.

2. **Quyền đóng gói mã nguồn phái sinh (Section 4 - Derivative Works)**:
   - Khác với giấy phép GPL (yêu cầu lây nhiễm mã nguồn mở), **Apache 2.0 cho phép bạn giữ kín các phần mã nguồn cải tiến, tính năng mở rộng hoặc thuật toán riêng mà RAIFIRST phát triển thêm** mà không bị bắt buộc phải công khai ra cộng đồng.

3. **Cấp phép sáng chế tương hỗ (Section 3 - Grant of Patent License)**:
   - Bảo vệ doanh nghiệp khỏi các vụ kiện bằng sáng chế từ các bên đóng góp mã nguồn ban đầu.

---

## 2. NGHĨA VỤ PHÁP LÝ BẮT BUỘC ĐÃ HOÀN TẤT (COMPLIANCE ACTIONS)

Để đảm bảo tuân thủ 100% về mặt pháp lý khi xuất bản lên các kho ứng dụng (App Store, Google Play) và thương mại hóa toàn cầu:

### A. Giữ thông cáo bản quyền & Attribution (Điều 4)
- File `mobile/LICENSE` chứa đầy đủ nguyên văn giấy phép Apache License 2.0.
- File `mobile/NOTICE` ghi nhận đầy đủ quyền tác giả gốc của OpenMausBot contributors cùng các thư viện bên thứ ba (WebRTC - BSD 3-Clause, HPKE - MIT).

### B. Cô lập và bảo vệ Nhãn hiệu (Section 6 - Trademarks Disassociation)
Điều 6 của Apache 2.0 cấm sử dụng tên thương hiệu hoặc logo của tác giả gốc. RAIFIRST đã tiến hành tái định danh (Rebranding) toàn diện:
- **Tên ứng dụng hiển thị (App Name)**: `RAI²` (hoặc `RAI² Companion`).
- **Tên doanh nghiệp phát hành**: `RAIFIRST` (`https://raifirst.si`).
- **Mã nhận diện ứng dụng (Application ID / Bundle ID)**:
  - iOS: `com.raifirst.rai2.companion` (thay thế hoàn toàn `com.openmausbot.*`).
  - Android: `com.raifirst.rai2.companion` (thay thế hoàn toàn `com.openmausbot.*`).
- **Logo & Bộ nhận diện**: Sử dụng toàn bộ biểu tượng và ngôn ngữ thiết kế đơn sắc của thương hiệu **RAI²**, loại bỏ hoàn toàn các hình ảnh linh vật/mascot của dự án gốc.

---

## 3. CHECKLIST SẴN SÀNG CHO APPLE APP STORE & GOOGLE PLAY STORE

### 1. Apple App Store (Apple Developer Program)
- **App Store Review Guideline 2.3.8 (App Display Name)**:
  `CFBundleDisplayName` trong `project.yml` và `Info.plist` được đặt thống nhất là `RAI²`.
- **Chính sách dữ liệu & quyền riêng tư (Privacy Nutrition Labels)**:
  - Dữ liệu kết nối tới máy chủ `companion` (cổng `8810` qua SSL/HTTPS) do người dùng tự sở hữu và quản lý (Private Cloud / On-Premise).
  - WebRTC Audio Stream phục vụ gọi thoại thời gian thực trực tiếp, không thu thập và không bán dữ liệu cho bên thứ ba.
- **App Group & Keychain Sharing**:
  Đã cấu hình namespace an toàn: `group.com.raifirst.rai2.shared` và `keychain-access-groups`.

### 2. Google Play Store (Google Play Console)
- **Data Safety Section**:
  - Không chứa mã theo dõi ngầm (no hidden telemetry/ad trackers).
  - Không truyền tải dữ liệu nhạy cảm ra ngoài phạm vi kết nối được người dùng phê duyệt bằng QR Pairing hoặc Token xác thực.
- **Chữ ký phát hành (Release Keystore)**:
  Tạo Keystore phát hành độc lập của RAIFIRST và cấu hình qua biến môi trường bí mật hoặc `keystore.properties` (được đưa vào `.gitignore`).

---

## 4. KẾT LUẬN

Tác phẩm phái sinh **RAI² Mobile Companion** được thiết lập chuẩn mực, đầy đủ tư cách pháp nhân để:
1. Triển khai phân phối tự do hoặc thương mại toàn cầu.
2. Đăng ký tài khoản Developer chính chủ của RAIFIRST trên Apple App Store và Google Play Store.
3. Tích hợp thanh toán In-App Purchase hoặc cổng thanh toán định kỳ của hệ sinh thái **RAI²**.
