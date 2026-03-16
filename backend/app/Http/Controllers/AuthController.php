<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    public function redirect(Request $request)
    {
        if ($request->has('callback')) {
            session(['auth_callback' => $request->query('callback')]);
        }

        return Socialite::driver('azure')->redirect();
    }

    public function callback(Request $request)
    {
        try {
            $azureUser = Socialite::driver('azure')->user();
        } catch (\Throwable $e) {
            $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://127.0.0.1:3000'));
            return redirect($frontendUrl . '?auth_error=1');
        }

        session([
            'user' => [
                'email' => $azureUser->getEmail(),
                'name' => $azureUser->getName(),
                'id' => $azureUser->getId(),
            ],
        ]);

        $callback = session()->pull('auth_callback', env('FRONTEND_URL', 'http://127.0.0.1:3000'));

        return redirect($callback);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->session()->forget('user');
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['success' => true]);
    }

    public function user(Request $request): JsonResponse
    {
        $user = session('user');

        if (!$user || !($user['email'] ?? null)) {
            return response()->json(['error' => 'Not authenticated'], 401);
        }

        return response()->json([
            'user' => [
                'email' => $user['email'],
                'name' => $user['name'] ?? null,
            ],
        ]);
    }
}
