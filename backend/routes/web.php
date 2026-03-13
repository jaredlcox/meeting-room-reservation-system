<?php

use App\Http\Controllers\Auth\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/login', [AuthController::class, 'redirect'])->name('login');
Route::get('/auth/callback', [AuthController::class, 'callback'])->name('auth.callback');
