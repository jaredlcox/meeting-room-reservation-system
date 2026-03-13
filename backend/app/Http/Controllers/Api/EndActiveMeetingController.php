<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MicrosoftGraphService;
use App\Services\RoomHoldService;
use App\Services\RoomRepository;
use App\Services\TimeHelper;
use DateTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EndActiveMeetingController extends Controller
{
    public function __construct(
        private RoomRepository $rooms,
        private RoomHoldService $holds,
        private MicrosoftGraphService $graph
    ) {}

    public function store(Request $request, string $slug): JsonResponse
    {
        $room = $this->rooms->getRoomBySlug($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }
        if (!$this->graph->isGraphConfigured()) {
            return response()->json(['error' => 'Stopping meetings requires Microsoft Graph configuration.'], 503);
        }

        $roomTimezone = config('app.room_timezone', 'America/New_York');
        $now = new DateTime;
        $nowMinutes = TimeHelper::minutesSinceMidnightInZone($now, $roomTimezone);

        try {
            $body = $request->all();
            $eventId = isset($body['eventId']) && is_string($body['eventId']) ? trim($body['eventId']) : null;

            $bounds = TimeHelper::getDayBounds($now);
            $meetings = $this->graph->getRoomCalendarView($room['email'], $bounds['start'], $bounds['end']);

            $meetingToEnd = null;
            if ($eventId) {
                foreach ($meetings as $m) {
                    if ($m['id'] === $eventId) {
                        $meetingToEnd = $m;
                        break;
                    }
                }
            }
            if (!$meetingToEnd) {
                foreach ($meetings as $m) {
                    if ($m['startMinutes'] <= $nowMinutes && $m['endMinutes'] > $nowMinutes) {
                        $meetingToEnd = $m;
                        break;
                    }
                }
            }

            if (!$meetingToEnd) {
                return response()->json(['error' => 'No active meeting to stop right now.'], 409);
            }

            $this->graph->endRoomEventNow(
                $room['email'],
                $meetingToEnd['id'],
                $now,
                $meetingToEnd['startMinutes'],
                $nowMinutes
            );
            $this->holds->clearHold($slug);

            return response()->json(['success' => true, 'endedEventId' => $meetingToEnd['id']]);
        } catch (\Throwable $e) {
            \Log::error('[end-active] failed: ' . $e->getMessage());
            return response()->json(['error' => 'Could not stop the active meeting. Please try again.'], 502);
        }
    }
}
