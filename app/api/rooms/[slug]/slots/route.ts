import { NextResponse } from "next/server";
import { getRoomBySlug } from "@/lib/rooms";
import { getRoomCalendarView, isGraphConfigured } from "@/lib/graph";
import type { Meeting } from "@/components/kiosk/types";

type RouteParams = { params: Promise<{ slug: string }> };

const SLOT_MINUTES = 15;
const BUSINESS_START_MINUTES = 8 * 60; // 8:00
const BUSINESS_END_MINUTES = 18 * 60; // 18:00

function parseDateQuery(dateStr: string | null): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = parseInt(y!, 10);
  const month = parseInt(m!, 10) - 1;
  const day = parseInt(d!, 10);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

function isPastDay(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function slotOverlapsMeeting(
  slotStartMin: number,
  slotEndMin: number,
  meeting: Meeting
): boolean {
  return meeting.startMinutes < slotEndMin && meeting.endMinutes > slotStartMin;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const room = getRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const date = parseDateQuery(dateParam);
  if (!date) {
    return NextResponse.json(
      { error: "Invalid or missing date. Use ?date=YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (isPastDay(date)) {
    return NextResponse.json(
      { error: "Date must be today or in the future" },
      { status: 400 }
    );
  }

  const { start: dayStart, end: dayEnd } = dayBounds(date);

  let meetings: Meeting[] = [];
  if (isGraphConfigured()) {
    try {
      meetings = await getRoomCalendarView(room.email, dayStart, dayEnd);
    } catch (err) {
      console.warn("[slots] getRoomCalendarView failed:", err);
    }
  }

  const slots: { start: string; end: string; startMinutes: number; endMinutes: number }[] = [];
  for (
    let startMin = BUSINESS_START_MINUTES;
    startMin + SLOT_MINUTES <= BUSINESS_END_MINUTES;
    startMin += SLOT_MINUTES
  ) {
    const endMin = startMin + SLOT_MINUTES;
    const isAvailable = !meetings.some((m) => slotOverlapsMeeting(startMin, endMin, m));
    if (!isAvailable) continue;

    const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    slotStart.setMinutes(slotStart.getMinutes() + startMin);
    const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60 * 1000);
    slots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      startMinutes: startMin,
      endMinutes: endMin,
    });
  }

  return NextResponse.json({ slots });
}
