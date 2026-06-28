import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getTokens } from "../token-store";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function jsonResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get("activityId");

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return jsonResponse({ authenticated: false, error: "Strava not connected. Please login first." }, 401);
  }

  const headers = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
  };

  try {
    if (activityId) {
      // 🛰️ FETCH SINGLE ACTIVITY DETAILS & STREAMS
      const [activityRes, streamsRes] = await Promise.all([
        fetch(`https://www.strava.com/api/v3/activities/${activityId}`, { headers }),
        fetch(`https://www.strava.com/api/v3/activities/${activityId}/streams?keys=latlng,time,altitude,heartrate,cadence,distance&key_by_type=true`, { headers })
      ]);

      if (!activityRes.ok || !streamsRes.ok) {
        return jsonResponse({ error: `Strava streams retrieval failed. Statuses: ${activityRes.status}, ${streamsRes.status}` }, 400);
      }

      const activity = await activityRes.json();
      const streams = await streamsRes.json();

      const latlngs = streams.latlng?.data || [];
      const times = streams.time?.data || [];
      const heartrates = streams.heartrate?.data || [];
      const cadences = streams.cadence?.data || [];
      const altitudes = streams.altitude?.data || [];
      const distances = streams.distance?.data || [];

      const startDateMs = new Date(activity.start_date).getTime();

      const trackPoints = latlngs.map((ll: [number, number], idx: number) => {
        let speedKmH = 0;
        if (idx > 0 && times[idx] !== undefined && times[idx - 1] !== undefined) {
          const dDist = (distances[idx] || 0) - (distances[idx - 1] || 0); // meters
          const dTime = times[idx] - times[idx - 1]; // seconds
          if (dTime > 0) {
            speedKmH = (dDist / dTime) * 3.6; // convert m/s to km/h
          }
        } else if (activity.average_speed) {
          speedKmH = activity.average_speed * 3.6;
        }

        return {
          time: new Date(startDateMs + (times[idx] || 0) * 1000).toISOString(),
          lat: ll[0],
          lon: ll[1],
          speed: speedKmH,
          elevation: altitudes[idx] ?? activity.elev_low ?? 0,
          heartRate: heartrates[idx] ?? 130, // fallback average HR is handled by UI
          cadence: cadences[idx] ?? 85,
          power: 0,
          distance: (distances[idx] || 0) / 1000,
          elapsedTimeSecs: times[idx] || 0,
        };
      });

      return jsonResponse({
        sessionInfo: {
          sessionId: activity.id.toString(),
          token: "strava",
          name: activity.name,
          startDate: activity.start_date,
          distance: activity.distance / 1000,
          duration: activity.moving_time,
          maxElevation: activity.total_elevation_gain || 0,
        },
        trackPoints,
      });

    } else {
      // 📋 FETCH RECENT ACTIVITIES LIST
      const res = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=15", { headers });
      if (!res.ok) {
        throw new Error(`Strava activities list returned status ${res.status}`);
      }

      const activities = await res.json();
      const completedSessions = activities.map((act: any) => {
        const hours = Math.floor(act.moving_time / 3600);
        const minutes = Math.floor((act.moving_time % 3600) / 60);
        const seconds = act.moving_time % 60;
        const durationStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

        return {
          sessionId: act.id.toString(),
          token: "strava",
          name: `${act.type === "Run" ? "🏃 " : act.type === "Ride" ? "🚴 " : "🏋️ "}${act.name}`,
          startDate: act.start_date,
          distance: act.distance / 1000,
          duration: durationStr,
          maxElevation: act.total_elevation_gain || 0,
        };
      });

      return jsonResponse({
        authenticated: true,
        completedSessions,
      });
    }
  } catch (e: any) {
    console.error("Strava API fetch error:", e);
    return jsonResponse({ error: e.message || "Failed to query Strava API" }, 500);
  }
}
