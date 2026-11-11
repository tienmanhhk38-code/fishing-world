import { useEffect, useState } from "react";
import { Check, Coins, RefreshCw, X } from "lucide-react";
import { type SaleQuote } from "@fishing/shared";
import { useGame } from "./network";
import { transact, useEconomy, retryPending } from "./economy-client";

export function SaleConfirmation({
  quote,
  onCancel,
}: {
  quote: SaleQuote;
  onCancel: () => void;
}) {
  const state = useEconomy(),
    disabled = state.busy || state.pending;
  return (
    <div
      className="overlay sale-overlay"
      onClick={(e) => {
        e.stopPropagation();
        if (!state.busy) onCancel();
      }}
    >
      <section
        className="panel sale-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <h2 id="sale-title">Bán {quote.count} con cá?</h2>
          <button
            className="icon"
            aria-label="Hủy bán cá"
            disabled={state.busy}
            onClick={onCancel}
          >
            <X />
          </button>
        </div>
        <div className="sale-coins">
          <Coins size={46} />
          <strong>{quote.total.toLocaleString("vi-VN")} Xu</strong>
        </div>
        <p>Số lần bắt và kỷ lục vẫn được lưu trong Album.</p>
        <div className="sale-buttons">
          <button
            className="secondary"
            disabled={state.busy}
            onClick={onCancel}
          >
            Hủy
          </button>
          <button
            className="play"
            disabled={disabled}
            onClick={() =>
              void transact({ action: "sell", quoteId: quote.id }).catch(
                () => {},
              )
            }
          >
            {state.busy ? "Đang bán…" : "Xác nhận bán"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function EconomyNotice() {
  const economy = useEconomy(),
    connected = useGame((state) => state.connected && !!state.profile);
  useEffect(() => {
    if (!economy.message) return;
    const timer = setTimeout(() => useEconomy.setState({ message: "" }), 5000);
    return () => clearTimeout(timer);
  }, [economy.message]);
  if (!economy.error && !economy.message) return null;
  return (
    <div
      className={`economy-notice ${economy.error ? "error" : ""}`}
      role={economy.error ? "alert" : "status"}
    >
      <span>{economy.error || economy.message}</span>
      {economy.pending ? (
        <button
          disabled={!connected || economy.busy}
          onClick={() => void retryPending().catch(() => {})}
        >
          <RefreshCw size={15} /> Thử lại
        </button>
      ) : (
        <button
          aria-label="Đóng thông báo"
          onClick={() => useEconomy.setState({ error: "", message: "" })}
        >
          <X size={17} />
        </button>
      )}
    </div>
  );
}

export function Tutorial({
  onBag,
  onShop,
}: {
  onBag: () => void;
  onShop: () => void;
}) {
  const step = useGame((state) => state.profile?.tutorialStep ?? 0),
    [collapsed, setCollapsed] = useState(false);
  if (step >= 4) return null;
  const titles = [
    "Dạo quanh bến gỗ",
    "Bắt con cá đầu tiên",
    "Bán cá lấy Xu",
    "Khám phá nâng cấp",
  ];
  const descriptions = [
    "Dùng WASD hoặc joystick để di chuyển.",
    "Tới gần bất kỳ bờ biển, bờ hồ hoặc bến. Thả cần xuống nước, chờ dấu ! rồi giật.",
    "Mở túi, chọn cá và xác nhận giá bán để nhận Xu.",
    "Xem cần tre ở cửa hàng và điều kiện cấp 3.",
  ];
  if (collapsed)
    return (
      <button
        className="tutorial-toggle hide-fishing"
        onClick={() => setCollapsed(false)}
      >
        Hướng dẫn {step + 1}/4
      </button>
    );
  return (
    <section className="tutorial hide-fishing">
      <div>
        <small>CHUYẾN CÂU ĐẦU TIÊN · {step + 1}/4</small>
        <button
          aria-label="Thu gọn hướng dẫn"
          onClick={() => setCollapsed(true)}
        >
          <X size={16} />
        </button>
      </div>
      <h3>{titles[step]}</h3>
      <p>{descriptions[step]}</p>
      {step > 1 && (
        <button
          className="tutorial-action"
          onClick={step === 2 ? onBag : onShop}
        >
          {step === 2 ? "Bán cá đầu tiên" : "Khám phá cần câu"}{" "}
          <Check size={14} />
        </button>
      )}
    </section>
  );
}
