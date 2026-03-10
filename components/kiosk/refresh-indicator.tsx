"use client";

import { cn } from "@/lib/utils";

interface RefreshIndicatorProps {
  lastSynced: Date;
  syncing: boolean;
  onRefresh: () => void;
}

export function RefreshIndicator({
  lastSynced,
  syncing,
  onRefresh,
}: RefreshIndicatorProps) {
  const timeStr = lastSynced.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <button
      onClick={onRefresh}
      disabled={syncing}
      aria-label="Refresh room data"
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground rounded-lg px-2.5 py-1.5",
        "border border-border bg-card hover:bg-secondary transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        syncing && "opacity-60 cursor-wait"
      )}
    >
      <RefreshIcon
        className={cn(
          "w-3.5 h-3.5 shrink-0",
          syncing && "animate-spin"
        )}
      />
      <span>{syncing ? "Syncing…" : `Synced ${timeStr}`}</span>
    </button>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 4v5h5M20 20v-5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.49 9A9 9 0 0 0 5.64 5.64L4 10M19.36 14l-1.64 4.36A9 9 0 0 1 3.51 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
