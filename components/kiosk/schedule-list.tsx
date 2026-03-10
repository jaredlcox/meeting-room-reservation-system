import { cn } from "@/lib/utils";
import type { Meeting } from "./types";

interface ScheduleListProps {
  meetings: Meeting[];
  nowMinutes: number;
}

export function ScheduleList({ meetings, nowMinutes }: ScheduleListProps) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5 flex flex-col gap-3 h-full min-w-0 overflow-hidden">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
        Today's Schedule
      </p>

      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No meetings scheduled today
        </p>
      ) : (
        <div className="flex flex-col gap-2 min-w-0">
          {meetings.map((meeting) => {
            const isPast = meeting.endMinutes < nowMinutes;
            const isActive =
              meeting.startMinutes <= nowMinutes &&
              meeting.endMinutes > nowMinutes;

            return (
              <div
                key={meeting.id}
                className={cn(
                  "flex items-start gap-2 sm:gap-3 rounded-xl px-3 py-3 transition-colors min-w-0",
                  isActive
                    ? "bg-[var(--status-busy-bg)] border border-[var(--status-busy)]/30"
                    : isPast
                    ? "opacity-40"
                    : "bg-secondary"
                )}
                aria-current={isActive ? "true" : undefined}
              >
                {/* Time column */}
                <div className="shrink-0 w-20 sm:w-24 text-right">
                  <span
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      isActive
                        ? "text-[var(--status-busy-fg)]"
                        : "text-muted-foreground"
                    )}
                  >
                    {meeting.startTime}
                  </span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {meeting.endTime}
                  </span>
                </div>

                {/* Divider */}
                <div
                  className={cn(
                    "w-0.5 self-stretch rounded-full mt-0.5 shrink-0",
                    isActive
                      ? "bg-[var(--status-busy)]"
                      : isPast
                      ? "bg-border"
                      : "bg-border"
                  )}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium truncate",
                      isActive ? "text-[var(--status-busy-fg)]" : "text-foreground"
                    )}
                  >
                    {meeting.subject}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {meeting.organizer}
                  </p>
                </div>

                {isActive && (
                  <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--status-busy)] text-white">
                    Now
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
