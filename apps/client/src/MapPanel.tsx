import { useEffect, useRef, useState } from "react";
import { AREAS, type AreaId } from "@fishing/shared";
import { LockKeyhole, MapPin, Navigation, X } from "lucide-react";
import { requestTeleport, useGame } from "./network";

const positions: Record<AreaId, { left: string; top: string }> = {
  beach: { left: "17%", top: "72%" },
  village: { left: "44%", top: "33%" },
  coral: { left: "88%", top: "85%" },
  mystery: { left: "88%", top: "60%" },
};
export function MapPanel({ onClose }: { onClose: () => void }) {
  const game = useGame(),
    [selected, setSelected] = useState<AreaId>(game.area);
  const attempted = useRef(false);
  useEffect(() => {
    if (attempted.current && !game.teleportPending && !game.teleportError)
      onClose();
  }, [game.teleportPending, game.teleportError, onClose]);
  const area = AREAS[selected];
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="panel map-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <h2 id="map-title">
            <MapPin /> Bản đồ đảo
          </h2>
          <button className="icon" aria-label="Đóng bản đồ" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="map-content">
          <div className="island-map photo-map">
            <img
              src="/assets/ui/island-map-reference.png"
              alt="Bản đồ đảo Fishing World: Bãi Biển, Làng Chài, hồ và hải đăng"
            />
            {(Object.keys(AREAS) as AreaId[]).map((id) => (
              <button
                style={{
                  ...positions[id],
                  width: id === "beach" ? "23%" : "24%",
                  height: "13%",
                }}
                className={`map-hotspot ${selected === id ? "selected" : ""}`}
                aria-label={AREAS[id].name}
                title={AREAS[id].name}
                key={id}
                aria-pressed={selected === id}
                onClick={() => {
                  attempted.current = false;
                  setSelected(id);
                  useGame.setState({ teleportError: "" });
                }}
              ></button>
            ))}
          </div>
          <aside className="area-card">
            <span className="area-water">{area.water}</span>
            <h3>{area.name}</h3>
            <p>{area.description}</p>
            <small>
              {game.area === selected
                ? "Bạn đang ở khu vực này"
                : area.open
                  ? "Đã mở · Cùng phòng hiện tại"
                  : "Sắp mở"}
            </small>
            <button
              className="play"
              disabled={!area.open || !game.connected || game.teleportPending}
              onClick={() => {
                attempted.current = true;
                requestTeleport(selected);
              }}
            >
              {area.open ? <Navigation size={18} /> : <LockKeyhole size={18} />}{" "}
              {game.teleportPending
                ? "Đang di chuyển…"
                : area.open
                  ? "Dịch chuyển"
                  : "Sắp mở"}
            </button>
            {game.teleportError && (
              <p className="panel-error" role="alert">
                {game.teleportError}
              </p>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
