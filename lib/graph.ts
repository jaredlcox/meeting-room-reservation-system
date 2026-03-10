/**
 * Microsoft Graph calendar integration.
 * Phase 6: implement getRoomCalendarView / getRoomAvailability using Graph calendar API.
 * Phase 7: createRoomReservation (app-only token); auth is NextAuth on the booking page.
 */

import type { Meeting } from "@/components/kiosk/types";
import type { AvailabilityResponse } from "@/lib/api-types";
import { getAvailability } from "@/lib/availability";
import { minutesSinceMidnight } from "@/lib/time";

const GRAPH_NOT_CONFIGURED = "Microsoft Graph not configured";

/** Format a Date in the given IANA timezone for Graph API (local time string). */
function formatInTimeZone(date: Date, timeZone: string): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = f.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

const TOKEN_URL = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

let tokenCache: { token: string; expiresAt: number } | null = null;
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export function isGraphConfigured(): boolean {
  return (
    process.env.MICROSOFT_GRAPH_ENABLED === "true" &&
    !!process.env.AZURE_CLIENT_ID &&
    !!process.env.AZURE_TENANT_ID &&
    !!process.env.AZURE_CLIENT_SECRET
  );
}

/**
 * Get an app-only (client credentials) access token for Microsoft Graph.
 * Cached in memory; refreshed when expired or within 5 minutes of expiry.
 */
