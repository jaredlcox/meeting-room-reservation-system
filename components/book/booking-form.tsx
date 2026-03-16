"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import type { Room } from "@/lib/rooms";
import type { TimeSlot, SlotsResponse } from "@/lib/api-types";
import { apiGet, apiPost, API_URL } from "@/lib/api-client";

/** Slots are 15-min blocks. Returns contiguous minutes available from each slot's start. */
function getContiguousMinutesBySlot(slots: TimeSlot[]): Map<string, number> {
  const map = new Map<string, number>();
  const sorted = [...slots].sort((a, b) => a.startMinutes - b.startMinutes);
  for (let i = 0; i < sorted.length; i++) {
    const slot = sorted[i]!;
    let end = slot.endMinutes;
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.startMinutes === end) {
      end = sorted[j]!.endMinutes;
      j++;
    }
    map.set(slot.start, end - slot.startMinutes);
  }
  return map;
}
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DirectoryUser {
  id: string;
  displayName: string;
  mail: string;
}
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTime12h } from "@/lib/time";

const DURATION_OPTIONS = [15, 30, 45, 60] as const;
const MAX_DAYS_AHEAD = 7;

const ALLOWED_INVITE_DOMAINS = ["integrityhomeexteriors.com", "ircuwd.com"];
function isAllowedInviteEmail(mail: string): boolean {
  const lower = mail.toLowerCase();
  return ALLOWED_INVITE_DOMAINS.some((d) => lower.endsWith(d));
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function isTomorrow(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear()
  );
}

function formatDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

type SubmitStatus = "idle" | "submitting" | "success" | "error" | "conflict" | "unauthorized";

interface BookingFormProps {
  room: Room;
}

