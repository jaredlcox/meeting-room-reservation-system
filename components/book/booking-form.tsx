"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import type { Session } from "next-auth";
import type { Room } from "@/lib/rooms";
import type { TimeSlot, SlotsResponse } from "@/lib/api-types";
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
  session: Session | null;
}

export function BookingForm({ room, session }: BookingFormProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [title, setTitle] = useState("");
  const [attendees, setAttendees] = useState<DirectoryUser[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [selectedAttendeeEmails, setSelectedAttendeeEmails] = useState<Set<string>>(new Set());
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");

  const dateStr = useMemo(() => toDateString(selectedDate), [selectedDate]);

  useEffect(() => {
    setAttendeesLoading(true);
    fetch("/api/directory/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data: { users: DirectoryUser[] }) => {
        const all = data.users ?? [];
        setAttendees(all.filter((u) => u.mail && isAllowedInviteEmail(u.mail)));
      })
      .catch(() => setAttendees([]))
      .finally(() => setAttendeesLoading(false));
  }, []);

  useEffect(() => {
    setSlotsLoading(true);
    setSlotsError(false);
    setSelectedSlot(null);
    fetch(`/api/rooms/${room.slug}/slots?date=${dateStr}`)
      .then((res) => {
        if (!res.ok) {
          setSlotsError(true);
          setSlots([]);
          return;
        }
        return res.json() as Promise<SlotsResponse>;
      })
      .then((data) => {
        if (data?.slots) setSlots(data.slots);
        else setSlots([]);
      })
      .catch(() => {
        setSlotsError(true);
        setSlots([]);
      })
      .finally(() => setSlotsLoading(false));
  }, [room.slug, dateStr]);

  const now = useMemo(() => new Date(), []);
  const selectableSlots = useMemo(() => {
    if (!isToday(selectedDate)) return slots;
    return slots.filter((s) => new Date(s.start) > now);
  }, [slots, selectedDate, now]);

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
    const res = await fetch(`/api/rooms/${room.slug}/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
              onClick={() => signIn("azure-ad", { callbackUrl: `/book/${room.slug}` })}
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
          <p className="text-sm text-muted-foreground mt-0.5">
            Quick book
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {session.user?.name ?? session.user?.email ?? "Signed in"}{" "}
            <button
              type="button"
              onClick={() => signOut()}
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
              {dateOptions.map((d) => (
                <Button
                  key={d.getTime()}
                  type="button"
                  variant={
                    toDateString(d) === toDateString(selectedDate) ? "default" : "outline"
                  }
                  size="sm"
                  className="min-h-[40px]"
                  onClick={() => setSelectedDate(d)}
                  disabled={status === "submitting"}
                >
                  {formatDateLabel(d)}
                </Button>
              ))}
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
                {selectableSlots.map((slot) => (
                  <Button
                    key={slot.start}
                    type="button"
                    variant={selectedSlot?.start === slot.start ? "default" : "outline"}
                    size="lg"
                    className="min-h-[44px]"
                    onClick={() => setSelectedSlot(slot)}
                    disabled={status === "submitting"}
                  >
                    {formatTime12h(new Date(slot.start))}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div role="group" aria-labelledby="duration-label">
            <Label id="duration-label" className="text-base">
              Duration
            </Label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((min) => (
                <Button
                  key={min}
                  type="button"
                  variant={durationMinutes === min ? "default" : "outline"}
                  size="lg"
                  className="min-h-[44px]"
                  onClick={() => setDurationMinutes(min)}
                  disabled={status === "submitting"}
                >
                  {min} min
                </Button>
              ))}
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
                <Input
                  type="search"
                  placeholder="Search by name or email"
                  value={attendeeSearch}
                  onChange={(e) => setAttendeeSearch(e.target.value)}
                  className="mt-2 min-h-[40px]"
                  disabled={status === "submitting"}
                  aria-label="Search invite list by name or email"
                />
                <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                  {attendees
                    .filter(
                      (u) =>
                        !attendeeSearch.trim() ||
                        u.displayName.toLowerCase().includes(attendeeSearch.trim().toLowerCase()) ||
                        u.mail.toLowerCase().includes(attendeeSearch.trim().toLowerCase())
                    )
                    .slice(0, 100)
                    .map((u) => {
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
                })}
                </div>
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
