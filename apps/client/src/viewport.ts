export interface ViewportSize {
  width: number;
  height: number;
  visibleHeight: number;
  keyboard: boolean;
}
export interface ViewportMeasurement {
  width: number;
  height: number;
  visibleHeight: number;
  editing: boolean;
  touch: boolean;
  scale: number;
}
/** Keep the renderer at its pre-keyboard size; only overlays follow the visual viewport. */
export function resolveViewport(
  previous: ViewportSize | undefined,
  m: ViewportMeasurement,
): ViewportSize {
  const rotated = previous && Math.abs(previous.width - m.width) > 48;
  let height = previous
    ? rotated
      ? previous.keyboard
        ? Math.max(m.height, previous.width)
        : m.height
      : previous.height
    : m.height;
  const keyboard =
    m.touch &&
    Math.abs(m.scale - 1) < 0.05 &&
    (m.editing || !!previous?.keyboard) &&
    height - m.visibleHeight > Math.max(100, height * 0.18);
  if (!keyboard) height = m.height;
  return { width: m.width, height, visibleHeight: m.visibleHeight, keyboard };
}
export function installViewportSizing() {
  const root = document.documentElement,
    visual = window.visualViewport;
  let previous: ViewportSize | undefined,
    frame = 0;
  const update = () => {
    frame = 0;
    const active = document.activeElement;
    const editing =
      active instanceof HTMLElement &&
      active.matches(
        'input:not([type="range"]):not([type="checkbox"]),textarea,select,[contenteditable="true"]',
      );
    previous = resolveViewport(previous, {
      width: window.innerWidth,
      height: window.innerHeight,
      visibleHeight: visual?.height ?? window.innerHeight,
      editing,
      touch:
        navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches,
      scale: visual?.scale ?? 1,
    });
    root.style.setProperty("--game-height", `${previous.height}px`);
    root.style.setProperty("--visible-height", `${previous.visibleHeight}px`);
    root.style.setProperty(
      "--visual-top",
      `${Math.max(0, visual?.offsetTop ?? 0)}px`,
    );
    if (previous.keyboard) {
      root.dataset.keyboardOpen = "true";
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    } else delete root.dataset.keyboardOpen;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  update();
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("scroll", schedule);
  visual?.addEventListener("resize", schedule);
  visual?.addEventListener("scroll", schedule);
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", schedule);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    window.removeEventListener("scroll", schedule);
    visual?.removeEventListener("resize", schedule);
    visual?.removeEventListener("scroll", schedule);
    document.removeEventListener("focusin", schedule);
    document.removeEventListener("focusout", schedule);
    delete root.dataset.keyboardOpen;
    for (const name of ["--game-height", "--visible-height", "--visual-top"])
      root.style.removeProperty(name);
  };
}
