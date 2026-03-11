"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Meeting } from "./types";

interface ScheduleListProps {
  meetings: Meeting[];
  nowMinutes: number;
}

function getMeetingStatus(meeting: Meeting, nowMinutes: number): string {
  if (meeting.startMinutes <= nowMinutes && meeting.endMinutes > nowMinutes) {
    return "Happening now";
  }
  if (meeting.endMinutes < nowMinutes) {
    return "Ended";
  }
  return "Up next";
}

export function ScheduleList({ meetings, nowMinutes }: ScheduleListProps) {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const activeOrUpcomingMeetings = meetings.filter((meeting) => meeting.endMinutes > nowMinutes);

  return (
    <>
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5 flex flex-col gap-3 flex-1 min-h-0 min-w-0 overflow-hidden">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
          Today&apos;s Schedule
        </p>

        {activeOrUpcomingMeetings.length === 0 ? (
          <p className="text-sm text-muted-foreground italic shrink-0">
            No active or upcoming meetings
          </p>
        ) : (
          <div className="flex flex-col gap-2 min-h-0 min-w-0 overflow-y-auto flex-1">
            {activeOrUpcomingMeetings.map((meeting) => {
              const isActive =
                meeting.startMinutes <= nowMinutes &&
                meeting.endMinutes > nowMinutes;

              return (
                <button
                  key={meeting.id}
                  type="button"
                  onClick={() => setSelectedMeeting(meeting)}
                  aria-label={`View details for ${meeting.subject}`}
                  className={cn(
                    "flex items-start gap-2 sm:gap-3 rounded-xl px-3 py-3 transition-colors min-w-0 text-left w-full cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "bg-[var(--status-busy-bg)] border border-[var(--status-busy)]/30"
                      : "bg-secondary hover:bg-secondary/80"
                  )}
                  aria-current={isActive ? "true" : undefined}
                >
                  {/* Time column */}
                  <div className="shrink-0 w-20 sm:w-24 text-right">
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums block",
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
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={!!selectedMeeting}
        onOpenChange={(open) => !open && setSelectedMeeting(null)}
      >
        <DialogContent>
          {selectedMeeting && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedMeeting.subject}</DialogTitle>
                <DialogDescription>
                  {getMeetingStatus(selectedMeeting, nowMinutes)}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground font-medium">Organizer</dt>
                  <dd className="text-foreground">{selectedMeeting.organizer}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">Start</dt>
                  <dd className="text-foreground tabular-nums">{selectedMeeting.startTime}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">End</dt>
                  <dd className="text-foreground tabular-nums">{selectedMeeting.endTime}</dd>
                </div>
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
