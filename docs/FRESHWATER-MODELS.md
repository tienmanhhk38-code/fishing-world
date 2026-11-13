# Model cá nước ngọt theo ảnh tham chiếu

## Nguồn và phạm vi

15 loài nước ngọt dùng bộ dựng riêng `apps/client/src/art/freshwater-author.ts`, được gọi từ bộ dựng cá chung. ID, tên, phân loại nước, rarity, khoảng khối lượng và kinh tế trong catalog không đổi. 25 loài biển tiếp tục dùng asset cũ.

Ba poster gốc nằm tại `design/reference/freshwater/boards/`; vùng ảnh từng loài, mask đường bao và mốc tạo hình nằm trong `crops/` và `references.json`. Script chuẩn bị sinh `freshwater-guides.json` với đường bao, profile thân, mốc mắt/miệng/mang/vây và polygon vùng sắc tố. Koi Showa có đường bao trắng được hiệu chỉnh thủ công vì màu trắng gần trùng nền poster. Các mask là annotation phục vụ dựng hình và đo kiểm, không phải ground truth độc lập được duyệt bởi họa sĩ.

## Cách dựng và tích hợp

- Mesh hai mặt khép theo đường bao, có bề dày từ profile tiết diện riêng của từng loài; vây, môi, nắp mang, râu, mắt và giáp cá tầm có geometry thật. Không dùng poster hoặc ảnh mặt cá làm billboard.
- Albedo sinh từ palette, polygon sắc tố được vector hóa và các lớp vảy/gân vây xác định. Không chiếu nguyên ảnh poster lên thân. Base color 1024 px, normal 384/512 px, roughness 32 px; hai LOD dùng chung texture và material.
- Đầu hướng `+X`; các nhóm `fish-lod-high`/`fish-lod-low` giữ 5 xương thân và 2 xương vây. Đầu khóa vào xương đầu, vây ngực xoay tại chân vây. Preview và scene game gọi cùng `fish-rig.ts` để đặt pose và chuyển LOD.
- Thumbnail nước ngọt nhìn từ `-Z` nên đầu hướng trái theo poster; thumbnail cá biển không đổi góc hoặc ánh sáng. Model được tải qua đường dẫn GLB hiện có, nên tự cập nhật trong Túi đồ, Album và cá đang mang.
- URL GLB/thumbnail nước ngọt có query version `freshwater-v1` để tránh cache asset cũ sau khi cập nhật; tên file và URL asset biển không đổi.
- Giới hạn riêng: 20.000/4.000 tam giác ở high/low, tối đa 4 draw call/LOD, dưới 2.000.000 byte/GLB; GLB và thumbnail của cả bộ dưới 32.000.000 byte. Cá biển giữ giới hạn cũ.

## Tạo lại và kiểm tra

Cần Vite ở `http://127.0.0.1:5173`; các lệnh dưới không cần backend/database.

```powershell
python -m pip install --target .local/freshwater-tools -r scripts/requirements-freshwater.txt
python scripts/prepare-freshwater-references.py
node scripts/build-fish-assets.mjs fish_concept_07 fish_concept_08 fish_concept_10 fish_extra_tilapia fish_concept_12 fish_concept_13 fish_extra_grasscarp fish_extra_bigheadcarp fish_concept_09 fish_extra_blackcarp fish_extra_snakehead fish_extra_marbled_eel fish_extra_giantcatfish fish_extra_arapaima fish_extra_sturgeon
pnpm test
pnpm build
pnpm exec playwright test tests/browser/freshwater-models.spec.ts tests/browser/popup-design.spec.ts
```

Trước khi thay asset, sao lưu model/thumbnail vào `.local/freshwater-v1/baseline/models/` và `thumbnails/`, cùng SHA-256 dưới dạng `hashes.json` có các trường `Path` và `Hash`. Không lấy file đã thay làm baseline.

```powershell
node scripts/qa-freshwater.mjs --benchmark --video
python scripts/report-freshwater.py
```

QA sinh ảnh chuẩn, đối diện, trên, trước, sau, góc ba phần tư, mask high/low, ảnh chồng và bảng so sánh tại `.local/freshwater-v1/renders/`; `overview.png` xem cả bộ và `turntable.webm` ghi xoay/quẫy. `report.json` ghi IoU silhouette với annotation, sai lệch mốc hình chiếu, hiệu năng và hash cá biển. `--benchmark-only` đo lại hiệu năng với cùng baseline và không chụp lại ảnh.

Phép đo dùng Chromium/Windows, sân khấu độc lập, 4 cá cùng loài, 60 frame làm nóng và 180 frame lấy mẫu; đo cả high/low cho cá rô, koi và chình. Cần chạy riêng, không đồng thời với Playwright hoặc tác vụ GPU khác. Mục tiêu median và p95 frame time sau/trước không vượt 1,10; kết quả không đại diện hiệu năng toàn phòng multiplayer hoặc thiết bị điện thoại thật.

## Kết quả kiểm tra ngày 14/11/2026

- Đủ 15 GLB/thumbnail, hai LOD và rig 7 xương mỗi LOD; UV và ba loại texture nhúng được kiểm tra bằng unit test. Tổng GLB và thumbnail: 24.384.549 byte; file GLB lớn nhất: 1.982.500 byte.
- IoU high với mask annotation: 95,18–99,43%; sai lệch mốc trung bình lớn nhất theo loài: 1,15% chiều dài thân. Low giữ đường bao ở mức 91,08–99,13%; đây không phải phép đo màu hoặc mức giống ảnh gốc tuyệt đối.
- 6 phép đo trước/sau trên cùng sân khấu bốn cá: median frame time tăng nhiều nhất 1,21%, p95 tăng nhiều nhất 1,71%, dưới ngưỡng 10%. Đây là đo Chromium trên máy hiện tại, không phải benchmark đầy đủ game multiplayer.
- SHA-256 của đủ 25 model và 25 thumbnail cá biển không thay đổi.
- `pnpm test`: 54 test qua; `pnpm build`: qua. Playwright có kiểm tra model/LOD/pose/reduced-motion/đường ráp nhìn từ trên và các popup với API mô phỏng; không kiểm tra kinh tế, cước/kéo cá hoặc tư thế tay bằng server/database thật trong đợt này.

Xem [bảng tổng hợp](images/freshwater/overview.png), [báo cáo đo kiểm](validation/freshwater-models.json) và [video xoay/quẫy](video/freshwater-turntable.webm). 15 bảng so sánh sáu góc nằm trong `docs/images/freshwater/`, tên file theo ID loài.

## Giới hạn nghiệm thu

IoU >=95% và sai lệch mốc trung bình <=2% chỉ đo độ khớp hình chiếu với annotation ở góc mẫu, không chứng minh màu/ánh sáng hay mọi góc 3D giống poster 100%. Mặt khuất được hoàn thiện đối xứng và nhất quán; cần đối chiếu trực quan từng bảng so sánh trước khi tuyên bố giống tuyệt đối. Kiểm thử live server và cước/kéo cá chỉ chạy khi có database test riêng được giao; QA mặc định không ghi database.
