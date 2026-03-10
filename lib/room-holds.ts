const DEFAULT_HOLD_TTL_MINUTES = 30;

export interface RoomHold {
  roomSlug: string;
  startedAt: string;
  expiresAt: string;
  reason: "manual-checkin";
}

const holds = new Map<string, RoomHold>();

function nowMs(): number {
  return Date.now();
}

function isExpired(hold: RoomHold): boolean {
  return new Date(hold.expiresAt).getTime() <= nowMs();
}

function pruneExpired(): void {
  for (const [slug, hold] of holds.entries()) {
    if (isExpired(hold)) holds.delete(slug);
  }
}

export function setHold(roomSlug: string, ttlMinutes = DEFAULT_HOLD_TTL_MINUTES): RoomHold {
  const started = new Date();
  const expires = new Date(started.getTime() + Math.max(1, ttlMinutes) * 60 * 1000);
  const hold: RoomHold = {
    roomSlug,
    startedAt: started.toISOString(),
    expiresAt: expires.toISOString(),
    reason: "manual-checkin",
  };
  holds.set(roomSlug, hold);
  return hold;
}

export function getActiveHold(roomSlug: string): RoomHold | null {
  pruneExpired();
  const hold = holds.get(roomSlug);
  if (!hold) return null;
  if (isExpired(hold)) {
    holds.delete(roomSlug);
    return null;
  }
  return hold;
}

export function clearHold(roomSlug: string): void {
  holds.delete(roomSlug);
}

export function isHoldActive(roomSlug: string): boolean {
  return getActiveHold(roomSlug) !== null;
}
