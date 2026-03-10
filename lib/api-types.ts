import type { Meeting, RoomStatus } from "@/components/kiosk/types";

export type { Meeting, RoomStatus };

export interface ScheduleResponse {
  meetings: Meeting[];
}

export interface AvailabilityResponse {
  status: RoomStatus;
  label: string;
  currentMeeting: Meeting | null;
  nextMeeting: Meeting | null;
}

export interface ReserveRequest {
  durationMinutes: number;
  title?: string;
  /** ISO date-time for start of reservation; if omitted, start is "now" */
  startTime?: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
}

export interface SlotsResponse {
  slots: TimeSlot[];
}

export interface ReserveResponse {
  success: true;
  eventId?: string;
}

export interface ApiErrorResponse {
  error: string;
}