export async function getGraphAccessToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "[graph] getGraphAccessToken failed: missing AZURE_TENANT_ID, AZURE_CLIENT_ID, or AZURE_CLIENT_SECRET"
    );
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + EXPIRY_BUFFER_MS) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(TOKEN_URL(tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[graph] getGraphAccessToken failed:", res.status, text);
    throw new Error(`[graph] getGraphAccessToken failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  tokenCache = {
    token: data.access_token,
    expiresAt: now + expiresInMs,
  };
  return tokenCache.token;
}

interface GraphEvent {
  id?: string;
  subject?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  organizer?: { emailAddress?: { name?: string; address?: string } };
}

function parseMinutesFromGraphDateTime(dateTime: string): number | null {
  const m = /T(\d{2}):(\d{2})/.exec(dateTime);
  if (!m) return null;
  const hour = parseInt(m[1]!, 10);
  const minute = parseInt(m[2]!, 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatMinutes12h(minutes: number): string {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function mapGraphEventToMeeting(ev: GraphEvent): Meeting | null {
  const startDateTime = ev.start?.dateTime;
  const endDateTime = ev.end?.dateTime;
  if (!startDateTime || !endDateTime) return null;

  const startMinutes = parseMinutesFromGraphDateTime(startDateTime);
  const endMinutes = parseMinutesFromGraphDateTime(endDateTime);
  if (startMinutes === null || endMinutes === null) return null;

  const organizer =
    ev.organizer?.emailAddress?.name ||
    ev.organizer?.emailAddress?.address ||
    "Unknown";

  return {
    id: ev.id ?? crypto.randomUUID(),
    subject: ev.subject ?? "(No title)",
    organizer,
    startTime: formatMinutes12h(startMinutes),
    endTime: formatMinutes12h(endMinutes),
    startMinutes,
    endMinutes,
  };
}

/**
 * Get calendar view for a room mailbox (events in the given time range).
 * Returns list of meetings in the app's Meeting shape.
 * On failure or not configured, returns [] and logs.
 */
export async function getRoomCalendarView(
  roomEmail: string,
  start: Date,
  end: Date
): Promise<Meeting[]> {
  if (!isGraphConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[graph] " + GRAPH_NOT_CONFIGURED + "; returning empty calendar view.");
    }
    return [];
  }

  try {
    const token = await getGraphAccessToken();
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const encodedEmail = encodeURIComponent(roomEmail);
    const url = `${GRAPH_BASE}/users/${encodedEmail}/calendar/calendarView?startDateTime=${encodeURIComponent(startIso)}&endDateTime=${encodeURIComponent(endIso)}`;
    const roomTimeZone = process.env.ROOM_TIMEZONE?.trim() || "America/New_York";

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: `outlook.timezone="${roomTimeZone}"`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[graph] getRoomCalendarView failed:", res.status, text);
      return [];
    }

    const data = (await res.json()) as { value?: GraphEvent[] };
    const events = data.value ?? [];
    const meetings: Meeting[] = [];
    for (const ev of events) {
      const m = mapGraphEventToMeeting(ev);
      if (m) meetings.push(m);
    }
    meetings.sort((a, b) => a.startMinutes - b.startMinutes);
    return meetings;
  } catch (err) {
    console.error("[graph] getRoomCalendarView failed:", err);
    return [];
  }
}

const EMPTY_AVAILABILITY: AvailabilityResponse = {
  status: "available",
  label: "Available All Day",
  currentMeeting: null,
  nextMeeting: null,
};

/**
 * Get current availability for a room (status, current meeting, next meeting, label).
 * Uses getRoomCalendarView then getAvailability with server's current time.
 */
export async function getRoomAvailability(
  roomEmail: string,
  start: Date,
  end: Date
): Promise<AvailabilityResponse> {
  if (!isGraphConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[graph] " + GRAPH_NOT_CONFIGURED + "; returning empty availability.");
    }
    return EMPTY_AVAILABILITY;
  }

  try {
    const meetings = await getRoomCalendarView(roomEmail, start, end);
    const now = new Date();
    const nowMinutes = minutesSinceMidnight(now);
    return getAvailability(meetings, nowMinutes);
  } catch (err) {
    console.error("[graph] getRoomAvailability failed:", err);
    return EMPTY_AVAILABILITY;
  }
}

/**
 * Create a reservation (calendar event) for the room.
 * Uses app-only token; adds attendees when provided (or organizerEmail as single attendee).
 */
export async function createRoomReservation(
  roomEmail: string,
  start: Date,
  end: Date,
  subject?: string,
  organizerEmail?: string,
  attendeeEmailsParam?: string[]
): Promise<{ success: true; eventId?: string }> {
  if (!isGraphConfigured()) {
    throw new Error(GRAPH_NOT_CONFIGURED);
  }

  const token = await getGraphAccessToken();
  const encodedEmail = encodeURIComponent(roomEmail);
  const url = `${GRAPH_BASE}/users/${encodedEmail}/calendar/events`;

  const roomTimeZone = process.env.ROOM_TIMEZONE?.trim() || "America/New_York";
  const body: Record<string, unknown> = {
    subject: subject ?? "Quick booking",
    start: { dateTime: formatInTimeZone(start, roomTimeZone), timeZone: roomTimeZone },
    end: { dateTime: formatInTimeZone(end, roomTimeZone), timeZone: roomTimeZone },
  };

  const attendeeEmails = Array.isArray(attendeeEmailsParam) && attendeeEmailsParam.length > 0
    ? attendeeEmailsParam.filter((e): e is string => typeof e === "string" && e.length > 0)
    : organizerEmail
      ? [organizerEmail]
      : [];
  if (attendeeEmails.length > 0) {
    body.attendees = attendeeEmails.map((address) => ({
      emailAddress: { address },
      type: "required" as const,
    }));
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[graph] createRoomReservation failed:", res.status, text);
    throw new Error(`[graph] createRoomReservation failed: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  return { success: true, eventId: data.id };
}

export interface DirectoryUser {
  id: string;
  displayName: string;
  mail: string;
}

/**
 * List users from Microsoft 365 directory (Entra ID).
 * Requires application permission User.Read.All (or Directory.Read.All) and admin consent.
 * Uses mail or userPrincipalName as the invite address.
 */
export async function getDirectoryUsers(): Promise<DirectoryUser[]> {
  if (!isGraphConfigured()) {
    return [];
  }
  try {
    const token = await getGraphAccessToken();
    const url = `${GRAPH_BASE}/users?$select=id,displayName,mail,userPrincipalName&$top=500`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[graph] getDirectoryUsers failed:", res.status, text);
      if (res.status === 403) {
        throw new Error(
          "User.Read.All or Directory.Read.All application permission is required, with admin consent. Some tenants also require allowedToReadOtherUsers in the authorization policy."
        );
      }
      return [];
    }
    const data = (await res.json()) as {
      value?: Array<{ id?: string; displayName?: string; mail?: string | null; userPrincipalName?: string | null }>;
    };
    const list = data.value ?? [];
    return list
      .filter((u) => u.id && (u.mail || u.userPrincipalName))
      .map((u) => ({
        id: u.id!,
        displayName: u.displayName ?? u.userPrincipalName ?? "",
        mail: (u.mail ?? u.userPrincipalName) as string,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  } catch (err) {
    console.error("[graph] getDirectoryUsers failed:", err);
    return [];
  }
}
