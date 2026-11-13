import { HelpPanel } from "./HelpPanel";
import { installViewportSizing } from "./viewport";
import { formatFishWeight } from "@fishing/shared";
import React, { useEffect, useState, useRef, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { AssetBoundary, fishModelId } from "./assets";
import { AssetImage, InventoryPanel } from "./InventoryPanel";
import {
  Fish,
  Backpack,
  Volume2,
  VolumeX,
  Anchor,
  Users,
  X,
  ArrowRight,
  RotateCcw,
  Check,
  MousePointer2,
  Settings,
  MapPin,
  Coins,
  ShoppingBasket,
  BookOpen,
  Flag,
  Footprints,
  ArrowUp,
  Menu,
} from "lucide-react";
import { Scene } from "./scene";
import {
  action,
  jump,
  leaveToLobby,
  connect,
  controls,
  enableAudio,
  send,
  useGame,
  world,
  type JoinOptions,
} from "./network";
import "@fontsource-variable/nunito";
import "./style.css";
import "./social.css";
import "./coastal.css";
import "./experience.css";
import "./responsive.css";
import "./popup-mobile.css";
import "./popup-design.css";
import "./scrollbars.css";
import { QuestPanel } from "./QuestPanel";
import { useSettings } from "./settings";
import { ShopPanel, AlbumPanel } from "./CollectionPanels";
import { Tutorial, EconomyNotice } from "./ProgressPanels";
import { AREAS, RODS, BAITS, RARITIES, levelProgress } from "@fishing/shared";
import { RoomPicker } from "./RoomPicker";
import { MapPanel } from "./MapPanel";
import { SettingsPanel } from "./SettingsPanel";
import { ChatDock, EmoteTray, SocialNotice, Avatar } from "./CommunityPanel";
import { AppearancePanel } from "./AppearancePanel";
import { focusAudio, playSound } from "./audio";
import { canShop } from "@fishing/shared";
import { transact, useEconomy, retryPending } from "./economy-client";
import { useSocial } from "./social-client";
import { NearbyChat } from "./CommunityPanel";
import {
  GraphicsBoundary,
  GraphicsNotice,
  GraphicsLifecycle,
} from "./GraphicsSupport";

function Logo() {
  return (
    <div className="logo image-logo">
      <img
        src="/assets/ui/fishing-world-logo-20261111.png"
        alt="Fishing World Online"
        width={1536}
        height={1024}
        draggable={false}
        fetchPriority="high"
      />
    </div>
  );
}
function FishArtwork({ species }: { species?: string }) {
  return <AssetImage id={fishModelId(species)} className="fish-art" />;
}
function TopStatus({ caption }: { caption: string }) {
  const game = useGame(),
    economy = useEconomy(),
    social = useSocial();
  useEffect(() => {
    if (!economy.message && !social.notice && !game.notice) return;
    const timer = setTimeout(() => {
      useEconomy.setState({ message: "" });
      useSocial.setState({ notice: "" });
      useGame.setState({ notice: "" });
    }, 6000);
    return () => clearTimeout(timer);
  }, [economy.message, social.notice, game.notice]);
  const bite = game.phase === "BITE_WINDOW";
  const active = !["IDLE", "SHOWCASING", "RESULT"].includes(game.phase);
  const error = economy.error || social.error;
  return (
    <div
      className={`hint top-status ${bite ? "bite" : ""}`}
      role={error && !bite ? "alert" : "status"}
    >
      <span>{bite ? "!" : error ? "!" : "✦"}</span>
      <div>
        <b>
          {bite
            ? caption
            : error ||
              (active
                ? caption
                : game.notice || economy.message || social.notice || caption)}
        </b>
        {bite && (
          <small>
            {(game.hookWindowMs / 1000).toLocaleString("vi-VN")} giây để giật!
          </small>
        )}
        {!bite && game.announcement && <small>{game.announcement}</small>}
      </div>
      {!bite &&
        (economy.pending ? (
          <button
            disabled={economy.busy || !game.connected}
            onClick={() => void retryPending().catch(() => {})}
          >
            Thử lại
          </button>
        ) : error ? (
          <button
            aria-label="Đóng thông báo"
            onClick={() => {
              useEconomy.setState({ error: "" });
              useSocial.setState({ error: "" });
            }}
          >
            <X size={16} />
          </button>
        ) : null)}
    </div>
  );
}

function AssetLoading() {
  const { active } = useProgress();
  return active ? (
    <div className="asset-loading-screen">
      <div className="asset-loading" role="status">
        Đang tải hòn đảo…
      </div>
    </div>
  ) : null;
}
function normalizeMovementCode(e: KeyboardEvent): string | null {
  if (
    [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "KeyF",
      "ShiftLeft",
      "ShiftRight",
    ].includes(e.code)
  ) {
    return e.code;
  }
  const k = e.key?.toLowerCase();
  if (k === "w" || k === "ư") return "KeyW";
  if (k === "s") return "KeyS";
  if (
    k === "a" ||
    k === "â" ||
    k === "ă" ||
    k === "á" ||
    k === "à" ||
    k === "ả" ||
    k === "ã" ||
    k === "ạ"
  )
    return "KeyA";
  if (k === "d" || k === "đ") return "KeyD";
  if (k === "f") return "KeyF";
  if (k === " ") return "Space";
  return null;
}

function App() {
  const game = useGame();
  const settings = useSettings();
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopTab, setShopTab] = useState<"rods" | "baits">("rods");
  const [shopOpen, setShopOpen] = useState(false),
    [albumOpen, setAlbumOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false),
    [chatFocused, setChatFocused] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false),
    [mapOpen, setMapOpen] = useState(false);
  const [started, setStarted] = useState(false),
    [loading, setLoading] = useState(false),
    [bag, setBag] = useState(false),
    [help, setHelp] = useState(false);
  const [questsOpen, setQuestsOpen] = useState(false),
    [sprinting, setSprinting] = useState(false);
  const fishing = [
    "CASTING",
    "WAITING",
    "APPROACHING",
    "NIBBLING",
    "BITE_WINDOW",
    "REELING",
  ].includes(game.phase);
  useEffect(() => {
    if (game.leftLobby) {
      setStarted(false);
      setConfigOpen(false);
      setBag(false);
      setMapOpen(false);
      setQuestsOpen(false);
      setShopOpen(false);
      setAlbumOpen(false);
      setHelp(false);
      setSprinting(false);
      controls.sprint = false;
    }
  }, [game.leftLobby]);
  const modalOpen =
    questsOpen ||
    bag ||
    help ||
    configOpen ||
    roomsOpen ||
    mapOpen ||
    shopOpen ||
    albumOpen ||
    appearanceOpen;
  useEffect(() => {
    // Try immediately; browsers that require a gesture are unlocked on the
    // first pointer/key action anywhere, including the background of the lobby.
    enableAudio();
    const unlock = () => enableAudio();
    document.addEventListener("pointerdown", unlock, { capture: true });
    document.addEventListener("pointerup", unlock, { capture: true });
    document.addEventListener("keydown", unlock, { capture: true });
    const click = (e: MouseEvent) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "button",
      );
      if (button && !button.disabled) {
        enableAudio();
        playSound("click");
      }
    };
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("pointerup", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    };
  }, []);
  useEffect(
    () => focusAudio(game.phase === "BITE_WINDOW" || game.phase === "REELING"),
    [game.phase],
  );
  useEffect(() => {
    if (fishing) {
      setShopOpen(false);
      setAlbumOpen(false);
      setBag(false);
      setMapOpen(false);
      setHelp(false);
      setConfigOpen(false);
      setAppearanceOpen(false);
    }
  }, [fishing]);
  useEffect(() => {
    const interact = (event: Event) => {
      if (modalOpen || !game.connected || game.phase !== "IDLE") return;
      const npc = (event as CustomEvent<string>).detail;
      if (npc === "merchant" && canShop(world.get(game.id))) {
        void transact({ action: "viewShop" })
          .then(() => setShopOpen(true))
          .catch(() => {});
      } else if (npc === "guide") setHelp(true);
      else if (npc === "quest") setQuestsOpen(true);
    };
    window.addEventListener("fishing:npc", interact);
    return () => window.removeEventListener("fishing:npc", interact);
  }, [modalOpen, game.connected, game.id, game.phase]);
  useEffect(() => {
    if (!shopOpen) return;
    const timer = setInterval(() => {
      if (
        !useGame.getState().connected ||
        !canShop(world.get(useGame.getState().id))
      )
        setShopOpen(false);
    }, 100);
    return () => clearInterval(timer);
  }, [shopOpen]);
  useEffect(() => {
    if (modalOpen) setMenuOpen(false);
  }, [modalOpen]);
  useEffect(installViewportSizing, []);
  const progress = levelProgress(game.profile?.xp ?? 0);
  useEffect(() => {
    if (!game.announcement) return;
    const timer = setTimeout(
      () => useGame.setState({ announcement: "" }),
      6000,
    );
    return () => clearTimeout(timer);
  }, [game.announcement]);
  async function play(options: JoinOptions = {}) {
    enableAudio();
    setLoading(true);
    try {
      await connect(options);
      setRoomsOpen(false);
      setStarted(true);
    } catch {
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    controls.keys.clear();
    controls.x = 0;
    controls.z = 0;
    controls.sprint = false;
    setSprinting(false);
    drag.current = null;
    const keyTimes = new Map<string, number>();
    const down = (e: KeyboardEvent) => {
      if (
        !started ||
        questsOpen ||
        bag ||
        help ||
        configOpen ||
        roomsOpen ||
        mapOpen ||
        shopOpen ||
        albumOpen ||
        appearanceOpen ||
        chatFocused ||
        (e.target as HTMLElement).matches("input,textarea,select") ||
        ((e.target as HTMLElement).matches("button") &&
          ["Space", "Enter"].includes(e.code) &&
          !(e.target as HTMLElement).closest(".action-area,.movement-buttons"))
      )
        return;
      if (e.code === "Enter") {
        e.preventDefault();
        if (!e.repeat) window.dispatchEvent(new Event("fishing:nearby-chat"));
        return;
      }
      if (e.code === "KeyC" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!e.repeat) window.dispatchEvent(new Event("fishing:chat"));
        return;
      }
      const code = normalizeMovementCode(e) ?? e.code;
      if (
        [
          "Space",
          "KeyF",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(code)
      )
        e.preventDefault();
      controls.keys.add(code);
      keyTimes.set(code, performance.now());
      if (code === "Space" && !e.repeat) jump();
      if (code === "KeyF" && !e.repeat) action();
    };
    const up = (e: KeyboardEvent) => {
      const code = normalizeMovementCode(e);
      if (code) {
        controls.keys.delete(code);
        keyTimes.delete(code);
      }
      controls.keys.delete(e.code);
      keyTimes.delete(e.code);
    };
    const clear = () => {
      controls.keys.clear();
      keyTimes.clear();
      controls.x = 0;
      controls.z = 0;
    };
    const watchdog = setInterval(() => {
      const now = performance.now();
      for (const [code, time] of keyTimes.entries()) {
        if (now - time > 450) {
          controls.keys.delete(code);
          keyTimes.delete(code);
        }
      }
    }, 100);
    const onCompositionEnd = () => {
      if (
        !chatFocused &&
        !(document.activeElement as HTMLElement)?.matches(
          "input,textarea,select",
        )
      ) {
        clear();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    window.addEventListener("compositionend", onCompositionEnd);
    document.addEventListener("visibilitychange", clear);
    return () => {
      clearInterval(watchdog);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      window.removeEventListener("compositionend", onCompositionEnd);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [
    questsOpen,
    bag,
    help,
    configOpen,
    started,
    roomsOpen,
    mapOpen,
    shopOpen,
    albumOpen,
    appearanceOpen,
    chatFocused,
  ]);
  const captions: Record<string, string> = {
    IDLE:
      game.area === "village"
        ? "Ra bờ ao, thử một loài cá nước ngọt."
        : "Một chiếc cần. Cả đại dương.",
    CASTING: "Mồi đã xuống nước…",
    WAITING: "Thư thả một chút, cá đang đến.",
    APPROACHING: "Có bóng cá! Chờ phao chìm nhé.",
    NIBBLING: "Cá đang nhấp mồi… hãy chờ!",
    BITE_WINDOW: "Cá cắn! Giật cần ngay!",
    REELING: "Được rồi! Đang kéo cá lên…",
    RESULT: "Một món quà từ đại dương!",
    SHOWCASING: "Đi khoe chiến lợi phẩm nào! Cất cá để câu tiếp.",
  };
  return (
    <main
      className={`${fishing ? "fishing" : ""} ${!started ? "lobby" : ""} ${settings.reducedMotion ? "reduce-motion" : ""} ${chatFocused ? "chat-typing" : ""} ${menuOpen ? "functions-open" : ""}`}
    >
      <div
        className="world"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
          };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d?.id !== e.pointerId) return;
          controls.yaw -= (e.clientX - d.x) * 0.006 * settings.sensitivity;
          controls.pitch = Math.max(
            0.18,
            Math.min(
              1,
              controls.pitch +
                (e.clientY - d.y) *
                  0.004 *
                  settings.sensitivity *
                  (settings.invertY ? -1 : 1),
            ),
          );
          d.x = e.clientX;
          d.y = e.clientY;
        }}
        onPointerUp={(e) => {
          drag.current = null;
        }}
        onPointerCancel={(e) => {
          drag.current = null;
        }}
      >
        <GraphicsBoundary>
          <Canvas
            shadows={settings.quality === "high" ? "percentage" : false}
            frameloop="never"
            camera={{ position: [10, 13, 22], fov: 50 }}
            dpr={
              settings.quality === "high" ? Math.min(devicePixelRatio, 1.5) : 1
            }
            gl={{ antialias: true }}
          >
            <GraphicsLifecycle />
            <AssetBoundary>
              <Suspense fallback={null}>
                <Scene />
              </Suspense>
            </AssetBoundary>
          </Canvas>
        </GraphicsBoundary>
      </div>
      <AssetLoading />
      <GraphicsNotice />
      <div className="vignette" />
      <header>
        <Logo />
        {started && (
          <div className="top-right">
            <button
              className="profile"
              aria-label="Chỉnh sửa nhân vật"
              onClick={() => setAppearanceOpen(true)}
            >
              <span className="avatar">
                <Avatar appearanceId={game.profile?.appearanceId} />
              </span>
              <div>
                <b>{game.profile?.name}</b>
                <small>
                  Cấp {progress.level}{" "}
                  <i
                    style={{
                      background: `linear-gradient(90deg,#ffd772 ${progress.needed ? (progress.current / progress.needed) * 100 : 100}%,#2b5674 0)`,
                    }}
                  />{" "}
                  {game.profile?.xp ?? 0} XP
                </small>
              </div>
            </button>
            <button
              className="icon hide-fishing"
              aria-label="Âm thanh"
              onClick={() => {
                enableAudio();
                settings.update({ soundMuted: !settings.soundMuted });
              }}
            >
              {settings.soundMuted ? <VolumeX /> : <Volume2 />}
            </button>
            <button
              className="icon camera-reset hide-fishing"
              aria-label="Góc nhìn"
              title="Đặt lại góc nhìn"
              onClick={() => {
                controls.yaw = 0.35;
                controls.pitch = 0.3;
              }}
            >
              <RotateCcw />
            </button>
          </div>
        )}
        {started && (
          <div className="coin-counter hide-fishing" aria-label="Số Xu">
            <Coins size={23} />
            <b>{(game.profile?.coins ?? 0).toLocaleString("vi-VN")}</b>
            <span>Xu</span>
          </div>
        )}
        <button
          className="lobby-settings icon hide-fishing"
          aria-label="Cài đặt game"
          onClick={() => setConfigOpen(true)}
        >
          <Settings />
        </button>
      </header>
      {!started ? (
        <section className="landing">
          <Logo />
          <div className="landing-actions">
            <button
              className="play"
              onClick={() => void play()}
              disabled={loading}
            >
              {loading ? "Đang ra bến…" : "Chơi khách"}
              <ArrowRight size={22} />
            </button>
            <button
              className="choose-room"
              onClick={() => {
                useGame.setState({ notice: "" });
                setRoomsOpen(true);
              }}
            >
              <Users size={18} /> Chọn phòng
            </button>
            <button
              className="choose-room character-entry"
              onClick={() => setAppearanceOpen(true)}
            >
              <Avatar appearanceId={game.profile?.appearanceId} />
              Nhân vật
            </button>
            <small>Tiến trình lưu tự động trên trình duyệt</small>
            {game.notice && (
              <p role="alert" className="login-error">
                {game.notice}
              </p>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className="location hide-fishing">
            <span className="location-icon">
              <Anchor size={20} />
            </span>
            <div>
              <b>{AREAS[game.area].name}</b>
              <small>
                <span className="live-dot" />{" "}
                {game.area === "beach" ? "Bến bình yên" : "Ao làng"}
              </small>
            </div>
          </div>
          <button
            className="menu-toggle hide-fishing"
            aria-label="Chức năng"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu size={21} />
            <span>Menu</span>
          </button>
          <nav
            className={`side hide-fishing ${menuOpen ? "menu-open" : ""}`}
            onClick={() => setMenuOpen(false)}
          >
            <button
              onClick={() => {
                useGame.setState({ teleportError: "" });
                setMapOpen(true);
              }}
            >
              <span>
                <MapPin />
              </span>
              Bản đồ
            </button>
            <button onClick={() => setBag(true)}>
              <span>
                <Backpack />
              </span>
              Túi đồ
              {(game.profile?.fish.length ?? 0) > 0 && (
                <b className="badge">{game.profile?.fish.length}</b>
              )}
            </button>
            <button onClick={() => setAlbumOpen(true)}>
              <span>
                <BookOpen />
              </span>
              Album
            </button>
            <button onClick={() => setQuestsOpen(true)}>
              <span>
                <Flag />
              </span>
              Nhiệm vụ
              {game.profile?.quests?.some(
                (q) => !q.claimed && q.available && q.progress >= q.goal,
              ) && <b className="badge">!</b>}
            </button>
            <button onClick={() => setHelp(true)}>
              <span>
                <MousePointer2 />
              </span>
              Cách chơi
            </button>
            <button
              className="camera-menu"
              onClick={() => {
                controls.yaw = 0.35;
                controls.pitch = 0.3;
              }}
            >
              <span>
                <RotateCcw />
              </span>
              Góc nhìn
            </button>
          </nav>
          <div
            className="room hide-fishing"
            aria-label={`Mã phòng ${game.roomId}`}
            title={`Mã phòng ${game.roomId}`}
          >
            <Users size={15} />
            <span>
              <span className="room-prefix">Mã phòng </span>
              {game.roomId}
            </span>
            <span className="live-dot" />
          </div>
          <TopStatus caption={captions[game.phase]} />
          {game.rtt > 300 && (
            <div className="connection">
              Kết nối yếu · {Math.round(game.rtt)} ms
            </div>
          )}
          {!game.connected && (
            <button
              className="reconnect"
              disabled={game.reconnecting}
              onClick={() => void play()}
            >
              {game.reconnecting ? "Đang kết nối lại…" : "Kết nối lại"}
            </button>
          )}
          <div className="equipment">
            <span>🎣</span>
            <div>
              <b>{RODS[game.profile?.equippedRod ?? "wood"].name}</b>
              <small>
                {BAITS[game.profile?.equippedBait ?? "dough"].name} ·{" "}
                {game.profile?.equippedBait === "dough"
                  ? "∞"
                  : (game.profile?.baitCounts[game.profile.equippedBait] ??
                    "∞")}
              </small>
            </div>
            <Check size={14} />
          </div>
          <div className="action-area">
            {fishing && (
              <button
                className="cancel"
                disabled={["CASTING", "REELING", "RESULT"].includes(game.phase)}
                onClick={() => send("FISH_CANCEL")}
              >
                Thu cần
              </button>
            )}
            <button
              className={
                "cast " + (game.phase === "BITE_WINDOW" ? "ready" : "")
              }
              disabled={
                !game.connected ||
                ["CASTING", "REELING", "RESULT"].includes(game.phase) ||
                bag ||
                help ||
                mapOpen ||
                shopOpen ||
                albumOpen ||
                configOpen ||
                appearanceOpen
              }
              onClick={() => {
                enableAudio();
                if (game.phase === "SHOWCASING") send("FISH_STOW");
                else action();
              }}
            >
              <span>
                {game.phase === "BITE_WINDOW" ? "!" : <Fish size={40} />}
              </span>
              <b>
                {game.phase === "SHOWCASING"
                  ? "Cất cá"
                  : game.phase === "REELING"
                    ? "Đang kéo"
                    : fishing
                      ? "Giật cần"
                      : "Thả câu"}
              </b>
              <small>{game.phase === "SHOWCASING" ? "CẤT CÁ" : "F"}</small>
            </button>
          </div>
          {!fishing && !modalOpen && game.phase !== "RESULT" && (
            <div className="movement-buttons">
              <button
                aria-label="Chạy"
                aria-pressed={sprinting}
                onClick={() => {
                  controls.sprint = !sprinting;
                  setSprinting(!sprinting);
                }}
              >
                <Footprints />
                Chạy
              </button>
              <button
                aria-label="Nhảy"
                onPointerDown={(e) => {
                  e.preventDefault();
                  jump();
                }}
                onClick={(e) => {
                  if (e.detail === 0) jump();
                }}
              >
                <ArrowUp />
                Nhảy
              </button>
            </div>
          )}
          <Joystick
            hidden={
              fishing ||
              questsOpen ||
              game.phase === "RESULT" ||
              bag ||
              help ||
              configOpen ||
              mapOpen ||
              shopOpen ||
              albumOpen ||
              appearanceOpen ||
              chatFocused
            }
          />
          <div className="desktop-help hide-fishing">
            <kbd>W A S D</kbd> Đi <span /> <kbd>Shift</kbd> Chạy <span />{" "}
            <kbd>Space</kbd> Nhảy · Giữ Shift để chạy nhảy <span /> <kbd>F</kbd>{" "}
            Câu
          </div>
          {!modalOpen && <ChatDock onFocusChange={setChatFocused} />}
          {!modalOpen && (
            <div className="hud-emotes hide-fishing">
              <EmoteTray />
              <NearbyChat onFocusChange={setChatFocused} />
            </div>
          )}
          <Tutorial
            onBag={() => {
              useGame.setState({ result: null });
              setBag(true);
            }}
            onShop={() => {
              setMapOpen(true);
              useGame.setState({
                notice: "Đến Làng Chài và tìm Cô Sáu tại sạp hàng.",
              });
            }}
          />
          {game.result && (
            <div
              className="result"
              role="dialog"
              aria-modal="true"
              aria-labelledby="result-fish-title"
            >
              <button
                aria-label="Đóng kết quả"
                onClick={() => send("FISH_STOW")}
              >
                <X size={18} />
              </button>
              <div className="result-star">✦ BẮT ĐƯỢC RỒI! ✦</div>
              <div className="fish-illustration">
                <FishArtwork species={game.result.species} />
              </div>
              <h2 id="result-fish-title">{game.result.species}</h2>
              <p>
                {formatFishWeight(game.result.grams)} <span>•</span>{" "}
                {AREAS[game.result.area ?? "beach"].name}
              </p>
              <span className={`rarity ${game.result.rarity ?? "common"}`}>
                {RARITIES[game.result.rarity ?? "common"]}
              </span>
              <b>+{game.result.xp ?? 20} XP</b>
              <p>Giá bán dự kiến · {game.result.saleValue ?? 0} Xu</p>
              {game.result.newSpecies ? (
                <small className="record-label">Loài mới trong album!</small>
              ) : (
                game.result.newRecord && (
                  <small className="record-label">
                    Kỷ lục trọng lượng mới!
                  </small>
                )
              )}
              <small>Đã cất vào túi đồ</small>
              <div className="result-actions">
                <button
                  className="play"
                  title="Câu tiếp (F)"
                  onClick={() => send("FISH_CONTINUE")}
                >
                  Câu tiếp
                </button>
                <button
                  className="play"
                  onClick={() => send("FISH_SHOWCASE_REQUEST")}
                >
                  Khoe cá
                </button>
                <button
                  disabled={fishing}
                  onClick={() => {
                    send("FISH_STOW");
                    setBag(true);
                  }}
                >
                  Xem túi
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {!started && (
        <div className="landing-bottom">
          <span>
            <span className="live-dot" /> Một hòn đảo, những cuộc gặp mới
          </span>
          <span>© Fishing World Online</span>
        </div>
      )}
      {roomsOpen && (
        <RoomPicker onClose={() => setRoomsOpen(false)} onJoin={play} />
      )}
      {questsOpen && <QuestPanel onClose={() => setQuestsOpen(false)} />}
      {mapOpen && <MapPanel onClose={() => setMapOpen(false)} />}
      {configOpen && (
        <SettingsPanel
          onClose={() => setConfigOpen(false)}
          onExit={started ? () => void leaveToLobby() : undefined}
        />
      )}
      {appearanceOpen && (
        <AppearancePanel onClose={() => setAppearanceOpen(false)} />
      )}
      {shopOpen && game.profile && (
        <ShopPanel initialTab={shopTab} onClose={() => setShopOpen(false)} />
      )}
      {albumOpen && game.profile && (
        <AlbumPanel onClose={() => setAlbumOpen(false)} />
      )}
      {!started && (
        <>
          <EconomyNotice />
          <SocialNotice />
        </>
      )}
      {bag && game.profile && (
        <InventoryPanel
          profile={game.profile}
          onClose={() => setBag(false)}
          canVisitShop={
            game.connected &&
            game.phase === "IDLE" &&
            canShop(world.get(game.id))
          }
          onShop={(tab) => {
            if (
              !game.connected ||
              game.phase !== "IDLE" ||
              !canShop(world.get(game.id))
            )
              return;
            void transact({ action: "viewShop" })
              .then(() => {
                setShopTab(tab);
                setBag(false);
                setShopOpen(true);
              })
              .catch(() => {});
          }}
        />
      )}
      {help && <HelpPanel onClose={() => setHelp(false)} />}
    </main>
  );
}
function Joystick({ hidden }: { hidden: boolean }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (hidden) {
      setKnob({ x: 0, y: 0 });
      controls.x = 0;
      controls.z = 0;
    }
  }, [hidden]);
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const r = e.currentTarget.getBoundingClientRect(),
      x = e.clientX - r.left - r.width / 2,
      y = e.clientY - r.top - r.height / 2,
      range = r.width * 0.28,
      l = Math.max(1, Math.hypot(x, y) / range);
    setKnob({ x: x / l, y: y / l });
    controls.x = x / l / range;
    controls.z = y / l / range;
  }
  return (
    <div
      className={"joystick " + (hidden ? "invisible" : "")}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={() => {
        setKnob({ x: 0, y: 0 });
        controls.x = 0;
        controls.z = 0;
      }}
      onPointerCancel={() => {
        setKnob({ x: 0, y: 0 });
        controls.x = 0;
        controls.z = 0;
      }}
    >
      <div style={{ transform: `translate(${knob.x}px,${knob.y}px)` }} />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
