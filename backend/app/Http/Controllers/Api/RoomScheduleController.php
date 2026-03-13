<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MicrosoftGraphService;
use App\Services\MockSchedule;
use App\Services\RoomRepository;
use App\Services\TimeHelper;
use DateTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomScheduleController extends Controller
{
    private string $roomTimezone;

    public function __construct(
        private RoomRepository $rooms,
        private MicrosoftGraphService $graph
    ) {
        $this->roomTimezone = config('app.room_timezone', 'America/New_York');
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $room = $this->rooms->getRoomBySlug($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $source = 'mock';
        if (!$this->graph->isGraphConfigured()) {
            \Log::info('[schedule] using mock data: Microsoft Graph not configured (check MICROSOFT_GRAPH_ENABLED and Azure env vars)');
            $meetings = MockSchedule::getMockSchedule($slug);
        } else {
            try {
                $bounds = TimeHelper::getDayBounds(new DateTime);
                $meetings = $this->graph->getRoomCalendarView($room['email'], $bounds['start'], $bounds['end']);
                $source = 'graph';
            } catch (\Throwable $e) {
                \Log::warning('[schedule] using mock data (Graph failed): ' . $e->getMessage());
                $meetings = MockSchedule::getMockSchedule($slug);
            }
        }

        $nowMinutes = TimeHelper::minutesSinceMidnightInZone(new DateTime, $this->roomTimezone);
        $activeOrUpcoming = array_values(array_filter($meetings, fn ($m) => $m['endMinutes'] > $nowMinutes));

        return response()->json(['meetings' => $activeOrUpcoming])
            ->header('X-Schedule-Source', $source);
    }
}
