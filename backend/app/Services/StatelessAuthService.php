<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;

/**
 * Stateless auth: issue and verify encrypted tokens (no database).
 * Payload: email, name, exp (expiry timestamp).
 */
class StatelessAuthService
{
    private const DEFAULT_TTL_DAYS = 30;

    /**
     * Create a token that encodes the user. Token is encrypted and expires after TTL days.
     */
    public function issueToken(string $email, ?string $name = null, int $ttlDays = self::DEFAULT_TTL_DAYS): string
    {
        $payload = [
            'email' => $email,
            'name' => $name ?? $email,
            'exp' => now()->addDays($ttlDays)->timestamp,
        ];
        return Crypt::encrypt($payload);
    }

    /**
     * Decode and validate token. Returns payload array (email, name) or null if invalid/expired.
     *
     * @return array{email: string, name: string}|null
     */
    public function validateToken(string $token): ?array
    {
        try {
            $payload = Crypt::decrypt($token);
            if (!is_array($payload) || empty($payload['email'])) {
                return null;
            }
            $exp = $payload['exp'] ?? 0;
            if ($exp < time()) {
                return null;
            }
            return [
                'email' => (string) $payload['email'],
                'name' => isset($payload['name']) ? (string) $payload['name'] : $payload['email'],
            ];
        } catch (\Throwable) {
            return null;
        }
    }
}
