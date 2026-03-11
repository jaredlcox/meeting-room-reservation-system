import { cn } from "@/lib/utils";
import type { RoomStatus } from "./types";

interface StatusCardProps {
  status: RoomStatus;
  label: string;
}

const STATUS_CONFIG = {
  available: {
    dot: "bg-[var(--status-available)]",
    badge: "bg-[var(--status-available)]/20 text-foreground border-2 border-[var(--status-available)]/50",
    ring: "ring-[var(--status-available)]",
    border: "border-[var(--status-available)]",
    bg: "bg-[var(--status-available-bg)]",
    icon: (
      <svg
        className="w-14 h-14 sm:w-16 sm:h-16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" className="fill-[var(--status-available)]" opacity={0.2} />
        <path
          d="M7.5 12.5l3 3 6-6"
          stroke="var(--status-available)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    label: "Available",
  },
  busy: {
    dot: "bg-[var(--status-busy)]",
    badge: "bg-[var(--status-busy)]/20 text-foreground border-2 border-[var(--status-busy)]/50",
    ring: "ring-[var(--status-busy)]",
    border: "border-[var(--status-busy)]",
    bg: "bg-[var(--status-busy-bg)]",
    icon: (
      <svg
        className="w-14 h-14 sm:w-16 sm:h-16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" className="fill-[var(--status-busy)]" opacity={0.2} />
        <path
          d="M9 9l6 6M15 9l-6 6"
          stroke="var(--status-busy)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    label: "In Use",
  },
  "ending-soon": {
    dot: "bg-[var(--status-ending)]",
    badge: "bg-[var(--status-ending)]/20 text-foreground border-2 border-[var(--status-ending)]/50",
    ring: "ring-[var(--status-ending)]",
    border: "border-[var(--status-ending)]",
    bg: "bg-[var(--status-ending-bg)]",
    icon: (
      <svg
        className="w-14 h-14 sm:w-16 sm:h-16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" className="fill-[var(--status-ending)]" opacity={0.2} />
        <path
          d="M12 7v5l3 3"
          stroke="var(--status-ending)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    label: "Ending Soon",
  },
};

export function StatusCard({ status, label }: StatusCardProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        "rounded-2xl border-[3px] px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3 sm:gap-5 shadow-md min-w-0",
        cfg.bg,
        cfg.border
      )}
      role="status"
      aria-label={`Room status: ${cfg.label}`}
    >
      <div className="shrink-0">{cfg.icon}</div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-2xl sm:text-4xl font-extrabold tracking-tight text-balance break-words text-foreground">
            {cfg.label}
          </span>
          <span
            className={cn(
              "text-sm font-semibold px-3 py-1.5 rounded-full shrink-0",
              cfg.badge
            )}
          >
            {label}
          </span>
        </div>
      </div>
      {/* Pulsing dot */}
      <div className="relative shrink-0 flex items-center justify-center w-6 h-6">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping",
            cfg.dot
          )}
        />
        <span
          className={cn("relative inline-flex rounded-full h-4 w-4", cfg.dot)}
        />
      </div>
    </div>
  );
}
