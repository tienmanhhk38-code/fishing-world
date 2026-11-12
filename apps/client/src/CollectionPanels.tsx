import { formatFishWeight } from "@fishing/shared";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  Coins,
  LockKeyhole,
  ShoppingBasket,
  Trophy,
  X,
} from "lucide-react";
import {
  SPECIES,
  RODS,
  BAITS,
  RARITIES,
  AREAS,
  levelProgress,
  type RodId,
  type BaitId,
} from "@fishing/shared";
import { useGame } from "./network";
import { useEconomy, transact } from "./economy-client";
import { AssetImage } from "./InventoryPanel";

export function ShopPanel({ onClose }: { onClose: () => void }) {
  const profile = useGame((state) => state.profile)!;
  const economy = useEconomy();
  const [tab, setTab] = useState<"rods" | "baits">("rods"),
    [quantity, setQuantity] = useState(10);
  const blocked = economy.busy || economy.pending,
    level = levelProgress(profile.xp).level;
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="panel shop-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <h2 id="shop-title">
            <ShoppingBasket /> Cửa hàng
          </h2>
          <span className="panel-coins">
            <Coins size={20} />
            {profile.coins.toLocaleString("vi-VN")} Xu
          </span>
          <button className="icon" aria-label="Đóng cửa hàng" onClick={onClose}>
            <X />
          </button>
        </div>
        <p className="npc-greeting">
          Cô Sáu: Ghé sạp nào! Chọn cần và mồi cho chuyến câu hôm nay nhé.
        </p>
        <div className="inventory-tabs" role="tablist" aria-label="Hàng hóa">
          <button
            role="tab"
            aria-selected={tab === "rods"}
            onClick={() => setTab("rods")}
          >
            Cần câu
          </button>
          <button
            role="tab"
            aria-selected={tab === "baits"}
            onClick={() => setTab("baits")}
          >
            Mồi
          </button>
        </div>
        {tab === "rods" ? (
          <div className="shop-grid">
            {(Object.keys(RODS) as RodId[]).map((id) => {
              const item = RODS[id],
                owned = profile.ownedRods.includes(id),
                equipped = profile.equippedRod === id,
                locked = level < item.level;
              return (
                <article className="shop-card" key={id}>
                  <AssetImage id={item.model} />
                  <h3>{item.name}</h3>
                  <span>Cấp {item.level}</span>
                  <p>Luck +{Math.round(item.luck * 100)}%</p>
                  <strong>
                    {owned
                      ? "Đã sở hữu"
                      : `${item.price.toLocaleString("vi-VN")} Xu`}
                  </strong>
                  <button
                    className={equipped ? "equipped" : "play"}
                    disabled={
                      blocked ||
                      equipped ||
                      (!owned && (locked || profile.coins < item.price))
                    }
                    onClick={() =>
                      void transact({
                        action: owned ? "equipRod" : "buyRod",
                        itemId: id,
                      }).catch(() => {})
                    }
                  >
                    {equipped ? (
                      <>
                        <Check size={16} /> Đang dùng
                      </>
                    ) : owned ? (
                      "Trang bị"
                    ) : locked ? (
                      <>
                        <LockKeyhole size={15} /> Chưa đủ cấp
                      </>
                    ) : (
                      "Mua"
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <>
            <label className="bait-quantity">
              Số lượng mua
              <input
                aria-label="Số lượng mồi"
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    Math.max(
                      1,
                      Math.min(100, Math.trunc(Number(e.target.value)) || 1),
                    ),
                  )
                }
              />
            </label>
            <div className="shop-grid">
              {(Object.keys(BAITS) as BaitId[]).map((id) => {
                const item = BAITS[id];
                return (
                  <article className="shop-card" key={id}>
                    <AssetImage id={item.model} />
                    <h3>{item.name}</h3>
                    <span>
                      {id === "dough"
                        ? "Vô hạn"
                        : `Đang có ${profile.baitCounts[id]}`}
                    </span>
                    <p>
                      {id === "worm"
                        ? "Ưu tiên nhóm cá thích giun"
                        : id === "shrimp"
                          ? "Ưu tiên nhóm cá thích tôm"
                          : "Dùng ở mọi khu vực"}
                    </p>
                    <strong>
                      {id === "dough" ? "Miễn phí" : `${item.price} Xu / mồi`}
                    </strong>
                    <button
                      className="play"
                      disabled={
                        blocked ||
                        (id === "dough"
                          ? profile.equippedBait === id
                          : profile.coins < item.price * quantity)
                      }
                      onClick={() =>
                        void transact(
                          id === "dough"
                            ? { action: "equipBait", itemId: id }
                            : { action: "buyBait", itemId: id, quantity },
                        ).catch(() => {})
                      }
                    >
                      {id === "dough"
                        ? profile.equippedBait === id
                          ? "Đang dùng"
                          : "Trang bị"
                        : `Mua ${quantity} · ${item.price * quantity} Xu`}
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}
        <footer>
          <span>Cấp hiện tại {level}</span>
          <span>Mua cần rồi chọn Trang bị để sử dụng.</span>
        </footer>
      </section>
    </div>
  );
}

export function AlbumPanel({ onClose }: { onClose: () => void }) {
  const profile = useGame((state) => state.profile)!;
  const [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState(SPECIES[0].id);
  const entries = new Map(
    profile.album.map((entry) => [entry.speciesId, entry]),
  );
  const visible = SPECIES.filter(
      (species) => filter === "all" || species.area === filter,
    ),
    species = SPECIES.find((item) => item.id === selected)!,
    entry = entries.get(selected);
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="panel album-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="album-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <h2 id="album-title">
            <BookOpen /> Album cá
          </h2>
          <span className="album-progress">
            {entries.size} / {SPECIES.length} loài
          </span>
          <button className="icon" aria-label="Đóng album" onClick={onClose}>
            <X />
          </button>
        </div>
        <progress
          value={entries.size}
          max={SPECIES.length}
          aria-label="Tiến độ album"
        />
        <div className="inventory-tabs" role="tablist" aria-label="Loại nước">
          {[
            { id: "all", name: "Tất cả" },
            { id: "beach", name: "Biển" },
            { id: "village", name: "Nước ngọt" },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={filter === tab.id}
              onClick={() => {
                setFilter(tab.id);
                setSelected(
                  SPECIES.find(
                    (item) => tab.id === "all" || item.area === tab.id,
                  )!.id,
                );
              }}
            >
              {tab.name}
            </button>
          ))}
        </div>
        <div className="inventory-content">
          <div className="album-grid">
            {visible.map((item) => (
              <button
                key={item.id}
                className={`${selected === item.id ? "selected" : ""} ${entries.has(item.id) ? "" : "undiscovered"}`}
                onClick={() => setSelected(item.id)}
                aria-label={
                  entries.has(item.id) ? item.name : "Loài chưa khám phá"
                }
              >
                <AssetImage id={item.model} />
                {!entries.has(item.id) && <b>?</b>}
              </button>
            ))}
          </div>
          <aside className="fish-detail">
            {entry ? (
              <>
                <AssetImage id={species.model} />
                <h3>{species.name}</h3>
                <span className={`rarity ${species.rarity}`}>
                  {RARITIES[species.rarity]}
                </span>
                <p>Đã bắt {entry.count} con</p>
                <p>
                  <Trophy size={17} /> {formatFishWeight(entry.recordGrams)}
                </p>
                <p>{AREAS[species.area].name}</p>
              </>
            ) : (
              <div className="empty">
                <LockKeyhole size={40} />
                <h3>Chưa khám phá</h3>
                <p>
                  Thử câu ở cả biển và ao làng để tìm đủ {SPECIES.length} loài.
                </p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
