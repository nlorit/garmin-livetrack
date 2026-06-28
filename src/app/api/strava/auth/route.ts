import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "STRAVA_CLIENT_ID environment variable is not set." }, { status: 500 });
  }

  // Determine host for redirect URI dynamically if not set
  const host = request.headers.get("host") || "garmin.nathan-lorit.com";
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const defaultRedirectUri = `${protocol}://${host}/api/strava/callback`;
  const redirectUri = process.env.STRAVA_REDIRECT_URI || defaultRedirectUri;

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=activity:read,activity:read_all&approval_prompt=auto`;

  return NextResponse.redirect(stravaAuthUrl);
}
