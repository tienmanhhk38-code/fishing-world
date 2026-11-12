import { useState, useEffect } from "react";
import {
  Backpack,
  Check,
  ChevronLeft,
  ChevronRight,
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
}: {
  profile: Profile;
  onClose: () => void;
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
    [page, setPage] = useState(0),
    [selectedId, setSelectedId] = useState("");
  const pages = Math.max(1, Math.ceil(fish.length / 12));
  const pageIndex = Math.min(page, pages - 1);
  const visible = fish.slice(pageIndex * 12, pageIndex * 12 + 12);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="panel inventory-panel"
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
            <div className="fish-grid">
              {visible.length ? (
                visible.map((item) => (
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
                <span className="water-badge">
                  {AREAS[selected.area ?? "beach"].water}
                </span>
                <p>
                  <Weight size={16} /> {formatFishWeight(selected.grams)}
                </p>
                <p>
                  <MapPin size={16} /> {AREAS[selected.area ?? "beach"].name}
                </p>
                <small>
                  {new Date(selected.caughtAt).toLocaleString("vi-VN")}
                </small>
                <span className={`rarity ${selected.rarity ?? "common"}`}>
                  {RARITIES[selected.rarity ?? "common"]}
                </span>
                <p className="fish-price">
                  Giá bán {selected.saleValue?.toLocaleString("vi-VN")} Xu
                </p>
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
        ) : (
          <div className="equipment-list">
            {tab === "rod"
              ? profile.ownedRods.map((id) => (
                  <article className="owned-equipment" key={id}>
                    <AssetImage id={RODS[id].model} />
                    <h3>{RODS[id].name}</h3>
                    <p>Luck +{Math.round(RODS[id].luck * 100)}%</p>
                    <button
                      disabled={blocked || profile.equippedRod === id}
                      onClick={() =>
                        void transact({ action: "equipRod", itemId: id }).catch(
                          () => {},
                        )
                      }
                    >
                      {profile.equippedRod === id ? (
                        <>
                          <Check size={16} /> Đang dùng
                        </>
                      ) : (
                        "Trang bị"
                      )}
                    </button>
                  </article>
                ))
              : (Object.keys(BAITS) as BaitId[]).map((id) => (
                  <article className="owned-equipment" key={id}>
                    <AssetImage id={BAITS[id].model} />
                    <h3>{BAITS[id].name}</h3>
                    <p>
                      {id === "dough"
                        ? "Vô hạn"
                        : `Còn ${profile.baitCounts[id]}`}
                    </p>
                    <button
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
            <Fish size={18} />
            {fish.length} con cá
          </span>
          {tab === "fish" && pages > 1 && (
            <div className="pagination">
              <button
                className="icon"
                aria-label="Trang trước"
                disabled={pageIndex === 0}
                onClick={() => setPage(pageIndex - 1)}
              >
                <ChevronLeft />
              </button>
              <span>
                {pageIndex + 1} / {pages}
              </span>
              <button
                className="icon"
                aria-label="Trang sau"
                disabled={pageIndex === pages - 1}
                onClick={() => setPage(pageIndex + 1)}
              >
                <ChevronRight />
              </button>
            </div>
          )}
          {tab === "fish" && (
            <button
              className="play sell-all"
              disabled={blocked || !fish.length}
              onClick={() => void sell()}
            >
              Bán tất cả
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
