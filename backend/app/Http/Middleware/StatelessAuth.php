<?php

namespace App\Http\Middleware;

use App\Services\StatelessAuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticate using Bearer token (stateless encrypted payload). No database.
 */
class StatelessAuth
{
    public function __construct(
        private StatelessAuthService $auth
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization');
        $token = null;
        if ($header && str_starts_with($header, 'Bearer ')) {
            $token = trim(substr($header, 7));
        }
        if (!$token) {
            return response()->json(['error' => 'Sign in required'], 401);
        }
        $user = $this->auth->validateToken($token);
        if (!$user) {
            return response()->json(['error' => 'Invalid or expired token'], 401);
        }
        $request->attributes->set('auth_user', (object) $user);
        return $next($request);
    }
}
