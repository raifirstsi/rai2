# RAI² Custom On-Premise Deployment

Bộ cài đặt dành riêng cho doanh nghiệp triển khai trên hạ tầng riêng (On-Premise / Private Cloud).

- **Bảo vệ mã nguồn**: Image chỉ đóng gói `dist/` và `dist-server/` đã biên dịch; không chứa `src/`, `server/*.ts`, hay `saas/`.
- **Kiểm soát bản quyền**: Yêu cầu `RAI2_LICENSE_KEY` ký số Ed25519 hợp lệ (`RAI2_CUSTOM_ONPREM=1`).
- **Cài đặt nhanh**:
  1. `cp .env.custom.example .env` và điền `DOMAIN`, `RAI2_LICENSE_KEY`.
  2. Chạy `bash install.sh`.
