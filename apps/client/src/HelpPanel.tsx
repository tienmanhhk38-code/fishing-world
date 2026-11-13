import { ArrowRight, CircleAlert, MapPin, X } from "lucide-react";

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="panel help reference-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <button
          className="icon close"
          aria-label="Đóng hướng dẫn"
          onClick={onClose}
        >
          <X />
        </button>
        <div className="help-intro">
          <img
            src="/assets/starter/thumbnails/avatar-sailor.png"
            alt="Chú Hải"
          />
          <div>
            <small>CHẬM MỘT CHÚT, VUI MỘT NGÀY</small>
            <h2 id="help-title">Cùng ra bến câu</h2>
          </div>
        </div>
        <ol className="help-steps">
          <li>
            <span className="help-step-icon">
              <MapPin />
            </span>
            <div>
              <h3>01 · Đến gần bờ nước</h3>
              <p>Chọn vị trí tại bờ biển, hồ hoặc bến.</p>
            </div>
          </li>
          <li>
            <span className="help-step-icon">
              <svg
                viewBox="0 0 40 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="M20 3v14m-6 10V21a6 6 0 0 1 12 0v6" />
                <ellipse cx="20" cy="29" rx="15" ry="6" />
                <path d="M14 24c3 2 9 2 12 0" />
              </svg>
            </span>
            <div>
              <h3>02 · Thả câu và chờ</h3>
              <p>Đợi bóng cá tới gần và quan sát phao.</p>
            </div>
          </li>
          <li>
            <span className="help-step-icon">
              <CircleAlert />
            </span>
            <div>
              <h3>03 · Phao chìm, giật ngay!</h3>
              <p>
                Khi dấu <b className="help-bite">!</b> xuất hiện, bấm Giật cần.
              </p>
            </div>
          </li>
        </ol>
        <button className="play" onClick={onClose}>
          Ra bến thôi <ArrowRight />
        </button>
      </section>
    </div>
  );
}
