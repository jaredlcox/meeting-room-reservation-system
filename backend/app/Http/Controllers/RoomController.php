<?php

namespace App\Http\Controllers;

use App\Services\AvailabilityHelper;
use App\Services\GraphService;
use App\Services\MockSchedule;
use App\Services\RoomHoldService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class RoomController extends Controller
{
    private const SLOT_MINUTES = 15;
    private const BUSINESS_START = 480;  // 8:00
    private const BUSINESS_END = 1080;   // 18:00
    private const MAX_DAYS_AHEAD = 7;

    /** @var GraphService */
    private $graph;

    public function __construct(GraphService $graph)
    {
        $this->graph = $graph;
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private function resolveRoom(string $slug): ?array
    {
        return config("rooms.{$slug}");
    }

    private function roomTimezone(): string
    {
        return env('ROOM_TIMEZONE', 'America/New_York');
    }

    private function nowMinutesInZone(): int
    {
        $now = now($this->roomTimezone());
        return (int) $now->format('G') * 60 + (int) $now->format('i');
    }

    private function dayBounds(?Carbon $date = null): array
    {
        $d = $date ?? now($this->roomTimezone());
        return [
            'start' => $d->copy()->startOfDay(),
            'end' => $d->copy()->endOfDay(),
        ];
    }

    private function getMeetings(string $slug, string $roomEmail, ?Carbon $date = null): array
    {
        if (!$this->graph->isConfigured()) {
            return MockSchedule::get($slug);
        }

        try {
            $bounds = $this->dayBounds($date);
            return $this->graph->getRoomCalendarView($roomEmail, $bounds['start'], $bounds['end']);
        } catch (\Throwable $e) {
            Log::warning('[schedule] using mock data (Graph failed)', ['error' => $e->getMessage()]);
            return MockSchedule::get($slug);
        }
    }

    private function hasOverlap(array $meetings, Carbon $start, Carbon $end): bool
    {
        $startMin = $start->hour * 60 + $start->minute;
        $endMin = $end->hour * 60 + $end->minute;
        foreach ($meetings as $m) {
            if ($m['startMinutes'] < $endMin && $m['endMinutes'] > $startMin) {
                return true;
            }
        }
        return false;
    }

    // ── endpoints ───────────────────────────────────────────────────────

    public function schedule(string $slug): JsonResponse
    {
        $room = $this->resolveRoom($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $meetings = $this->getMeetings($slug, $room['email']);
        $nowMinutes = $this->nowMinutesInZone();
        $active = array_values(array_filter($meetings, fn($m) => $m['endMinutes'] > $nowMinutes));

        return response()->json(['meetings' => $active]);
    }

    public function availability(string $slug): JsonResponse
    {
        $room = $this->resolveRoom($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }

        if (RoomHoldService::isHoldActive($slug)) {
            return response()->json([
                'status' => 'busy',
                'label' => 'In Use - Started early',
                'currentMeeting' => null,
                'nextMeeting' => null,
            ]);
        }

        $meetings = $this->getMeetings($slug, $room['email']);
        $nowMinutes = $this->nowMinutesInZone();
        $body = AvailabilityHelper::getAvailability($meetings, $nowMinutes);

        return response()->json($body);
    }

    public function slots(Request $request, string $slug): JsonResponse
    {
        $room = $this->resolveRoom($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }

        if (RoomHoldService::isHoldActive($slug)) {
            return response()->json(['slots' => [], 'holdActive' => true]);
        }

        $dateStr = $request->query('date');
        if (!$dateStr || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateStr)) {
            return response()->json(['error' => 'Invalid or missing date. Use ?date=YYYY-MM-DD'], 400);
        }

        try {
            $date = Carbon::createFromFormat('Y-m-d', $dateStr, $this->roomTimezone())->startOfDay();
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Invalid date'], 400);
        }

        if ($date->lt(today($this->roomTimezone()))) {
            return response()->json(['error' => 'Date must be today or in the future'], 400);
        }

        $meetings = [];
        if ($this->graph->isConfigured()) {
            try {
                $bounds = $this->dayBounds($date);
                $meetings = $this->graph->getRoomCalendarView($room['email'], $bounds['start'], $bounds['end']);
            } catch (\Throwable $e) {
                Log::warning('[slots] Graph failed', ['error' => $e->getMessage()]);
            }
        }

        $slots = [];
        for ($startMin = self::BUSINESS_START; $startMin + self::SLOT_MINUTES <= self::BUSINESS_END; $startMin += self::SLOT_MINUTES) {
            $endMin = $startMin + self::SLOT_MINUTES;
            $overlaps = false;
            foreach ($meetings as $m) {
                if ($m['startMinutes'] < $endMin && $m['endMinutes'] > $startMin) {
                    $overlaps = true;
                    break;
                }
            }
            if ($overlaps) {
                continue;
            }

            $slotStart = $date->copy()->addMinutes($startMin);
            $slotEnd = $slotStart->copy()->addMinutes(self::SLOT_MINUTES);
            $slots[] = [
                'start' => $slotStart->toISOString(),
                'end' => $slotEnd->toISOString(),
                'startMinutes' => $startMin,
                'endMinutes' => $endMin,
            ];
        }

        return response()->json(['slots' => $slots]);
    }

    // ── hold endpoints ─────────────────────────────────────────────────

    public function getHold(string $slug): JsonResponse
    {
        $room = $this->resolveRoom($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $hold = RoomHoldService::getActiveHold($slug);
        return response()->json([
            'holdActive' => $hold !== null,
            'hold' => $hold,
        ]);
    }

    public function createHold(string $slug): JsonResponse
    {
        $room = $this->resolveRoom($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $hold = RoomHoldService::setHold($slug);
        return response()->json(['success' => true, 'holdActive' => true, 'hold' => $hold], 201);
    }

    public function deleteHold(string $slug): JsonResponse
    {
        $room = $this->resolveRoom($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }

        RoomHoldService::clearHold($slug);
        return response()->json(['success' => true, 'holdActive' => false]);
    }

    // ── quick-book ─────────────────────────────────────────────────────

    public function quickBook(Request $request, string $slug): JsonResponse
    {
        $room = $this->resolveRoom($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }

        if (RoomHoldService::isHoldActive($slug)) {
            return response()->json(['error' => 'Room was started early and is temporarily unavailable.'], 409);
        }

        $data = $request->validate([
            'durationMinutes' => 'required|integer|in:15,30',
            'startNow' => 'sometimes|boolean',
            'startTime' => 'sometimes|string',
            'attendeeEmails' => 'sometimes|array',
            'attendeeEmails.*' => 'string',
            'title' => 'sometimes|string',
        ]);

        $startNow = $data['startNow'] ?? false;
        $startTimeStr = $data['startTime'] ?? null;

        if (!$startNow && !$startTimeStr) {
            return response()->json(['error' => 'startTime or startNow required'], 400);
        }
        if ($startNow && $startTimeStr) {
            return response()->json(['error' => 'Provide startTime or startNow, not both'], 400);
        }

        if ($startNow) {
            $start = now();
        } else {
            try {
                $start = Carbon::parse($startTimeStr);
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Invalid startTime'], 400);
            }
            if ($start->lt(now())) {
                return response()->json(['error' => 'startTime must be in the future'], 400);
            }
            if ($start->gt(now()->addDays(self::MAX_DAYS_AHEAD))) {
                return response()->json(['error' => 'startTime must be within the next 7 days'], 400);
            }
        }

        $end = $start->copy()->addMinutes($data['durationMinutes']);

        if (!$this->graph->isConfigured()) {
            return response()->json(['error' => 'Booking is not configured'], 503);
        }

        try {
            $meetings = $this->graph->getRoomCalendarView($room['email'], $start, $end);
            if ($this->hasOverlap($meetings, $start, $end)) {
                return response()->json(['error' => 'Room is not available for that time.'], 409);
            }

            $attendees = array_filter($data['attendeeEmails'] ?? [], fn($e) => is_string($e) && $e !== '');
            $this->graph->createRoomReservation(
                $room['email'],
                $start,
                $end,
                $data['title'] ?? 'Quick booking',
                null,
                $attendees
            );
        } catch (\Throwable $e) {
            Log::error('[quick-book] failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Could not create reservation. Please try again.'], 502);
        }

        return response()->json(['success' => true], 201);
    }

    // ── reserve (authenticated) ────────────────────────────────────────

    public function reserve(Request $request, string $slug): JsonResponse
    {
        $room = $this->resolveRoom($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }

        if (RoomHoldService::isHoldActive($slug)) {
            return response()->json(['error' => 'Room was started early at the kiosk and is temporarily unavailable.'], 409);
        }

        $user = session('user');
        if (!$user || !($user['email'] ?? null)) {
            return response()->json(['error' => 'Sign in required'], 401);
        }

        $data = $request->validate([
            'durationMinutes' => 'required|integer|in:15,30,45,60',
            'startTime' => 'sometimes|string',
            'title' => 'sometimes|string',
            'attendeeEmails' => 'sometimes|array',
            'attendeeEmails.*' => 'string',
        ]);

        if (!empty($data['startTime'])) {
            try {
                $start = Carbon::parse($data['startTime']);
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Invalid startTime'], 400);
            }
            if ($start->lt(now())) {
                return response()->json(['error' => 'startTime must be in the future'], 400);
            }
            if ($start->gt(now()->addDays(self::MAX_DAYS_AHEAD))) {
                return response()->json(['error' => 'startTime must be within the next 7 days'], 400);
            }
        } else {
            $start = now();
        }

        $end = $start->copy()->addMinutes($data['durationMinutes']);
        $eventId = null;

        if ($this->graph->isConfigured()) {
            try {
                $meetings = $this->graph->getRoomCalendarView($room['email'], $start, $end);
                if ($this->hasOverlap($meetings, $start, $end)) {
                    return response()->json(['error' => 'Room is not available for that time.'], 409);
                }

                $organizerEmail = $user['email'];
                $attendees = array_filter($data['attendeeEmails'] ?? [], fn($e) => is_string($e) && $e !== '');
                $allAttendees = array_unique(array_merge([$organizerEmail], $attendees));

                $result = $this->graph->createRoomReservation(
                    $room['email'],
                    $start,
                    $end,
                    $data['title'] ?? 'Quick booking',
                    $organizerEmail,
                    $allAttendees
                );
                $eventId = $result['eventId'] ?? null;
            } catch (\Throwable $e) {
                Log::error('[reserve] failed', ['error' => $e->getMessage()]);
                return response()->json(['error' => 'Could not create reservation. Please try again.'], 502);
            }
        }

        $response = ['success' => true];
        if ($eventId) {
            $response['eventId'] = $eventId;
        }

        return response()->json($response, 201);
    }

    // ── end-active ─────────────────────────────────────────────────────

    public function endActive(Request $request, string $slug): JsonResponse
    {
        $room = $this->resolveRoom($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }

        if (!$this->graph->isConfigured()) {
            return response()->json(['error' => 'Stopping meetings requires Microsoft Graph configuration.'], 503);
        }

        $now = now();
        $nowMinutes = $this->nowMinutesInZone();

        try {
            $eventId = $request->input('eventId');
            $bounds = $this->dayBounds();
            $meetings = $this->graph->getRoomCalendarView($room['email'], $bounds['start'], $bounds['end']);

            $meetingToEnd = null;
            if (is_string($eventId)) {
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

            $this->graph->endRoomEventNow($room['email'], $meetingToEnd['id'], $now, $meetingToEnd['startMinutes'], $nowMinutes);
            RoomHoldService::clearHold($slug);

            return response()->json(['success' => true, 'endedEventId' => $meetingToEnd['id']]);
        } catch (\Throwable $e) {
            Log::error('[end-active] failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Could not stop the active meeting. Please try again.'], 502);
        }
    }
}
