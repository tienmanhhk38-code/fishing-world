# Fishing World Online — Bộ asset 3D prototype v1

Bộ model thật để thử trong Blender, Three.js/R3F và các engine hỗ trợ glTF. Đây là bộ prototype hình học low-poly, chưa đạt chất lượng nhân vật/kiến trúc chi tiết như ảnh concept. Không phải game hoàn chỉnh.

## Có gì trong bộ này?

| Nhóm | Số model | Nội dung |
|---|---:|---|
| Môi trường | 12 | Nền đảo, bến thẳng 2×3 m, góc bến 3×3 m, cọc, dừa, cụm đá, bụi cây, nhà, hải đăng, quầy cá, thùng gỗ, ghế |
| Dụng cụ câu | 8 | Cần gỗ/tre/carbon; mồi thường/giun/tôm; phao; bóng cá chung |
| Cá concept | 15 | 5 dáng cơ bản × 3 biến thể màu/hình, chưa gán tên loài hoặc bảng cân bằng |
| Nhân vật | 1 | Blockout chibi đội mũ, hoodie, quần short; tĩnh, chưa rig |
| Mặt nước và hiệu ứng | 3 | Ô nước 10 m, vòng sóng tĩnh, dấu chấm than dạng mesh |
| **Tổng** | **39** | Mỗi model có file GLB riêng |

## Mở và sử dụng

- `fishing_world_assets.blend`: file nguồn Blender, có tất cả asset gốc và cảnh đảo ghép thử. Các asset gốc bị ẩn để không chồng lên cảnh; bật chúng qua Outliner khi cần chỉnh.
- `models/`: 39 file `.glb`, mỗi file là một mesh nhiều material, không tham chiếu texture ngoài.
- `island_layout_example.glb`: ví dụ bố cục ghép từ model. Đây là cảnh trình diễn tỷ lệ, không phải bản đồ sản xuất hoặc layout collision chính thức.
- `previews/`: ảnh render trực tiếp từ model thật, không phải ảnh AI giả lập model.
- `asset_manifest.json`: tên file, số tam giác, số material, kích thước và trạng thái từng asset.
- `source/build_assets.py`: mã dựng lại bộ asset, chạy bằng Blender 4.3.2: `blender -b --python source/build_assets.py` từ thư mục bộ asset. Script xuất lại model và render ảnh xem trước.

Trong R3F, tải model bằng `useGLTF('/assets/models/palm_tree.glb')`, rồi clone scene khi cần nhiều bản. Sao chép file GLB vào thư mục public của dự án; đường dẫn ví dụ này không tải từ CDN.

## Quy ước kỹ thuật

- Tỷ lệ model tính bằng mét; GLB xuất Y-up. File Blender dùng Z-up.
- Pivot chủ yếu ở gốc asset: mặt bến tại cao độ gốc, cọc bến kéo xuống dưới mặt; chân nhân vật ở gần mặt nền. Phao nổi đặt quanh cao độ mặt nước. Khi ghép cảnh cần kiểm tra lại điểm chạm nền.
- Cá hướng +X; dùng cùng `fish_shadow_uniform.glb` cho mọi loài trong giai đoạn chờ/nhấp. Không dùng mesh cá cụ thể làm bóng báo trước.
- Model là mesh tĩnh, tô màu bằng material PBR đơn giản. Không có texture atlas, UV texture được biên tập, LOD, Draco/Meshopt hay KTX2.
- Vòng sóng là mesh tĩnh để lập trình animate scale/opacity. Dấu `!` phải được lập trình billboard hướng về camera. Ô nước là placeholder opaque, chưa có shader cuộn hoặc phản xạ.
- Các model chưa có collision, spawn, fishing point, navmesh, networking hoặc logic câu. Cảnh đảo chỉ minh họa Bãi Biển/Làng Chài; không tạo khu chơi mới ngoài MVP.
- 15 mẫu cá là gợi ý thị giác; chưa đại diện cho danh sách 15 loài chính thức, độ hiếm hoặc giá bán. Cần duyệt silhouette và thiết kế loài trước khi đặt ID gameplay.
- Bóng, ánh sáng và camera trong file Blender phục vụ render xem trước. Chúng không đi kèm từng GLB. Bản render có bóng thật; runtime mobile nên dùng bóng giả theo plan.

## Phần cần làm tiếp để dùng cho beta

1. Duyệt một nhân vật mẫu: chỉnh topology/UV, rig, skinning, clip `idle`, `walk`, `cast`, `wait`, `hook`, `reel`, `catch`; kiểm tra animation trên ngoại hình dựng sẵn trước khi nhân rộng.
2. Chốt danh mục 15 loài, chỉnh mỗi silhouette, thêm bone đuôi/vây nếu cần. Tách asset hiển thị cá bắt được khỏi bóng báo trước đồng nhất.
3. Làm texture atlas và gộp material để giảm draw call. Dùng instancing cho cây/đá. Đo hiệu năng trên điện thoại trước khi công bố ngân sách hoặc mục tiêu FPS.
4. Xây mặt nước runtime, bóng giả, vệt nước/phao và animation hiệu ứng; điều chỉnh màu và chống che phao theo camera.
5. Tạo dữ liệu map riêng cho vùng đi được, nước, spawn, NPC, 7 điểm câu biển và 5 điểm câu nước ngọt; không lấy ảnh hay mesh để quyết định luật gameplay.
6. Tối ưu GLB và kiểm tra import thực tế trong dự án R3F. Chưa có benchmark trình duyệt/điện thoại cho bộ này.

## Nguồn và quyền sử dụng

Toàn bộ hình học trong bộ này được dựng mới bằng script procedural đi kèm. Không chứa model, texture hoặc âm thanh bên thứ ba. Ảnh tham khảo chỉ định hướng phong cách; không nhúng ảnh tham khảo vào GLB. Không áp dụng một giấy phép của bên thứ ba hoặc cam kết tính độc quyền cho các hình khối được tạo.

Các con số tiền, XP, cấp độ và xác suất vẫn theo cấu hình trong plan, không suy ra từ asset.
