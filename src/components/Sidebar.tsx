"use client";

import React from "react";
import { Activity, Heart, Zap, Flame, Compass, MapPin, Award, RefreshCw, Calendar } from "lucide-react";

interface SidebarProps {
  mode: "live" | "history";
  isLoadingProfile: boolean;
  isLoadingTrack: boolean;
  activeSessions: any[];
  completedSessions: any[];
  selectedSession: any;
  setSelectedSession: (s: any) => void;
  trackPoints: any[];
  speed: number;
  heartRate: number;
  power: number;
  cadence: number;
  calories: number;
  distance: number;
  elevation: number;
  elapsedTime: number;
  peakSpeed: number;
  currentIndex: number;
  formatTime: (secs: number) => string;
}

export default function Sidebar({
  mode,
  isLoadingProfile,
  isLoadingTrack,
  activeSessions,
  completedSessions,
  selectedSession,
  setSelectedSession,
  trackPoints,
  speed,
  heartRate,
  power,
  cadence,
  calories,
  distance,
  elevation,
  elapsedTime,
  peakSpeed,
  currentIndex,
  formatTime
}: SidebarProps) {
  return (
    <div className="w-full md:w-80 shrink-0 p-3 md:p-5 flex flex-row md:flex-col gap-3 md:gap-4 overflow-x-auto md:overflow-y-auto border-b md:border-b-0 md:border-r border-white/[0.05] bg-[#090b0f]/90 z-20 max-h-48 md:max-h-none">
      
      {/* Session list */}
      <div className="glass-panel rounded-2xl p-4 hidden md:flex flex-col gap-2 relative overflow-hidden">
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          {mode === "live" ? "Sessions en direct" : "Sessions terminées"}
        </span>

        {isLoadingProfile ? (
          <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-400">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Chargement des sessions...</span>
          </div>
        ) : mode === "live" ? (
          activeSessions.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-4">Aucune activité en cours.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {activeSessions.map((session) => (
                <button
                  key={session.sessionId}
                  className="flex flex-col text-left p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-slate-100 text-xs"
                >
                  <span className="font-semibold text-emerald-400 truncate">{session.name}</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">Début : {new Date(session.startDate).toLocaleTimeString()}</span>
                </button>
              ))}
            </div>
          )
        ) : completedSessions.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4">Aucune session publique trouvée.</div>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
            {completedSessions.map((session) => (
              <button
                key={session.sessionId}
                onClick={() => setSelectedSession(session)}
                className={`flex flex-col text-left p-2.5 rounded-xl border text-xs transition-all ${
                  selectedSession?.sessionId === session.sessionId && mode === "history"
                    ? "bg-cyan-500/10 border-cyan-400/30 text-slate-100"
                    : "bg-white/[0.01] border-white/[0.05] text-slate-400 hover:bg-white/[0.03]"
                }`}
              >
                <span className="font-semibold text-slate-200 truncate">{session.name}</span>
                <div className="flex justify-between w-full text-[10px] text-slate-500 mt-1">
                  <span>{session.distance.toFixed(1)} km</span>
                  <span>{new Date(session.startDate).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Telemetry Metrics */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          {mode === "live" ? "Télémétrie temps réel" : "Télémétrie du replay"}
        </span>

        {isLoadingTrack ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
            <span className="text-xs text-slate-400">Chargement des points GPS...</span>
          </div>
        ) : trackPoints.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-6">Sélectionnez une session pour charger les données.</div>
        ) : (
          <>
            <div className="flex flex-col items-center justify-center py-2 border-b border-white/[0.03]">
              <span className="font-mono text-5xl font-semibold tracking-tighter text-slate-100 tabular-nums">
                {speed.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Vitesse km/h</span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                  <Heart className="w-3 h-3 text-red-500 fill-current" />
                  Fréquence cardiaque
                </span>
                <span className="font-mono text-lg font-medium text-slate-200 mt-0.5 tabular-nums">
                  {heartRate} <span className="text-xs text-slate-500">bpm</span>
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-500 fill-current" />
                  Puissance
                </span>
                <span className="font-mono text-lg font-medium text-slate-200 mt-0.5 tabular-nums">
                  {power} <span className="text-xs text-slate-500">W</span>
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                  <Flame className="w-3 h-3 text-orange-500 fill-current" />
                  Calories
                </span>
                <span className="font-mono text-lg font-medium text-slate-200 mt-0.5 tabular-nums">
                  {Math.floor(calories)} <span className="text-xs text-slate-500">kcal</span>
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                  <Compass className="w-3 h-3 text-purple-500" />
                  Cadence
                </span>
                <span className="font-mono text-lg font-medium text-slate-200 mt-0.5 tabular-nums">
                  {cadence} <span className="text-xs text-slate-500">rpm</span>
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Progression */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          Progression
        </span>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Distance totale</span>
            <span className="font-mono font-medium text-slate-200">{distance.toFixed(2)} km</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Altitude actuelle</span>
            <span className="font-mono font-medium text-slate-200">{elevation.toFixed(0)} m</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Temps écoulé</span>
            <span className="font-mono font-medium text-slate-200">{formatTime(elapsedTime)}</span>
          </div>

          <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden mt-2">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-1000" 
              style={{ width: `${trackPoints.length > 0 ? (currentIndex / trackPoints.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Records */}
      <div className="glass-panel rounded-2xl p-4 hidden md:flex flex-col gap-3">
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-yellow-500" />
          Records
        </span>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Vitesse max</span>
            <span className="font-mono font-medium text-slate-200 text-yellow-500">{peakSpeed.toFixed(1)} km/h</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Altitude max</span>
            <span className="font-mono font-medium text-slate-200">
              {selectedSession ? `${selectedSession.maxElevation.toFixed(0)} m` : "--"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
