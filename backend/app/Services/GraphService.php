<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GraphService
{
    private const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
    private const TOKEN_CACHE_KEY = 'graph_access_token';
    private const EXPIRY_BUFFER_SECONDS = 300;

    public function isConfigured(): bool
    {
        return config('services.azure.client_id')
            && config('services.azure.tenant')
            && config('services.azure.client_secret')
            && filter_var(env('MICROSOFT_GRAPH_ENABLED'), FILTER_VALIDATE_BOOLEAN);
    }

    public function getAccessToken(): string
    {
        $cached = Cache::get(self::TOKEN_CACHE_KEY);
        if ($cached) {
            return $cached;
        }

        $tenantId = config('services.azure.tenant');
        $clientId = config('services.azure.client_id');
        $clientSecret = config('services.azure.client_secret');

        $url = "https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/token";

        $response = Http::asForm()->post($url, [
            'grant_type' => 'client_credentials',
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'scope' => 'https://graph.microsoft.com/.default',
        ]);

        if (!$response->ok()) {
            Log::error('[graph] getAccessToken failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \RuntimeException('[graph] getAccessToken failed: ' . $response->status());
        }

        $data = $response->json();
        $token = $data['access_token'];
        $expiresIn = ($data['expires_in'] ?? 3600) - self::EXPIRY_BUFFER_SECONDS;

        Cache::put(self::TOKEN_CACHE_KEY, $token, max(60, $expiresIn));

        return $token;
    }

    public function getRoomCalendarView(string $roomEmail, \DateTimeInterface $start, \DateTimeInterface $end): array
    {
        if (!$this->isConfigured()) {
            return [];
        }

        try {
            $token = $this->getAccessToken();
            $roomTimeZone = env('ROOM_TIMEZONE', 'America/New_York');
            $encodedEmail = urlencode($roomEmail);
            $startIso = $start->format('c');
            $endIso = $end->format('c');

            $url = self::GRAPH_BASE . "/users/{$encodedEmail}/calendar/calendarView"
                . '?startDateTime=' . urlencode($startIso)
                . '&endDateTime=' . urlencode($endIso);

            $allEvents = [];

            while ($url) {
                $response = Http::withToken($token)
                    ->withHeaders(['Prefer' => "outlook.timezone=\"{$roomTimeZone}\""])
                    ->get($url);

                if (!$response->ok()) {
                    Log::error('[graph] getRoomCalendarView failed', [
                        'status' => $response->status(),
                        'body' => $response->body(),
                    ]);
                    return [];
                }

                $data = $response->json();
                $allEvents = array_merge($allEvents, $data['value'] ?? []);
                $url = $data['@odata.nextLink'] ?? null;
            }

            $meetings = [];
            foreach ($allEvents as $ev) {
                $m = $this->mapGraphEventToMeeting($ev);
                if ($m) {
                    $meetings[] = $m;
                }
            }

            usort($meetings, fn($a, $b) => $a['startMinutes'] - $b['startMinutes']);

            return $meetings;
        } catch (\Throwable $e) {
            Log::error('[graph] getRoomCalendarView failed', ['error' => $e->getMessage()]);
            return [];
        }
    }

    public function getRoomAvailability(string $roomEmail, \DateTimeInterface $start, \DateTimeInterface $end): array
    {
        if (!$this->isConfigured()) {
            return [
                'status' => 'available',
                'label' => 'Available All Day',
                'currentMeeting' => null,
                'nextMeeting' => null,
            ];
        }

        try {
            $meetings = $this->getRoomCalendarView($roomEmail, $start, $end);
            $nowMinutes = (int) now(env('ROOM_TIMEZONE', 'America/New_York'))->format('G') * 60
                + (int) now(env('ROOM_TIMEZONE', 'America/New_York'))->format('i');

            return AvailabilityHelper::getAvailability($meetings, $nowMinutes);
        } catch (\Throwable $e) {
            Log::error('[graph] getRoomAvailability failed', ['error' => $e->getMessage()]);
            return [
                'status' => 'available',
                'label' => 'Available All Day',
                'currentMeeting' => null,
                'nextMeeting' => null,
            ];
        }
    }

    public function createRoomReservation(
        string $roomEmail,
        \DateTimeInterface $start,
        \DateTimeInterface $end,
        ?string $subject = null,
        ?string $organizerEmail = null,
        array $attendeeEmails = []
    ): array {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('Microsoft Graph not configured');
        }

        $token = $this->getAccessToken();
        $encodedEmail = urlencode($roomEmail);
        $roomTimeZone = env('ROOM_TIMEZONE', 'America/New_York');

        $body = [
            'subject' => $subject ?? 'Quick booking',
            'start' => [
                'dateTime' => $this->formatInTimeZone($start, $roomTimeZone),
                'timeZone' => $roomTimeZone,
            ],
            'end' => [
                'dateTime' => $this->formatInTimeZone($end, $roomTimeZone),
                'timeZone' => $roomTimeZone,
            ],
        ];

        $emails = array_filter($attendeeEmails, fn($e) => is_string($e) && $e !== '');
        if (empty($emails) && $organizerEmail) {
            $emails = [$organizerEmail];
        }
        if (!empty($emails)) {
            $body['attendees'] = array_map(fn($address) => [
                'emailAddress' => ['address' => $address],
                'type' => 'required',
            ], $emails);
        }

        $url = self::GRAPH_BASE . "/users/{$encodedEmail}/calendar/events";
        $response = Http::withToken($token)->post($url, $body);

        if (!$response->successful()) {
            Log::error('[graph] createRoomReservation failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \RuntimeException('[graph] createRoomReservation failed: ' . $response->status());
        }

        $data = $response->json();
        return ['success' => true, 'eventId' => $data['id'] ?? null];
    }

    public function endRoomEventNow(
        string $roomEmail,
        string $eventId,
        \DateTimeInterface $now,
        int $startMinutes,
        int $nowMinutes
    ): array {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('Microsoft Graph not configured');
        }

        $token = $this->getAccessToken();
        $encodedEmail = urlencode($roomEmail);
        $encodedEventId = urlencode($eventId);
        $roomTimeZone = env('ROOM_TIMEZONE', 'America/New_York');

        $endDateTime = $this->formatInTimeZone($now, $roomTimeZone);
        $startDateTime = $nowMinutes < $startMinutes
            ? $endDateTime
            : $this->formatDateAtMinutes($now, $roomTimeZone, $startMinutes);

        $body = [
            'start' => ['dateTime' => $startDateTime, 'timeZone' => $roomTimeZone],
            'end' => ['dateTime' => $endDateTime, 'timeZone' => $roomTimeZone],
        ];

        $url = self::GRAPH_BASE . "/users/{$encodedEmail}/calendar/events/{$encodedEventId}";
        $response = Http::withToken($token)
            ->withHeaders(['Prefer' => "outlook.timezone=\"{$roomTimeZone}\""])
            ->patch($url, $body);

        if (!$response->ok()) {
            Log::error('[graph] endRoomEventNow failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \RuntimeException('[graph] endRoomEventNow failed: ' . $response->status());
        }

        return ['success' => true];
    }

    public function getDirectoryUsers(): array
    {
        if (!$this->isConfigured()) {
            return [];
        }

        try {
            $token = $this->getAccessToken();
            $url = self::GRAPH_BASE . '/users?$select=id,displayName,mail,userPrincipalName&$top=500';
            $response = Http::withToken($token)->get($url);

            if (!$response->ok()) {
                Log::error('[graph] getDirectoryUsers failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                if ($response->status() === 403) {
                    throw new \RuntimeException(
                        'User.Read.All or Directory.Read.All application permission is required, with admin consent.'
                    );
                }
                return [];
            }

            $data = $response->json();
            $list = $data['value'] ?? [];

            $users = collect($list)
                ->filter(fn($u) => ($u['id'] ?? null) && (($u['mail'] ?? null) || ($u['userPrincipalName'] ?? null)))
                ->map(fn($u) => [
                    'id' => $u['id'],
                    'displayName' => $u['displayName'] ?? $u['userPrincipalName'] ?? '',
                    'mail' => $u['mail'] ?? $u['userPrincipalName'],
                ])
                ->sortBy('displayName', SORT_STRING | SORT_FLAG_CASE)
                ->values()
                ->all();

            return $users;
        } catch (\Throwable $e) {
            Log::error('[graph] getDirectoryUsers failed', ['error' => $e->getMessage()]);
            throw $e;
        }
    }

    private function mapGraphEventToMeeting(array $ev): ?array
    {
        $startDateTime = $ev['start']['dateTime'] ?? null;
        $endDateTime = $ev['end']['dateTime'] ?? null;
        if (!$startDateTime || !$endDateTime) {
            return null;
        }

        $startMinutes = $this->parseMinutesFromGraphDateTime($startDateTime);
        $endMinutes = $this->parseMinutesFromGraphDateTime($endDateTime);
        if ($startMinutes === null || $endMinutes === null) {
            return null;
        }

        $organizer = $ev['organizer']['emailAddress']['name']
            ?? $ev['organizer']['emailAddress']['address']
            ?? 'Unknown';

        return [
            'id' => $ev['id'] ?? \Illuminate\Support\Str::uuid()->toString(),
            'subject' => $ev['subject'] ?? '(No title)',
            'organizer' => $organizer,
            'startTime' => $this->formatMinutes12h($startMinutes),
            'endTime' => $this->formatMinutes12h($endMinutes),
            'startMinutes' => $startMinutes,
            'endMinutes' => $endMinutes,
        ];
    }

    private function parseMinutesFromGraphDateTime(string $dateTime): ?int
    {
        if (!preg_match('/T(\d{2}):(\d{2})/', $dateTime, $m)) {
            return null;
        }
        $hour = (int) $m[1];
        $minute = (int) $m[2];
        if ($hour < 0 || $hour > 23 || $minute < 0 || $minute > 59) {
            return null;
        }
        return $hour * 60 + $minute;
    }

    private function formatMinutes12h(int $minutes): string
    {
        $hour24 = intdiv($minutes, 60) % 24;
        $minute = $minutes % 60;
        $suffix = $hour24 >= 12 ? 'PM' : 'AM';
        $hour12 = $hour24 % 12 ?: 12;
        return $hour12 . ':' . str_pad((string) $minute, 2, '0', STR_PAD_LEFT) . ' ' . $suffix;
    }

    private function formatInTimeZone(\DateTimeInterface $date, string $timeZone): string
    {
        $dt = (clone \DateTime::createFromInterface($date))->setTimezone(new \DateTimeZone($timeZone));
        return $dt->format('Y-m-d\TH:i:s');
    }

    private function formatDateAtMinutes(\DateTimeInterface $date, string $timeZone, int $minutesSinceMidnight): string
    {
        $dt = (clone \DateTime::createFromInterface($date))->setTimezone(new \DateTimeZone($timeZone));
        $datePart = $dt->format('Y-m-d');
        $h = intdiv($minutesSinceMidnight, 60) % 24;
        $m = $minutesSinceMidnight % 60;
        return sprintf('%sT%02d:%02d:00', $datePart, $h, $m);
    }
}
