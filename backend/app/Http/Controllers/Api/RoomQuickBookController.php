<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MicrosoftGraphService;
use App\Services\RoomHoldService;
use App\Services\RoomRepository;
use DateTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomQuickBookController extends Controller
{
    private const VALID_DURATIONS = [15, 30];
    private const MAX_DAYS_AHEAD = 7;

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
        if ($this->holds->isHoldActive($slug)) {
            return response()->json(['error' => 'Room was started early and is temporarily unavailable.'], 409);
        }

        $body = $request->all();
        $parsed = $this->parseBody($body);
        if (!$parsed) {
            return response()->json(['error' => 'durationMinutes (15 or 30) and startTime or startNow required'], 400);
        }

        if ($parsed['startNow']) {
            $start = new DateTime;
        } else {
            $validated = $this->parseAndValidateStartTime($parsed['startTime']);
            if (isset($validated['error'])) {
                return response()->json(['error' => $validated['error']], 400);
            }
            $start = $validated['start'];
        }
        $end = (clone $start)->modify('+' . $parsed['durationMinutes'] . ' minutes');

        if (!$this->graph->isGraphConfigured()) {
            return response()->json(['error' => 'Booking is not configured'], 503);
        }

        try {
            $meetings = $this->graph->getRoomCalendarView($room['email'], $start, $end);
            if ($this->hasOverlappingMeeting($meetings, $start, $end)) {
                return response()->json(['error' => 'Room is not available for that time.'], 409);
            }
            $this->graph->createRoomReservation(
                $room['email'],
                $start,
                $end,
                $parsed['title'] ?? 'Quick booking',
                null,
                !empty($parsed['attendeeEmails']) ? $parsed['attendeeEmails'] : null
            );
        } catch (\Throwable $e) {
            \Log::error('[quick-book] createRoomReservation failed: ' . $e->getMessage());
            return response()->json(['error' => 'Could not create reservation. Please try again.'], 502);
        }

        return response()->json(['success' => true], 201);
    }

    /** @return array{startTime?: string, startNow: bool, durationMinutes: int, attendeeEmails: string[], title?: string}|null */
    private function parseBody(array $body): ?array
    {
        $startTime = isset($body['startTime']) && is_string($body['startTime']) ? trim($body['startTime']) ?: null : null;
        $startNow = ($body['startNow'] ?? false) === true;
        $durationMinutes = $body['durationMinutes'] ?? null;
        if (!is_numeric($durationMinutes) || !in_array((int) $durationMinutes, self::VALID_DURATIONS, true)) {
            return null;
        }
        if (!$startNow && !$startTime) {
            return null;
        }
        if ($startNow && $startTime) {
            return null;
        }
        $attendeeEmails = [];
        if (is_array($body['attendeeEmails'] ?? null)) {
            $attendeeEmails = array_values(array_filter($body['attendeeEmails'], fn ($e) => is_string($e) && $e !== ''));
        }
        $title = isset($body['title']) && is_string($body['title']) ? trim($body['title']) ?: null : null;
        return [
            'startTime' => $startTime,
            'startNow' => $startNow,
            'durationMinutes' => (int) $durationMinutes,
            'attendeeEmails' => $attendeeEmails,
            'title' => $title,
        ];
    }

    /** @return array{start: DateTime}|array{error: string} */
    private function parseAndValidateStartTime(string $startTime): array
    {
        $start = DateTime::createFromFormat(DateTime::ATOM, $startTime) ?: new DateTime($startTime);
        if (!$start || $start->getTimestamp() === false) {
            return ['error' => 'Invalid startTime'];
        }
        $now = new DateTime;
        if ($start < $now) {
            return ['error' => 'startTime must be in the future'];
        }
        $maxDate = (clone $now)->modify('+' . self::MAX_DAYS_AHEAD . ' days');
        if ($start > $maxDate) {
            return ['error' => 'startTime must be within the next ' . self::MAX_DAYS_AHEAD . ' days'];
        }
        return ['start' => $start];
    }

    /** @param array<int, array{startMinutes: int, endMinutes: int}> $meetings */
    private function hasOverlappingMeeting(array $meetings, DateTime $start, DateTime $end): bool
    {
        $startMinutes = (int) $start->format('G') * 60 + (int) $start->format('i');
        $endMinutes = (int) $end->format('G') * 60 + (int) $end->format('i');
        foreach ($meetings as $m) {
            if ($m['startMinutes'] < $endMinutes && $m['endMinutes'] > $startMinutes) {
                return true;
            }
        }
        return false;
    }
}
