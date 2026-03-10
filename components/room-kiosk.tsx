"use client";

import { useEffect, useState } from "react";
import { StatusCard } from "@/components/kiosk/status-card";
import { MeetingCard } from "@/components/kiosk/meeting-card";
import { QuickBook } from "@/components/kiosk/quick-book";
import { QRPanel } from "@/components/kiosk/qr-panel";
import { ScheduleList } from "@/components/kiosk/schedule-list";
import { RefreshIndicator } from "@/components/kiosk/refresh-indicator";
import type { Meeting, RoomStatus } from "@/components/kiosk/types";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const ACTIVE_MEETING: Meeting = {
  id: "1",
  subject: "Q2 Brand Strategy Review",
  organizer: "Sarah Mitchell",
  startTime: "10:00 AM",
  endTime: "11:00 AM",
  startMinutes: 10 * 60,
  endMinutes: 11 * 60,
};

const NEXT_MEETING: Meeting = {
  id: "2",
  subject: "Product Design Sync",
  organizer: "James Okafor",
  startTime: "11:30 AM",
  endTime: "12:30 PM",
  startMinutes: 11 * 60 + 30,
  endMinutes: 12 * 60 + 30,
};

const SCHEDULE: Meeting[] = [
  ACTIVE_MEETING,
  NEXT_MEETING,
  {
    id: "3",
    subject: "Engineering All-Hands",
    organizer: "Priya Nair",
    startTime: "1:00 PM",
    endTime: "2:00 PM",
    startMinutes: 13 * 60,
    endMinutes: 14 * 60,
  },
  {
    id: "4",
    subject: "Client Onboarding — Apex Corp",
    organizer: "Tom Reardon",
    startTime: "2:30 PM",
    endTime: "3:30 PM",
    startMinutes: 14 * 60 + 30,
    endMinutes: 15 * 60 + 30,
  },
  {
    id: "5",
    subject: "Weekly Retrospective",
    organizer: "Alicia Chen",
    startTime: "4:00 PM",
    endTime: "4:45 PM",
    startMinutes: 16 * 60,
    endMinutes: 16 * 60 + 45,
  },
];

function getRoomStatus(
  now: Date,
  active: Meeting | null,
  next: Meeting | null
): RoomStatus {
  if (!active) return "available";
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (active.endMinutes - nowMin <= 15) return "ending-soon";
  return "busy";
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function RoomKiosk() {
  const [now, setNow] = useState(new Date());
  const [lastSynced, setLastSynced] = useState(new Date());
  const [syncing, setSyncing] = useState(false);

  // Tick clock every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  function handleRefresh() {
    setSyncing(true);
    setTimeout(() => {
      setLastSynced(new Date());
      setSyncing(false);
    }, 1200);
  }

  const status = getRoomStatus(now, ACTIVE_MEETING, NEXT_MEETING);

  // Determine available-until label
  let statusLabel = "";
  if (status === "available") {
    statusLabel = NEXT_MEETING
      ? `Available Until ${NEXT_MEETING.startTime}`
      : "Available All Day";
  } else if (status === "ending-soon") {
    statusLabel = `Ending Soon — Free at ${ACTIVE_MEETING.endTime}`;
  } else {
    statusLabel = `In Use Until ${ACTIVE_MEETING.endTime}`;
  }

  // Quick-book slots (in minutes)
  const BOOK_OPTIONS = [15, 30, 45, 60];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const minutesUntilNext = NEXT_MEETING ? NEXT_MEETING.startMinutes - nowMin : 480;

  const formattedTime = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const formattedDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      {/* ── Header ── */}
      <header className="flex items-start justify-between px-6 pt-6 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Canvass Room
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            canvassroom@ircuwd.com
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <p className="text-3xl font-semibold tabular-nums text-foreground">
            {formattedTime}
          </p>
          <p className="text-sm text-muted-foreground">{formattedDate}</p>
          <RefreshIndicator
            lastSynced={lastSynced}
            syncing={syncing}
            onRefresh={handleRefresh}
          />
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 px-6 pb-4 flex flex-col gap-4 overflow-y-auto">
        {/* Status Card */}
        <StatusCard status={status} label={statusLabel} />

        {/* Meeting Cards */}
        <div className="grid grid-cols-2 gap-4">
          <MeetingCard
            title="Current Meeting"
            meeting={ACTIVE_MEETING}
            emptyText="No meeting in progress"
          />
          <MeetingCard
            title="Up Next"
            meeting={NEXT_MEETING}
            emptyText="No more meetings today"
          />
        </div>

        {/* Quick Book */}
        <QuickBook options={BOOK_OPTIONS} minutesUntilNext={minutesUntilNext} />

        {/* QR Code + Schedule side by side on larger screens */}
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2">
            <QRPanel />
          </div>
          <div className="col-span-3">
            <ScheduleList meetings={SCHEDULE} nowMinutes={nowMin} />
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="px-6 py-3 border-t border-border flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Synced with Microsoft 365
        </p>
        <p className="text-xs text-muted-foreground">
          Floor 3 · Building A
        </p>
      </footer>
    </div>
  );
}
