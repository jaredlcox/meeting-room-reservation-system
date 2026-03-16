<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class RoomHoldService
{
    private const DEFAULT_HOLD_TTL_MINUTES = 30;

    private static function cacheKey(string $roomSlug): string
    {
        return "room_hold:{$roomSlug}";
    }

    public static function setHold(string $roomSlug, int $ttlMinutes = self::DEFAULT_HOLD_TTL_MINUTES): array
    {
        $started = now();
        $expires = $started->copy()->addMinutes(max(1, $ttlMinutes));

        $hold = [
            'roomSlug' => $roomSlug,
            'startedAt' => $started->toISOString(),
            'expiresAt' => $expires->toISOString(),
            'reason' => 'manual-checkin',
        ];

        Cache::put(self::cacheKey($roomSlug), $hold, $expires);

        return $hold;
    }

    public static function getActiveHold(string $roomSlug): ?array
    {
        $hold = Cache::get(self::cacheKey($roomSlug));
        if (!$hold) {
            return null;
        }

        if (now()->gte($hold['expiresAt'])) {
            Cache::forget(self::cacheKey($roomSlug));
            return null;
        }

        return $hold;
    }

    public static function clearHold(string $roomSlug): void
    {
        Cache::forget(self::cacheKey($roomSlug));
    }

    public static function isHoldActive(string $roomSlug): bool
    {
        return self::getActiveHold($roomSlug) !== null;
    }
}
