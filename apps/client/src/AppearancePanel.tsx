import { useEffect, useState } from "react";
import { X, Check, UserRound, Pencil } from "lucide-react";
import { APPEARANCES, validName, type AppearanceId } from "@fishing/shared";
import { applyProfile, useGame } from "./network";

export function AppearancePanel({ onClose }: { onClose: () => void }) {
  const profile = useGame((state) => state.profile);
  const [name, setName] = useState(profile?.name ?? ""),
    [selected, setSelected] = useState<AppearanceId>(
      profile?.appearanceId ?? "sailor",
    );
  const [loading, setLoading] = useState(!profile),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (profile) return;
    let active = true;
    void fetch("/api/guest", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Không thể tải nhân vật. Hãy mở lại.");
        return response.json();
      })
      .then(({ profile }) => {
        if (!active) return;
        applyProfile(profile);
        setName(profile.name);
        setSelected(profile.appearanceId);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const appearance = APPEARANCES[selected];
  return (
    <div
      className="overlay"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <section
        className="panel appearance-panel reference-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <div>
            <h2 id="appearance-title">
              <UserRound />
              Nhân vật của bạn
            </h2>
          </div>
          <button
            className="icon"
            aria-label="Đóng nhân vật"
            onClick={onClose}
            disabled={busy}
          >
            <X />
          </button>
        </div>
        <div className="appearance-layout">
          <div
            className="appearance-stage"
            style={
              { "--outfit-color": appearance.shirt } as React.CSSProperties
            }
          >
            <span className="appearance-sun" />
            <img
              key={selected}
              src={`/assets/starter/thumbnails/character-${selected}.png`}
              alt={appearance.name}
            />
            <div className="appearance-plinth" />
            <b>{appearance.name}</b>
            <small>Trang phục dựng sẵn · Miễn phí</small>
          </div>
          <div className="appearance-options">
            <h3>Chọn ngoại hình</h3>
            <div className="appearance-choices">
              {(Object.keys(APPEARANCES) as AppearanceId[]).map((id) => (
                <button
                  key={id}
                  aria-label={`Chọn ${APPEARANCES[id].name}`}
                  aria-pressed={selected === id}
                  className={selected === id ? "selected" : ""}
                  disabled={loading || busy}
                  onClick={() => setSelected(id)}
                >
                  <img
                    src={`/assets/starter/thumbnails/character-${id}.png`}
                    alt=""
                    draggable={false}
                  />
                  {selected === id && (
                    <i>
                      <Check size={16} />
                    </i>
                  )}
                  <span>{APPEARANCES[id].name}</span>
                </button>
              ))}
            </div>
            <label className="character-name">
              <span>
                <Pencil size={16} />
                Tên nhân vật
              </span>
              <input
                aria-label="Tên nhân vật"
                placeholder="Tên trên bến câu"
                maxLength={20}
                disabled={loading || busy}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <small>Từ 2 đến 20 ký tự. Tên sẽ hiển thị trong phòng.</small>
            </label>
            {error && (
              <p className="panel-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="play save-appearance"
              disabled={loading || busy || !validName(name)}
              onClick={() => {
                setBusy(true);
                setError("");
                void fetch("/api/character", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, appearanceId: selected }),
                })
                  .then(async (response) => {
                    const result = await response.json();
                    if (!response.ok)
                      throw new Error(
                        result.error ?? "Chưa lưu được nhân vật.",
                      );
                    applyProfile(result.profile);
                    onClose();
                  })
                  .catch((error) => setError(error.message))
                  .finally(() => setBusy(false));
              }}
            >
              {loading ? "Đang tải…" : busy ? "Đang lưu…" : "Lưu nhân vật"}
              <Check size={20} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
