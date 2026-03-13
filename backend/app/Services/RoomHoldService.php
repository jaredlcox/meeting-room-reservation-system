<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class RoomHoldService
{
    private const DEFAULT_TTL_MINUTES = 30;
    private const CACHE_PREFIX = 'room_hold:';

    /**
     * @return array{roomSlug: string, startedAt: string, expiresAt: string, reason: 'manual-checkin'}
     */
    public function setHold(string $roomSlug, int $ttlMinutes = self::DEFAULT_TTL_MINUTES): array
    {
        $started = now();
        $expires = $started->copy()->addMinutes(max(1, $ttlMinutes));
        $hold = [
            'roomSlug' => $roomSlug,
            'startedAt' => $started->toIso8601String(),
            'expiresAt' => $expires->toIso8601String(),
            'reason' => 'manual-checkin',
        ];
        Cache::put(self::CACHE_PREFIX . $roomSlug, $hold, $expires);
        return $hold;
    }

    /**
     * @return array{roomSlug: string, startedAt: string, expiresAt: string, reason: string}|null
     */
    public function getActiveHold(string $roomSlug): ?array
    {
        $hold = Cache::get(self::CACHE_PREFIX . $roomSlug);
        if (!$hold) {
            return null;
        }
        $expiresAt = \Carbon\Carbon::parse($hold['expiresAt']);
        if ($expiresAt->isPast()) {
            Cache::forget(self::CACHE_PREFIX . $roomSlug);
            return null;
        }
        return $hold;
    }

    public function clearHold(string $roomSlug): void
    {
        Cache::forget(self::CACHE_PREFIX . $roomSlug);
    }

    public function isHoldActive(string $roomSlug): bool
    {
        return $this->getActiveHold($roomSlug) !== null;
    }
}
