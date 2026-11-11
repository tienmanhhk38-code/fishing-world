import { create } from "zustand";
import type { EconomyAction, Profile, SaleQuote } from "@fishing/shared";
import { applyProfile, useGame } from "./network";

type Pending = { guestId: string; body: EconomyAction & { requestId: string } };
function savedPending(): Pending | null {
  try {
    return JSON.parse(
      sessionStorage.getItem("fishing-pending-operation") ?? "null",
    );
  } catch {
    return null;
  }
}
export const useEconomy = create<{
  busy: boolean;
  pending: boolean;
  error: string;
  message: string;
  completedSaleId: string;
}>(() => ({
  busy: false,
  pending: !!savedPending(),
  error: savedPending() ? "Có thao tác đang chờ xác nhận. Hãy thử lại." : "",
  message: "",
  completedSaleId: "",
}));
function save(pending: Pending | null) {
  try {
    if (pending)
      sessionStorage.setItem(
        "fishing-pending-operation",
        JSON.stringify(pending),
      );
    else sessionStorage.removeItem("fishing-pending-operation");
  } catch {}
  useEconomy.setState({ pending: !!pending });
}
class ResponseError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
  }
}
async function post(path: string, body: unknown) {
  const abort = new AbortController(),
    timer = setTimeout(() => abort.abort(), 8000);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    const result = await response.json();
    if (!response.ok)
      throw new ResponseError(
        result.error ?? "Không thể lưu dữ liệu.",
        response.status < 500,
      );
    return result;
  } finally {
    clearTimeout(timer);
  }
}
async function submit(pending: Pending): Promise<void> {
  useEconomy.setState({ busy: true, error: "", message: "" });
  save(pending);
  try {
    let result: { profile: Profile; message: string } | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await post("/api/economy", pending.body);
        break;
      } catch (error) {
        if (error instanceof ResponseError && error.permanent) throw error;
        if (attempt === 1) throw error;
      }
    }
    applyProfile(result!.profile);
    save(null);
    useEconomy.setState({
      message: pending.body.action === "viewShop" ? "" : result!.message,
      completedSaleId:
        pending.body.action === "sell" ? pending.body.quoteId : "",
    });
  } catch (error) {
    if (error instanceof ResponseError && error.permanent) save(null);
    await fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        if (response.ok) applyProfile(await response.json());
      })
      .catch(() => {});
    const message =
      error instanceof ResponseError
        ? error.message
        : "Chưa nhận được xác nhận. Bấm Thử lại để kiểm tra cùng thao tác.";
    useEconomy.setState({ error: message });
    throw error;
  } finally {
    useEconomy.setState({ busy: false });
  }
}
export async function transact(action: EconomyAction) {
  if (useEconomy.getState().busy) return;
  const guestId = useGame.getState().profile?.id;
  if (!guestId) throw new Error("Chưa có hồ sơ.");
  let pending = savedPending();
  if (pending?.guestId !== guestId) {
    save(null);
    pending = null;
  }
  if (pending) {
    const { requestId, ...previous } = pending.body;
    if (JSON.stringify(previous) !== JSON.stringify(action)) {
      useEconomy.setState({
        error: "Hãy thử lại thao tác đang chờ xác nhận trước.",
      });
      throw new Error("Pending operation");
    }
  }
  return submit(
    pending ?? { guestId, body: { ...action, requestId: crypto.randomUUID() } },
  );
}
export async function retryPending() {
  if (useEconomy.getState().busy) return;
  const pending = savedPending();
  if (pending && pending.guestId === useGame.getState().profile?.id)
    return submit(pending);
  save(null);
}
export async function quoteSale(fishId?: string): Promise<SaleQuote> {
  useEconomy.setState({ busy: true, error: "" });
  try {
    return await post("/api/sale-quote", fishId ? { fishId } : {});
  } catch (error) {
    useEconomy.setState({
      error: error instanceof Error ? error.message : "Không thể xem giá bán.",
    });
    throw error;
  } finally {
    useEconomy.setState({ busy: false });
  }
}
