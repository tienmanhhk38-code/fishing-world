import { useEffect, useState } from "react";
import {
  X,
  Gift,
  Flag,
  Fish,
  Droplet,
  Store,
  Coins,
  Worm,
  LockKeyhole,
} from "lucide-react";
import { useGame, applyProfile } from "./network";
import { playSound } from "./audio";
import { RodGlyph, RunningGlyph } from "./PopupParts";
export function QuestPanel({ onClose }: { onClose: () => void }) {
  const profile = useGame((s) => s.profile),
    [tab, setTab] = useState<"intro" | "daily">("intro"),
    [pending, setPending] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    void fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.id) applyProfile(d);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!profile?.questResetAt) return;
    const timer = setTimeout(
      () => {
        void fetch("/api/profile")
          .then((r) => r.json())
          .then((d) => {
            if (d.id) applyProfile(d);
          })
          .catch(() => {});
      },
      Math.max(1000, Date.parse(profile.questResetAt) - Date.now() + 100),
    );
    return () => clearTimeout(timer);
  }, [profile?.questResetAt]);
  const quests = (profile?.quests ?? []).filter((q) => q.kind === tab);
  async function claim(questId: string, period: string) {
    setPending(questId);
    setMessage("");
    try {
      const response = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId,
          period,
          requestId: crypto.randomUUID(),
        }),
      });
      let result: any = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }
      if (!response.ok)
        throw Error(
          result?.error ?? "Chưa nhận được phần thưởng. Hãy thử lại.",
        );
      applyProfile(result.profile);
      setMessage(result.message);
      playSound("click");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kết nối đang gián đoạn.");
    } finally {
      setPending("");
    }
  }
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="panel quest-panel reference-popup"
        role="dialog"
        aria-modal="true"
        aria-label="Nhiệm vụ"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <h2>
            <Flag /> Nhiệm vụ
          </h2>
          <button className="icon" aria-label="Đóng nhiệm vụ" onClick={onClose}>
            <X />
          </button>
        </div>
        <p className="npc-greeting">
          Linh: Chào bạn! Hoàn thành những việc này rồi ghé nhận quà nhé.
        </p>
        <div className="quest-tabs">
          <button
            aria-pressed={tab === "intro"}
            onClick={() => setTab("intro")}
          >
            Khởi đầu
          </button>
          <button
            aria-pressed={tab === "daily"}
            onClick={() => setTab("daily")}
          >
            Hằng ngày
          </button>
        </div>
        {tab === "daily" && (
          <p className="quest-reset">
            Làm mới lúc 00:00 giờ Việt Nam · Thưởng chưa nhận hết hạn khi sang
            ngày.
          </p>
        )}
        <div className="quest-list">
          {quests.map((q) => (
            <article
              key={q.id}
              className={
                q.claimed
                  ? "claimed"
                  : !q.available
                    ? "locked"
                    : q.progress >= q.goal
                      ? "ready"
                      : ""
              }
            >
              <div className="quest-icon">
                {q.metric === "moveJump" ? (
                  <RunningGlyph />
                ) : q.metric === "caught" ? (
                  <Fish />
                ) : q.metric === "fresh" ? (
                  <Droplet />
                ) : q.metric === "sold" ? (
                  <Store />
                ) : (
                  <RodGlyph />
                )}
              </div>
              <div className="quest-info">
                <div className="quest-title-row">
                  <h3>{q.title}</h3>
                  <span>
                    {q.progress}/{q.goal}
                  </span>
                </div>
                <progress
                  aria-label={`Tiến độ: ${q.title}`}
                  value={q.progress}
                  max={q.goal}
                />
                <small className="quest-rewards">
                  <span>
                    <Coins aria-hidden="true" /> {q.coins} Xu
                  </span>
                  <span>
                    <b>XP</b> {q.xp} XP
                  </span>
                  {q.worms ? (
                    <span>
                      <Worm aria-hidden="true" /> {q.worms} mồi giun
                    </span>
                  ) : null}
                </small>
              </div>
              <button
                className="play"
                disabled={
                  !!pending || q.claimed || !q.available || q.progress < q.goal
                }
                onClick={() => void claim(q.id, q.period)}
              >
                {pending === q.id ? (
                  "Đang nhận…"
                ) : q.claimed ? (
                  "Đã nhận"
                ) : !q.available ? (
                  <>
                    <LockKeyhole size={16} /> Chưa mở
                  </>
                ) : (
                  <>
                    <Gift size={16} /> Nhận
                  </>
                )}
              </button>
            </article>
          ))}
        </div>
        {message && <p role="status">{message}</p>}
      </section>
    </div>
  );
}
