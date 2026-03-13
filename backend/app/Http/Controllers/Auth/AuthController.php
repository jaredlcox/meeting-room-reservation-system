<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\StatelessAuthService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirect;

class AuthController extends Controller
{
    public function __construct(
        private StatelessAuthService $auth
    ) {}

    public function redirect(Request $request): SymfonyRedirect|RedirectResponse
    {
        $returnTo = $request->query('returnTo', '/');
        session(['auth.return_to' => $returnTo]);
        return Socialite::driver('microsoft')->redirect();
    }

    public function callback(Request $request): RedirectResponse
    {
        $returnTo = session('auth.return_to', '/');
        $returnTo = str_starts_with($returnTo, '/') ? $returnTo : '/' . $returnTo;

        try {
            $oauthUser = Socialite::driver('microsoft')->user();
        } catch (\Throwable $e) {
            \Log::error('[auth] Microsoft callback failed: ' . $e->getMessage());
            return $this->redirectToFrontend($returnTo, ['error' => 'Sign in failed']);
        }

        $email = $oauthUser->getEmail();
        if (!$email) {
            return $this->redirectToFrontend($returnTo, ['error' => 'No email from Microsoft']);
        }

        $token = $this->auth->issueToken($email, $oauthUser->getName());
        return $this->redirectToFrontend($returnTo, ['token' => $token]);
    }

    private function redirectToFrontend(string $path, array $query = []): RedirectResponse
    {
        $frontendUrl = rtrim(env('FRONTEND_URL', env('APP_URL', 'http://localhost:3000')), '/');
        $url = $frontendUrl . $path;
        if (!empty($query)) {
            $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($query);
        }
        return redirect()->away($url);
    }
}
