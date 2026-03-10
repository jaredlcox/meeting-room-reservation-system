import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getRoomBySlug } from "@/lib/rooms";
import { getRoomCalendarView, createRoomReservation, isGraphConfigured } from "@/lib/graph";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import type { ReserveRequest, ReserveResponse } from "@/lib/api-types";
import { isHoldActive } from "@/lib/room-holds";

const VALID_DURATIONS = [15, 30, 45, 60] as const;

type RouteParams = { params: Promise<{ slug: string }> };

const MAX_DAYS_AHEAD = 7;

function hasOverlappingMeeting(meetings: { startMinutes: number; endMinutes: number }[], start: Date, end: Date): boolean {
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  return meetings.some((m) => m.startMinutes < endMinutes && m.endMinutes > startMinutes);
}

function parseBody(body: unknown): ReserveRequest | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const durationMinutes = o.durationMinutes;
  if (
    typeof durationMinutes !== "number" ||
    !VALID_DURATIONS.includes(durationMinutes as (typeof VALID_DURATIONS)[number])
  ) {
    return null;
  }
  const title =
    o.title === undefined || o.title === null
      ? undefined
      : typeof o.title === "string"
        ? o.title
        : undefined;
  const startTime =
    o.startTime === undefined || o.startTime === null
      ? undefined
      : typeof o.startTime === "string"
        ? o.startTime.trim() || undefined
        : undefined;
  const attendeeEmails = Array.isArray(o.attendeeEmails)
    ? (o.attendeeEmails as unknown[]).filter((e): e is string => typeof e === "string" && e.length > 0)
    : undefined;
  return { durationMinutes: durationMinutes as number, title, startTime, attendeeEmails };
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
      { error: "Room was started early at the kiosk and is temporarily unavailable." },
      { status: 409 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Sign in required" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "durationMinutes must be 15, 30, 45, or 60" },
      { status: 400 }
    );
  }

  let start: Date;
  let end: Date;
  if (parsed.startTime) {
    const validated = parseAndValidateStartTime(parsed.startTime);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    start = validated.start;
    end = new Date(start.getTime() + parsed.durationMinutes * 60 * 1000);
  } else {
    const now = new Date();
    start = new Date(now);
    end = new Date(now.getTime() + parsed.durationMinutes * 60 * 1000);
  }

  let eventId: string | undefined;
  if (isGraphConfigured()) {
    try {
      const meetings = await getRoomCalendarView(room.email, start, end);
      if (hasOverlappingMeeting(meetings, start, end)) {
        return NextResponse.json(
          { error: "Room is not available for that time." },
          { status: 409 }
        );
      }

      const organizerEmail = session.user.email;
      const allAttendees = [
        organizerEmail,
        ...(parsed.attendeeEmails ?? []).filter((e) => e !== organizerEmail),
      ];
      const result = await createRoomReservation(
        room.email,
        start,
        end,
        parsed.title ?? "Quick booking",
        organizerEmail,
        allAttendees
      );
      eventId = result.eventId;
    } catch (err) {
      console.error("[reserve] createRoomReservation failed:", err);
      return NextResponse.json(
        { error: "Could not create reservation. Please try again." },
        { status: 502 }
      );
    }
  }

  const response: ReserveResponse = { success: true, ...(eventId && { eventId }) };
  return NextResponse.json(response, { status: 201 });
}
