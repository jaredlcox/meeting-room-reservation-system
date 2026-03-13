<?php

namespace App\Services;

use DateTime;
use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MicrosoftGraphService
{
    private const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
    private const EXPIRY_BUFFER_SECONDS = 300;

    private ?array $tokenCache = null;

    public function isGraphConfigured(): bool
    {
        $enabled = config('services.microsoft_graph.enabled', false);
        $clientId = config('services.microsoft_graph.client_id');
        $tenantId = config('services.microsoft_graph.tenant_id');
        $clientSecret = config('services.microsoft_graph.client_secret');

        $ok = $enabled && !empty($clientId) && !empty($tenantId) && !empty($clientSecret);
        if (!$ok) {
            $reasons = [];
            if (!$enabled) {
                $reasons[] = 'enabled is false (env MICROSOFT_GRAPH_ENABLED must be exactly "true")';
            }
            if (empty($clientId)) {
                $reasons[] = 'AZURE_CLIENT_ID is empty';
            }
            if (empty($tenantId)) {
                $reasons[] = 'AZURE_TENANT_ID is empty';
            }
            if (empty($clientSecret)) {
                $reasons[] = 'AZURE_CLIENT_SECRET is empty';
            }
            Log::info('[graph] not configured: ' . implode('; ', $reasons));
        }
        return $ok;
    }

    /**
     * HTTP options for outbound requests. In local env, disable SSL verify to work around
     * Windows PHP/cURL missing CA bundle (cURL error 60). Do not use in production.
     */
    private function httpOptions(): array
    {
        return config('app.env') === 'local' ? ['verify' => false] : [];
    }

    public function getAccessToken(): string
    {
        $now = time();
        if ($this->tokenCache && $this->tokenCache['expiresAt'] > $now + self::EXPIRY_BUFFER_SECONDS) {
            return $this->tokenCache['token'];
        }

        $tenantId = config('services.microsoft_graph.tenant_id');
        $clientId = config('services.microsoft_graph.client_id');
        $clientSecret = config('services.microsoft_graph.client_secret');

        if (!$tenantId || !$clientId || !$clientSecret) {
            throw new Exception('Missing AZURE_TENANT_ID, AZURE_CLIENT_ID, or AZURE_CLIENT_SECRET');
        }

        $url = "https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/token";
        $response = Http::withOptions($this->httpOptions())->asForm()->post($url, [
            'grant_type' => 'client_credentials',
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'scope' => 'https://graph.microsoft.com/.default',
        ]);

        if (!$response->successful()) {
            Log::error('[graph] getGraphAccessToken failed', ['status' => $response->status(), 'body' => $response->body()]);
            throw new Exception('[graph] getGraphAccessToken failed: ' . $response->status());
        }

        $data = $response->json();
        $expiresIn = $data['expires_in'] ?? 3600;
        $this->tokenCache = [
            'token' => $data['access_token'],
            'expiresAt' => $now + $expiresIn,
        ];
        return $this->tokenCache['token'];
    }

    private function roomTimezone(): string
    {
        return config('app.room_timezone', 'America/New_York');
    }

    private function formatInTimeZone(DateTime $date, string $timeZone): string
    {
        $d = clone $date;
        $d->setTimezone(new \DateTimeZone($timeZone));
        return $d->format('Y-m-d\TH:i:s');
    }

    private function formatDateAtMinutes(DateTime $date, string $timeZone, int $minutesSinceMidnight): string
    {
        $d = clone $date;
        $d->setTimezone(new \DateTimeZone($timeZone));
        $datePart = $d->format('Y-m-d');
        $h = (int) floor($minutesSinceMidnight / 60) % 24;
        $m = $minutesSinceMidnight % 60;
        return sprintf('%sT%02d:%02d:00', $datePart, $h, $m);
    }

    /**
     * @return array<int, array{id: string, subject: string, organizer: string, startTime: string, endTime: string, startMinutes: int, endMinutes: int}>
     */
    public function getRoomCalendarView(string $roomEmail, DateTime $start, DateTime $end): array
    {
        if (!$this->isGraphConfigured()) {
            return [];
        }

        try {
            $token = $this->getAccessToken();
            $tz = $this->roomTimezone();
            $startIso = $start->format('c');
            $endIso = $end->format('c');
            $encodedEmail = rawurlencode($roomEmail);
            $url = self::GRAPH_BASE . "/users/{$encodedEmail}/calendar/calendarView?startDateTime=" . rawurlencode($startIso) . '&endDateTime=' . rawurlencode($endIso);

            $allEvents = [];
            while ($url) {
                $res = Http::withOptions($this->httpOptions())
                    ->withToken($token)
                    ->withHeaders(['Prefer' => "outlook.timezone=\"{$tz}\""])
                    ->get($url);

                if (!$res->successful()) {
                    Log::error('[graph] getRoomCalendarView failed', ['status' => $res->status(), 'body' => $res->body()]);
                    return [];
                }

                $data = $res->json();
                $page = $data['value'] ?? [];
                $allEvents = array_merge($allEvents, $page);
                $url = $data['@odata.nextLink'] ?? null;
            }

            $meetings = [];
            foreach ($allEvents as $ev) {
                $m = $this->mapGraphEventToMeeting($ev);
                if ($m) {
                    $meetings[] = $m;
                }
            }
            usort($meetings, fn ($a, $b) => $a['startMinutes'] <=> $b['startMinutes']);
            return $meetings;
        } catch (Exception $e) {
            Log::error('[graph] getRoomCalendarView failed', ['error' => $e->getMessage()]);
            return [];
        }
    }

    private function parseMinutesFromGraphDateTime(string $dateTime): ?int
    {
        if (preg_match('/T(\d{2}):(\d{2})/', $dateTime, $m)) {
            $hour = (int) $m[1];
            $minute = (int) $m[2];
            if ($hour >= 0 && $hour <= 23 && $minute >= 0 && $minute <= 59) {
                return $hour * 60 + $minute;
            }
        }
        return null;
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
        $organizer = $ev['organizer']['emailAddress']['name'] ?? $ev['organizer']['emailAddress']['address'] ?? 'Unknown';
        return [
            'id' => $ev['id'] ?? \Illuminate\Support\Str::uuid()->toString(),
            'subject' => $ev['subject'] ?? '(No title)',
            'organizer' => $organizer,
            'startTime' => TimeHelper::formatMinutes12h($startMinutes),
            'endTime' => TimeHelper::formatMinutes12h($endMinutes),
            'startMinutes' => $startMinutes,
            'endMinutes' => $endMinutes,
        ];
    }

    /**
     * @return array{status: 'available'|'busy', label: string, currentMeeting: array|null, nextMeeting: array|null}
     */
    public function getRoomAvailability(string $roomEmail, DateTime $start, DateTime $end): array
    {
        if (!$this->isGraphConfigured()) {
            return [
                'status' => 'available',
                'label' => 'Available All Day',
                'currentMeeting' => null,
                'nextMeeting' => null,
            ];
        }
        $meetings = $this->getRoomCalendarView($roomEmail, $start, $end);
        $now = new DateTime;
        $nowMinutes = TimeHelper::minutesSinceMidnight($now);
        return AvailabilityService::getAvailability($meetings, $nowMinutes);
    }

    /**
     * @param string[]|null $attendeeEmails
     * @return array{success: true, eventId?: string}
     */
    public function createRoomReservation(
        string $roomEmail,
        DateTime $start,
        DateTime $end,
        ?string $subject = null,
        ?string $organizerEmail = null,
        ?array $attendeeEmails = null
    ): array {
        if (!$this->isGraphConfigured()) {
            throw new Exception('Microsoft Graph not configured');
        }

        $token = $this->getAccessToken();
        $tz = $this->roomTimezone();
        $encodedEmail = rawurlencode($roomEmail);
        $url = self::GRAPH_BASE . "/users/{$encodedEmail}/calendar/events";

        $body = [
            'subject' => $subject ?? 'Quick booking',
            'start' => ['dateTime' => $this->formatInTimeZone($start, $tz), 'timeZone' => $tz],
            'end' => ['dateTime' => $this->formatInTimeZone($end, $tz), 'timeZone' => $tz],
        ];

        $attendees = is_array($attendeeEmails) && count($attendeeEmails) > 0
            ? array_values(array_filter($attendeeEmails, fn ($e) => is_string($e) && $e !== ''))
            : ($organizerEmail ? [$organizerEmail] : []);

        if (count($attendees) > 0) {
            $body['attendees'] = array_map(fn ($address) => [
                'emailAddress' => ['address' => $address],
                'type' => 'required',
            ], $attendees);
        }

        $res = Http::withOptions($this->httpOptions())->withToken($token)->post($url, $body);

        if (!$res->successful()) {
            Log::error('[graph] createRoomReservation failed', ['status' => $res->status(), 'body' => $res->body()]);
            throw new Exception('[graph] createRoomReservation failed: ' . $res->status());
        }

        $data = $res->json();
        return ['success' => true, 'eventId' => $data['id'] ?? null];
    }

    public function endRoomEventNow(
        string $roomEmail,
        string $eventId,
        DateTime $now,
        int $startMinutes,
        int $nowMinutes
    ): void {
        if (!$this->isGraphConfigured()) {
            throw new Exception('Microsoft Graph not configured');
        }

        $token = $this->getAccessToken();
        $tz = $this->roomTimezone();
        $endDateTime = $this->formatInTimeZone($now, $tz);
        $startDateTime = $nowMinutes < $startMinutes
            ? $endDateTime
            : $this->formatDateAtMinutes($now, $tz, $startMinutes);

        $encodedEmail = rawurlencode($roomEmail);
        $encodedEventId = rawurlencode($eventId);
        $url = self::GRAPH_BASE . "/users/{$encodedEmail}/calendar/events/{$encodedEventId}";

        $body = [
            'start' => ['dateTime' => $startDateTime, 'timeZone' => $tz],
            'end' => ['dateTime' => $endDateTime, 'timeZone' => $tz],
        ];

        $res = Http::withOptions($this->httpOptions())
            ->withToken($token)
            ->withHeaders(['Prefer' => "outlook.timezone=\"{$tz}\""])
            ->patch($url, $body);

        if (!$res->successful()) {
            Log::error('[graph] endRoomEventNow failed', ['status' => $res->status(), 'body' => $res->body()]);
            throw new Exception('[graph] endRoomEventNow failed: ' . $res->status());
        }
    }

    /**
     * @return array<int, array{id: string, displayName: string, mail: string}>
     */
    public function getDirectoryUsers(): array
    {
        if (!$this->isGraphConfigured()) {
            return [];
        }

        try {
            $token = $this->getAccessToken();
            $url = self::GRAPH_BASE . '/users?$select=id,displayName,mail,userPrincipalName&$top=500';
            $res = Http::withOptions($this->httpOptions())->withToken($token)->get($url);

            if (!$res->successful()) {
                if ($res->status() === 403) {
                    throw new Exception('User.Read.All or Directory.Read.All application permission is required, with admin consent.');
                }
                Log::error('[graph] getDirectoryUsers failed', ['status' => $res->status()]);
                return [];
            }

            $data = $res->json();
            $list = $data['value'] ?? [];
            $users = [];
            foreach ($list as $u) {
                if (empty($u['id']) || empty($u['mail'] ?? $u['userPrincipalName'] ?? null)) {
                    continue;
                }
                $users[] = [
                    'id' => $u['id'],
                    'displayName' => $u['displayName'] ?? $u['userPrincipalName'] ?? '',
                    'mail' => $u['mail'] ?? $u['userPrincipalName'],
                ];
            }
            usort($users, fn ($a, $b) => strcmp($a['displayName'], $b['displayName']));
            return $users;
        } catch (Exception $e) {
            Log::error('[graph] getDirectoryUsers failed', ['error' => $e->getMessage()]);
            throw $e;
        }
    }
}
