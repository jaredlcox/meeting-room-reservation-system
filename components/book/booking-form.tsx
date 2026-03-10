"use client";

import { useState } from "react";
import Link from "next/link";
import type { Room } from "@/lib/rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const DURATION_OPTIONS = [15, 30, 45, 60] as const;

type SubmitStatus = "idle" | "submitting" | "success" | "error";

interface BookingFormProps {
  room: Room;
}

export function BookingForm({ room }: BookingFormProps) {
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");

    // Payload shape for future POST /api/rooms/[slug]/reserve:
    // { durationMinutes, title: title.trim() || undefined }
    // Mock submission. Later: replace with:
    // const res = await fetch(`/api/rooms/${room.slug}/reserve`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ durationMinutes, title: title.trim() || undefined }),
    // });
    // if (res.ok) setStatus("success"); else setStatus("error");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setStatus("success");
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
        </header>

        <p className="text-sm text-muted-foreground mb-6">
          Check the display outside the room for live availability, or book now
          to reserve.
        </p>

        {status === "error" && (
          <div
            className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            Something went wrong. Please try again.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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

          <Button
            type="submit"
            size="lg"
            className="min-h-[48px] w-full"
            disabled={status === "submitting"}
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
