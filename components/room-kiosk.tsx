"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Room } from "@/lib/rooms";
import { StatusCard } from "@/components/kiosk/status-card";
import { MeetingCard } from "@/components/kiosk/meeting-card";
import { QuickBook } from "@/components/kiosk/quick-book";
import { QRPanel } from "@/components/kiosk/qr-panel";
import { ScheduleList } from "@/components/kiosk/schedule-list";
import { RefreshIndicator } from "@/components/kiosk/refresh-indicator";
import type { Meeting, RoomStatus } from "@/components/kiosk/types";
import type { ScheduleResponse } from "@/lib/api-types";

interface RoomKioskProps {
  room: Room;
}

function getCurrentAndNext(
  schedule: Meeting[],
  nowMinutes: number
): { currentMeeting: Meeting | null; nextMeeting: Meeting | null } {
  let currentMeeting: Meeting | null = null;
  let nextMeeting: Meeting | null = null;
  for (const m of schedule) {
    if (m.startMinutes <= nowMinutes && nowMinutes < m.endMinutes) {
      currentMeeting = m;
    }
    if (m.startMinutes > nowMinutes && !nextMeeting) {
      nextMeeting = m;
    }
  }
  return { currentMeeting, nextMeeting };
}

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

export default function RoomKiosk({ room }: RoomKioskProps) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Meeting[] | null>(null);
  const [scheduleError, setScheduleError] = useState(false);

  const fetchSchedule = useCallback(async () => {
    const res = await fetch(`/api/rooms/${room.slug}/schedule`);
    if (!res.ok) {
      setScheduleError(true);
      return;
    }
    setScheduleError(false);
    const data: ScheduleResponse = await res.json();
    setSchedule(data.meetings);
    setLastSynced(new Date());
  }, [room.slug]);

  useEffect(() => {
    setNow(new Date());
    setLastSynced(new Date());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchSchedule();
  }, [mounted, fetchSchedule]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const base =
        typeof process.env.NEXT_PUBLIC_APP_URL === "string" &&
        process.env.NEXT_PUBLIC_APP_URL.length > 0
          ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
          : window.location.origin;
      setBookingUrl(`${base}${room.bookingPath}`);
    }
  }, [room.bookingPath]);

  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [mounted]);

  async function handleRefresh() {
    setSyncing(true);
    await fetchSchedule();
    setSyncing(false);
  }

  const scheduleForDerive = schedule ?? [];
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const { currentMeeting, nextMeeting } = useMemo(
    () => getCurrentAndNext(scheduleForDerive, nowMin),
    [scheduleForDerive, nowMin]
  );

  const status = now ? getRoomStatus(now, currentMeeting, nextMeeting) : "available";

  let statusLabel = "";
  if (status === "available") {
    statusLabel = nextMeeting
      ? `Available Until ${nextMeeting.startTime}`
      : "Available All Day";
  } else if (status === "ending-soon" && currentMeeting) {
    statusLabel = `Ending Soon — Free at ${currentMeeting.endTime}`;
  } else if (currentMeeting) {
    statusLabel = `In Use Until ${currentMeeting.endTime}`;
  }

  const minutesUntilNext = nextMeeting ? nextMeeting.startMinutes - nowMin : 480;

  const BOOK_OPTIONS = [15, 30];

  const formattedTime = now
    ? now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "--:-- --";
  const formattedDate = now
    ? now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "Loading...";

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col overflow-x-hidden">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-3xl font-bold text-foreground tracking-tight truncate">
            {room.name}
          </h1>
        </div>
        <div className="text-right flex flex-col items-end gap-1 shrink-0">
          <p className="text-xl sm:text-3xl font-semibold tabular-nums text-foreground">
            {formattedTime}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">{formattedDate}</p>
          {lastSynced && (
            <RefreshIndicator
              lastSynced={lastSynced}
              syncing={syncing}
              onRefresh={handleRefresh}
            />
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 px-4 sm:px-6 pb-6 sm:pb-4 flex flex-col gap-4 overflow-y-auto overflow-x-hidden min-w-0">
        {scheduleError && (
          <p className="text-sm text-destructive" role="alert">
            Could not load schedule. Try refreshing.
          </p>
        )}
        {schedule === null && !scheduleError ? (
          <p className="text-sm text-muted-foreground">Loading schedule…</p>
        ) : (
          <>
            <StatusCard status={status} label={statusLabel} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MeetingCard
                title="Current Meeting"
                meeting={currentMeeting}
                emptyText="No meeting in progress"
              />
              <MeetingCard
                title="Up Next"
                meeting={nextMeeting}
                emptyText="No more meetings today"
              />
            </div>

          </>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-w-0">
          <div className="lg:col-span-2 min-w-0 flex flex-col gap-4">
            <QRPanel bookingUrl={bookingUrl} roomSlug={room.slug} />
            <QuickBook
              roomSlug={room.slug}
              options={BOOK_OPTIONS}
              minutesUntilNext={minutesUntilNext}
            />
          </div>
          <div className="lg:col-span-3 min-w-0">
            <ScheduleList
              meetings={schedule ?? []}
              nowMinutes={nowMin}
            />
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="px-4 sm:px-6 py-3 border-t border-border flex flex-wrap items-center justify-between gap-2 min-w-0">
        <p className="text-xs text-muted-foreground truncate min-w-0">
          Synced with Microsoft 365
        </p>
        <p className="text-xs text-muted-foreground shrink-0">
          Floor 3 · Building A
        </p>
      </footer>
    </div>
  );
}
