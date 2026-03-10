import { cn } from "@/lib/utils";
import type { RoomStatus } from "./types";

interface StatusCardProps {
  status: RoomStatus;
  label: string;
}

const STATUS_CONFIG = {
  available: {
    dot: "bg-[var(--status-available)]",
    badge: "bg-[var(--status-available-bg)] text-[var(--status-available-fg)]",
    ring: "ring-[var(--status-available-bg)]",
    border: "border-[var(--status-available)]",
    icon: (
      <svg
        className="w-12 h-12"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" className="fill-[var(--status-available-bg)]" />
        <path
          d="M7.5 12.5l3 3 6-6"
          stroke="var(--status-available)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    label: "Available",
  },
  busy: {
    dot: "bg-[var(--status-busy)]",
    badge: "bg-[var(--status-busy-bg)] text-[var(--status-busy-fg)]",
    ring: "ring-[var(--status-busy-bg)]",
    border: "border-[var(--status-busy)]",
    icon: (
      <svg
        className="w-12 h-12"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" className="fill-[var(--status-busy-bg)]" />
        <path
          d="M9 9l6 6M15 9l-6 6"
          stroke="var(--status-busy)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    label: "In Use",
  },
  "ending-soon": {
    dot: "bg-[var(--status-ending)]",
    badge: "bg-[var(--status-ending-bg)] text-[var(--status-ending-fg)]",
    ring: "ring-[var(--status-ending-bg)]",
    border: "border-[var(--status-ending)]",
    icon: (
      <svg
        className="w-12 h-12"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" className="fill-[var(--status-ending-bg)]" />
        <path
          d="M12 7v5l3 3"
          stroke="var(--status-ending)"
          strokeWidth="2"
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
        "bg-card rounded-2xl border-2 px-6 py-5 flex items-center gap-5 shadow-sm",
        cfg.border
      )}
      role="status"
      aria-label={`Room status: ${cfg.label}`}
    >
      <div className="shrink-0">{cfg.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={cn(
              "text-4xl font-bold tracking-tight text-balance",
              status === "available"
                ? "text-[var(--status-available-fg)]"
                : status === "busy"
                ? "text-[var(--status-busy-fg)]"
                : "text-[var(--status-ending-fg)]"
            )}
          >
            {cfg.label}
          </span>
          <span
            className={cn(
              "text-sm font-medium px-3 py-1 rounded-full shrink-0",
              cfg.badge
            )}
          >
            {label}
          </span>
        </div>
      </div>
      {/* Pulsing dot */}
      <div className="relative shrink-0 flex items-center justify-center w-5 h-5">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping",
            cfg.dot
          )}
        />
        <span
          className={cn("relative inline-flex rounded-full h-3 w-3", cfg.dot)}
        />
      </div>
    </div>
  );
}
