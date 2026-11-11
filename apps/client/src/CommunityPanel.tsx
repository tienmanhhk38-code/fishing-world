import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Users,
  X,
  Send,
  MoreHorizontal,
  VolumeX,
  Volume2,
  Flag,
  ChevronDown,
} from "lucide-react";
import {
  EMOTES,
  REPORT_REASONS,
  type AppearanceId,
  type RoomMember,
  type EmoteId,
} from "@fishing/shared";
import { useGame, controls } from "./network";
import { useSocial, socialAction, sendChat } from "./social-client";

export function Avatar({
  appearanceId = "sailor",
  className = "",
}: {
  appearanceId?: AppearanceId;
  className?: string;
}) {
  return (
    <img
      className={`portrait-avatar ${className}`}
      src={`/assets/starter/thumbnails/avatar-${appearanceId}.png`}
      alt=""
      draggable={false}
    />
  );
}
function ChatLog({ compact = false }: { compact?: boolean }) {
  const messages = useSocial((state) => state.messages),
    ownId = useGame((state) => state.profile?.id),
    log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);
  return (
    <div
      ref={log}
      className={`chat-log ${compact ? "compact" : ""}`}
      role="log"
      aria-label="Tin nhắn trong phòng"
      aria-relevant="additions"
    >
      {messages.length ? (
        messages.slice(compact ? -3 : -80).map((message) => (
          <div
            className={`chat-line ${message.senderId === ownId ? "own" : ""}`}
            key={message.id}
          >
            {!compact && <Avatar appearanceId={message.appearanceId} />}
            <div>
              <b>{message.name}</b>
              <p>{message.text}</p>
            </div>
          </div>
        ))
      ) : (
        <div className="chat-empty">
          <MessageCircle size={25} />
          <p>
            Biển xanh, bạn mới.
            <br />
            Gửi lời chào đầu tiên!
          </p>
        </div>
      )}
    </div>
  );
}
function ChatForm({
  onFocusChange,
}: {
  onFocusChange?: (focused: boolean) => void;
}) {
  const social = useSocial(),
    connected = useGame((state) => state.connected);
  const [now, setNow] = useState(Date.now());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      onFocusChange?.(false);
    };
  }, [onFocusChange]);
  const muted =
    !!social.chatMutedUntil && new Date(social.chatMutedUntil).getTime() > now;
  return (
    <form
      className="chat-form"
      onSubmit={(e) => {
        e.preventDefault();
        void sendChat().catch(() => {});
      }}
      onFocusCapture={() => {
        controls.keys.clear();
        controls.x = controls.z = 0;
        onFocusChange?.(true);
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) onFocusChange?.(false);
      }}
    >
      <label className="chat-input-wrap">
        <input
          ref={input}
          aria-label="Tin nhắn"
          placeholder={muted ? "Đang tạm tắt chat" : "Nhập tin nhắn…"}
          maxLength={160}
          disabled={!connected || muted}
          value={social.draft}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && e.nativeEvent.isComposing)
              e.preventDefault();
          }}
          onChange={(e) => useSocial.setState({ draft: e.target.value })}
        />
        <small>{social.draft.length}/160</small>
      </label>
      <button
        className="play"
        type="submit"
        aria-label="Gửi tin nhắn"
        disabled={!connected || muted || social.sending || !social.draft.trim()}
      >
        <Send size={18} />
        <span>{social.sending ? "Đang gửi…" : "Gửi"}</span>
      </button>
    </form>
  );
}
export function EmoteTray() {
  const connected = useGame((state) => state.connected),
    phase = useGame((state) => state.phase);
  const [busy, setBusy] = useState(false);
  return (
    <div className="emote-tray" aria-label="Biểu cảm">
      {(Object.keys(EMOTES) as EmoteId[]).map((id) => (
        <button
          key={id}
          aria-label={EMOTES[id].name}
          title={EMOTES[id].name}
          disabled={!connected || phase !== "IDLE" || busy}
          onClick={() => {
            setBusy(true);
            void socialAction("EMOTE_SEND", { emoteId: id })
              .catch(() => {})
              .finally(() => setBusy(false));
          }}
        >
          {EMOTES[id].emoji}
        </button>
      ))}
    </div>
  );
}
export function SocialNotice() {
  const social = useSocial();
  useEffect(() => {
    if (!social.notice) return;
    const timer = setTimeout(() => useSocial.setState({ notice: "" }), 6000);
    return () => clearTimeout(timer);
  }, [social.notice]);
  if (!social.error && !social.notice) return null;
  return (
    <div
      className={`social-notice ${social.error ? "error" : ""}`}
      role={social.error ? "alert" : "status"}
    >
      <span>{social.error || social.notice}</span>
      <button
        aria-label="Đóng thông báo cộng đồng"
        onClick={() => useSocial.setState({ error: "", notice: "" })}
      >
        <X size={17} />
      </button>
    </div>
  );
}
function ReportDialog({
  target,
  onClose,
}: {
  target: RoomMember;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<keyof typeof REPORT_REASONS>("spam"),
    [detail, setDetail] = useState(""),
    [busy, setBusy] = useState(false);
  const attempt = useRef({ signature: "", id: "" });
  return (
    <div
      className="overlay report-overlay"
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) onClose();
      }}
    >
      <section
        className="panel report-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <h2 id="report-title">
            <Flag />
            Báo cáo người chơi
          </h2>
          <button
            className="icon"
            aria-label="Đóng báo cáo"
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <p>
          Báo cáo <b>{target.name}</b>
        </p>
        <label>
          Lý do
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
          >
            {Object.entries(REPORT_REASONS).map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mô tả thêm
          <textarea
            value={detail}
            maxLength={300}
            placeholder="Điều gì đã xảy ra? (không bắt buộc)"
            onChange={(e) => setDetail(e.target.value)}
          />
        </label>
        <small>
          Tin nhắn gần đây của người này trong phòng được đính kèm để xem xét.
        </small>
        <button
          className="play"
          disabled={busy}
          onClick={() => {
            const signature = JSON.stringify({
              targetId: target.publicId,
              reason,
              detail,
            });
            if (attempt.current.signature !== signature)
              attempt.current = { signature, id: crypto.randomUUID() };
            setBusy(true);
            void socialAction(
              "REPORT_SEND",
              { targetId: target.publicId, reason, detail },
              attempt.current.id,
            )
              .then(onClose)
              .catch(() => {})
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Đang lưu…" : "Gửi báo cáo"}
        </button>
      </section>
    </div>
  );
}
export function CommunityPanel({ onClose }: { onClose: () => void }) {
  const social = useSocial(),
    game = useGame();
  const [menu, setMenu] = useState(""),
    [report, setReport] = useState<RoomMember | null>(null),
    [busy, setBusy] = useState(false);
  const [showMuted, setShowMuted] = useState(false);
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="panel community-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !report) onClose();
        }}
      >
        <div className="panel-heading">
          <div>
            <small>CÙNG NHAU RA BIỂN</small>
            <h2 id="community-title">
              <Users />
              Cộng đồng
            </h2>
          </div>
          <span className="member-count">
            {game.roomId} · {social.members.length}/20
          </span>
          <button
            className="icon"
            aria-label="Đóng cộng đồng"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="community-layout">
          <div className="community-chat">
            <ChatLog />
            <ChatForm />
          </div>
          <div className="community-people">
            <h3>
              <Users size={17} />
              Người chơi ({social.members.length}/20)
            </h3>
            <div className="member-list">
              {social.members.map((member) => (
                <article
                  className={`member-row ${menu === member.id ? "open" : ""}`}
                  key={member.id}
                >
                  <Avatar appearanceId={member.appearanceId} />
                  <div className="member-name">
                    <b>
                      {member.name}
                      {member.publicId === game.profile?.id && (
                        <small> · Bạn</small>
                      )}
                    </b>
                    <small>
                      <i className={member.connected ? "online" : "offline"} />
                      {member.connected
                        ? `Cấp ${member.level}`
                        : "Đang kết nối lại"}
                      {social.muted.some(
                        (player) => player.id === member.publicId,
                      ) && " · Đã tắt tiếng"}
                    </small>
                  </div>
                  {member.publicId !== game.profile?.id && (
                    <button
                      className="member-more"
                      aria-label={`Tùy chọn ${member.name}`}
                      onClick={() =>
                        setMenu(menu === member.id ? "" : member.id)
                      }
                    >
                      <MoreHorizontal size={21} />
                    </button>
                  )}
                  {menu === member.id && (
                    <div className="member-menu">
                      <button
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          void socialAction("MUTE_SET", {
                            targetId: member.publicId,
                            muted: !social.muted.some(
                              (player) => player.id === member.publicId,
                            ),
                          })
                            .then(() => setMenu(""))
                            .catch(() => {})
                            .finally(() => setBusy(false));
                        }}
                      >
                        <VolumeX size={16} />
                        {social.muted.some(
                          (player) => player.id === member.publicId,
                        )
                          ? "Bỏ tắt tiếng"
                          : "Tắt tiếng"}
                      </button>
                      <button
                        onClick={() => {
                          setReport(member);
                          setMenu("");
                        }}
                      >
                        <Flag size={16} />
                        Báo cáo
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <button
              className="muted-toggle"
              onClick={() => setShowMuted(!showMuted)}
            >
              <VolumeX size={14} />
              Đã tắt tiếng ({social.muted.length})<ChevronDown size={14} />
            </button>
            {showMuted && (
              <div className="muted-list">
                {social.muted.length ? (
                  social.muted.map((player) => (
                    <div key={player.id}>
                      <span>{player.name}</span>
                      <button
                        disabled={busy}
                        aria-label={`Bỏ tắt tiếng ${player.name}`}
                        onClick={() => {
                          setBusy(true);
                          void socialAction("MUTE_SET", {
                            targetId: player.id,
                            muted: false,
                          })
                            .catch(() => {})
                            .finally(() => setBusy(false));
                        }}
                      >
                        <Volume2 size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <small>Chưa tắt tiếng người chơi nào.</small>
                )}
              </div>
            )}
            <EmoteTray />
          </div>
        </div>
        <footer>
          Chat tối đa 160 ký tự · 1 tin/giây. Tắt tiếng chỉ áp dụng với bạn.
        </footer>
      </section>
      {report && (
        <ReportDialog target={report} onClose={() => setReport(null)} />
      )}
    </div>
  );
}
export function ChatDock({
  onCommunity,
  onFocusChange,
}: {
  onCommunity: () => void;
  onFocusChange: (focused: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    container = useRef<HTMLDivElement>(null);
  const members = useSocial((state) => state.members);
  useEffect(() => {
    const focus = () => {
      setOpen(true);
      setTimeout(
        () =>
          container.current?.querySelector<HTMLInputElement>("input")?.focus(),
        0,
      );
    };
    window.addEventListener("fishing:chat", focus);
    return () => window.removeEventListener("fishing:chat", focus);
  }, []);
  return (
    <div ref={container} className={`chat-dock ${open ? "expanded" : ""}`}>
      <div className="chat-dock-heading">
        <button
          className="chat-toggle"
          aria-label={open ? "Thu gọn chat" : "Mở chat"}
          onClick={() => setOpen(!open)}
        >
          <MessageCircle size={21} />
          <span>{open ? "Chat phòng" : "Trò chuyện"}</span>
        </button>
        <button
          className="community-open hide-fishing"
          aria-label="Cộng đồng"
          onClick={onCommunity}
        >
          <Users size={18} />
          <small>{members.length}</small>
        </button>
      </div>
      {open && (
        <>
          <ChatLog compact />
          <ChatForm onFocusChange={onFocusChange} />
        </>
      )}
    </div>
  );
}
