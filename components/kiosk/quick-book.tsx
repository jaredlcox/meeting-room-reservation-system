"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface QuickBookProps {
  options: number[];
  minutesUntilNext: number;
}

export function QuickBook({ options, minutesUntilNext }: QuickBookProps) {
  const [booked, setBooked] = useState<number | null>(null);

  function handleBook(min: number) {
    setBooked(min);
    // Reset after brief feedback
    setTimeout(() => setBooked(null), 2500);
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5 pb-6 sm:pb-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        Quick Book
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {options.map((min) => {
          const disabled = min > minutesUntilNext;
          const isBooked = booked === min;

          return (
            <button
              key={min}
              disabled={disabled}
              onClick={() => handleBook(min)}
              aria-label={`Book for ${min} minutes`}
              className={cn(
                "rounded-xl py-4 text-sm font-semibold transition-all duration-150 select-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isBooked
                  ? "bg-[var(--status-available)] text-white scale-95"
                  : disabled
                  ? "bg-secondary text-muted-foreground opacity-40 cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:opacity-90 active:scale-95 cursor-pointer shadow-sm"
              )}
            >
              {isBooked ? "Booked!" : `${min} min`}
            </button>
          );
        })}
      </div>
      {minutesUntilNext < 60 && (
        <p className="text-xs text-muted-foreground mt-3">
          Options longer than available time are disabled
        </p>
      )}
    </div>
  );
}
