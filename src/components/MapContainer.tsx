"use client";

import React, { forwardRef } from "react";
import { Info, Crosshair } from "lucide-react";

interface MapContainerProps {
  errorMsg: string | null;
  trackPointsLength: number;
  handleRecenter: () => void;
  userInteracting: boolean;
  children: React.ReactNode;
}

const MapContainer = forwardRef<HTMLDivElement, MapContainerProps>(({
  errorMsg,
  trackPointsLength,
  handleRecenter,
  userInteracting,
  children
}, ref) => {
  return (
    <div className="flex-1 h-full min-h-[50vh] md:min-h-0 relative bg-[#06070a]">
      {errorMsg && (
        <div className="absolute top-4 left-4 right-4 bg-red-950/80 border border-red-500/30 rounded-xl p-3 z-30 text-xs text-red-200 flex items-center gap-2 backdrop-blur-md shadow-lg">
          <Info className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div ref={ref} className="w-full h-full" />

      {/* Recenter button */}
      <button 
        onClick={handleRecenter}
        disabled={trackPointsLength === 0}
        className={`absolute bottom-14 right-2 md:bottom-6 md:right-6 flex items-center justify-center w-11 h-11 rounded-xl glass-panel transition-colors z-20 shadow-[0_4px_20px_rgba(0,0,0,0.5)] disabled:opacity-35 ${
          userInteracting 
            ? "text-amber-400 hover:text-amber-300 border-amber-500/30 animate-pulse" 
            : "text-slate-300 hover:text-white hover:border-white/10"
        }`}
        title="Recentrer la caméra"
      >
        <Crosshair className="w-5 h-5" />
      </button>

      {children}
    </div>
  );
});

MapContainer.displayName = "MapContainer";

export default MapContainer;
