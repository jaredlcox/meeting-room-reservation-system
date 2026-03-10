import { NextResponse } from "next/server";
import { endRoomEventNow, getRoomCalendarView, isGraphConfigured } from "@/lib/graph";
import { getRoomBySlug } from "@/lib/rooms";
import { clearHold } from "@/lib/room-holds";
import { getDayBounds } from "@/lib/time";

type RouteParams = { params: Promise<{ slug: string }> };

function minutesNowInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const room = getRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isGraphConfigured()) {
    return NextResponse.json(
      { error: "Stopping meetings requires Microsoft Graph configuration." },
      { status: 503 }
    );
  }

  const now = new Date();
  const roomTimeZone = process.env.ROOM_TIMEZONE?.trim() || "America/New_York";
  const nowMinutes = minutesNowInTimeZone(now, roomTimeZone);

  try {
    const { start, end } = getDayBounds(now);
    const meetings = await getRoomCalendarView(room.email, start, end);
    const activeMeeting = meetings.find(
      (m) => m.startMinutes <= nowMinutes && m.endMinutes > nowMinutes
    );
    if (!activeMeeting) {
      return NextResponse.json(
        { error: "No active meeting to stop right now." },
        { status: 409 }
      );
    }
    await endRoomEventNow(room.email, activeMeeting.id, now);
    clearHold(slug);
    return NextResponse.json({ success: true, endedEventId: activeMeeting.id });
  } catch (err) {
    console.error("[end-active] failed:", err);
    return NextResponse.json(
      { error: "Could not stop the active meeting. Please try again." },
      { status: 502 }
    );
  }
}
