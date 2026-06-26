"use client";

import React from "react";
import { Navigation, Radio, Calendar, User, Search, Compass, Pause, Play, RotateCcw } from "lucide-react";

interface HeaderProps {
  mode: "live" | "history";
  profile: any;
  activeSessions: any[];
  usernameInput: string;
  setUsernameInput: (val: string) => void;
  handleSearchSubmit: (e: React.FormEvent) => void;
  handleModeChange: (mode: "live" | "history") => void;
  isDroneMode: boolean;
  setIsDroneMode: (val: boolean) => void;
  isPlaying: boolean;
  setIsPlaying: (val: boolean) => void;
  handleReset: () => void;
  trackPointsLength: number;
}

export default function Header({
  mode,
  profile,
  activeSessions,
  usernameInput,
  setUsernameInput,
  handleSearchSubmit,
  handleModeChange,
  isDroneMode,
  setIsDroneMode,
  isPlaying,
  setIsPlaying,
  handleReset,
  trackPointsLength
}: HeaderProps) {
  return (
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
            {profile ? `${profile.name} — ${profile.location || "Gan, France"}` : "Chargement de l'athlète..."}
          </p>
        </div>
      </div>

      <div className="flex bg-white/[0.02] border border-white/[0.06] rounded-xl p-1 z-20">
        <button 
          onClick={() => handleModeChange("live")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-20 ${
            mode === "live" 
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[inset_0_1px_0_0_rgba(52,211,153,0.15)]" 
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Activité Live</span>
        </button>
        <button 
          onClick={() => handleModeChange("history")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
            mode === "history" 
              ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[inset_0_1px_0_0_rgba(34,211,238,0.15)]" 
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Replay Historique</span>
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 gap-2 max-w-xs w-full">
        <User className="w-3.5 h-3.5 text-slate-500" />
        <input 
          type="text" 
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          placeholder="Rechercher un utilisateur..." 
          className="bg-transparent border-none text-xs outline-none text-slate-200 placeholder-slate-500 w-full"
        />
        <button type="submit" className="text-slate-400 hover:text-white transition-colors">
          <Search className="w-3.5 h-3.5" />
        </button>
      </form>

      <div className="flex items-center gap-2">
        <button 
          onClick={() => setIsDroneMode(!isDroneMode)}
          className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${
            isDroneMode 
              ? "bg-cyan-500/10 border-cyan-400/30 text-cyan-400 shadow-[inset_0_1px_0_0_rgba(34,211,238,0.15)]" 
              : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/10 hover:text-white"
          }`}
        >
          <Compass className={`w-3.5 h-3.5 ${isDroneMode ? "animate-spin" : ""}`} style={{ animationDuration: '6s' }} />
          <span>Vue Drone</span>
        </button>

        {mode === "history" && (
          <>
            <div className="w-px h-6 bg-white/[0.05] mx-1" />
            <div className="flex items-center bg-white/[0.02] border border-white/[0.06] rounded-xl p-1">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={trackPointsLength === 0}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.03] transition-colors disabled:opacity-30"
                title={isPlaying ? "Pause" : "Reprendre"}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current text-cyan-400" />}
              </button>
              <button 
                onClick={handleReset}
                disabled={trackPointsLength === 0}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.03] transition-colors disabled:opacity-30"
                title="Réinitialiser"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
