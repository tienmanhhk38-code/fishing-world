import { useEffect, useRef } from "react";
import { Monitor, Volume2, MousePointer2, X, RotateCcw } from "lucide-react";
import { useSettings } from "./settings";

export function SettingsPanel({
  onClose,
  onExit,
}: {
  onClose: () => void;
  onExit?: () => void;
}) {
  const settings = useSettings();
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="overlay settings-overlay" onClick={onClose}>
      <section
        ref={dialog}
        className="panel settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key !== "Tab") return;
          const fields = Array.from(
            dialog.current!.querySelectorAll<HTMLElement>(
              "button,input,select",
            ),
          );
          const first = fields[0],
            last = fields[fields.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="panel-heading">
          <div>
            <small>CHƠI THEO CÁCH CỦA BẠN</small>
            <h2 id="settings-title">Cài đặt game</h2>
          </div>
          <button className="icon" aria-label="Đóng cài đặt" onClick={onClose}>
            <X />
          </button>
        </div>
        <h3>
          <Monitor size={18} /> Hình ảnh
        </h3>
        <label className="setting-row">
          <span>
            Chất lượng đồ họa<small>Độ sắc nét và chi tiết mặt nước</small>
          </span>
          <select
            value={settings.quality}
            onChange={(e) =>
              settings.update({ quality: e.target.value as "low" | "high" })
            }
          >
            <option value="low">Tiết kiệm</option>
            <option value="high">Đẹp</option>
          </select>
        </label>
        <label className="setting-row">
          <span>
            Giới hạn khung hình
            <small>60 FPS sử dụng nhiều tài nguyên hơn</small>
          </span>
          <select
            value={settings.fps}
            onChange={(e) =>
              settings.update({ fps: Number(e.target.value) as 30 | 60 })
            }
          >
            <option value={30}>30 FPS</option>
            <option value={60}>60 FPS</option>
          </select>
        </label>
        <label className="setting-row">
          <span>
            Giảm chuyển động
            <small>Tắt zoom tự động và hiệu ứng nhấp nháy</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.reducedMotion}
            onChange={(e) =>
              settings.update({ reducedMotion: e.target.checked })
            }
          />
        </label>
        <h3>
          <Volume2 size={18} /> Âm thanh
        </h3>
        <label className="setting-row">
          <span>
            Âm lượng hiệu ứng<small>Quăng cần, cá cắn và bắt cá</small>
          </span>
          <div className="range-field">
            <input
              aria-label="Âm lượng hiệu ứng"
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.volume * 100)}
              onChange={(e) =>
                settings.update({ volume: Number(e.target.value) / 100 })
              }
            />
            <output>{Math.round(settings.volume * 100)}%</output>
          </div>
        </label>
        {(
          [
            ["ambienceVolume", "Âm thanh môi trường", "Sóng biển và chim biển"],
            ["musicVolume", "Nhạc nền", "Giai điệu trên đảo"],
          ] as const
        ).map(([key, label, hint]) => (
          <label className="setting-row" key={key}>
            <span>
              {label}
              <small>{hint}</small>
            </span>
            <div className="range-field">
              <input
                aria-label={label}
                type="range"
                min={0}
                max={100}
                value={Math.round(settings[key] * 100)}
                onChange={(e) =>
                  settings.update({ [key]: Number(e.target.value) / 100 })
                }
              />
              <output>{Math.round(settings[key] * 100)}%</output>
            </div>
          </label>
        ))}
        <label className="setting-row">
          <span>Tắt toàn bộ âm thanh</span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.soundMuted}
            onChange={(e) => settings.update({ soundMuted: e.target.checked })}
          />
        </label>
        <h3>
          <MousePointer2 size={18} /> Camera
        </h3>
        <label className="setting-row">
          <span>Độ nhạy xoay camera</span>
          <div className="range-field">
            <input
              aria-label="Độ nhạy xoay camera"
              type="range"
              min={30}
              max={200}
              step={5}
              value={Math.round(settings.sensitivity * 100)}
              onChange={(e) =>
                settings.update({ sensitivity: Number(e.target.value) / 100 })
              }
            />
            <output>{settings.sensitivity.toFixed(2)}×</output>
          </div>
        </label>
        <label className="setting-row">
          <span>Đảo chiều trục dọc</span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.invertY}
            onChange={(e) => settings.update({ invertY: e.target.checked })}
          />
        </label>
        <label className="setting-row">
          <span>Hiện khoe cá của người khác</span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.showOtherCatches}
            onChange={(e) =>
              settings.update({ showOtherCatches: e.target.checked })
            }
          />
        </label>
        <footer>
          <span>Tự động lưu trên trình duyệt này</span>
          <button onClick={settings.reset}>
            <RotateCcw size={14} /> Mặc định
          </button>
        </footer>
        {onExit && (
          <div className="lobby-exit">
            <p>
              Cá và tiến trình đã lưu được giữ lại. Lượt đang câu sẽ hủy, mồi đã
              dùng không hoàn.
            </p>
            <button className="play" onClick={onExit}>
              Về lobby
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
