<?php

namespace App\Services;

use DateTime;
use DateTimeZone;

class TimeHelper
{
    public static function minutesSinceMidnight(DateTime $date): int
    {
        return (int) $date->format('G') * 60 + (int) $date->format('i');
    }

    public static function minutesSinceMidnightInZone(DateTime $date, string $timeZone): int
    {
        $tz = new DateTimeZone($timeZone);
        $local = $date->setTimezone($tz);
        return (int) $local->format('G') * 60 + (int) $local->format('i');
    }

    /** @return array{start: DateTime, end: DateTime} */
    public static function getDayBounds(DateTime $date): array
    {
        $start = clone $date;
        $start->setTime(0, 0, 0, 0);
        $end = clone $date;
        $end->setTime(23, 59, 59, 999000);
        return ['start' => $start, 'end' => $end];
    }

    public static function formatTime12h(DateTime $date): string
    {
        return $date->format('g:i A');
    }

    /** Format minutes since midnight as "10:30 AM" */
    public static function formatMinutes12h(int $minutes): string
    {
        $hour24 = (int) floor($minutes / 60) % 24;
        $minute = $minutes % 60;
        $suffix = $hour24 >= 12 ? 'PM' : 'AM';
        $hour12 = $hour24 % 12 ?: 12;
        return sprintf('%d:%02d %s', $hour12, $minute, $suffix);
    }
}
