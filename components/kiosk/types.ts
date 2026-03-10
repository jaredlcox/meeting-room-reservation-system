export type RoomStatus = "available" | "busy" | "ending-soon";

export interface Meeting {
  id: string;
  subject: string;
  organizer: string;
  startTime: string;
  endTime: string;
  /** Start time expressed as total minutes since midnight, e.g. 9*60+30 = 570 */
  startMinutes: number;
  /** End time expressed as total minutes since midnight */
  endMinutes: number;
}
