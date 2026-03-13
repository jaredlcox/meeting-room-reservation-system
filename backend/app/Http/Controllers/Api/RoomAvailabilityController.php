<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AvailabilityService;
use App\Services\MicrosoftGraphService;
use App\Services\MockSchedule;
use App\Services\RoomHoldService;
use App\Services\RoomRepository;
use App\Services\TimeHelper;
use DateTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomAvailabilityController extends Controller
{
    public function __construct(
        private RoomRepository $rooms,
        private RoomHoldService $holds,
        private MicrosoftGraphService $graph
    ) {}

    public function show(Request $request, string $slug): JsonResponse
    {
        $room = $this->rooms->getRoomBySlug($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $activeHold = $this->holds->getActiveHold($slug);
        if ($activeHold) {
            return response()->json([
                'status' => 'busy',
                'label' => 'In Use - Started early',
                'currentMeeting' => null,
                'nextMeeting' => null,
            ]);
        }

        if (!$this->graph->isGraphConfigured()) {
            $meetings = MockSchedule::getMockSchedule($slug);
            $now = new DateTime;
            $nowMinutes = TimeHelper::minutesSinceMidnight($now);
            $body = AvailabilityService::getAvailability($meetings, $nowMinutes);
            return response()->json($body);
        }

        try {
            $bounds = TimeHelper::getDayBounds(new DateTime);
            $body = $this->graph->getRoomAvailability($room['email'], $bounds['start'], $bounds['end']);
            return response()->json($body);
        } catch (\Throwable $e) {
            \Log::warning('[availability] using mock data (Graph failed): ' . $e->getMessage());
            $meetings = MockSchedule::getMockSchedule($slug);
            $now = new DateTime;
            $nowMinutes = TimeHelper::minutesSinceMidnight($now);
            $body = AvailabilityService::getAvailability($meetings, $nowMinutes);
            return response()->json($body);
        }
    }
}
