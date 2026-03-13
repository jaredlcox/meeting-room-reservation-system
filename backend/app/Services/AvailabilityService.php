<?php

namespace App\Services;

/**
 * Compute room availability (status, label, current/next meeting) from a list of meetings.
 */
class AvailabilityService
{
    /**
     * @param array<int, array{id: string, subject: string, organizer: string, startTime: string, endTime: string, startMinutes: int, endMinutes: int}> $meetings
     * @return array{status: 'available'|'busy', label: string, currentMeeting: array|null, nextMeeting: array|null}
     */
    public static function getAvailability(array $meetings, int $nowMinutes): array
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
        $status = $currentMeeting ? 'busy' : 'available';
        $label = self::getStatusLabel($status, $currentMeeting, $nextMeeting);
        return [
            'status' => $status,
            'label' => $label,
            'currentMeeting' => $currentMeeting,
            'nextMeeting' => $nextMeeting,
        ];
    }

    /**
     * @param array|null $currentMeeting
     * @param array|null $nextMeeting
     */
    private static function getStatusLabel(string $status, $currentMeeting, $nextMeeting): string
    {
        if ($status === 'available') {
            return $nextMeeting
                ? 'Available Until ' . $nextMeeting['startTime']
                : 'Available All Day';
        }
        if ($currentMeeting) {
            return 'In Use Until ' . $currentMeeting['endTime'];
        }
        return '';
    }
}
