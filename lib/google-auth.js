export const GOOGLE_OAUTH_STATE_COOKIE = "pubesto_google_oauth_state";
export const GOOGLE_OAUTH_REDIRECT_COOKIE = "pubesto_google_oauth_redirect";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export function getSafeAuthRedirect(value, fallback = "/account") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export function getGoogleAuthConfig(request) {
  const origin = new URL(request.url).origin;
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`,
  };
}

export function buildGoogleAuthorizationUrl({ clientId, redirectUri, state }) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeGoogleCode({ code, clientId, clientSecret, redirectUri }) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google token exchange failed.");
  }

  return data;
}

export async function fetchGoogleProfile(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const profile = await response.json().catch(() => ({}));
  if (!response.ok || !profile.sub || !profile.email || profile.email_verified === false) {
    throw new Error(profile.error_description || profile.error || "Google profile fetch failed.");
  }

  return profile;
}
