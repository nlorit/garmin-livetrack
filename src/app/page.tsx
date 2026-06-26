"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { 
  Play, Pause, RotateCcw, MapPin, Compass, Navigation,
  Heart, Zap, Flame, Award, Crosshair, Activity, Info,
  Search, RefreshCw, User, Calendar, Radio
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
  const [selectedSession, setSelectedSession] = useState<CompletedSession | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // ✅ INITIALISATION ÉVOLUÉE : On démarre par défaut en mode "live" pour forcer l'écoute réseau
  const [mode, setMode] = useState<"live" | "history">("live");
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isDroneMode, setIsDroneMode] = useState<boolean>(true);
  
  const [speed, setSpeed] = useState<number>(0); 
  const [heartRate, setHeartRate] = useState<number>(0); 
  const [power, setPower] = useState<number>(0); 
  const [cadence, setCadence] = useState<number>(0); 
  const [distance, setDistance] = useState<number>(0); 
  const [elevation, setElevation] = useState<number>(0); 
  const [calories, setCalories] = useState<number>(0); 
  const [elapsedTime, setElapsedTime] = useState<number>(0); 
  const [peakSpeed, setPeakSpeed] = useState<number>(0);

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

  const fetchTrackData = async (fitMapBounds: boolean = false, forcedMode?: "live" | "history", targetSession?: CompletedSession | null) => {
    const activeSession = targetSession !== undefined ? targetSession : selectedSession;
    if (!activeSession) return;
    
    const targetSessionId = activeSession.sessionId;
    const targetToken = activeSession.token || activeSession.sessionToken;

    if (!targetSessionId || !targetToken) return;

    setIsLoadingTrack(true);
    const currentMode = forcedMode || mode;
    try {
      const res = await fetch(`/api/garmin?sessionId=${targetSessionId}&token=${targetToken}&mode=${currentMode}`);
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
      const res = await fetch(`/api/garmin?username=${targetUser}`);
      if (!res.ok) throw new Error("Failed to load user profile.");
      const data = await res.json();
      setProfile(data.profile);
      const active = data.activeSessions || [];
      const completed = data.completedSessions || [];
      
      setActiveSessions(active);
      setCompletedSessions(completed);
      
      // ✅ LOGIQUE FORCÉE : S'il y a du contenu (Live ou Historique), on initialise l'écoute immédiate en mode Live
      if (active.length > 0) {
        setMode("live");
        setSelectedSession(active[0]);
        fetchTrackData(true, "live", active[0]);
      } else if (completed.length > 0) {
        setMode("live"); // On démarre en mode écoute active pour intercepter la sortie du jour
        setSelectedSession(completed[0]);
        fetchTrackData(true, "live", completed[0]);
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
        setMode("live");
        setSelectedSession(active[0]);
        setInfoMsg("Une activité en direct vient de démarrer ! Mode direct activé.");
        setTimeout(() => setInfoMsg(null), 8000);
      } else if (isLiveActivityStopped) {
        setMode("history");
        setInfoMsg("L'activité en direct s'est terminée. Replay de la session disponible dans l'historique.");
        setTimeout(() => setInfoMsg(null), 8000);
        
        // Auto-switch to the completed version of the active session
        const matchingCompleted = completed.find((s: any) => s.sessionId === selectedSession?.sessionId);
        if (matchingCompleted) {
          setSelectedSession(matchingCompleted);
        } else if (completed.length > 0) {
          setSelectedSession(completed[0]);
        }
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
      const delta = (now - lastTime) / 1000;
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
  }, [mode, isPlaying, trackPoints, isDroneMode, power]);

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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#08090d] select-none text-slate-100 font-sans relative">
      <div className="absolute inset-0 pointer-events-none z-10 bg-radial-gradient from-transparent via-[#08090d]/35 to-[#08090d]" />
      
      <header className="flex shrink-0 flex-wrap items-center justify-between px-3 py-2 md:px-6 md:py-4 gap-2 border-b border-white/[0.05] bg-[#08090d]/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
            <Navigation className="w-5 h-5 fill-current rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-wider uppercase text-slate-200">Garmin LiveTrack</h1>
              {mode === "live" ? (
                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">DIFFUSION EN DIRECT</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                  <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest">REPLAY HISTORIQUE</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {profile ? `${profile.name} — ${profile.location}` : "Chargement de l'athlète..."}
            </p>
          </div>
        </div>

        <div className="flex bg-white/[0.02] border border-white/[0.06] rounded-xl p-1 z-20">
          <button 
            onClick={() => handleModeChange("live")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              mode === "live" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Activité Live</span>
          </button>
          <button 
            onClick={() => handleModeChange("history")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              mode === "history" ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Replay Historique</span>
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 gap-2 max-w-xs w-full">
          <User className="w-3.5 h-3.5 text-slate-500" />
          <input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="Rechercher un utilisateur..." className="bg-transparent border-none text-xs outline-none text-slate-200 placeholder-slate-500 w-full" />
          <button type="submit" className="text-slate-400 hover:text-white transition-colors"><Search className="w-3.5 h-3.5" /></button>
        </form>

        <div className="flex items-center gap-2">
          <button onClick={() => setIsDroneMode(!isDroneMode)} className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${isDroneMode ? "bg-cyan-500/10 border-cyan-400/30 text-cyan-400" : "bg-white/[0.02] border-white/[0.06] text-slate-400"}`}>
            <Compass className={`w-3.5 h-3.5 ${isDroneMode ? "animate-spin" : ""}`} style={{ animationDuration: '6s' }} />
            <span>Vue Drone</span>
          </button>
          {mode === "history" && (
            <div className="flex items-center bg-white/[0.02] border border-white/[0.06] rounded-xl p-1">
              <button onClick={() => setIsPlaying(!isPlaying)} disabled={trackPoints.length === 0} className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white"><Pause className="w-4 h-4" /></button>
              <button onClick={handleReset} disabled={trackPoints.length === 0} className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white"><RotateCcw className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 w-full relative z-10">
        <div className="w-full md:w-80 shrink-0 p-3 md:p-5 flex flex-row md:flex-col gap-3 md:gap-4 overflow-x-auto md:overflow-y-auto border-b md:border-b-0 md:border-r border-white/[0.05] bg-[#090b0f]/90 z-20 max-h-48 md:max-h-none">
          
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-4 relative overflow-hidden shrink-0 w-64 md:w-auto">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5 mb-2"><Radio className="w-3.5 h-3.5 text-emerald-400" />En direct</span>
              {isLoadingProfile ? (
                <div className="text-xs text-slate-400"><RefreshCw className="w-3 h-3 animate-spin text-cyan-400" /><span>Chargement...</span></div>
              ) : activeSessions.length === 0 && mode !== "live" ? (
                <div className="text-[11px] text-slate-500 italic">Aucune activité live.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {/* Mode Écoute Forcée Actif pour intercepter le flux XHR de Garmin */}
                  <button onClick={() => handleModeChange("live")} className={`flex flex-col text-left p-2.5 rounded-xl border text-xs ${mode === "live" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md animate-pulse" : "bg-white/[0.01] border-white/[0.05] text-slate-400"}`}>
                    <span className="font-semibold truncate">📡 Écoute du flux Live en cours...</span>
                  </button>
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5 mb-2"><Calendar className="w-3.5 h-3.5 text-cyan-400" />Précédentes sorties</span>
              {isLoadingProfile ? (
                <div className="text-xs text-slate-400"><RefreshCw className="w-3 h-3 animate-spin text-cyan-400" /><span>Chargement...</span></div>
              ) : completedSessions.length === 0 ? (
                <div className="text-[11px] text-slate-500 italic">Aucun historique public.</div>
              ) : (
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                  {completedSessions.map((session) => (
                    <button key={session.sessionId} onClick={() => handleSessionSelect(session, "history")} className={`flex flex-col text-left p-2 rounded-xl border text-xs transition-all ${selectedSession?.sessionId === session.sessionId && mode === "history" ? "bg-cyan-500/10 border-cyan-400/30 text-slate-100" : "bg-white/[0.01] border-white/[0.05] text-slate-400"}`}>
                      <span className="font-semibold text-slate-200 truncate">{session.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden shrink-0 w-64 md:w-auto">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-cyan-400" />{mode === "live" ? "Télémétrie temps réel" : "Télémétrie du replay"}</span>
            {isLoadingTrack ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3"><RefreshCw className="w-6 h-6 animate-spin text-cyan-400" /></div>
            ) : trackPoints.length === 0 ? <div className="text-xs text-slate-500 text-center py-6">En attente de transmission GPS...</div> : (
              <>
                <div className="flex flex-col items-center justify-center py-2 border-b border-white/[0.03]"><span className="font-mono text-5xl font-semibold tracking-tighter text-slate-100 tabular-nums">{speed.toFixed(1)}</span><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Vitesse km/h</span></div>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="flex flex-col"><span className="text-[9px] uppercase text-slate-500 font-semibold flex items-center gap-1"><Heart className="w-3 h-3 text-red-500 fill-current" />Cardio</span><span className="font-mono text-lg font-medium text-slate-200 mt-0.5 tabular-nums">{heartRate} bpm</span></div>
                  <div className="flex flex-col"><span className="text-[9px] uppercase text-slate-500 font-semibold flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-500 fill-current" />Puissance</span><span className="font-mono text-lg font-medium text-slate-200 mt-0.5 tabular-nums">{power} W</span></div>
                  <div className="flex flex-col"><span className="text-[9px] uppercase text-slate-500 font-semibold flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500 fill-current" />Calories</span><span className="font-mono text-lg font-medium text-slate-200 mt-0.5 tabular-nums">{Math.floor(calories)} kcal</span></div>
                  <div className="flex flex-col"><span className="text-[9px] uppercase text-slate-500 font-semibold flex items-center gap-1"><Compass className="w-3 h-3 text-purple-500" />Cadence</span><span className="font-mono text-lg font-medium text-slate-200 mt-0.5 tabular-nums">{cadence} rpm</span></div>
                </div>
              </>
            )}
          </div>

          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3 shrink-0 w-64 md:w-auto">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-cyan-400" />Progression</span>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs"><span className="text-slate-400">Distance</span><span className="font-mono font-medium text-slate-200">{distance.toFixed(2)} km</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">Altitude</span><span className="font-mono font-medium text-slate-200">{elevation.toFixed(0)} m</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">Temps</span><span className="font-mono font-medium text-slate-200">{formatTime(elapsedTime)}</span></div>
              <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden mt-2">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-1000" style={{ width: `${trackPoints.length > 0 ? (currentIndex / trackPoints.length) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 h-full min-h-[50vh] md:min-h-0 relative bg-[#06070a]">
          {errorMsg && (
            <div className="absolute top-4 left-4 right-4 bg-red-950/80 border border-red-500/30 rounded-xl p-3 z-30 text-xs text-red-200 flex items-center gap-2 backdrop-blur-md">
              <Info className="w-4 h-4 text-red-400 shrink-0" /><span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="absolute top-4 left-4 right-4 bg-emerald-950/80 border border-emerald-500/30 rounded-xl p-3 z-30 text-xs text-emerald-200 flex items-center gap-2 backdrop-blur-md">
              <Radio className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" /><span>{infoMsg}</span>
            </div>
          )}

          <div ref={mapContainerRef} className="w-full h-full" />

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
            className={`absolute bottom-14 right-2 md:bottom-6 md:right-6 flex items-center justify-center w-11 h-11 rounded-xl glass-panel transition-colors z-20 ${userInteractingRef.current ? "text-amber-400 animate-pulse" : "text-slate-300"}`}
          >
            <Crosshair className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}