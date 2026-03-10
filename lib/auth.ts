/**
 * Microsoft identity / MSAL scaffolding.
 * Phase 7: implement getAccessToken, getLoginUrl, getLogoutUrl, handleCallback using MSAL.
 */

const AUTH_NOT_CONFIGURED = "Auth not configured";

export interface AuthUser {
  email: string;
  name?: string;
}

export interface AuthContext {
  isAuthenticated: boolean;
  user?: AuthUser;
}

/**
 * Get a valid access token for Microsoft Graph (e.g. for server-side or API route).
 * Phase 7: initialize MSAL, acquire token (client credentials or delegated); return token string.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!process.env.AZURE_CLIENT_ID) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[auth] " + AUTH_NOT_CONFIGURED);
    }
    return null;
  }
  throw new Error(AUTH_NOT_CONFIGURED);
}

/**
 * Get current auth session (user and auth state).
 * Phase 7: read from session/cookie or MSAL cache.
 */
export async function getAuthSession(): Promise<AuthContext | null> {
  if (!process.env.AZURE_CLIENT_ID) {
    return null;
  }
  throw new Error(AUTH_NOT_CONFIGURED);
}

/**
 * Return URL to redirect the user to Microsoft sign-in.
 * Phase 7: build MSAL login URL with redirect_uri and state.
 */
export function getLoginUrl(_returnTo?: string): string {
  throw new Error(AUTH_NOT_CONFIGURED);
}

/**
 * Return URL to sign out and optionally redirect.
 * Phase 7: build logout URL and clear local session.
 */
export function getLogoutUrl(_returnTo?: string): string {
  throw new Error(AUTH_NOT_CONFIGURED);
}

/**
 * Handle auth callback (e.g. /api/auth/callback): exchange code for token, set session.
 * Phase 7: validate state, exchange code, store token/session.
 */
export async function handleCallback(_code: string, _state?: string): Promise<{ redirectTo: string }> {
  throw new Error(AUTH_NOT_CONFIGURED);
}
