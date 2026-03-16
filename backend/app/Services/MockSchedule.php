<?php

namespace App\Services;

class MockSchedule
{
    private static array $schedules = [
        'canvass' => [
            ['id' => 'c1', 'subject' => 'Q2 Brand Strategy Review', 'organizer' => 'Sarah Mitchell', 'startTime' => '10:00 AM', 'endTime' => '11:00 AM', 'startMinutes' => 600, 'endMinutes' => 660],
            ['id' => 'c2', 'subject' => 'Product Design Sync', 'organizer' => 'James Okafor', 'startTime' => '11:30 AM', 'endTime' => '12:30 PM', 'startMinutes' => 690, 'endMinutes' => 750],
            ['id' => 'c3', 'subject' => 'Engineering All-Hands', 'organizer' => 'Priya Nair', 'startTime' => '1:00 PM', 'endTime' => '2:00 PM', 'startMinutes' => 780, 'endMinutes' => 840],
            ['id' => 'c4', 'subject' => 'Client Onboarding — Apex Corp', 'organizer' => 'Tom Reardon', 'startTime' => '2:30 PM', 'endTime' => '3:30 PM', 'startMinutes' => 870, 'endMinutes' => 930],
            ['id' => 'c5', 'subject' => 'Weekly Retrospective', 'organizer' => 'Alicia Chen', 'startTime' => '4:00 PM', 'endTime' => '4:45 PM', 'startMinutes' => 960, 'endMinutes' => 1005],
        ],
        'sales' => [
            ['id' => 's1', 'subject' => 'Pipeline Review', 'organizer' => 'Marcus Webb', 'startTime' => '10:00 AM', 'endTime' => '11:00 AM', 'startMinutes' => 600, 'endMinutes' => 660],
            ['id' => 's2', 'subject' => 'Customer Success Sync', 'organizer' => 'Jordan Lee', 'startTime' => '11:30 AM', 'endTime' => '12:30 PM', 'startMinutes' => 690, 'endMinutes' => 750],
            ['id' => 's3', 'subject' => 'Deal Desk Review', 'organizer' => 'Sam Rivera', 'startTime' => '1:00 PM', 'endTime' => '2:00 PM', 'startMinutes' => 780, 'endMinutes' => 840],
            ['id' => 's4', 'subject' => 'Quarterly Targets', 'organizer' => 'Alex Kim', 'startTime' => '2:30 PM', 'endTime' => '3:30 PM', 'startMinutes' => 870, 'endMinutes' => 930],
            ['id' => 's5', 'subject' => 'Territory Planning', 'organizer' => 'Morgan Tate', 'startTime' => '4:00 PM', 'endTime' => '4:45 PM', 'startMinutes' => 960, 'endMinutes' => 1005],
        ],
    ];

    public static function get(string $roomSlug): array
    {
        return self::$schedules[$roomSlug] ?? [];
    }
}
