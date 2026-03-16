"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { apiPost } from "@/lib/api-client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface QuickBookProps {
  roomSlug: string;
  options: number[];
  minutesUntilNext: number;
  /** When true, duration buttons are disabled; user should scan QR to book later */
  hasCurrentMeeting?: boolean;
  /** Called after a quick book is created so the kiosk can refresh schedule */
  onBooked?: () => void;
}

export function QuickBook({ roomSlug, options, minutesUntilNext, hasCurrentMeeting = false, onBooked }: QuickBookProps) {
  const [step, setStep] = useState<"duration" | "notes" | "submitting" | "done" | "error">("duration");
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [meetingNotes, setMeetingNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleDurationClick(min: number) {
    setSelectedDuration(min);
    setStep("notes");
    setErrorMessage(null);
  }

  async function handleSubmit() {
    if (selectedDuration == null) return;
    setStep("submitting");
    setErrorMessage(null);
    try {
      const res = await apiPost(`/api/rooms/${roomSlug}/quick-book`, {
        startNow: true,
        durationMinutes: selectedDuration,
        attendeeEmails: [],
        title: meetingNotes.trim() || "Quick booking",
      });
      if (res.ok) {
        setStep("done");
        setMeetingNotes("");
        onBooked?.();
        setTimeout(() => {
          setStep("duration");
          setSelectedDuration(null);
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
    if (step === "notes") {
      setStep("duration");
      setSelectedDuration(null);
      setMeetingNotes("");
    } else if (step === "error") {
      setStep("notes");
      setErrorMessage(null);
    }
  }

  if (step === "done") {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col items-center justify-center gap-3 min-h-[160px]">
        <p className="text-lg font-semibold text-[var(--status-available-fg)]">Booked!</p>
        <p className="text-sm text-muted-foreground text-center">
          {selectedDuration} min starting now
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5 min-w-0 flex flex-col">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        Quick Book
      </p>

      {step === "duration" && (
        <div className="flex flex-col gap-3 flex-1">
          {hasCurrentMeeting ? (
            <p className="text-sm text-muted-foreground">
              A meeting is in progress. Scan the QR code to book a time in the future.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {options.map((min) => {
                  const disabled = min > minutesUntilNext;
                  return (
                    <Button
                      key={min}
                      size="lg"
                      variant={disabled ? "secondary" : "default"}
                      disabled={disabled}
                      onClick={() => handleDurationClick(min)}
                      aria-label={`Book for ${min} minutes`}
                      className={cn(
                        "min-h-[56px] text-base font-semibold rounded-xl transition-all duration-200",
                        "shadow-md hover:shadow-lg active:scale-[0.98]",
                        disabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {min} min
                    </Button>
                  );
                })}
              </div>
              {minutesUntilNext < 60 && (
                <p className="text-xs text-muted-foreground">
                  Options longer than available time are disabled
                </p>
              )}
            </>
          )}
        </div>
      )}

      {step === "notes" && (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <p className="text-sm text-muted-foreground">
            {selectedDuration} min · starting now
          </p>
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            <label htmlFor="quickbook-notes" className="text-sm font-medium text-foreground">
              Meeting notes (optional)
            </label>
            <Textarea
              id="quickbook-notes"
              placeholder="e.g. Team standup, client call…"
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              className="min-h-[88px] resize-none rounded-xl text-base"
              disabled={step === "submitting"}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-[48px] rounded-xl flex-1"
              onClick={handleBack}
              disabled={step === "submitting"}
            >
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-h-[48px] rounded-xl flex-[2] font-semibold shadow-md hover:shadow-lg"
              onClick={handleSubmit}
              disabled={step === "submitting"}
            >
              {step === "submitting" ? "Booking…" : "Book room"}
            </Button>
          </div>
        </div>
      )}

      {step === "submitting" && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <p className="text-sm text-muted-foreground">Booking…</p>
        </div>
      )}

      {step === "error" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-destructive">{errorMessage}</p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-[48px] rounded-xl w-full"
            onClick={handleBack}
          >
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
