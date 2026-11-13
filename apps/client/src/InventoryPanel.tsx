import { useState, useEffect } from "react";
import {
  Backpack,
  Check,
  ChevronRight,
  Coins,
  Store,
  ShoppingCart,
  Waves,
  Worm,
  Fish,
  MapPin,
  Weight,
  X,
} from "lucide-react";
import {
  AREAS,
  RODS,
  BAITS,
  RARITIES,
  type Profile,
  type RodId,
  type BaitId,
  type SaleQuote,
  formatFishWeight,
} from "@fishing/shared";
import { useGame, send } from "./network";

import { SaleConfirmation } from "./ProgressPanels";
import { useEconomy, transact, quoteSale } from "./economy-client";
import { fishModelId } from "./assets";
import { DetailStat, RodGlyph } from "./PopupParts";

export function AssetImage({
  id,
  className = "",
  alt = "",
}: {
  id: string;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      className={`asset-image ${className}`}
      src={`/assets/starter/thumbnails/${id}.png`}
      alt={alt}
      draggable={false}
    />
  );
}

export function InventoryPanel({
  profile,
  onClose,
  onShop,
  canVisitShop = false,
}: {
  profile: Profile;
  onClose: () => void;
  onShop?: (tab: "rods" | "baits") => void;
  canVisitShop?: boolean;
}) {
  const fish = profile.fish;
  const economy = useEconomy();
  const game = useGame();
  const [showPending, setShowPending] = useState(false);
  useEffect(() => {
    useGame.setState({ showcaseError: "", showcaseAck: 0 });
  }, []);
  useEffect(() => {
    if (showPending && !game.connected) setShowPending(false);
    if (showPending && game.showcaseError) setShowPending(false);
    if (showPending && game.showcaseAck) onClose();
  }, [
    showPending,
    game.connected,
    game.showcaseError,
    game.showcaseAck,
    onClose,
  ]);
  const blocked = economy.busy || economy.pending;
  const [quote, setQuote] = useState<SaleQuote | null>(null);
  useEffect(() => {
    if (quote?.id === economy.completedSaleId) setQuote(null);
  }, [quote, economy.completedSaleId]);
  async function sell(fishId?: string) {
    try {
      setQuote(await quoteSale(fishId));
    } catch {}
  }
  const [tab, setTab] = useState("fish"),
    [selectedId, setSelectedId] = useState("");
  const [selectedRod, setSelectedRod] = useState<RodId>(profile.equippedRod);
  const selected = fish.find((item) => item.id === selectedId) ?? fish[0];
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="panel inventory-panel reference-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="panel-heading">
          <h2 id="inventory-title">
            <Backpack /> Túi đồ
          </h2>
          <button className="icon" aria-label="Đóng túi đồ" onClick={onClose}>
            <X />
          </button>
        </div>
        <div
          className="inventory-tabs"
          role="tablist"
          aria-label="Loại vật phẩm"
        >
          {[
            { id: "fish", name: "Cá" },
            { id: "rod", name: "Cần câu" },
            { id: "bait", name: "Mồi" },
          ].map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
        {tab === "fish" ? (
          <div className="inventory-content">
            <div
              className="fish-grid"
              role="region"
              aria-label="Cá trong túi"
              tabIndex={0}
            >
              {fish.length ? (
                fish.map((item) => (
                  <article
                    key={item.id}
                    className={selected.id === item.id ? "selected" : ""}
                  >
                    <button
                      onClick={() => setSelectedId(item.id)}
                      aria-label={`${item.species}, ${formatFishWeight(item.grams)}`}
                      aria-pressed={selected.id === item.id}
                    >
                      <AssetImage id={fishModelId(item.species)} />
                      {selected.id === item.id && (
                        <i className="selection-check">
                          <Check />
                        </i>
                      )}
                      <b>{formatFishWeight(item.grams)}</b>
                    </button>
                  </article>
                ))
              ) : (
                <div className="empty">
                  <Fish size={52} />
                  <h3>Đại dương đang chờ bạn</h3>
                  <p>Tới gần mặt nước và thả cần để bắt con cá đầu tiên.</p>
                </div>
              )}
            </div>
            {selected && (
              <aside className="fish-detail">
                <AssetImage id={fishModelId(selected.species)} />
                <h3>{selected.species}</h3>
                <span className={`rarity ${selected.rarity ?? "common"}`}>
                  {RARITIES[selected.rarity ?? "common"]}
                </span>
                <div className="fish-water">
                  <Waves size={16} /> {AREAS[selected.area ?? "beach"].water}
                </div>
                <div className="detail-stats">
                  <DetailStat icon={Weight} label="Khối lượng">
                    {formatFishWeight(selected.grams)}
                  </DetailStat>
                  <DetailStat icon={MapPin} label="Nơi bắt">
                    {AREAS[selected.area ?? "beach"].name}
                  </DetailStat>
                  <DetailStat icon={Coins} label="Giá bán">
                    {selected.saleValue?.toLocaleString("vi-VN")} Xu
                  </DetailStat>
                </div>
                <div className="fish-actions">
                  <button
                    className="showcase-action"
                    disabled={
                      !!blocked ||
                      showPending ||
                      !game.connected ||
                      !["IDLE", "RESULT", "SHOWCASING"].includes(game.phase)
                    }
                    onClick={() => {
                      useGame.setState({ showcaseError: "", showcaseAck: 0 });
                      setShowPending(true);
                      send("FISH_SHOWCASE_REQUEST", { fishId: selected.id });
                    }}
                  >
                    {showPending ? "Đang lấy cá…" : "Mang ra khoe"}
                  </button>
                  <button
                    className="play sell-one"
                    disabled={blocked}
                    onClick={() => void sell(selected.id)}
                  >
                    Bán cá
                  </button>
                </div>
                {!["IDLE", "RESULT", "SHOWCASING"].includes(game.phase) && (
                  <small>Hãy thu cần trước khi khoe cá.</small>
                )}
                {game.showcaseError && <p role="alert">{game.showcaseError}</p>}
              </aside>
            )}
          </div>
        ) : tab === "rod" ? (
          <div className="rod-layout">
            <div className="rod-preview">
              <AssetImage id={RODS[selectedRod].model} />
              <h3>{RODS[selectedRod].name}</h3>
            </div>
            <div className="rod-details">
              <h3>{RODS[selectedRod].name}</h3>
              <span className="water-badge">
                Luck +{Math.round(RODS[selectedRod].luck * 100)}%
              </span>
              <p>
                {selectedRod === "wood"
                  ? "Cần câu khởi đầu cho chuyến đi đầu tiên."
                  : selectedRod === "bamboo"
                    ? "Cần tre nhẹ nhàng, thêm may mắn cho mỗi lượt câu."
                    : "Cần carbon cho những chuyến câu đầy thử thách."}
              </p>
              {profile.ownedRods.length > 1 && (
                <div className="rod-picker" aria-label="Cần câu đã sở hữu">
                  {profile.ownedRods.map((id) => (
                    <button
                      key={id}
                      aria-pressed={selectedRod === id}
                      onClick={() => setSelectedRod(id)}
                    >
                      {RODS[id].name}
                    </button>
                  ))}
                </div>
              )}
              <button
                className={`equip-button ${profile.equippedRod === selectedRod ? "equipped" : ""}`}
                disabled={blocked || profile.equippedRod === selectedRod}
                onClick={() =>
                  void transact({
                    action: "equipRod",
                    itemId: selectedRod,
                  }).catch(() => {})
                }
              >
                {profile.equippedRod === selectedRod ? (
                  <>
                    <Check /> Đang dùng
                  </>
                ) : (
                  "Trang bị"
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="equipment-list bait-list">
            {(Object.keys(BAITS) as BaitId[]).map((id) => (
              <article className="owned-equipment" key={id}>
                <AssetImage id={BAITS[id].model} />
                <h3>{BAITS[id].name}</h3>
                <p>
                  {id === "dough" ? "Vô hạn" : `Còn ${profile.baitCounts[id]}`}
                </p>
                <button
                  className={`equip-button ${profile.equippedBait === id ? "equipped" : ""}`}
                  disabled={
                    blocked ||
                    profile.equippedBait === id ||
                    (id !== "dough" && profile.baitCounts[id] < 1)
                  }
                  onClick={() =>
                    void transact({
                      action: "equipBait",
                      itemId: id,
                    }).catch(() => {})
                  }
                >
                  {profile.equippedBait === id ? (
                    <>
                      <Check size={16} /> Đang dùng
                    </>
                  ) : id !== "dough" && profile.baitCounts[id] < 1 ? (
                    "Hết mồi"
                  ) : (
                    "Trang bị"
                  )}
                </button>
              </article>
            ))}
          </div>
        )}

        <footer>
          <span className="fish-count">
            {tab === "fish" ? (
              <Fish size={18} />
            ) : tab === "rod" ? (
              <RodGlyph size={18} />
            ) : (
              <Worm size={18} />
            )}
            {tab === "fish"
              ? `${fish.length} con cá`
              : tab === "rod"
                ? `${profile.ownedRods.length} cần câu`
                : `${Object.keys(BAITS).length} loại mồi`}
          </span>
          {tab === "fish" && (
            <button
              className="play sell-all"
              disabled={blocked || !fish.length}
              onClick={() => void sell()}
            >
              Bán tất cả
            </button>
          )}
          {tab !== "fish" && (
            <button
              className="shop-link"
              disabled={!onShop || !canVisitShop || !!blocked}
              title={
                canVisitShop
                  ? undefined
                  : "Đến gần Cô Sáu ở Làng Chài để mua đồ"
              }
              onClick={() => onShop?.(tab === "rod" ? "rods" : "baits")}
            >
              {tab === "rod" ? <Store /> : <ShoppingCart />}
              {tab === "rod" ? "Xem cửa hàng" : "Mua thêm mồi"}
              <ChevronRight />
            </button>
          )}
        </footer>
      </section>
      {quote && (
        <SaleConfirmation quote={quote} onCancel={() => setQuote(null)} />
      )}
    </div>
  );
}
