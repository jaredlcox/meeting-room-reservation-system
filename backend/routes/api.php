<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DirectoryController;
use App\Http\Controllers\RoomController;
use Illuminate\Support\Facades\Route;

Route::get('/auth/user', [AuthController::class, 'user']);

Route::get('/directory/users', [DirectoryController::class, 'index']);

Route::prefix('rooms/{slug}')->group(function () {
    Route::get('/schedule', [RoomController::class, 'schedule']);
    Route::get('/availability', [RoomController::class, 'availability']);
    Route::get('/slots', [RoomController::class, 'slots']);

    Route::get('/hold', [RoomController::class, 'getHold']);
    Route::post('/hold', [RoomController::class, 'createHold']);
    Route::delete('/hold', [RoomController::class, 'deleteHold']);

    Route::post('/quick-book', [RoomController::class, 'quickBook']);
    Route::post('/end-active', [RoomController::class, 'endActive']);

    Route::post('/reserve', [RoomController::class, 'reserve']);
});
