<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StatelessAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthSessionController extends Controller
{
    public function __construct(
        private StatelessAuthService $auth
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $token = $this->bearerToken($request);
        $user = $token ? $this->auth->validateToken($token) : null;
        if (!$user) {
            return response()->json(['user' => null]);
        }
        return response()->json([
            'user' => [
                'email' => $user['email'],
                'name' => $user['name'],
            ],
        ]);
    }

    private function bearerToken(Request $request): ?string
    {
        $header = $request->header('Authorization');
        if ($header && str_starts_with($header, 'Bearer ')) {
            return trim(substr($header, 7));
        }
        return null;
    }
}
