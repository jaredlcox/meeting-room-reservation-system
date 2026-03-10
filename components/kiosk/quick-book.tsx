"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { formatTime12h } from "@/lib/time";
import type { TimeSlot, SlotsResponse } from "@/lib/api-types";

interface DirectoryUser {
  id: string;
  displayName: string;
  mail: string | null;
}

interface QuickBookProps {
  roomSlug: string;
  options: number[];
  minutesUntilNext: number;
}

const ALLOWED_INVITE_DOMAINS = ["integrityhomeexteriors.com", "ircuwd.com"];
function isAllowedInviteEmail(mail: string | null): boolean {
  if (!mail) return false;
  const lower = mail.toLowerCase();
  return ALLOWED_INVITE_DOMAINS.some((d) => lower.endsWith(d));
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function QuickBook({ roomSlug, options, minutesUntilNext }: QuickBookProps) {
  const [step, setStep] = useState<"duration" | "slot" | "participants" | "submitting" | "done" | "error">("duration");
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [participantSearch, setParticipantSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dateStr = useMemo(() => toDateString(selectedDate), [selectedDate]);
  const now = useMemo(() => new Date(), []);
  const isToday = selectedDate.getDate() === now.getDate() && selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear();
  const selectableSlots = useMemo(() => {
    if (!isToday) return slots;
    return slots.filter((s) => new Date(s.start) > now);
  }, [slots, isToday, now]);

  useEffect(() => {
    if (step !== "slot" || !selectedDuration) return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot(null);
    fetch(`/api/rooms/${roomSlug}/slots?date=${dateStr}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SlotsResponse | null) => setSlots(data?.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [roomSlug, dateStr, step, selectedDuration]);

  useEffect(() => {
    if (step !== "participants") return;
    setUsersLoading(true);
    fetch("/api/directory/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data: { users: DirectoryUser[] }) => {
        const all = data.users ?? [];
        setUsers(all.filter((u) => isAllowedInviteEmail(u.mail)));
      })
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }, [step]);

  function handleDurationClick(min: number) {
    setSelectedDuration(min);
    setStep("slot");
    setErrorMessage(null);
  }

  function handleSlotClick(slot: TimeSlot) {
    setSelectedSlot(slot);
    setStep("participants");
    setSelectedEmails(new Set());
    setErrorMessage(null);
  }

  function toggleUser(email: string) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function handleSubmit() {
    if (!selectedDuration || !selectedSlot) return;
    setStep("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/rooms/${roomSlug}/quick-book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: selectedSlot.start,
          durationMinutes: selectedDuration,
          attendeeEmails: Array.from(selectedEmails),
          title: "Quick booking",
        }),
      });
      if (res.ok) {
        setStep("done");
        setTimeout(() => {
          setStep("duration");
          setSelectedDuration(null);
          setSelectedSlot(null);
          setSelectedEmails(new Set());
        }, 2500);
      } else {
        const data = (await res.json()) as { error?: string };
        setErrorMessage(data.error ?? "Booking failed");
        setStep("error");
      }
    } catch {
      setErrorMessage("Something went wrong");
      setStep("error");
    }
  }

  function handleBack() {
    if (step === "slot") {
      setStep("duration");
      setSelectedDuration(null);
    } else if (step === "participants") {
      setStep("slot");
      setSelectedSlot(null);
    } else if (step === "error") {
      setStep("participants");
      setErrorMessage(null);
    }
  }

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  if (step === "done") {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5 flex flex-col items-center justify-center gap-3 min-h-[140px]">
        <p className="text-lg font-semibold text-[var(--status-available-fg)]">Booked!</p>
        <p className="text-sm text-muted-foreground text-center">
          {selectedDuration} min at {selectedSlot && formatTime12h(new Date(selectedSlot.start))}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5 pb-6 sm:pb-5 min-w-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        Quick Book
      </p>

      {step === "duration" && (
        <div className="grid grid-cols-2 gap-3">
          {options.map((min) => {
            const disabled = min > minutesUntilNext;
            return (
              <button
                key={min}
                disabled={disabled}
                onClick={() => handleDurationClick(min)}
                aria-label={`Book for ${min} minutes`}
                className={cn(
                  "rounded-xl py-4 text-sm font-semibold transition-all duration-150 select-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  disabled
                    ? "bg-secondary text-muted-foreground opacity-40 cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:opacity-90 active:scale-95 cursor-pointer shadow-sm"
                )}
              >
                {min} min
              </button>
            );
          })}
        </div>
      )}

      {step === "slot" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium",
                selectedDate.getDate() === now.getDate() ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(tomorrow)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium",
                selectedDate.getDate() === tomorrow.getDate() ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="rounded-lg px-3 py-1.5 text-xs font-medium bg-secondary text-muted-foreground"
            >
              Back
            </button>
          </div>
          {slotsLoading ? (
            <p className="text-sm text-muted-foreground">Loading slots…</p>
          ) : selectableSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No slots available. Try another day.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {selectableSlots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => handleSlotClick(slot)}
                  className={cn(
                    "rounded-xl py-2.5 text-sm font-medium",
                    selectedSlot?.start === slot.start
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  )}
                >
                  {formatTime12h(new Date(slot.start))}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "participants" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {selectedSlot && formatTime12h(new Date(selectedSlot.start))} for {selectedDuration} min
          </p>
          {usersLoading ? (
            <p className="text-sm text-muted-foreground">Loading participants…</p>
          ) : (
            <>
              <Input
                type="search"
                placeholder="Search by name or email"
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="min-h-[40px]"
                aria-label="Search participants by name or email"
              />
              <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5">
                {users
                  .filter(
                    (u) =>
                      u.mail &&
                      (!participantSearch.trim() ||
                        u.displayName.toLowerCase().includes(participantSearch.trim().toLowerCase()) ||
                        u.mail.toLowerCase().includes(participantSearch.trim().toLowerCase()))
                  )
                  .slice(0, 100)
                  .map((u) => {
                    const isSelected = selectedEmails.has(u.mail!);
                    return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.mail)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-left text-sm flex items-center gap-2",
                        isSelected ? "bg-primary/20 border border-primary" : "bg-secondary border border-transparent"
                      )}
                    >
                      <span className={cn("size-4 rounded border flex shrink-0", isSelected ? "bg-primary border-primary" : "border-muted-foreground")} />
                      <span className="truncate">{u.displayName}</span>
                      <span className="text-muted-foreground text-xs truncate shrink-0 max-w-[120px]">{u.mail}</span>
                    </button>
                    );
                  })}
              </div>
              {users.length === 0 && <p className="text-sm text-muted-foreground">No users loaded. You can still book without participants.</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-xl py-2.5 px-3 text-sm font-medium bg-secondary text-muted-foreground"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90"
                >
                  Book room
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === "submitting" && (
        <p className="text-sm text-muted-foreground py-4 text-center">Booking…</p>
      )}

      {step === "error" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-destructive">{errorMessage}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="rounded-xl py-2.5 px-3 text-sm font-medium bg-secondary"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === "duration" && minutesUntilNext < 60 && (
        <p className="text-xs text-muted-foreground mt-3">
          Options longer than available time are disabled
        </p>
      )}
    </div>
  );
}
