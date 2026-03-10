import type { ReactNode } from "react";
import type { Meeting } from "./types";

interface MeetingCardProps {
  title: string;
  meeting: Meeting | null;
  emptyText: string;
  footer?: ReactNode;
}

export function MeetingCard({ title, meeting, emptyText, footer }: MeetingCardProps) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5 flex flex-col gap-3 min-w-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>

      {meeting ? (
        <>
          <h2 className="text-base sm:text-lg font-semibold text-foreground leading-snug text-balance break-words truncate">
            {meeting.subject}
          </h2>
          <div className="mt-auto flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
              <PersonIcon />
              <span className="truncate">{meeting.organizer}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClockIcon />
              <span>
                {meeting.startTime} — {meeting.endTime}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center">
          <p className="text-base text-muted-foreground italic">{emptyText}</p>
        </div>
      )}
      {footer ? <div className="pt-1">{footer}</div> : null}
    </div>
  );
}

function PersonIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM6 21v-1a6 6 0 0 1 12 0v1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 7v5l3 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
