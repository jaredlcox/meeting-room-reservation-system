# Microsoft 365 / Outlook integration setup

This document is a checklist for enabling Microsoft Graph and Entra (Azure AD) authentication so the room display and booking app can read and write room calendars.

## Integration plan (high level)

- **Graph (read):** The app will call Microsoft Graph to get a room mailbox’s calendar view for a time range. That data drives the room display (current meeting, next meeting, today’s schedule) and availability. Implemented in Phase 6 in `lib/graph.ts` (`getRoomCalendarView`, `getRoomAvailability`).
- **Graph (write):** When a user reserves a room from the booking page, the app will create a calendar event in the room’s mailbox via Graph. Implemented in Phase 7 in `lib/graph.ts` (`createRoomReservation`).
- **Auth:** Users sign in with their Microsoft work account on the booking page. Phase 7 uses **NextAuth.js** with the Azure AD (Entra ID) provider. The redirect URI for the NextAuth callback must be registered in the Entra app (e.g. `https://your-domain.com/api/auth/callback` or `http://localhost:3000/api/auth/callback` for local dev). No new Graph permission is required beyond `Calendars.ReadWrite` (application) when the app creates the event with the app-only token and passes the signed-in user as attendee.

---

## Checklist

### 1. Microsoft Entra (Azure AD) app registration

- [ ] In [Azure Portal](https://portal.azure.com) go to **Microsoft Entra ID** (or Azure Active Directory) → **App registrations** → **New registration**.
- [ ] Name the app (e.g. "Meeting Room Display"). Choose supported account types (single tenant or multitenant as needed).
- [ ] Note the **Application (client) ID** and **Directory (tenant) ID**.
- [ ] Create a **Client secret** (Certificates & secrets) for server-side or daemon flows. Copy the secret value once; store it in `.env.local` as `AZURE_CLIENT_SECRET`.
- [ ] If you will use a SPA or client-side MSAL flow, you can create a separate app registration or configure the same app for both; document redirect URIs in step 3.

### 2. API permissions (Microsoft Graph)

- [ ] In the app registration, go to **API permissions** → **Add a permission** → **Microsoft Graph**.
- [ ] For **room display (read-only):** add **Application** or **Delegated** permission:
  - `Calendars.Read` (or `Calendars.ReadWrite` if the same app will also create events).
- [ ] For **booking (create events):** add:
  - `Calendars.ReadWrite` (application permission to write to room calendars, or delegated if the signed-in user is allowed to book the room).
- [ ] For **Quick Book participant list** (kiosk): add **Application** permission:
  - `User.Read.All` (or `User.ReadBasic.All`) so the app can list directory users for the participant picker. Grant admin consent.
- [ ] For room resource mailboxes, ensure the app has access (admin consent for application permissions, or delegated with a user who has access to the room).
- [ ] Grant **admin consent** if using application permissions.
- [ ] Reference: [Microsoft Graph calendar permissions](https://learn.microsoft.com/en-us/graph/permissions-reference#calendar-permissions), [access room mailboxes](https://learn.microsoft.com/en-us/graph/room-list).

### 3. Redirect URIs (Phase 7 NextAuth)

- [ ] In the app registration, go to **Authentication** → **Platform configurations** → **Web** (or SPA if applicable).
- [ ] Add **Redirect URIs** that match your app exactly. For Phase 7 sign-in, include the NextAuth callback URL: `https://your-domain.com/api/auth/callback/azure-ad` (production), or `http://localhost:3000/api/auth/callback/azure-ad` for local dev if your tenant allows HTTP.
- [ ] **Azure often allows only HTTPS redirect URIs.** If you cannot add `http://192.168.x.x:3000/...` (e.g. when testing from your phone on the same Wi‑Fi), use an **HTTPS tunnel** so you have an HTTPS URL to register:
  1. Run a tunnel to your dev server (e.g. [ngrok](https://ngrok.com): `ngrok http 3000`). You get a URL like `https://abc123.ngrok-free.app`.
  2. In Azure, add redirect URI: `https://abc123.ngrok-free.app/api/auth/callback/azure-ad`.
  3. In `.env.local` set `NEXTAUTH_URL=https://abc123.ngrok-free.app` (no trailing slash). Restart the dev server.
  4. Open the app on your phone (or kiosk) via the ngrok URL. Sign-in will redirect through Azure and back to the HTTPS callback.
  - Free ngrok URLs change each time you restart ngrok; update both Azure and `NEXTAUTH_URL` when that happens. A fixed ngrok domain or a deployed app avoids that.
- [ ] Optional: set **Front-channel logout URL** if you implement logout.
- [ ] Do not guess tenant-specific domains; use your actual deployment URL and localhost (or tunnel URL) for development.

### 4. Room mailbox assumptions

- [ ] Rooms are **resource mailboxes** (or shared mailboxes) in Exchange / Microsoft 365.
- [ ] Room emails are configured in this app in `lib/rooms.ts` (e.g. `canvassroom@ircuwd.com`, `salesroom@ircuwd.com`). The app will use these emails to query Graph (e.g. `/users/{roomEmail}/calendarView` or equivalent).
- [ ] The app (via application permission) or the signed-in user (via delegated permission) must have access to read and optionally write these room calendars. Confirm with your tenant admin.

### 5. Environment variables

- [ ] Copy `.env.example` to `.env.local`.
- [ ] Fill in real values for `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_CLIENT_SECRET`. Do not commit `.env.local`.
- [ ] Set `MICROSOFT_GRAPH_ENABLED=true` when you are ready to use Graph (Phase 6/7).
- [ ] For Phase 7 sign-in: set `NEXTAUTH_SECRET` (e.g. `openssl rand -base64 32`) and `NEXTAUTH_URL` (e.g. `http://localhost:3000` in dev, or your production URL).
- [ ] Optional: set `NEXT_PUBLIC_BASE_URL` (or similar) for building redirect URIs.
- [ ] Optional: set `NEXT_PUBLIC_APP_URL` to your production URL so the kiosk QR code always points to the canonical booking page (e.g. `https://your-domain.com`).

---

After completing this checklist, the codebase is ready for Phase 6 (wire Graph for schedule/availability) and Phase 7 (wire auth and create reservation).
