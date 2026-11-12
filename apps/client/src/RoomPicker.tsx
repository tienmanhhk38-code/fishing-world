import { useEffect, useState } from "react";
import { DoorOpen, Plus, RefreshCw, Users, X } from "lucide-react";
import type { RoomInfo } from "@fishing/shared";
import { useGame, type JoinOptions } from "./network";

export function RoomPicker({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  onJoin: (options: JoinOptions) => Promise<void>;
}) {
  const [rooms, setRooms] = useState<RoomInfo[]>([]),
    [code, setCode] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const notice = useGame((state) => state.notice);
  async function refresh(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/rooms", { signal, cache: "no-store" });
      if (!response.ok) throw new Error();
      setRooms(await response.json());
      setError("");
    } catch {
      if (!signal?.aborted) setError("Không thể tải danh sách phòng.");
    }
  }
  useEffect(() => {
    const abort = new AbortController();
    void refresh(abort.signal);
    const timer = setInterval(() => void refresh(abort.signal), 5000);
    return () => {
      abort.abort();
      clearInterval(timer);
    };
  }, []);
  async function join(options: JoinOptions) {
    setPending(true);
    try {
      await onJoin(options);
    } finally {
      setPending(false);
    }
  }
  return (
    <div
      className="overlay"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <section
        className="panel room-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <h2 id="room-title">
            <Users /> Chọn phòng câu cá
          </h2>
          <button
            className="icon"
            aria-label="Đóng chọn phòng"
            disabled={pending}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="room-toolbar">
          <span>Cùng mã phòng, cùng một hòn đảo</span>
          <button
            className="icon"
            aria-label="Làm mới phòng"
            onClick={() => void refresh()}
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="room-list">
          {rooms.length ? (
            rooms.map((room) => (
              <button
                className="room-card"
                key={room.id}
                disabled={
                  pending || room.locked || room.clients >= room.maxClients
                }
                onClick={() => void join({ roomId: room.id })}
              >
                <div className="room-card-art">
                  <Users size={36} />
                </div>
                <b>{room.name}</b>
                <span>
                  {room.locked || room.clients >= room.maxClients
                    ? "Phòng đã đầy"
                    : "Có thể tham gia"}
                </span>
                <small>{room.locked ? "Đầy" : `Mã ${room.id}`}</small>
              </button>
            ))
          ) : (
            <div className="empty">
              <Users size={40} />
              <p>Hãy tạo phòng đầu tiên cho chuyến đi hôm nay.</p>
            </div>
          )}
        </div>
        {(error || notice) && (
          <p className="panel-error" role="alert">
            {error || notice}
          </p>
        )}
        <form
          className="join-by-code"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void join({ roomId: code.trim() });
          }}
        >
          <label>
            <span>Mã phòng</span>
            <input
              autoComplete="off"
              aria-label="Mã phòng"
              value={code}
              maxLength={16}
              placeholder="Nhập mã phòng của bạn bè"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
          <button className="play" disabled={pending || !code.trim()}>
            <DoorOpen size={18} />
            {pending ? "Đang vào…" : "Vào phòng"}
          </button>
        </form>
        <button
          className="create-room"
          disabled={pending}
          onClick={() => void join({ create: true })}
        >
          <Plus size={18} /> Tạo phòng mới
        </button>
      </section>
    </div>
  );
}
