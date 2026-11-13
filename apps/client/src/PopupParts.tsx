import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function RodGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 21 14-17 4 3M7 16l3 3M10 12l3 3M14 8l2 2M21 7v7a2 2 0 0 1-4 0v-1" />
    </svg>
  );
}
export function RunningGlyph() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="16" cy="4" r="2" />
      <path d="m10 7 4 2 2 4 4 1M4 9l4-3 3 2-3 6 5 3-2 5M8 14l-3 5H1M15 9l-3 5" />
    </svg>
  );
}

export function DetailStat({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="detail-stat">
      <Icon aria-hidden="true" />
      <span>{label}</span> <b>{children}</b>
    </div>
  );
}
