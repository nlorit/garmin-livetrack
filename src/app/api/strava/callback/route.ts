import { NextRequest, NextResponse } from "next/server";


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const host = request.headers.get("host") || "garmin.nathan-lorit.com";
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const rootUrl = `${protocol}://${host}/`;

  if (error) {
    return NextResponse.redirect(`${rootUrl}?error=${encodeURIComponent("Strava Auth Error: " + error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${rootUrl}?error=${encodeURIComponent("Missing authorization code.")}`);
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${rootUrl}?error=${encodeURIComponent("Server Configuration Error: Strava credentials not configured.")}`);
  }

  try {
    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) {
      throw new Error(`Token exchange returned status ${res.status}`);
    }

    const data = await res.json();
    
    const redirectUrl = `${rootUrl}?info=${encodeURIComponent("Strava connecté avec succès !")}`;
    const response = NextResponse.redirect(redirectUrl);

    // Save tokens inside secure HTTP-only cookies for 1 year
    const maxAge = 365 * 24 * 60 * 60;
    response.cookies.set("strava_access_token", data.access_token, { maxAge, path: "/", httpOnly: true, secure: true, sameSite: "lax" });
    response.cookies.set("strava_refresh_token", data.refresh_token, { maxAge, path: "/", httpOnly: true, secure: true, sameSite: "lax" });
    response.cookies.set("strava_expires_at", data.expires_at.toString(), { maxAge, path: "/", httpOnly: true, secure: true, sameSite: "lax" });

    return response;
  } catch (e: any) {
    console.error("Strava Token Exchange failed:", e);
    return NextResponse.redirect(`${rootUrl}?error=${encodeURIComponent("Failed to exchange tokens: " + e.message)}`);
  }
}
