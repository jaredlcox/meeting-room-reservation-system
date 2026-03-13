<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoomHoldService;
use App\Services\RoomRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomHoldController extends Controller
{
    public function __construct(
        private RoomRepository $rooms,
        private RoomHoldService $holds
    ) {}

    public function show(Request $request, string $slug): JsonResponse
    {
        $room = $this->rooms->getRoomBySlug($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }
        $hold = $this->holds->getActiveHold($slug);
        return response()->json([
            'holdActive' => $hold !== null,
            'hold' => $hold,
        ]);
    }

    public function store(Request $request, string $slug): JsonResponse
    {
        $room = $this->rooms->getRoomBySlug($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }
        $hold = $this->holds->setHold($slug);
        return response()->json(['success' => true, 'holdActive' => true, 'hold' => $hold], 201);
    }

    public function destroy(Request $request, string $slug): JsonResponse
    {
        $room = $this->rooms->getRoomBySlug($slug);
        if (!$room) {
            return response()->json(['error' => 'Not found'], 404);
        }
        $this->holds->clearHold($slug);
        return response()->json(['success' => true, 'holdActive' => false]);
    }
}
