import { NextResponse } from "next/server";
import { getRoomBySlug } from "@/lib/rooms";
import { getMockSchedule } from "@/lib/mock-schedule";
import { getRoomAvailability, isGraphConfigured } from "@/lib/graph";
import { getAvailability } from "@/lib/availability";
import { getDayBounds, minutesSinceMidnight } from "@/lib/time";
import type { AvailabilityResponse } from "@/lib/api-types";
import { getActiveHold } from "@/lib/room-holds";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const room = getRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const activeHold = getActiveHold(slug);
  if (activeHold) {
    return NextResponse.json(
      {
        status: "busy",
        label: "In Use - Started early",
        currentMeeting: null,
        nextMeeting: null,
      } satisfies AvailabilityResponse
    );
  }

  let body: AvailabilityResponse;
  if (!isGraphConfigured()) {
    const meetings = getMockSchedule(slug);
    const now = new Date();
    const nowMinutes = minutesSinceMidnight(now);
    body = getAvailability(meetings, nowMinutes);
  } else {
    try {
      const { start, end } = getDayBounds(new Date());
      body = await getRoomAvailability(room.email, start, end);
    } catch (err) {
      console.warn("[availability] using mock data (Graph failed):", err);
      const meetings = getMockSchedule(slug);
      const now = new Date();
      const nowMinutes = minutesSinceMidnight(now);
      body = getAvailability(meetings, nowMinutes);
    }
  }

  return NextResponse.json(body);
}
