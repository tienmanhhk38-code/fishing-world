# Các phần nghiệm thu cần người và thiết bị thật

Chưa thực hiện các phép thử dưới đây. Kết quả tự động/SwiftShader trong M5 không được điền thay vào bảng này.

Đã có benchmark desktop tự động bằng GPU Intel UHD 730 thật trong [báo cáo M5](M5-REPORT.md). Bảng bên dưới dành cho kiểm tra bằng tay, chạy lâu, nhiều mức chất lượng và các thiết bị di động; chưa được điền bằng kết quả benchmark ngắn đó.

## Năm người mới

Cho từng người dùng một phiên khách mới, camera/cài đặt mặc định. Chỉ nói “Hãy bắt con cá đầu tiên”; không hướng dẫn trước lúc nào cần giật. Bấm giờ từ khi vào bến. Hỏi sau lượt đầu họ phân biệt nhấp giả/cắn thật bằng dấu hiệu nào. Ghi riêng nếu cần trợ giúp, nhầm do nắng/âm thanh hoặc dùng cảm ứng.

| Người | Thiết bị/trình duyệt | Phân biệt nhấp/cắn tự lực | Cá đầu trong 3 phút | Thời gian | Cần trợ giúp / ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Chưa thử | — | — | — | — |
| 2 | Chưa thử | — | — | — | — |
| 3 | Chưa thử | — | — | — | — |
| 4 | Chưa thử | — | — | — | — |
| 5 | Chưa thử | — | — | — | — |

Đạt mục tiêu khi ít nhất 4/5 tự phân biệt và bắt cá đầu trong 3 phút. Không bỏ các lượt hụt khỏi thống kê. Đo thêm thời gian mua cần tre/carbon và phản hồi vòng bắt → bán → nâng cấp trước khi điều chỉnh kinh tế.

## Thiết bị và hình ảnh

Thử desktop có GPU thật, Android tầm trung/Chrome, iPhone/iPad/Safari; ghi model máy, RAM/GPU, OS, browser, viewport/DPR, mức đồ họa/FPS đã chọn, Wi-Fi/di động. Đo một người rồi phòng đủ 20 người, đi lại/câu/chat ít nhất 10 phút. Xoay trọn 360° và thử cả hai giới hạn pitch; đo cả lúc nhiều phao/dấu !/cá khoe. Ghi FPS trung bình, frame p95, draw call cao nhất, nhiệt/giảm xung, thời gian tải lạnh và dung lượng nén. Mục tiêu desktop 60 FPS, điện thoại chất lượng thấp ít nhất 30 FPS.

Mở `?diagnostics=1` để thu tối đa 1.000 mẫu gần nhất trong `window.__fishingDiagnostics`; reset trước đoạn đo, giữ tab foreground. Đây là công cụ đo tại máy, không gửi telemetry cá nhân ra dịch vụ bên ngoài.

| Thiết bị thật | 20 người / chất lượng | FPS / frame p95 | Draw call lớn nhất | Phút chạy | Kết quả |
| --- | --- | --- | --- | --- | --- |
| Desktop GPU | Chưa thử | — | — | — | Chưa xác nhận |
| Android tầm trung | Chưa thử | — | — | — | Chưa xác nhận |
| Safari iOS | Chưa thử | — | — | — | Chưa xác nhận |

Đối chiếu ảnh góc mặc định với ba bảng trong `design/reference/`: bố cục nhân vật/bến/phao/hải đăng, màu nước/gỗ, cỡ chữ, độ tương phản !/phao. Model low-poly hiện tại vẫn khác độ chi tiết ảnh concept; rig runtime chưa thay cho bộ animation Blender được biên tập.

Kiểm tra màn hình dọc/ngang, safe area, dùng đồng thời joystick và kéo camera, xoay sát nhà/cây để phát hiện che camera, nhả phím khi chuyển tab, mất mạng 5/25/40 giây, bật/tắt âm và các mức âm lượng. Nghe riêng nhấp giả không có âm cắn, cắn thật có âm báo rõ. WebKit tự động trên Windows không tương đương chứng nhận Safari iOS hay kiểm thử bằng tay.

## Beta public

Sau khi có Vercel + backend thật, chạy lại soak 20 người/60 phút, HTTPS/WSS từ mạng ngoài, hai trình duyệt độc lập, tải lại sau bắt, backup/restore và thử mất kết nối. Kiểm tra vận hành, lưu lượng và log trên chính cấu hình máy chủ trước khi đánh dấu M5 phát hành đạt. Bản cấu hình local chưa đáp ứng thay cho điều kiện này.
