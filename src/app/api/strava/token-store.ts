import fs from "fs";
import path from "path";

const PRIMARY_PATH = path.join(process.cwd(), "strava_tokens.json");
const FALLBACK_PATH = "/tmp/strava_tokens.json";

interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // UNIX epoch seconds
}

function getStorePath(): string {
  try {
    // Check if we can write to primary path, otherwise use fallback
    fs.writeFileSync(PRIMARY_PATH, fs.existsSync(PRIMARY_PATH) ? fs.readFileSync(PRIMARY_PATH) : "{}", { flag: "a" });
    return PRIMARY_PATH;
  } catch (e) {
    return FALLBACK_PATH;
  }
}

export function saveTokens(tokens: StravaTokens): void {
  const storePath = getStorePath();
  try {
    fs.writeFileSync(storePath, JSON.stringify(tokens, null, 2), "utf8");
    console.log(`[Strava TokenStore] Tokens saved successfully to ${storePath}`);
  } catch (e) {
    console.error("[Strava TokenStore] Failed to save tokens:", e);
  }
}

export function getTokens(): StravaTokens | null {
  const storePath = getStorePath();
  try {
    if (!fs.existsSync(storePath)) return null;
    const raw = fs.readFileSync(storePath, "utf8");
    return JSON.parse(raw) as StravaTokens;
  } catch (e) {
    console.error("[Strava TokenStore] Failed to read tokens:", e);
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens) {
    console.warn("[Strava TokenStore] No tokens found. User needs to authenticate.");
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  // Refresh if token expires in less than 5 minutes
  if (tokens.expires_at - nowSeconds < 300) {
    console.log("[Strava TokenStore] Access token expired or expiring soon. Refreshing...");
    return await refreshAccessToken(tokens.refresh_token);
  }

  return tokens.access_token;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
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

    const data = await res.json();
    const updatedTokens: StravaTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken, // fallback if not rotated
      expires_at: data.expires_at,
    };

    saveTokens(updatedTokens);
    return updatedTokens.access_token;
  } catch (e) {
    console.error("[Strava TokenStore] Error refreshing access token:", e);
    return null;
  }
}
