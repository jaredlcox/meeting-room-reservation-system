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

class RoomSlotsController extends Controller
{
    private const SLOT_MINUTES = 15;
    private const BUSINESS_START_MINUTES = 8 * 60;
    private const BUSINESS_END_MINUTES = 18 * 60;

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
        if ($this->holds->isHoldActive($slug)) {
            return response()->json(['slots' => [], 'holdActive' => true]);
        }

        $dateParam = $request->query('date');
        $date = $this->parseDateQuery($dateParam);
        if (!$date) {
            return response()->json(['error' => 'Invalid or missing date. Use ?date=YYYY-MM-DD'], 400);
        }
        if ($this->isPastDay($date)) {
            return response()->json(['error' => 'Date must be today or in the future'], 400);
        }

        $dayStart = (clone $date)->setTime(0, 0, 0, 0);
        $dayEnd = (clone $date)->setTime(23, 59, 59, 999000);

        $meetings = [];
        if ($this->graph->isGraphConfigured()) {
            try {
                $meetings = $this->graph->getRoomCalendarView($room['email'], $dayStart, $dayEnd);
            } catch (\Throwable $e) {
                \Log::warning('[slots] getRoomCalendarView failed: ' . $e->getMessage());
            }
        }

        $slots = [];
        for ($startMin = self::BUSINESS_START_MINUTES; $startMin + self::SLOT_MINUTES <= self::BUSINESS_END_MINUTES; $startMin += self::SLOT_MINUTES) {
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

            $slotStart = (clone $date)->setTime(0, 0, 0, 0);
            $slotStart->modify("+{$startMin} minutes");
            $slotEnd = (clone $slotStart)->modify('+' . self::SLOT_MINUTES . ' minutes');

            $slots[] = [
                'start' => $slotStart->format('c'),
                'end' => $slotEnd->format('c'),
                'startMinutes' => $startMin,
                'endMinutes' => $endMin,
            ];
        }

        return response()->json(['slots' => $slots]);
    }

    private function parseDateQuery(?string $dateStr): ?DateTime
    {
        if (!$dateStr || !is_string($dateStr)) {
            return null;
        }
        $dateStr = trim($dateStr);
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dateStr)) {
            return null;
        }
        $date = DateTime::createFromFormat('Y-m-d', $dateStr);
        if (!$date || $date->format('Y-m-d') !== $dateStr) {
            return null;
        }
        $date->setTime(0, 0, 0, 0);
        return $date;
    }

    private function isPastDay(DateTime $date): bool
    {
        $today = (new DateTime)->setTime(0, 0, 0, 0);
        $d = (clone $date)->setTime(0, 0, 0, 0);
        return $d < $today;
    }
}
