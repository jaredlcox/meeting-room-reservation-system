/**
 * Microsoft Graph calendar integration.
 * Phase 6: implement getRoomCalendarView / getRoomAvailability using Graph calendar API.
 * Phase 7: implement createRoomReservation and wire auth (getAccessToken, login redirect, callback).
 */

import type { Meeting } from "@/components/kiosk/types";
import type { AvailabilityResponse } from "@/lib/api-types";

const GRAPH_NOT_CONFIGURED = "Microsoft Graph not configured";

function isGraphConfigured(): boolean {
  return process.env.MICROSOFT_GRAPH_ENABLED === "true" && !!process.env.AZURE_CLIENT_ID;
}

/**
 * Get calendar view for a room mailbox (events in the given time range).
 * Phase 6: call Graph API /users/{roomEmail}/calendarView with start and end.
 * @returns List of meetings in the app's Meeting shape (id, subject, organizer, startTime, endTime, startMinutes, endMinutes).
 */
export async function getRoomCalendarView(
  _roomEmail: string,
  _start: Date,
  _end: Date
): Promise<Meeting[]> {
  if (!isGraphConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[graph] " + GRAPH_NOT_CONFIGURED + "; returning empty calendar view.");
    }
    return [];
  }
  throw new Error(GRAPH_NOT_CONFIGURED);
}

/**
 * Get current availability for a room (status, current meeting, next meeting, label).
 * Phase 6: use getRoomCalendarView then derive availability with getAvailability() from lib/availability.
 */
export async function getRoomAvailability(
  _roomEmail: string,
  _start: Date,
  _end: Date
): Promise<AvailabilityResponse> {
  if (!isGraphConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[graph] " + GRAPH_NOT_CONFIGURED + "; returning empty availability.");
    }
    return {
      status: "available",
      label: "Available All Day",
      currentMeeting: null,
      nextMeeting: null,
    };
  }
  throw new Error(GRAPH_NOT_CONFIGURED);
}

/**
 * Create a reservation (calendar event) for the room.
 * Phase 7: call Graph API to create event in room calendar; optionally set organizer and subject.
 */
export async function createRoomReservation(
  _roomEmail: string,
  _start: Date,
  _end: Date,
  _subject?: string,
  _organizerEmail?: string
): Promise<{ success: true; eventId?: string }> {
  if (!isGraphConfigured()) {
    throw new Error(GRAPH_NOT_CONFIGURED);
  }
  throw new Error(GRAPH_NOT_CONFIGURED);
}
