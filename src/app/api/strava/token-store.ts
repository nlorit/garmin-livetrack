import { NextRequest } from "next/server";

interface TokenData {
  accessToken: string;
  newTokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

export async function getAccessTokenFromRequest(request: NextRequest): Promise<TokenData | null> {
  const accessToken = request.cookies.get("strava_access_token")?.value;
  const refreshToken = request.cookies.get("strava_refresh_token")?.value;
  const expiresAtStr = request.cookies.get("strava_expires_at")?.value;

  if (!refreshToken) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = expiresAtStr ? parseInt(expiresAtStr) : 0;

  if (expiresAt - nowSeconds < 300 || !accessToken) {
    console.log("[Strava TokenStore] Token expired or missing. Refreshing...");
    const refreshed = await refreshAccessToken(refreshToken);
    if (refreshed) {
      return {
        accessToken: refreshed.access_token,
        newTokens: {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token || refreshToken,
          expiresAt: refreshed.expires_at,
        }
      };
    }
    return null;
  }

  return { accessToken };
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[Strava TokenStore] Client ID or Secret environment variable is missing.");
    return null;
  }

  try {
    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      throw new Error(`Strava returned status ${res.status}`);
    }

    return await res.json();
  } catch (e) {
    console.error("[Strava TokenStore] Error refreshing access token:", e);
    return null;
  }
}