export function BookingForm({ room }: BookingFormProps) {
  const [session, setSession] = useState<{ user: { email: string; name?: string } } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [slotsByDate, setSlotsByDate] = useState<Record<string, TimeSlot[]>>({});
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [title, setTitle] = useState("");
  const [attendees, setAttendees] = useState<DirectoryUser[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [selectedAttendeeEmails, setSelectedAttendeeEmails] = useState<Set<string>>(new Set());
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>("idle");

  const checkAuth = useCallback(async () => {
    try {
      const res = await apiGet("/api/auth/user");
      if (res.ok) {
        const data = await res.json();
        setSession({ user: data.user });
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const dateStr = useMemo(() => toDateString(selectedDate), [selectedDate]);


  useEffect(() => {
    setAttendeesLoading(true);
    apiGet("/api/directory/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data: { users: DirectoryUser[] }) => {
        const all = data.users ?? [];
        setAttendees(all.filter((u) => u.mail && isAllowedInviteEmail(u.mail)));
      })
      .catch(() => setAttendees([]))
      .finally(() => setAttendeesLoading(false));
  }, []);

  useEffect(() => {
    if (!session) return;
    setSlotsLoading(true);
    setSlotsError(false);
    const base = new Date();
    const dateStrings: string[] = [];
    for (let i = 0; i < MAX_DAYS_AHEAD; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      dateStrings.push(toDateString(d));
    }
    Promise.all(
      dateStrings.map((dateStr) =>
        apiGet(`/api/rooms/${room.slug}/slots?date=${dateStr}`)
          .then((res) => (res.ok ? (res.json() as Promise<SlotsResponse>) : { slots: [] }))
          .then((data) => ({ dateStr, slots: data?.slots ?? [] }))
          .catch(() => ({ dateStr, slots: [] }))
      )
    )
      .then((results) => {
        const next: Record<string, TimeSlot[]> = {};
        for (const { dateStr, slots } of results) {
          next[dateStr] = slots;
        }
        setSlotsByDate((prev) => ({ ...prev, ...next }));
        setSlotsError(false);
      })
      .catch(() => setSlotsError(true))
      .finally(() => setSlotsLoading(false));
  }, [session, room.slug]);

  const slots = useMemo(
    () => slotsByDate[dateStr] ?? [],
    [slotsByDate, dateStr]
  );

  const now = useMemo(() => new Date(), []);
  const selectableSlots = useMemo(() => {
    if (!isToday(selectedDate)) return slots;
    return slots.filter((s) => new Date(s.start) > now);
  }, [slots, selectedDate, now]);

  const contiguousBySlot = useMemo(
    () => getContiguousMinutesBySlot(selectableSlots),
    [selectableSlots]
  );

  const hasSlotsForDate = useMemo(() => {
    return (d: Date) => {
      const str = toDateString(d);
      const daySlots = slotsByDate[str] ?? [];
      if (!isToday(d)) return daySlots.length > 0;
      return daySlots.some((s) => new Date(s.start) > now);
    };
  }, [slotsByDate, now]);

  const dateOptions = useMemo(() => {
    const options: Date[] = [];
    const base = new Date();
    for (let i = 0; i < MAX_DAYS_AHEAD; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      options.push(d);
    }
    return options;
  }, []);

  const filteredAttendees = useMemo(() => {
    const q = attendeeSearch.trim().toLowerCase();
    return attendees
      .filter(
        (u) =>
          !q ||
          u.displayName.toLowerCase().includes(q) ||
          u.mail.toLowerCase().includes(q)
      )
      .slice(0, 100);
  }, [attendees, attendeeSearch]);

  function toggleAttendee(email: string) {
    setSelectedAttendeeEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setStatus("submitting");
    const body: { durationMinutes: number; title?: string; startTime: string; attendeeEmails?: string[] } = {
      durationMinutes,
      startTime: selectedSlot.start,
    };
    if (title.trim()) body.title = title.trim();
    if (selectedAttendeeEmails.size > 0) body.attendeeEmails = Array.from(selectedAttendeeEmails);
    const res = await apiPost(`/api/rooms/${room.slug}/reserve`, body);
    if (res.ok) {
      setStatus("success");
    } else if (res.status === 401) {
      setStatus("unauthorized");
    } else if (res.status === 409) {
      setStatus("conflict");
    } else if (res.status === 400) {
      setStatus("error");
    } else {
      setStatus("error");
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background font-sans flex flex-col">
        <main className="flex-1 px-4 py-8 max-w-md mx-auto w-full flex flex-col justify-center gap-6">
          <p className="text-sm text-muted-foreground text-center">Loading…</p>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background font-sans flex flex-col">
        <main className="flex-1 px-4 py-8 max-w-md mx-auto w-full flex flex-col justify-center gap-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {room.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Sign in with your Microsoft work account to reserve this room.
            </p>
            <Button
              type="button"
              size="lg"
              className="mt-6 min-h-[48px] w-full"
              onClick={() => {
                const callbackUrl = typeof window !== "undefined"
                  ? `${window.location.origin}/book/${room.slug}`
                  : `/book/${room.slug}`;
                window.location.href = `${API_URL}/auth/redirect?callback=${encodeURIComponent(callbackUrl)}`;
              }}
            >
              Sign in with Microsoft
            </Button>
            <Link
              href={room.displayPath}
              className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground"
            >
              Back to room display
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-background font-sans flex flex-col">
        <main className="flex-1 px-4 py-8 max-w-md mx-auto w-full flex flex-col justify-center gap-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
            <p className="text-lg font-semibold text-foreground">
              Reservation confirmed
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Your booking for {room.name} has been submitted.
            </p>
            <Link
              href={room.displayPath}
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 min-h-[44px]"
            >
              Back to room display
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <main className="flex-1 px-4 py-8 max-w-md mx-auto w-full">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {room.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {session.user?.name ?? session.user?.email ?? "Signed in"}{" "}
            <button
              type="button"
              onClick={async () => {
                await apiPost("/auth/logout");
                setSession(null);
              }}
              className="underline hover:text-foreground"
            >
              Sign out
            </button>
          </p>
        </header>

        <p className="text-sm text-muted-foreground mb-6">
          Choose a date and time slot, then duration and optional title.
        </p>

        {status === "unauthorized" && (
          <div
            className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400"
            role="alert"
          >
            Session expired; please sign in again.
          </div>
        )}
        {status === "conflict" && (
          <div
            className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            Room is not available for that time. Please choose a different slot or try again later.
          </div>
        )}
        {status === "error" && (
          <div
            className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            Something went wrong. Please try again.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div role="group" aria-labelledby="date-label">
            <Label id="date-label" className="text-base">
              Date
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {dateOptions.map((d) => {
                const noAvailability = !hasSlotsForDate(d);
                return (
                  <Button
                    key={d.getTime()}
                    type="button"
                    variant={
                      toDateString(d) === toDateString(selectedDate) ? "default" : "outline"
                    }
                    size="sm"
                    className="min-h-[40px]"
                    onClick={() => {
                      setSelectedDate(d);
                      setSelectedSlot(null);
                    }}
                    disabled={status === "submitting" || noAvailability}
                    title={noAvailability ? "No availability" : undefined}
                  >
                    {formatDateLabel(d)}
                  </Button>
                );
              })}
            </div>
          </div>

          <div role="group" aria-labelledby="time-label">
            <Label id="time-label" className="text-base">
              Start time
            </Label>
            {slotsLoading ? (
              <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                <Spinner className="size-4" />
                Loading available slots…
              </p>
            ) : slotsError ? (
              <p className="mt-2 text-sm text-destructive">
                Could not load slots. Try another date or refresh.
              </p>
            ) : selectableSlots.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No available slots this day. Try another date.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                {selectableSlots.map((slot) => {
                  const contiguous = contiguousBySlot.get(slot.start) ?? 0;
                  const cannotFit = contiguous < durationMinutes;
                  return (
                    <Button
                      key={slot.start}
                      type="button"
                      variant={selectedSlot?.start === slot.start ? "default" : "outline"}
                      size="lg"
                      className="min-h-[44px]"
                      onClick={() => setSelectedSlot(slot)}
                      disabled={status === "submitting" || cannotFit}
                      title={cannotFit ? `Only ${contiguous} min available from this time` : undefined}
                    >
                      {formatTime12h(new Date(slot.start))}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          <div role="group" aria-labelledby="duration-label">
            <Label id="duration-label" className="text-base">
              Duration
            </Label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((min) => {
                const selectedContiguous = selectedSlot
                  ? contiguousBySlot.get(selectedSlot.start) ?? 0
                  : 0;
                const noSlotSupports =
                  !selectedSlot && !selectableSlots.some((s) => (contiguousBySlot.get(s.start) ?? 0) >= min);
                const exceedsSelectedSlot = !!(selectedSlot && selectedContiguous < min);
                const durationDisabled =
                  status === "submitting" || noSlotSupports || exceedsSelectedSlot;
                return (
                  <Button
                    key={min}
                    type="button"
                    variant={durationMinutes === min ? "default" : "outline"}
                    size="lg"
                    className="min-h-[44px]"
                    onClick={() => setDurationMinutes(min)}
                    disabled={durationDisabled}
                    title={
                      durationDisabled
                        ? selectedSlot
                          ? `Selected time has only ${selectedContiguous} min available`
                          : "No start time has this much availability"
                        : undefined
                    }
                  >
                    {min} min
                  </Button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="title" className="text-base">
              Meeting title (optional)
            </Label>
            <Input
              id="title"
              type="text"
              placeholder="e.g. Team standup"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 min-h-[44px]"
              disabled={status === "submitting"}
            />
          </div>

          <div role="group" aria-labelledby="attendees-label">
            <Label id="attendees-label" className="text-base">
              Invite people (optional)
            </Label>
            {attendeesLoading ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
            ) : attendees.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No directory list. Add User.Read.All permission and admin consent to show colleagues.
              </p>
            ) : (
              <>
                <Popover open={inviteOpen} onOpenChange={setInviteOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 min-h-[44px] w-full justify-between"
                      disabled={status === "submitting"}
                      aria-label="Open invite people list"
                    >
                      <span className="truncate">
                        {selectedAttendeeEmails.size > 0
                          ? `${selectedAttendeeEmails.size} selected`
                          : "Select people to invite"}
                      </span>
                      <span className="text-muted-foreground" aria-hidden="true">
                        {inviteOpen ? "Close" : "Open"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                    <Input
                      type="search"
                      placeholder="Search by name or email"
                      value={attendeeSearch}
                      onChange={(e) => setAttendeeSearch(e.target.value)}
                      className="min-h-[40px]"
                      disabled={status === "submitting"}
                      aria-label="Search invite list by name or email"
                    />
                    <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-border p-1 space-y-1">
                      {filteredAttendees.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">No matches found</p>
                      ) : (
                        filteredAttendees.map((u) => {
                          const isSelected = selectedAttendeeEmails.has(u.mail);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => toggleAttendee(u.mail)}
                              className={cn(
                                "w-full rounded-lg px-3 py-2 text-left text-sm flex items-center gap-2",
                                isSelected ? "bg-primary/15 border border-primary/50" : "hover:bg-muted/50"
                              )}
                            >
                              <span
                                className={cn(
                                  "size-4 rounded border flex shrink-0",
                                  isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                                )}
                              />
                              <span className="truncate">{u.displayName}</span>
                              <span className="text-muted-foreground text-xs truncate shrink-0 max-w-[140px]">
                                {u.mail}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>

          {selectedSlot && (
            <p className="text-sm text-muted-foreground">
              Starting at {formatTime12h(new Date(selectedSlot.start))} for {durationMinutes}{" "}
              minutes
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="min-h-[48px] w-full"
            disabled={status === "submitting" || !selectedSlot || slotsLoading}
          >
            {status === "submitting" ? (
              <>
                <Spinner className="size-5" />
                Reserving…
              </>
            ) : (
              "Reserve room"
            )}
          </Button>
        </form>
      </main>
    </div>
  );
}
