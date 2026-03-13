<?php

use App\Http\Controllers\Api\AuthSessionController;
use App\Http\Controllers\Api\DirectoryUsersController;
use App\Http\Controllers\Api\EndActiveMeetingController;
use App\Http\Controllers\Api\RoomAvailabilityController;
use App\Http\Controllers\Api\RoomHoldController;
use App\Http\Controllers\Api\RoomQuickBookController;
use App\Http\Controllers\Api\RoomReserveController;
use App\Http\Controllers\Api\RoomScheduleController;
use App\Http\Controllers\Api\RoomSlotsController;
use Illuminate\Support\Facades\Route;

// Auth session (optional Bearer token; returns user or null)
Route::get('/auth/session', AuthSessionController::class);

// Directory (no auth)
Route::get('/directory/users', [DirectoryUsersController::class, 'index']);

// Room-scoped routes: /api/rooms/{slug}/...
Route::prefix('rooms')->group(function () {
    Route::get('{slug}/availability', [RoomAvailabilityController::class, 'show']);
    Route::get('{slug}/schedule', [RoomScheduleController::class, 'show']);
    Route::get('{slug}/slots', [RoomSlotsController::class, 'show']);

    Route::get('{slug}/hold', [RoomHoldController::class, 'show']);
    Route::post('{slug}/hold', [RoomHoldController::class, 'store']);
    Route::delete('{slug}/hold', [RoomHoldController::class, 'destroy']);

    Route::post('{slug}/quick-book', [RoomQuickBookController::class, 'store']);
    Route::post('{slug}/end-active', [EndActiveMeetingController::class, 'store']);

    // Reserve requires auth (stateless Bearer token)
    Route::post('{slug}/reserve', [RoomReserveController::class, 'store'])->middleware('auth.stateless');
});
