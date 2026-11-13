import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { EMOTES, type AppearanceId, type EmoteId } from "@fishing/shared";
import { useGame, controls } from "./network";
import { useSocial, socialAction, sendChat } from "./social-client";

export function Avatar({
  appearanceId = "sailor",
  className = "",
}: {
  appearanceId?: AppearanceId | "system";
  className?: string;
}) {
  if (appearanceId === "system") {
    return (
      <div className={`portrait-avatar system-avatar ${className}`} title="Hệ thống">
        <Sparkles size={18} />
      </div>
    );
  }
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
            className={`chat-line ${message.senderId === ownId ? "own" : ""} ${message.senderId === "system" ? "system-line" : ""}`}
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
  channel = "world",
  onClose,
}: {
  onFocusChange?: (focused: boolean) => void;
  channel?: "world" | "nearby";
  onClose?: () => void;
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
        void sendChat(channel)
          .then(() => {
            if (channel === "nearby") onClose?.();
          })
          .catch(() => {});
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
          aria-label={channel === "nearby" ? "Tin nhắn gần" : "Tin nhắn"}
          autoFocus={channel === "nearby"}
          placeholder={
            muted
              ? "Đang tạm tắt chat"
              : channel === "nearby"
                ? "Nói với người ở gần…"
                : "Nhập tin nhắn…"
          }
          maxLength={160}
          disabled={!connected || muted}
          value={channel === "nearby" ? social.nearbyDraft : social.draft}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              onClose?.();
              input.current?.blur();
            }
            if (e.key === "Enter" && e.nativeEvent.isComposing)
              e.preventDefault();
          }}
          onChange={(e) =>
            useSocial.setState({
              [channel === "nearby" ? "nearbyDraft" : "draft"]: e.target.value,
            })
          }
        />
        <small>
          {(channel === "nearby" ? social.nearbyDraft : social.draft).length}
          /160
        </small>
      </label>
      <button
        className="play"
        type="submit"
        aria-label="Gửi tin nhắn"
        disabled={
          !connected ||
          muted ||
          social.sending ||
          !(channel === "nearby" ? social.nearbyDraft : social.draft).trim()
        }
      >
        <Send size={18} />
        <span>{social.sending ? "Đang gửi…" : "Gửi"}</span>
      </button>
    </form>
  );
}
export function NearbyChat({
  onFocusChange,
}: {
  onFocusChange: (focused: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("fishing:nearby-chat", show);
    return () => window.removeEventListener("fishing:nearby-chat", show);
  }, []);
  return (
    <div className="nearby-chat">
      <button
        className="nearby-toggle"
        aria-label="Chat gần"
        aria-expanded={open}
        title="Nói với người trong 20 m (Enter)"
        onClick={() => setOpen(!open)}
      >
        <MessageCircle size={20} />
        <span>Chat gần</span>
      </button>
      {open &&
        createPortal(
          <div className="nearby-layer">
            <button
              className="nearby-dismiss"
              aria-label="Đóng khung chat gần"
              onClick={() => setOpen(false)}
            />
            <div className="nearby-composer" role="region" aria-label="Chat gần">
              <ChatForm
                channel="nearby"
                onFocusChange={onFocusChange}
                onClose={() => setOpen(false)}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
export function EmoteTray() {
  const connected = useGame((state) => state.connected),
    phase = useGame((state) => state.phase);
  const [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(hold.current), []);
  return (
    <div
      className={`emote-picker ${open ? "open" : ""}`}
      onMouseEnter={() => {
        if (matchMedia("(hover:hover)").matches) setOpen(true);
      }}
      onMouseLeave={() => {
        if (matchMedia("(hover:hover)").matches) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        className="emote-toggle"
        aria-label="Biểu cảm"
        aria-expanded={open}
        onClick={() => {
          if (matchMedia("(hover:hover)").matches) setOpen(!open);
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") {
            clearTimeout(hold.current);
            hold.current = setTimeout(() => setOpen(true), 300);
          }
        }}
        onPointerUp={() => clearTimeout(hold.current)}
        onPointerCancel={() => clearTimeout(hold.current)}
        onContextMenu={(e) => e.preventDefault()}
      >
        😊
      </button>
      {open && (
        <>
          <button
            className="emote-dismiss"
            aria-label="Đóng biểu cảm"
            onPointerEnter={(e) => {
              if (
                e.pointerType === "mouse" &&
                matchMedia("(hover:hover)").matches
              )
                setOpen(false);
            }}
            onClick={() => setOpen(false)}
          />
          <div className="emote-tray" aria-label="Chọn biểu cảm">
            {(Object.keys(EMOTES) as EmoteId[]).map((id) => (
              <button
                key={id}
                aria-label={EMOTES[id].name}
                title={EMOTES[id].name}
                disabled={!connected || phase !== "IDLE" || busy}
                onClick={() => {
                  setBusy(true);
                  setOpen(false);
                  void socialAction("EMOTE_SEND", { emoteId: id })
                    .catch(() => {})
                    .finally(() => setBusy(false));
                }}
              >
                {EMOTES[id].emoji}
              </button>
            ))}
          </div>
        </>
      )}
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
export function ChatDock({
  onFocusChange,
}: {
  onFocusChange: (focused: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const toggle = () => setOpen((value) => !value);
    window.addEventListener("fishing:chat", toggle);
    return () => window.removeEventListener("fishing:chat", toggle);
  }, []);
  return (
    <div ref={container} className={`chat-dock ${open ? "expanded" : ""}`}>
      <div className="chat-dock-heading">
        <button
          className="chat-toggle"
          aria-label={open ? "Thu gọn chat" : "Mở chat"}
          aria-expanded={open}
          title="Chat phòng (C)"
          onClick={() => setOpen(!open)}
        >
          <span className="chat-toggle-icon">
            <MessageCircle size={19} />
          </span>
          <span>{open ? "Chat phòng" : "Trò chuyện"}</span>
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
