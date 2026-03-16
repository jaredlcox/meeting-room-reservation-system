"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room } from "@/lib/rooms";
import { StatusCard } from "@/components/kiosk/status-card";
import { MeetingCard } from "@/components/kiosk/meeting-card";
import { QuickBook } from "@/components/kiosk/quick-book";
import { QRPanel } from "@/components/kiosk/qr-panel";
import { ScheduleList, getMeetingStatus } from "@/components/kiosk/schedule-list";
import type { Meeting, RoomStatus } from "@/components/kiosk/types";
import type { RoomHoldResponse, ScheduleResponse } from "@/lib/api-types";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  _now: Date,
  active: Meeting | null,
  _next: Meeting | null
): RoomStatus {
  return active ? "busy" : "available";
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function RoomKiosk({ room }: RoomKioskProps) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Meeting[] | null>(null);
  const [scheduleError, setScheduleError] = useState(false);
  const [holdActive, setHoldActive] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [selectedMeetingForDetail, setSelectedMeetingForDetail] = useState<Meeting | null>(null);
  const hadCurrentMeetingRef = useRef(false);
  /** Only treat hold as "started early" when the user clicked Start early in this session; ignore stale hold from server. */
  const userStartedEarlyThisSessionRef = useRef(false);

  const fetchRoomState = useCallback(
    async (options?: { skipHoldUpdate?: boolean }) => {
      const [scheduleRes, holdRes] = await Promise.all([
        apiGet(`/api/rooms/${room.slug}/schedule`),
        apiGet(`/api/rooms/${room.slug}/hold`),
      ]);

      if (!scheduleRes.ok) {
        setScheduleError(true);
      } else {
        setScheduleError(false);
        const data: ScheduleResponse = await scheduleRes.json();
        setSchedule(data.meetings);
      }

      if (!options?.skipHoldUpdate && holdRes.ok) {
        const holdData: RoomHoldResponse = await holdRes.json();
        setHoldActive(holdData.holdActive);
      }
    },
    [room.slug]
  );

  useEffect(() => {
    setNow(new Date());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchRoomState();
  }, [mounted, fetchRoomState]);

  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => fetchRoomState(), 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, fetchRoomState]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const base =
      typeof process.env.NEXT_PUBLIC_APP_URL === "string" &&
      process.env.NEXT_PUBLIC_APP_URL.length > 0
        ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
        : window.location.origin;
    const slugFromPath = window.location.pathname.replace(/^\/rooms\/?/, "").split("/")[0] || room.slug;
    setBookingUrl(`${base}/book/${slugFromPath}`);
  }, [mounted, room.slug]);

  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [mounted]);

  const scheduleForDerive = schedule ?? [];
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const { currentMeeting, nextMeeting } = useMemo(
    () => getCurrentAndNext(scheduleForDerive, nowMin),
    [scheduleForDerive, nowMin]
  );

  // Clear stale hold from server: if we have holdActive but the user didn't click "Start early" in this session, clear it so the next meeting doesn't show as current.
  useEffect(() => {
    if (!mounted || !holdActive || schedule === null || userStartedEarlyThisSessionRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiDelete(`/api/rooms/${room.slug}/hold`);
        if (res.ok && !cancelled) {
          setHoldActive(false);
          userStartedEarlyThisSessionRef.current = false;
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, holdActive, schedule, room.slug]);

  // When a meeting that was in progress by time ends (e.g. quick book), clear the hold so the next meeting doesn't jump to "Current" with "In Use - Started early" without the user clicking "Start early".
  useEffect(() => {
    if (!mounted || schedule === null) return;
    const hadCurrent = hadCurrentMeetingRef.current;
    const hasCurrent = currentMeeting !== null;
    if (holdActive && hadCurrent && !hasCurrent) {
      let cancelled = false;
      (async () => {
        try {
          const res = await apiDelete(`/api/rooms/${room.slug}/hold`);
          if (res.ok && !cancelled) {
            setHoldActive(false);
            userStartedEarlyThisSessionRef.current = false;
          }
        } catch {
          // ignore
        }
      })();
      hadCurrentMeetingRef.current = false;
      return () => {
        cancelled = true;
      };
    }
    hadCurrentMeetingRef.current = hasCurrent;
  }, [mounted, holdActive, currentMeeting, schedule, room.slug]);

  // Clear a stale "started early" hold only when there is no current AND no next meeting (e.g. after refresh with empty schedule). Do not clear when nextMeeting is set—that is the valid "started early for next" state; clearing would cause flicker when user clicks "Start early".
  useEffect(() => {
    if (
      !mounted ||
      !holdActive ||
      schedule === null ||
      scheduleError ||
      currentMeeting !== null ||
      nextMeeting !== null
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiDelete(`/api/rooms/${room.slug}/hold`);
        if (res.ok && !cancelled) {
          setHoldActive(false);
          userStartedEarlyThisSessionRef.current = false;
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, holdActive, schedule, scheduleError, currentMeeting, nextMeeting, room.slug]);

  const { displayCurrentMeeting, displayNextMeeting } = useMemo(() => {
    // If there's a meeting in progress by time (e.g. quick book), show it as current and next as up next—even if we have a "started early" hold. Only show next as current when the user actually clicked "Start early" this session (ignore stale hold from server).
    if (currentMeeting) {
      return { displayCurrentMeeting: currentMeeting, displayNextMeeting: nextMeeting };
    }
    if (holdActive && nextMeeting && userStartedEarlyThisSessionRef.current) {
      const meetingAfterNext = scheduleForDerive.find(
        (m) => m.startMinutes > nextMeeting.startMinutes
      ) ?? null;
      return { displayCurrentMeeting: nextMeeting, displayNextMeeting: meetingAfterNext };
    }
    return { displayCurrentMeeting: currentMeeting, displayNextMeeting: nextMeeting };
  }, [holdActive, currentMeeting, nextMeeting, scheduleForDerive]);

  const startedEarlyThisSession = userStartedEarlyThisSessionRef.current;
  const status = holdActive && startedEarlyThisSession
    ? "busy"
    : now
      ? getRoomStatus(now, currentMeeting, nextMeeting)
      : "available";

  let statusLabel = "";
  if (holdActive && startedEarlyThisSession && !currentMeeting) {
    statusLabel = "In Use - Started early";
  } else if (holdActive && startedEarlyThisSession && currentMeeting) {
    statusLabel = `In Use Until ${currentMeeting.endTime}`;
  } else if (status === "available") {
    statusLabel = nextMeeting
      ? `Available Until ${nextMeeting.startTime}`
      : "Available All Day";
  } else if (currentMeeting) {
    statusLabel = `In Use Until ${currentMeeting.endTime}`;
  }

  const minutesUntilNext = holdActive && startedEarlyThisSession
    ? 0
    : nextMeeting
      ? nextMeeting.startMinutes - nowMin
      : 480;

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

  async function handleStartEarly() {
    setActionSubmitting(true);
    setHoldError(null);
    try {
      const res = await apiPost(`/api/rooms/${room.slug}/hold`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setHoldError(data.error ?? "Could not start room early.");
      } else {
        userStartedEarlyThisSessionRef.current = true;
        setHoldActive(true);
      }
      await fetchRoomState();
    } catch {
      setHoldError("Could not start room early.");
    } finally {
      setActionSubmitting(false);
    }
  }

  async function handleStopEarly() {
    setActionSubmitting(true);
    setHoldError(null);
    try {
      // When user "started early", displayCurrentMeeting is the meeting to end (even if not started by clock). Otherwise end the current meeting by time.
      const meetingToEnd = holdActive ? displayCurrentMeeting : currentMeeting;
      const hasMeetingToEnd = !!meetingToEnd;
      const res = hasMeetingToEnd
        ? await apiPost(`/api/rooms/${room.slug}/end-active`, { eventId: meetingToEnd.id })
        : await apiDelete(`/api/rooms/${room.slug}/hold`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setHoldError(data.error ?? "Could not stop this room.");
        if (res.status === 409 && holdActive) {
          try {
            await apiDelete(`/api/rooms/${room.slug}/hold`);
          } catch {
            // ignore
          }
          userStartedEarlyThisSessionRef.current = false;
          setHoldActive(false);
        }
      } else {
        userStartedEarlyThisSessionRef.current = false;
        setHoldActive(false);
      }
      // Refresh schedule but don't overwrite holdActive with server response—we just cleared it
      await fetchRoomState({ skipHoldUpdate: true });
    } catch {
      setHoldError("Could not stop this room.");
    } finally {
      setActionSubmitting(false);
    }
  }

  const disableStart = actionSubmitting || (holdActive && startedEarlyThisSession) || !!currentMeeting || !nextMeeting;
  const disableStop = actionSubmitting || !displayCurrentMeeting;

  return (
    <div className="kiosk-viewport bg-background font-sans flex flex-col overflow-hidden">
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
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 min-h-0 px-4 sm:px-6 pb-6 sm:pb-4 flex flex-col gap-4 overflow-hidden min-w-0">
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
                meeting={displayCurrentMeeting}
                emptyText="No meeting in progress"
                onMeetingClick={setSelectedMeetingForDetail}
                footer={displayCurrentMeeting ? (
                  <Button
                    type="button"
                    size="lg"
                    variant="destructive"
                    className="min-h-[44px] min-w-[100px] rounded-xl font-semibold shadow-sm"
                    onClick={handleStopEarly}
                    disabled={disableStop}
                  >
                    Stop
                  </Button>
                ) : null}
              />
              <MeetingCard
                title="Up Next"
                meeting={displayNextMeeting}
                emptyText="No more meetings today"
                onMeetingClick={setSelectedMeetingForDetail}
                footer={displayNextMeeting ? (
                  <Button
                    type="button"
                    size="lg"
                    className="min-h-[44px] min-w-[120px] rounded-xl font-semibold shadow-sm bg-green-600 text-white hover:bg-green-700"
                    onClick={handleStartEarly}
                    disabled={disableStart}
                  >
                    Start early
                  </Button>
                ) : null}
              />
            </div>
            {holdError && (
              <p className="text-sm text-destructive" role="alert">
                {holdError}
              </p>
            )}

            <Dialog
              open={!!selectedMeetingForDetail}
              onOpenChange={(open) => !open && setSelectedMeetingForDetail(null)}
            >
              <DialogContent>
                {selectedMeetingForDetail && (
                  <>
                    <DialogHeader>
                      <DialogTitle>{selectedMeetingForDetail.subject}</DialogTitle>
                      <DialogDescription>
                        {getMeetingStatus(selectedMeetingForDetail, nowMin)}
                      </DialogDescription>
                    </DialogHeader>
                    <dl className="grid gap-2 text-sm">
                      <div>
                        <dt className="text-muted-foreground font-medium">Organizer</dt>
                        <dd className="text-foreground">{selectedMeetingForDetail.organizer}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground font-medium">Start</dt>
                        <dd className="text-foreground tabular-nums">{selectedMeetingForDetail.startTime}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground font-medium">End</dt>
                        <dd className="text-foreground tabular-nums">{selectedMeetingForDetail.endTime}</dd>
                      </div>
                    </dl>
                  </>
                )}
              </DialogContent>
            </Dialog>

          </>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-w-0 flex-1 min-h-0 overflow-hidden">
          <div className="lg:col-span-2 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QRPanel bookingUrl={bookingUrl} />
            <QuickBook
              roomSlug={room.slug}
              options={BOOK_OPTIONS}
              minutesUntilNext={minutesUntilNext}
              hasCurrentMeeting={!!displayCurrentMeeting}
              onBooked={fetchRoomState}
            />
          </div>
          <div className="lg:col-span-3 min-w-0 min-h-0 flex flex-col">
            <ScheduleList
              meetings={schedule ?? []}
              nowMinutes={nowMin}
            />
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="px-4 sm:px-6 py-3 border-t border-border flex items-center min-w-0">
        <p className="text-xs text-muted-foreground truncate min-w-0">
          Synced with Microsoft 365
        </p>
      </footer>
    </div>
  );
}
