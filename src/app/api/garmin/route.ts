import { NextRequest, NextResponse } from "next/server";

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

// Extraction des données Next.js SSR pour le mode Historique
function extractNextData(html: string): string {
  const regex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g;
  let merged = "";
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const unescaped = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
      merged += unescaped;
    } catch (e) {
      console.error("Error decoding match:", e);
    }
  }
  return merged;
}

// Extraction des blocs de requêtes GraphQL / React Query pour le mode Historique
function findAllQueries(text: string): any[] {
  const regex = /"queries"\s*:\s*\[/g;
  let match;
  let allQueries: any[] = [];

  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    let bracketCount = 1;
    let i = text.indexOf("[", start) + 1;

    while (i < text.length && bracketCount > 0) {
      if (text[i] === "[") {
        bracketCount++;
      } else if (text[i] === "]") {
        bracketCount--;
      }
      i++;
    }

    if (bracketCount === 0) {
      const block = text.substring(start, i);
      try {
        const parsed = JSON.parse("{" + block + "}");
        if (parsed.queries) {
          allQueries = allQueries.concat(parsed.queries);
        }
      } catch (e) {
        console.error("Error parsing queries block:", e);
      }
    }
  }
  return allQueries;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const sessionId = searchParams.get("sessionId");
  const token = searchParams.get("token");

  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
  };

  try {
    if (sessionId && token) {
      // 🛰️ UNIFIED TELEMETRY FETCH VIA SCRAPING (Works for both Live and History sessions)
      const targetUrl = `https://livetrack.garmin.com/session/${sessionId}/token/${token}`;

      const response = await fetch(targetUrl, { headers });

      if (!response.ok) {
        return jsonResponse({ error: `Garmin Live session returned status ${response.status}` }, response.status);
      }

      const html = await response.text();
      const mergedData = extractNextData(html);
      const queries = findAllQueries(mergedData);

      let sessionInfo = null;
      let rawPoints: any[] = [];

      for (const q of queries) {
        const key = q.getqueryKey || q.queryKey || [];
        const state = q.state || {};
        const qdata = state.data || {};

        if (key.length >= 3 && key[0] === "session" && key[1] === sessionId && key[2] === token) {
          if (key.length === 3) {
            sessionInfo = qdata;
          } else if (key[3] === "track-points" || key[3] === "points") {
            const pages = qdata.pages || [];
            for (const page of pages) {
              if (page.trackPoints) {
                rawPoints = rawPoints.concat(page.trackPoints);
              } else if (page.points) {
                rawPoints = rawPoints.concat(page.points);
              }
            }
          }
        }
      }

      // If we couldn't find points in paginated format, check if they are in a flat array inside one of the queries
      if (rawPoints.length === 0) {
        for (const q of queries) {
          const state = q.state || {};
          const qdata = state.data || {};
          if (Array.isArray(qdata)) {
            rawPoints = qdata;
            break;
          } else if (qdata && Array.isArray(qdata.trackPoints)) {
            rawPoints = qdata.trackPoints;
            break;
          } else if (qdata && Array.isArray(qdata.points)) {
            rawPoints = qdata.points;
            break;
          }
        }
      }

      return jsonResponse({
        sessionInfo,
        trackPoints: rawPoints.map((tp: any) => ({
          time: tp.dateTime || tp.time || tp.timestamp,
          lat: tp.position?.lat ?? tp.latitude ?? tp.lat,
          lon: tp.position?.lon ?? tp.position?.lng ?? tp.longitude ?? tp.lon ?? tp.lng,
          speed: tp.speedMetersPerSec != null ? tp.speedMetersPerSec * 3.6 : (tp.speed ? tp.speed * 3.6 : undefined),
          elevation: tp.altitude ?? tp.altitudeMeters ?? tp.elevation,
          heartRate: tp.heartRateBeatsPerMin ?? tp.heartRate,
          cadence: tp.cadenceCyclesPerMin ?? tp.cadence,
          power: tp.powerWatts ?? tp.power,
          distance: tp.totalDistanceMeters != null ? tp.totalDistanceMeters / 1000 : (tp.distance ? tp.distance / 1000 : undefined),
          elapsedTimeSecs: tp.totalDurationSecs ?? tp.durationSecs ?? tp.elapsedTimeSecs,
        })),
      });

    } else if (username) {
      // 👤 Resolve profile sessions and active session
      const targetUrl = `https://live.garmin.com/${username}`;
      const response = await fetch(targetUrl, {
        headers,
        redirect: "follow", // Follow redirects to see if Garmin points directly to an active session page
      });

      if (!response.ok) {
        return jsonResponse({ error: `Garmin returned status ${response.status}` }, response.status);
      }

      const finalUrl = response.url;
      const html = await response.text();

      // Check if redirected directly to an active session
      const sessionUrlMatch = finalUrl.match(/\/session\/([A-Za-z0-9-]+)\/token\/([A-Za-z0-9]+)/);
      let activeSessions: any[] = [];
      let completedSessions: any[] = [];
      let profile = null;

      if (sessionUrlMatch) {
        activeSessions.push({
          sessionId: sessionUrlMatch[1],
          token: sessionUrlMatch[2],
          name: "Active Session",
          startDate: new Date().toISOString(),
          distance: 0,
          duration: "00:00:00",
          maxElevation: 0,
        });
      }

      // Try next SSR query extraction (which fetches profile, name, completed/active sessions with full details)
      const mergedData = extractNextData(html);
      const queries = findAllQueries(mergedData);

      for (const q of queries) {
        const key = q.getqueryKey || q.queryKey || [];
        const state = q.state || {};
        const qdata = state.data || {};

        if (key.length >= 3 && key[0] === "user") {
          if (key[2] === "profile") {
            profile = qdata;
          } else if (key[2] === "sessions") {
            const pages = qdata.pages || [];
            for (const page of pages) {
              if (page.activeSessions && activeSessions.length === 0) {
                activeSessions = activeSessions.concat(page.activeSessions.map((s: any) => ({
                  sessionId: s.sessionId,
                  token: s.sessionToken,
                  name: s.sessionName || "Active Session",
                  startDate: s.startDate,
                  distance: s.distance / 1000,
                  duration: s.duration,
                  maxElevation: s.maxElevation,
                })));
              }
              if (page.completedSessions) {
                completedSessions = completedSessions.concat(page.completedSessions.map((s: any) => ({
                  sessionId: s.sessionId,
                  token: s.sessionToken,
                  name: s.sessionName || "Completed Session",
                  startDate: s.startDate,
                  distance: s.distance / 1000,
                  duration: s.duration,
                  maxElevation: s.maxElevation,
                })));
              }
            }
          }
        }
      }



      // Fallback profile if query parsing failed
      if (!profile) {
        profile = {
          name: username,
          location: "Garmin Athlete",
          profileImageMedium: "",
        };
      }

      return jsonResponse({
        profile,
        activeSessions,
        completedSessions,
      });
    }

    return jsonResponse({ error: "Missing required parameters" }, 400);
  } catch (err: any) {
    console.error("API error:", err);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
}