"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { 
  Play, Pause, RotateCcw, MapPin, Compass, Navigation,
  Heart, Zap, Flame, Award, Crosshair, Activity, Info,
  Search, RefreshCw, User, Calendar, Radio, ChevronLeft, ChevronRight, Menu, Footprints
} from "lucide-react";

interface TrackPoint {
  time: string;
  lat: number;
  lon: number;
  speed: number;
  elevation: number;
  heartRate: number;
  cadence: number;
  power: number;
  distance: number;
  elapsedTimeSecs: number;
}

interface CompletedSession {
  sessionId: string;
  token: string;
  sessionToken?: string;
  name: string;
  startDate: string;
  distance: number;
  duration: string;
  maxElevation: number;
}

interface UserProfile {
  name: string;
  location: string;
  profileImageMedium: string;
}

export default function LiveTrackDashboard() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [username, setUsername] = useState<string>("nlorit");
  const [usernameInput, setUsernameInput] = useState<string>("nlorit");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeSessions, setActiveSessions] = useState<CompletedSession[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [isStravaAuthenticated, setIsStravaAuthenticated] = useState<boolean>(true);
  const [selectedSession, setSelectedSession] = useState<CompletedSession | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Floating collapsible panels state
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);

  // Responsive state logic to close panels on mobile initial load
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsLeftPanelOpen(false);
      setIsRightPanelOpen(false);
    }
  }, []);

  // ✅ INITIALISATION ÉVOLUÉE : On démarre par défaut en mode "live" pour forcer l'écoute réseau
  const [mode, setMode] = useState<"live" | "history">("live");
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isDroneMode, setIsDroneMode] = useState<boolean>(true);
  
  const [speed, setSpeed] = useState<number>(0); 
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [heartRate, setHeartRate] = useState<number>(0); 
  const [power, setPower] = useState<number>(0); 
  const [cadence, setCadence] = useState<number>(0); 
  const [distance, setDistance] = useState<number>(0); 
  const [elevation, setElevation] = useState<number>(0); 
  const [calories, setCalories] = useState<number>(0); 
  const [elapsedTime, setElapsedTime] = useState<number>(0); 
  const [peakSpeed, setPeakSpeed] = useState<number>(0);

  const clearTelemetryState = () => {
    setTrackPoints([]);
    setCurrentIndex(0);
    setSpeed(0);
    setPeakSpeed(0);
    setHeartRate(0);
    setPower(0);
    setCadence(0);
    setDistance(0);
    setElevation(0);
    setElapsedTime(0);
    setIsPlaying(false);
  };

  const animFrameRef = useRef<number | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const cameraBearingRef = useRef<number>(15);
  const cameraZoomRef = useRef<number>(14.5);
  const cameraPitchRef = useRef<number>(52);
  const userInteractingRef = useRef<boolean>(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTrackDataRef = useRef<(fitMapBounds?: boolean, forcedMode?: "live" | "history", targetSession?: CompletedSession | null) => Promise<void>>(async () => {});

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatPace = (speedKmH: number) => {
    if (!speedKmH || speedKmH < 0.5) return "--:--";
    const totalMinutes = 60 / speedKmH;
    const mins = Math.floor(totalMinutes);
    const secs = Math.floor((totalMinutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const fetchTrackData = async (fitMapBounds: boolean = false, forcedMode?: "live" | "history", targetSession?: CompletedSession | null) => {
    const activeSession = targetSession !== undefined ? targetSession : selectedSession;
    if (!activeSession) return;
    
    const targetSessionId = activeSession.sessionId;
    const targetToken = activeSession.token || activeSession.sessionToken;

    if (!targetSessionId) return;

    if (targetSession !== undefined || trackPoints.length === 0) {
      setIsLoadingTrack(true);
    }
    const currentMode = forcedMode || mode;
    try {
      let res;
      if (targetToken === "strava") {
        res = await fetch(`/api/strava/activities?activityId=${targetSessionId}`);
      } else {
        if (!targetToken) return;
        res = await fetch(`/api/garmin?sessionId=${targetSessionId}&token=${targetToken}&mode=${currentMode}`);
      }
      if (!res.ok) throw new Error("Failed to load track points.");
      const data = await res.json();
      const points: TrackPoint[] = data.trackPoints || [];
      setTrackPoints(points);

      if (points.length > 0) {
        const lastIndex = points.length - 1;
        const currentPt = points[lastIndex];

        if (currentMode === "live") {
          setCurrentIndex(lastIndex);
          setSpeed(currentPt.speed || 0);
          setPeakSpeed(prev => Math.max(prev, currentPt.speed || 0));
          setHeartRate(currentPt.heartRate || 130);
          setPower(currentPt.power || 180);
          setCadence(currentPt.cadence || 80);
          setDistance(currentPt.distance || 0);
          setElevation(currentPt.elevation || 0);
          setElapsedTime(currentPt.elapsedTimeSecs || 0);

          if (markerRef.current) markerRef.current.setLngLat([currentPt.lon, currentPt.lat]);

          if (mapRef.current) {
            const travelSource = mapRef.current.getSource("travel-route") as maplibregl.GeoJSONSource;
            if (travelSource) {
              travelSource.setData({
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: points.map(p => [p.lon, p.lat]) }
              });
            }
            if (isDroneMode && !userInteractingRef.current) {
              mapRef.current.easeTo({
                center: [currentPt.lon, currentPt.lat],
                zoom: 14.5,
                pitch: 52,
                duration: 1000
              });
            }
          }
        } else {
          // Initialize first trackpoint metrics for replay mode so they aren't blank on load
          const startPt = points[0];
          if (startPt) {
            setSpeed(startPt.speed || 0);
            setPeakSpeed(startPt.speed || 0);
            setHeartRate(startPt.heartRate || 120);
            setPower(startPt.power || 150);
            setCadence(startPt.cadence || 80);
            setDistance(startPt.distance || 0);
            setElevation(startPt.elevation || 0);
            setElapsedTime(startPt.elapsedTimeSecs || 0);
            setCurrentIndex(0);
            if (markerRef.current) markerRef.current.setLngLat([startPt.lon, startPt.lat]);
          }
        }

        if (fitMapBounds && mapRef.current) {
          const map = mapRef.current;
          const lats = points.map(p => p.lat);
          const lons = points.map(p => p.lon);
          map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 50, duration: 1500 });
        }

        if (mapRef.current) {
          const fullRouteSource = mapRef.current.getSource("full-route") as maplibregl.GeoJSONSource;
          if (fullRouteSource) {
            fullRouteSource.setData({
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: points.map(p => [p.lon, p.lat]) }
            });
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setIsLoadingTrack(false);
    }
  };

  const fetchProfileAndSessions = async (targetUser: string) => {
    setIsLoadingProfile(true);
    setErrorMsg(null);
    try {
      // 1. Fetch Garmin profile and active sessions
      const garminRes = await fetch(`/api/garmin?username=${targetUser}`);
      if (!garminRes.ok) throw new Error("Failed to load user profile.");
      const garminData = await garminRes.json();
      setProfile(garminData.profile);
      const active = garminData.activeSessions || [];
      setActiveSessions(active);

      // 2. Fetch Strava activities
      let completed: CompletedSession[] = [];
      try {
        const stravaRes = await fetch("/api/strava/activities");
        if (stravaRes.ok) {
          const stravaData = await stravaRes.json();
          completed = stravaData.completedSessions || [];
          setIsStravaAuthenticated(true);
        } else if (stravaRes.status === 401) {
          setIsStravaAuthenticated(false);
        }
      } catch (stravaErr) {
        console.error("Failed to fetch Strava activities:", stravaErr);
        setIsStravaAuthenticated(false);
      }
      setCompletedSessions(completed);
      
      if (active.length > 0) {
        setMode("live");
        setSelectedSession(active[0]);
        fetchTrackData(true, "live", active[0]);
      } else if (completed.length > 0) {
        setMode("history");
        setSelectedSession(completed[0]);
        fetchTrackData(true, "history", completed[0]);
        setIsPlaying(true);
      } else {
        setMode("history");
        setSelectedSession(null);
        setTrackPoints([]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchProfileAndSessionsBackground = async (targetUser: string) => {
    try {
      const res = await fetch(`/api/garmin?username=${targetUser}`);
      if (!res.ok) return;
      const data = await res.json();
      const active = data.activeSessions || [];
      const completed = data.completedSessions || [];

      // Check if a live activity has started
      const hasLiveActivityStarted = active.length > 0 && activeSessions.length === 0;
      
      // Check if a live activity has stopped
      const wasLiveActivityRunning = activeSessions.length > 0;
      const isLiveActivityStopped = active.length === 0 && wasLiveActivityRunning;

      setActiveSessions(active);
      setCompletedSessions(completed);
      if (data.profile) setProfile(data.profile);

      if (hasLiveActivityStarted) {
        clearTelemetryState();
        setMode("live");
        setSelectedSession(active[0]);
        fetchTrackData(true, "live", active[0]);
        setInfoMsg("Une activité en direct vient de démarrer ! Mode direct activé.");
        setTimeout(() => setInfoMsg(null), 8000);
      } else if (isLiveActivityStopped) {
        setMode("history");
        setInfoMsg("L'activité en direct s'est terminée. Replay de la session disponible dans l'historique.");
        setTimeout(() => setInfoMsg(null), 8000);
        
        // Refresh completed sessions from Strava to include the newly completed run!
        fetchProfileAndSessions(targetUser);
      }
    } catch (err) {
      console.error("Background profile check failed:", err);
    }
  };

  useEffect(() => {
    fetchProfileAndSessions(username);
  }, [username]);

  // Polling for live activity starts/stops
  useEffect(() => {
    const interval = setInterval(() => {
      if (username) {
        fetchProfileAndSessionsBackground(username);
      }
    }, 20000); // Check every 20 seconds
    return () => clearInterval(interval);
  }, [username, activeSessions, selectedSession]);

  useEffect(() => {
    fetchTrackDataRef.current = fetchTrackData;
  });

  useEffect(() => {
    if (!selectedSession) return;
    setTrackPoints([]);

    if (mapRef.current) {
      const emptyGeoJSON = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: [] as number[][] } };
      const travelSource = mapRef.current.getSource("travel-route") as maplibregl.GeoJSONSource;
      if (travelSource) travelSource.setData(emptyGeoJSON);
      const fullSource = mapRef.current.getSource("full-route") as maplibregl.GeoJSONSource;
      if (fullSource) fullSource.setData(emptyGeoJSON);
    }

    fetchTrackData(true, mode);

    if (mode === "history") {
      setCurrentIndex(0); setElapsedTime(0); setCalories(0); setPeakSpeed(0);
    }
  }, [selectedSession]);

  // Boucle de rafraîchissement (polling) active toutes les 10 secondes
  useEffect(() => {
    if (mode === "live" && selectedSession) {
      pollingRef.current = setInterval(() => {
        console.log("🔄 [LiveTrack Polling] Interrogation des points GPS Garmin Live...");
        fetchTrackDataRef.current(false, "live");
      }, 10000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [mode, selectedSession]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const lightThemeStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        osm: { type: "raster", tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "&copy; OpenStreetMap Contributors", maxzoom: 19 },
        terrainSource: { type: "raster-dem", url: "https://tiles.mapterhorn.com/tilejson.json", encoding: "terrarium" },
        hillshadeSource: { type: "raster-dem", url: "https://tiles.mapterhorn.com/tilejson.json", encoding: "terrarium" }
      },
      layers: [
        { id: "osm", type: "raster", source: "osm" },
        { id: "hills", type: "hillshade", source: "hillshadeSource", layout: { visibility: "visible" }, paint: { "hillshade-shadow-color": "#473B24" } }
      ],
      terrain: { source: "terrainSource", exaggeration: 1 },
      sky: {}
    };

    const map = new maplibregl.Map({ container: mapContainerRef.current, style: lightThemeStyle, zoom: 12, center: [11.39085, 47.27574], pitch: 70, maxZoom: 18, maxPitch: 85 });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }));
    mapRef.current = map;

    const markerEl = document.createElement("div");
    markerEl.className = "relative flex items-center justify-center w-8 h-8";
    const innerPulse = document.createElement("div");
    innerPulse.className = "absolute w-3.5 h-3.5 bg-blue-600 rounded-full z-10 border-2 border-white shadow-[0_0_15px_#0284c7]";
    const wavePulse = document.createElement("div");
    wavePulse.className = "absolute w-8 h-8 bg-blue-500/30 rounded-full animate-ping";
    markerEl.appendChild(innerPulse); markerEl.appendChild(wavePulse);

    const marker = new maplibregl.Marker({ element: markerEl }).setLngLat([-0.389, 43.226]).addTo(map);
    markerRef.current = marker;

    const pauseDrone = () => {
      userInteractingRef.current = true;
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = setTimeout(() => {
        userInteractingRef.current = false;
        if (mapRef.current) {
          cameraBearingRef.current = mapRef.current.getBearing();
          cameraZoomRef.current = mapRef.current.getZoom();
          cameraPitchRef.current = mapRef.current.getPitch();
        }
      }, 5000);
    };

    const container = mapContainerRef.current;
    container.addEventListener("mousedown", pauseDrone);
    container.addEventListener("touchstart", pauseDrone, { passive: true });
    container.addEventListener("wheel", pauseDrone, { passive: true });

    map.on("load", () => {
      map.addSource("full-route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });
      map.addLayer({ id: "full-route-line", type: "line", source: "full-route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "rgba(0, 0, 0, 0.15)", "line-width": 4 } });
      map.addSource("travel-route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });
      map.addLayer({ id: "travel-route-line", type: "line", source: "travel-route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#0284c7", "line-width": 5, "line-blur": 1 } });
    });

    return () => {
      container.removeEventListener("mousedown", pauseDrone); container.removeEventListener("touchstart", pauseDrone); container.removeEventListener("wheel", pauseDrone);
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current); map.remove();
    };
  }, []);

  // Frame Loop de rendu Historique
  useEffect(() => {
    if (mode !== "history" || !isPlaying || trackPoints.length === 0) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let lastTime = performance.now();
    let accumulatedTime = currentIndex;

    const loop = (now: number) => {
      const delta = ((now - lastTime) / 1000) * playbackSpeed;
      lastTime = now;
      accumulatedTime = (accumulatedTime + delta) % trackPoints.length;
      
      const floorIndex = Math.floor(accumulatedTime);
      const ceilIndex = (floorIndex + 1) % trackPoints.length;
      const progress = accumulatedTime - floorIndex;

      const prevPt = trackPoints[floorIndex];
      const currentPt = trackPoints[ceilIndex];

      if (prevPt && currentPt) {
        const currentLon = prevPt.lon + (currentPt.lon - prevPt.lon) * progress;
        const currentLat = prevPt.lat + (currentPt.lat - prevPt.lat) * progress;

        if (markerRef.current) markerRef.current.setLngLat([currentLon, currentLat]);

        if (isDroneMode && mapRef.current && !userInteractingRef.current) {
          const lookAhead = Math.min(10, trackPoints.length - 1 - floorIndex);
          if (lookAhead > 0) {
            const futureIdx = floorIndex + lookAhead;
            const futurePt = trackPoints[futureIdx];
            const dLon = futurePt.lon - prevPt.lon; const dLat = futurePt.lat - prevPt.lat;
            if (Math.abs(dLon) > 0.00002 || Math.abs(dLat) > 0.00002) {
              const targetBearing = Math.atan2(dLon, dLat) * (180 / Math.PI);
              let diff = targetBearing - cameraBearingRef.current;
              while (diff < -180) diff += 360; while (diff > 180) diff -= 360;
              if (Math.abs(diff) > 10) cameraBearingRef.current += diff * 0.006;
            }
          }

          let targetZoom = 14.5; let targetPitch = 52;
          const terrainElev = mapRef.current.queryTerrainElevation({ lng: currentLon, lat: currentLat });
          if (terrainElev != null) {
            const elevDelta = Math.abs((currentPt.elevation || 0) - (prevPt.elevation || 0));
            const combined = Math.max(Math.min(terrainElev / 800, 1), Math.min(elevDelta / 5, 1));
            targetZoom = 14.5 - combined * 1.7; targetPitch = 52 - combined * 17;
          }
          cameraZoomRef.current += (targetZoom - cameraZoomRef.current) * 0.04; cameraPitchRef.current += (targetPitch - cameraPitchRef.current) * 0.04;
          mapRef.current.jumpTo({ center: [currentLon, currentLat], bearing: cameraBearingRef.current, pitch: cameraPitchRef.current, zoom: cameraZoomRef.current });
        }

        setCurrentIndex(floorIndex);
        setSpeed(currentPt.speed || 0);
        setPeakSpeed(prev => Math.max(prev, currentPt.speed || 0));
        setHeartRate(currentPt.heartRate || 130);
        setPower(currentPt.power || 180);
        setCadence(currentPt.cadence || 80);
        setDistance(currentPt.distance || 0);
        setElevation(currentPt.elevation || 0);
        setElapsedTime(currentPt.elapsedTimeSecs || floorIndex);
        setCalories(prev => prev + Math.floor((power || 150) / 100 * 0.25 * delta));

        if (mapRef.current) {
          const travelSource = mapRef.current.getSource("travel-route") as maplibregl.GeoJSONSource;
          if (travelSource) {
            const historyCoords = trackPoints.slice(0, floorIndex + 1).map(p => [p.lon, p.lat]);
            travelSource.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: historyCoords } });
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [mode, isPlaying, trackPoints, isDroneMode, power, playbackSpeed]);

  const handleReset = () => {
    setCurrentIndex(0); setElapsedTime(0); setCalories(0);
    if (trackPoints.length > 0) {
      const startPt = trackPoints[0];
      setSpeed(startPt.speed || 0); setPeakSpeed(startPt.speed || 0); setHeartRate(startPt.heartRate || 120); setPower(startPt.power || 150); setCadence(startPt.cadence || 80); setDistance(startPt.distance || 0); setElevation(startPt.elevation || 0);
      if (markerRef.current) markerRef.current.setLngLat([startPt.lon, startPt.lat]);
      if (mapRef.current) {
        const travelSource = mapRef.current.getSource("travel-route") as maplibregl.GeoJSONSource;
        if (travelSource) travelSource.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[startPt.lon, startPt.lat]] } });
        cameraBearingRef.current = 15; cameraZoomRef.current = 14.5; cameraPitchRef.current = 52;
        mapRef.current.flyTo({ center: [startPt.lon, startPt.lat], zoom: 14.5, pitch: 52, bearing: 15 });
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) setUsername(usernameInput.trim());
  };

  const handleModeChange = async (newMode: "live" | "history") => {
    setMode(newMode);
    const currentSession = selectedSession || completedSessions[0] || activeSessions[0];
    if (!currentSession) return;

    if (newMode === "live") {
      clearTelemetryState();
      await fetchTrackData(true, "live", currentSession);
    } else {
      await fetchTrackData(true, "history", currentSession);
      setCurrentIndex(0); setElapsedTime(0); setCalories(0); setPeakSpeed(0);
    }
  };

  const handleSessionSelect = async (session: CompletedSession, targetedMode: "live" | "history") => {
    setMode(targetedMode);
    setSelectedSession(session);
    await fetchTrackData(true, targetedMode, session);
  };

  const stepSize = Math.max(1, Math.floor(trackPoints.length / 60));
  const downsampledPoints: any[] = [];
  for (let i = 0; i < trackPoints.length; i += stepSize) {
    if (trackPoints[i]) downsampledPoints.push({ elevation: trackPoints[i].elevation, originalIndex: i });
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#050608] select-none text-slate-200 font-sans relative">
      {/* 🗺️ BACKGROUND FULL-SCREEN MAP */}
      <div className="absolute inset-0 z-0 bg-[#06070a]">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Radial glow vignette overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-t from-[#050608] via-transparent to-transparent opacity-85 md:opacity-40" />

      {/* 🔔 NOTIFICATIONS BANNERS */}
      {errorMsg && (
        <div className="absolute top-20 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-md bg-red-950/85 border border-red-500/30 rounded-xl p-3.5 z-50 text-xs text-red-200 flex items-center gap-2.5 backdrop-blur-xl shadow-lg glow-cyan">
          <Info className="w-4.5 h-4.5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {infoMsg && (
        <div className="absolute top-20 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-md bg-emerald-950/85 border border-emerald-500/30 rounded-xl p-3.5 z-50 text-xs text-emerald-200 flex items-center gap-2.5 backdrop-blur-xl shadow-lg glow-emerald">
          <Radio className="w-4.5 h-4.5 text-emerald-400 shrink-0 animate-pulse" />
          <span>{infoMsg}</span>
        </div>
      )}



      {/* 👑 FLOATING PREMIUM HEADER */}
      <header className="absolute top-4 left-4 right-4 h-16 neo-card rounded-2xl px-4 flex items-center justify-between gap-4 z-40">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors md:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 shrink-0">
            <Navigation className="w-4 h-4 fill-current rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs font-bold tracking-wider uppercase text-slate-100 hidden sm:inline-block">Garmin LiveTrack</h1>
              {mode === "live" ? (
                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">LIVE</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                  <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest">REPLAY</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 truncate max-w-[120px] sm:max-w-none">
              {profile ? `${profile.name} — ${profile.location}` : "Chargement..."}
            </p>
          </div>
        </div>

        {/* User Search Form */}
        <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl px-2.5 py-1.5 gap-2 max-w-xs w-48 focus-within:w-60 transition-all duration-300">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="Rechercher un athlète..." className="bg-transparent border-none text-xs outline-none text-slate-100 placeholder-slate-500 w-full" />
          <button type="submit" className="text-slate-400 hover:text-white transition-colors"><Search className="w-3.5 h-3.5" /></button>
        </form>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDroneMode(!isDroneMode)} className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${isDroneMode ? "bg-cyan-500/10 border-cyan-400/30 text-cyan-400" : "bg-white/[0.02] border-white/[0.06] text-slate-400"}`}>
            <Compass className={`w-3.5 h-3.5 ${isDroneMode ? "animate-spin" : ""}`} style={{ animationDuration: '8s' }} />
            <span className="hidden sm:inline">Drone</span>
          </button>
          
          <button 
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors md:hidden"
          >
            <Activity className="w-5 h-5 text-cyan-400" />
          </button>
        </div>
      </header>

      {/* 🚪 LEFT FLOATING PANEL: ATHLETE PROFILE & HISTORY */}
      <div className={`absolute top-24 bottom-4 left-4 right-4 md:right-auto md:w-80 z-30 transition-transform duration-500 ease-in-out ${isLeftPanelOpen ? "translate-x-0" : "-translate-x-[120%]"} pointer-events-none`}>
        <div className="w-full h-full neo-card rounded-2xl p-4 flex flex-col gap-4 overflow-y-auto pointer-events-auto">
          {/* Athlete Profile Summary */}
          {profile && (
            <div className="flex items-center gap-3 pb-3 border-b border-white/[0.04]">
              {profile.profileImageMedium ? (
                <img src={profile.profileImageMedium} alt={profile.name} className="w-10 h-10 rounded-full border border-white/[0.08] shadow-inner" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/[0.08] flex items-center justify-center text-slate-300 font-bold uppercase">{profile.name.substring(0, 2)}</div>
              )}
              <div>
                <h2 className="text-xs font-bold text-slate-100">{profile.name}</h2>
                <p className="text-[10px] text-slate-500">{profile.location || "Athlète Garmin"}</p>
              </div>
            </div>
          )}

          {/* Active Live Session Box */}
          <div>
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5 mb-2"><Radio className="w-3.5 h-3.5 text-emerald-400" />En direct</span>
            {isLoadingProfile ? (
              <div className="text-xs text-slate-400 flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /><span>Interrogation...</span></div>
            ) : activeSessions.length === 0 && mode !== "live" ? (
              <div className="text-[10px] text-slate-500 italic px-2">Aucun flux Garmin Live détecté.</div>
            ) : (
              <button 
                onClick={() => handleModeChange("live")} 
                className={`w-full text-left p-3 rounded-xl border text-xs transition-all duration-300 ${mode === "live" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 glow-emerald" : "bg-white/[0.01] border-white/[0.04] text-slate-400"}`}
              >
                <span className="font-bold flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  📡 Écoute active du flux Live...
                </span>
              </button>
            )}
          </div>

          {/* History sessions list */}
          <div className="flex-1 flex flex-col min-h-0">
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5 mb-2 shrink-0"><Calendar className="w-3.5 h-3.5 text-cyan-400" />Activités récentes</span>
            {!isStravaAuthenticated ? (
              <div className="flex flex-col items-center justify-center p-3.5 bg-orange-500/5 border border-orange-500/15 rounded-xl gap-2 mt-1">
                <span className="text-[9px] text-slate-400 text-center leading-normal">Connectez votre Strava pour synchroniser l'historique.</span>
                <a 
                  href="/api/strava/auth" 
                  className="w-full text-center bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-bold py-1.5 px-3 rounded-lg transition-colors uppercase shadow-sm"
                >
                  Se connecter à Strava
                </a>
              </div>
            ) : isLoadingProfile ? (
              <div className="text-xs text-slate-400 flex items-center gap-2 py-4"><RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /><span>Chargement de l'historique...</span></div>
            ) : completedSessions.length === 0 ? (
              <div className="text-[10px] text-slate-500 italic px-2">Aucune activité Strava trouvée.</div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5">
                {completedSessions.map((session) => {
                  const isSelected = selectedSession?.sessionId === session.sessionId && mode === "history";
                  return (
                    <button 
                      key={session.sessionId} 
                      onClick={() => handleSessionSelect(session, "history")} 
                      className={`flex flex-col text-left p-2.5 rounded-xl border text-[11px] transition-all duration-300 hover:translate-x-1 ${isSelected ? "bg-cyan-500/10 border-cyan-400/30 text-slate-100 shadow-md" : "bg-white/[0.01] border-white/[0.04] text-slate-400"}`}
                    >
                      <span className="font-bold text-slate-200 truncate">{session.name}</span>
                      <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500">
                        <span>{session.distance.toFixed(1)} km</span>
                        <span>•</span>
                        <span>{session.startDate ? new Date(session.startDate).toLocaleDateString() : ""}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🚪 RIGHT FLOATING PANEL: REALTIME TELEMETRY WIDGETS */}
      <div className={`absolute top-24 bottom-4 left-4 right-4 md:left-auto md:w-80 z-30 transition-transform duration-500 ease-in-out ${isRightPanelOpen ? "translate-x-0" : "translate-x-[120%]"} pointer-events-none`}>
        <div className="w-full h-full neo-card rounded-2xl p-4 flex flex-col gap-4 overflow-y-auto pointer-events-auto">
          
          {/* Dial Speedometer circular gauge */}
          <div className="flex flex-col items-center justify-center p-2 bg-white/[0.01] border border-white/[0.03] rounded-2xl relative overflow-hidden">
            {isLoadingTrack ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3"><RefreshCw className="w-7 h-7 animate-spin text-cyan-400" /></div>
            ) : trackPoints.length === 0 ? (
              <div className="text-[10px] text-slate-500 text-center py-10">En attente de transmission GPS...</div>
            ) : (
              <div className="relative w-40 h-40 flex items-center justify-center">
                {/* SVG circular speedometer indicator */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="80" cy="80" r="60" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
                  <circle 
                    cx="80" 
                    cy="80" 
                    r="60" 
                    fill="transparent" 
                    stroke="url(#speed-gradient)" 
                    strokeWidth="6" 
                    strokeDasharray="377" 
                    strokeDashoffset={377 - (377 * Math.min(speed, 25)) / 25} 
                    strokeLinecap="round" 
                    className="transition-all duration-500 ease-out" 
                  />
                  <defs>
                    <linearGradient id="speed-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Speed readout converted to Pace */}
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="font-mono text-3xl font-bold tracking-tight text-slate-100 tabular-nums">{formatPace(speed)}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Allure /km</span>
                </div>
              </div>
            )}
          </div>

          {/* Core metrics cards */}
          {trackPoints.length > 0 && !isLoadingTrack && (
            <div className="flex flex-col gap-3">
              {/* Cardio Card with Beating animation & background trace */}
              <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl relative overflow-hidden group">
                <div className="absolute bottom-0 left-0 right-0 h-8 opacity-20 pointer-events-none">
                  {/* ECG trace visual indicator */}
                  <svg className="w-full h-full text-rose-500" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <path d="M0,10 L30,10 L33,2 L36,18 L39,10 L43,10 L45,2 L48,18 L51,10 L100,10" fill="none" stroke="currentColor" strokeWidth="1.2" className="animate-pulse" />
                  </svg>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase text-slate-500 font-bold tracking-wider flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-current animate-heartbeat" />
                      Cardio
                    </span>
                    <span className="font-mono text-xl font-bold text-slate-200 mt-1 block tabular-nums">{heartRate} <span className="text-[10px] font-normal text-slate-500">bpm</span></span>
                  </div>
                </div>
              </div>

              {/* Altitude Card */}
              <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                <span className="text-[9px] uppercase text-slate-500 font-bold tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                  Altitude
                </span>
                <span className="font-mono text-xl font-bold text-slate-200 mt-1 block tabular-nums">{elevation.toFixed(0)} <span className="text-[10px] font-normal text-slate-500">m</span></span>
                {/* Elevation bar */}
                <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-500 ease-out" style={{ width: `${Math.min((elevation / 1000) * 100, 100)}%` }} />
                </div>
              </div>

              {/* Running Cadence Card with Steps Per Minute (SPM) */}
              <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase text-slate-500 font-bold tracking-wider flex items-center gap-1.5">
                    <Footprints className="w-3.5 h-3.5 text-purple-500" />
                    Cadence running
                  </span>
                  <span className="font-mono text-xl font-bold text-slate-200 mt-1 block tabular-nums">
                    {cadence < 120 ? cadence * 2 : cadence} <span className="text-[10px] font-normal text-slate-500">spm</span>
                  </span>
                </div>
                {/* Pulsing Footprints */}
                <div className="w-10 h-10 rounded-full border border-white/[0.05] flex items-center justify-center bg-white/[0.01]">
                  <Footprints 
                    className="w-5 h-5 text-purple-400" 
                    style={{ 
                      animation: `heartbeat ${60 / Math.max(cadence < 120 ? cadence * 2 : cadence, 80)}s infinite ease-in-out` 
                    }} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* Progression card details */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3 mt-auto">
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-cyan-400" />Progression</span>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs"><span className="text-slate-400">Distance</span><span className="font-mono font-medium text-slate-200">{distance.toFixed(2)} km</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">Altitude</span><span className="font-mono font-medium text-slate-200">{elevation.toFixed(0)} m</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">Temps</span><span className="font-mono font-medium text-slate-200">{formatTime(elapsedTime)}</span></div>
              
              {/* Timeline slider progress */}
              <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden mt-2 relative">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-all duration-1000" style={{ width: `${trackPoints.length > 0 ? (currentIndex / trackPoints.length) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📱 MOBILE BOTTOM METRICS BAR (Visible only on phone/tablet, hidden on desktop) */}
      {trackPoints.length > 0 && !isLoadingTrack && (
        <div className="absolute bottom-20 left-4 right-4 md:hidden neo-card rounded-2xl p-3 z-30 pointer-events-auto flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-1 divide-x divide-white/[0.04] text-center">
            <div className="flex flex-col justify-center">
              <span className="text-[8px] uppercase text-slate-500 font-bold tracking-wider">Allure</span>
              <span className="font-mono text-sm font-extrabold text-cyan-400 tabular-nums">{formatPace(speed)}</span>
            </div>
            <div className="flex flex-col justify-center pl-1">
              <span className="text-[8px] uppercase text-slate-500 font-bold tracking-wider">Cardio</span>
              <span className="font-mono text-sm font-extrabold text-rose-500 tabular-nums flex items-center justify-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {heartRate}
              </span>
            </div>
            <div className="flex flex-col justify-center pl-1">
              <span className="text-[8px] uppercase text-slate-500 font-bold tracking-wider">Distance</span>
              <span className="font-mono text-sm font-extrabold text-slate-200 tabular-nums">{distance.toFixed(1)} <span className="text-[7px] font-normal text-slate-500">km</span></span>
            </div>
            <div className="flex flex-col justify-center pl-1">
              <span className="text-[8px] uppercase text-slate-500 font-bold tracking-wider">Cadence</span>
              <span className="font-mono text-sm font-extrabold text-purple-400 tabular-nums">{cadence < 120 ? cadence * 2 : cadence} <span className="text-[7px] font-normal text-slate-500">spm</span></span>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ CENTRAL BOTTOM MAP CONTROLS & TIMELINE CONTROLS (Floating) */}
      <div className="absolute bottom-4 left-4 right-4 md:left-80 md:right-80 h-14 neo-card rounded-2xl px-4 flex items-center justify-between z-30 pointer-events-auto">
        {mode === "history" ? (
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              disabled={trackPoints.length === 0} 
              className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-white/[0.05] text-slate-300 hover:text-white transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <button 
              onClick={handleReset} 
              disabled={trackPoints.length === 0} 
              className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-white/[0.05] text-slate-300 hover:text-white transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                const nextSpeed = playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 5 : playbackSpeed === 5 ? 10 : 1;
                setPlaybackSpeed(nextSpeed);
              }}
              disabled={trackPoints.length === 0}
              className="flex items-center justify-center h-9 px-2 rounded-xl hover:bg-white/[0.05] text-[10px] font-mono font-bold text-slate-300 hover:text-white transition-colors shrink-0"
            >
              {playbackSpeed}x
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${activeSessions.length > 0 ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" : "bg-slate-500 animate-pulse"}`} />
            <span className={`text-[10px] font-bold tracking-wider uppercase ${activeSessions.length > 0 ? "text-emerald-400" : "text-slate-500"}`}>
              {activeSessions.length > 0 ? "Direct Actif" : "Écoute Live"}
            </span>
          </div>
        )}

        {/* Timeline slider pointer */}
        {trackPoints.length > 0 && (
          <div className="flex-1 mx-1 sm:mx-6 flex items-center gap-1.5 sm:gap-3 min-w-0">
            <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 tabular-nums shrink-0">{formatTime(elapsedTime)}</span>
            <input 
              type="range" 
              min="0" 
              max={trackPoints.length - 1} 
              value={currentIndex} 
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                setCurrentIndex(idx);
                const pt = trackPoints[idx];
                if (pt) {
                  setSpeed(pt.speed || 0);
                  setHeartRate(pt.heartRate || 120);
                  setPower(pt.power || 150);
                  setCadence(pt.cadence || 80);
                  setDistance(pt.distance || 0);
                  setElevation(pt.elevation || 0);
                  setElapsedTime(pt.elapsedTimeSecs || idx);
                  if (markerRef.current) markerRef.current.setLngLat([pt.lon, pt.lat]);
                }
              }}
              className="flex-1 min-w-[50px] sm:min-w-[100px] h-1 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
            />
            <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 tabular-nums shrink-0">
              {trackPoints.length > 0 ? formatTime(trackPoints[trackPoints.length - 1].elapsedTimeSecs || trackPoints.length) : "00:00:00"}
            </span>
          </div>
        )}

        {/* Focus center map marker */}
        <button 
          onClick={() => {
            userInteractingRef.current = false;
            if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
            if (mapRef.current && trackPoints.length > 0) {
              const currentPt = trackPoints[currentIndex];
              mapRef.current.flyTo({ center: [currentPt.lon, currentPt.lat], zoom: 14.5, pitch: 52, bearing: mapRef.current.getBearing(), essential: true });
            }
          }}
          disabled={trackPoints.length === 0}
          className={`flex items-center justify-center w-9 h-9 rounded-xl hover:bg-white/[0.05] transition-colors ${userInteractingRef.current ? "text-amber-400 animate-pulse" : "text-slate-300 hover:text-white"}`}
        >
          <Crosshair className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* 🚀 COLLAPSIBLE TOGGLE SIDE BUTTONS */}
      <button 
        onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-6 h-14 neo-card rounded-r-xl hidden md:flex items-center justify-center z-40 text-slate-400 hover:text-white transition-all ${isLeftPanelOpen ? "left-80" : "left-0"}`}
      >
        {isLeftPanelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <button 
        onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
        className={`absolute right-0 top-1/2 -translate-y-1/2 w-6 h-14 neo-card rounded-l-xl hidden md:flex items-center justify-center z-40 text-slate-400 hover:text-white transition-all ${isRightPanelOpen ? "right-80" : "right-0"}`}
      >
        {isRightPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </div>
  );
}