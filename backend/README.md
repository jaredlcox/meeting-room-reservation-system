# Meeting Room Reservation — Laravel API

This is the Laravel (PHP) backend for the meeting room reservation system. The Next.js frontend talks to this API when `NEXT_PUBLIC_API_URL` is set (e.g. `http://localhost:8000`).

**No database required.** Session (OAuth return URL) and cache (room holds) use file storage. Auth uses stateless encrypted tokens (no user or token tables).

## Requirements

- PHP 8.2+
- Composer
- For Microsoft Graph + Azure AD: same app registration for OAuth and Graph

## Setup

1. Copy `.env.example` to `.env` and set `APP_KEY`:
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

2. Set optional env vars:
   - `FRONTEND_URL` — Next.js app URL (e.g. `http://localhost:3000`) for OAuth redirect and CORS
   - `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` — Microsoft Entra app (OAuth + Graph)
   - `MICROSOFT_GRAPH_ENABLED=true` — enable calendar/directory
   - `ROOM_TIMEZONE` — IANA timezone (default `America/New_York`)

No migrations or database setup needed.

## Running

```bash
php artisan serve
```

API base: `http://localhost:8000`. Frontend should set `NEXT_PUBLIC_API_URL=http://localhost:8000`.

## API Routes (match Next.js API)

- `GET /api/rooms/{slug}/availability` — room status and label
- `GET /api/rooms/{slug}/schedule` — today’s meetings
- `GET /api/rooms/{slug}/slots?date=YYYY-MM-DD` — available 15-min slots
- `GET|POST|DELETE /api/rooms/{slug}/hold` — kiosk “started early” hold
- `POST /api/rooms/{slug}/quick-book` — kiosk quick book (15/30 min, start now)
- `POST /api/rooms/{slug}/end-active` — end current meeting now
- `POST /api/rooms/{slug}/reserve` — book a slot (requires Bearer token)
- `GET /api/directory/users` — directory users for attendee picker
- `GET /api/auth/session` — current user (optional Bearer token)

## Auth (Azure AD, stateless)

- **Login:** User visits `GET /login?returnTo=/book/canvass`. Laravel redirects to Microsoft, then back to `/auth/callback`, which issues an encrypted token (no database) and redirects to `FRONTEND_URL{returnTo}?token=...`.
- **Session:** Frontend stores the token and sends `Authorization: Bearer <token>` on `/api/auth/session` and `/api/rooms/{slug}/reserve`. Tokens are validated by decrypting and checking expiry (no DB lookup).

## CORS

Configured in `config/cors.php`. Default allows `FRONTEND_URL`. Set `CORS_ALLOWED_ORIGINS` for extra origins.
