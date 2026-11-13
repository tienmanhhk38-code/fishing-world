import { useEffect, useRef, useState } from "react";
import { AREAS, DESTINATIONS, type DestinationId } from "@fishing/shared";
import { LockKeyhole, MapPin, Navigation, X } from "lucide-react";
import { requestTeleport, useGame } from "./network";

export function MapPanel({ onClose }: { onClose: () => void }) {
  const game = useGame(),
    [selected, setSelected] = useState<DestinationId>(
      game.area === "beach" ? "dock" : "pond",
    );
  const attempted = useRef(false);
  useEffect(() => {
    if (attempted.current && !game.teleportPending && !game.teleportError)
      onClose();
  }, [game.teleportPending, game.teleportError, onClose]);
  const destination = DESTINATIONS[selected],
    area = AREAS[destination.area];
  const select = (id: DestinationId) => {
    attempted.current = false;
    setSelected(id);
    useGame.setState({ teleportError: "" });
  };
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="panel map-panel reference-popup"
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
            {(Object.keys(DESTINATIONS) as DestinationId[]).map((id) => (
              <button
                style={{
                  left: DESTINATIONS[id].left,
                  top: DESTINATIONS[id].top,
                  width: id === "mystery" ? "23%" : "19%",
                  height: "13%",
                }}
                className={`map-hotspot ${selected === id ? "selected" : ""}`}
                aria-label={DESTINATIONS[id].name}
                title={DESTINATIONS[id].name}
                key={id}
                aria-pressed={selected === id}
                onClick={() => select(id)}
              ></button>
            ))}
          </div>
          <div className="map-destination-list" aria-label="Điểm đến">
            {(Object.keys(DESTINATIONS) as DestinationId[]).map((id) => (
              <button
                key={id}
                aria-pressed={selected === id}
                onClick={() => select(id)}
              >
                {!DESTINATIONS[id].open && <LockKeyhole size={14} />}{" "}
                {DESTINATIONS[id].name}
              </button>
            ))}
          </div>
          <aside className="area-card">
            <span className="area-water">{area.water}</span>
            <h3>{destination.name}</h3>
            {destination.open && (
              <img
                className="destination-preview"
                src={`/assets/ui/destinations/${selected}.png`}
                alt={`Phong cảnh ${destination.name}`}
              />
            )}
            <p>
              {destination.open
                ? `Khám phá ${destination.name.toLocaleLowerCase("vi-VN")} trên đảo.`
                : area.description}
            </p>
            <small>
              {destination.open ? "Đã mở · Cùng phòng hiện tại" : "Sắp mở"}
            </small>
            <button
              className="play"
              disabled={
                !destination.open || !game.connected || game.teleportPending
              }
              onClick={() => {
                attempted.current = true;
                requestTeleport(selected);
              }}
            >
              {destination.open ? (
                <Navigation size={18} />
              ) : (
                <LockKeyhole size={18} />
              )}{" "}
              {game.teleportPending
                ? "Đang di chuyển…"
                : destination.open
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
