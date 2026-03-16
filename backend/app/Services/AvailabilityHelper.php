<?php

namespace App\Services;

class AvailabilityHelper
{
    public static function getCurrentAndNext(array $meetings, int $nowMinutes): array
    {
        $currentMeeting = null;
        $nextMeeting = null;

        foreach ($meetings as $m) {
            if ($m['startMinutes'] <= $nowMinutes && $nowMinutes < $m['endMinutes']) {
                $currentMeeting = $m;
            }
            if ($m['startMinutes'] > $nowMinutes && $nextMeeting === null) {
                $nextMeeting = $m;
            }
        }

        return ['currentMeeting' => $currentMeeting, 'nextMeeting' => $nextMeeting];
    }

    public static function getAvailability(array $meetings, int $nowMinutes): array
    {
        $result = self::getCurrentAndNext($meetings, $nowMinutes);
        $current = $result['currentMeeting'];
        $next = $result['nextMeeting'];

        $status = $current ? 'busy' : 'available';

        if ($status === 'available') {
            $label = $next
                ? 'Available Until ' . $next['startTime']
                : 'Available All Day';
        } elseif ($current) {
            $label = 'In Use Until ' . $current['endTime'];
        } else {
            $label = '';
        }

        return [
            'status' => $status,
            'label' => $label,
            'currentMeeting' => $current,
            'nextMeeting' => $next,
        ];
    }
}
