# Microsoft 365 / Outlook integration setup

This document is a checklist for enabling Microsoft Graph and Entra (Azure AD) authentication so the room display and booking app can read and write room calendars.

## Integration plan (high level)

- **Graph (read):** The app will call Microsoft Graph to get a room mailbox’s calendar view for a time range. That data drives the room display (current meeting, next meeting, today’s schedule) and availability. Implemented in Phase 6 in `lib/graph.ts` (`getRoomCalendarView`, `getRoomAvailability`).
- **Graph (write):** When a user reserves a room from the booking page, the app will create a calendar event in the room’s mailbox via Graph. Implemented in Phase 7 in `lib/graph.ts` (`createRoomReservation`).
- **Auth:** Users sign in with their Microsoft work account on the booking page. The app (or server) obtains an access token and uses it for Graph calls. Phase 7 wires `lib/auth.ts` (getAccessToken, login redirect, callback).

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
- [ ] For room resource mailboxes, ensure the app has access (admin consent for application permissions, or delegated with a user who has access to the room).
- [ ] Grant **admin consent** if using application permissions.
- [ ] Reference: [Microsoft Graph calendar permissions](https://learn.microsoft.com/en-us/graph/permissions-reference#calendar-permissions), [access room mailboxes](https://learn.microsoft.com/en-us/graph/room-list).

### 3. Redirect URIs

- [ ] In the app registration, go to **Authentication** → **Platform configurations** → **Web** (or SPA if applicable).
- [ ] Add **Redirect URIs** that match your app exactly (e.g. `https://your-domain.com/api/auth/callback`, or `https://localhost:3000/api/auth/callback` for local dev). Trailing slash and protocol must match.
- [ ] Optional: set **Front-channel logout URL** if you implement logout.
- [ ] Do not guess tenant-specific domains; use your actual deployment URL and localhost for development.

### 4. Room mailbox assumptions

- [ ] Rooms are **resource mailboxes** (or shared mailboxes) in Exchange / Microsoft 365.
- [ ] Room emails are configured in this app in `lib/rooms.ts` (e.g. `canvassroom@ircuwd.com`, `salesroom@ircuwd.com`). The app will use these emails to query Graph (e.g. `/users/{roomEmail}/calendarView` or equivalent).
- [ ] The app (via application permission) or the signed-in user (via delegated permission) must have access to read and optionally write these room calendars. Confirm with your tenant admin.

### 5. Environment variables

- [ ] Copy `.env.example` to `.env.local`.
- [ ] Fill in real values for `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_CLIENT_SECRET`. Do not commit `.env.local`.
- [ ] Set `MICROSOFT_GRAPH_ENABLED=true` when you are ready to use Graph (Phase 6/7).
- [ ] Optional: set `NEXT_PUBLIC_BASE_URL` (or similar) for building redirect URIs.

---

After completing this checklist, the codebase is ready for Phase 6 (wire Graph for schedule/availability) and Phase 7 (wire auth and create reservation).
