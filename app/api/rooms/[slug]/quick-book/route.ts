import { NextResponse } from "next/server";
import { getRoomBySlug } from "@/lib/rooms";
import {
  getRoomCalendarView,
  createRoomReservation,
  isGraphConfigured,
} from "@/lib/graph";
import { isHoldActive } from "@/lib/room-holds";

const VALID_DURATIONS = [15, 30] as const;
const MAX_DAYS_AHEAD = 7;

function hasOverlappingMeeting(meetings: { startMinutes: number; endMinutes: number }[], start: Date, end: Date): boolean {
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  return meetings.some((m) => m.startMinutes < endMinutes && m.endMinutes > startMinutes);
}

type RouteParams = { params: Promise<{ slug: string }> };

function parseBody(body: unknown): {
  startTime: string;
  durationMinutes: number;
  attendeeEmails: string[];
  title?: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const startTime = typeof o.startTime === "string" ? o.startTime.trim() : undefined;
  const durationMinutes = o.durationMinutes;
  if (
    !startTime ||
    typeof durationMinutes !== "number" ||
    !VALID_DURATIONS.includes(durationMinutes as (typeof VALID_DURATIONS)[number])
  ) {
    return null;
  }
  let attendeeEmails: string[] = [];
  if (Array.isArray(o.attendeeEmails)) {
    attendeeEmails = o.attendeeEmails.filter(
      (e): e is string => typeof e === "string" && e.length > 0
    );
  }
  const title =
    o.title === undefined || o.title === null
      ? undefined
      : typeof o.title === "string"
        ? o.title.trim() || undefined
        : undefined;
  return { startTime, durationMinutes, attendeeEmails, title };
}

function parseAndValidateStartTime(startTime: string): { start: Date } | { error: string } {
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) {
    return { error: "Invalid startTime" };
  }
  const now = new Date();
  if (start.getTime() < now.getTime()) {
    return { error: "startTime must be in the future" };
  }
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD);
  if (start.getTime() > maxDate.getTime()) {
    return { error: `startTime must be within the next ${MAX_DAYS_AHEAD} days` };
  }
  return { start };
}

export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const room = getRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isHoldActive(slug)) {
    return NextResponse.json(
      { error: "Room was started early and is temporarily unavailable." },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "startTime and durationMinutes (15 or 30) required" },
      { status: 400 }
    );
  }

  const validated = parseAndValidateStartTime(parsed.startTime);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const start = validated.start;
  const end = new Date(start.getTime() + parsed.durationMinutes * 60 * 1000);

  if (!isGraphConfigured()) {
    return NextResponse.json(
      { error: "Booking is not configured" },
      { status: 503 }
    );
  }

  try {
    const meetings = await getRoomCalendarView(room.email, start, end);
    if (hasOverlappingMeeting(meetings, start, end)) {
      return NextResponse.json(
        { error: "Room is not available for that time." },
        { status: 409 }
      );
    }

    await createRoomReservation(
      room.email,
      start,
      end,
      parsed.title ?? "Quick booking",
      undefined,
      parsed.attendeeEmails.length > 0 ? parsed.attendeeEmails : undefined
    );
  } catch (err) {
    console.error("[quick-book] createRoomReservation failed:", err);
    return NextResponse.json(
      { error: "Could not create reservation. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
