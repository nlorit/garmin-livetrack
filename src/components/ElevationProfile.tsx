"use client";

import React from "react";
import { Info } from "lucide-react";

interface ElevationProfileProps {
  trackPoints: any[];
  currentIndex: number;
  stepSize: number;
  elevation: number;
  selectedSession: any;
}

export default function ElevationProfile({
  trackPoints,
  currentIndex,
  stepSize,
  elevation,
  selectedSession
}: ElevationProfileProps) {
  if (trackPoints.length === 0) return null;

  const chartSteps = 60;
  const actualStepSize = Math.max(1, Math.floor(trackPoints.length / chartSteps));
  const downsampledPoints: any[] = [];
  for (let i = 0; i < trackPoints.length; i += actualStepSize) {
    downsampledPoints.push({
      elevation: trackPoints[i].elevation,
      originalIndex: i
    });
  }

  return (
    <div className="absolute bottom-14 left-2 right-2 md:bottom-6 md:left-6 md:right-auto glass-panel-heavy rounded-2xl p-3 md:p-4 flex flex-col gap-2 md:gap-2.5 z-20 max-w-sm w-auto md:w-full shadow-[0_8px_32px_rgba(0,0,0,0.7)]">
      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
        <Info className="w-3.5 h-3.5 text-cyan-400" />
        Profil d'altitude
      </span>
      <div className="flex items-end gap-[1px] h-12 pt-2">
        {downsampledPoints.map((pt, i) => {
          const elevations = downsampledPoints.map(p => p.elevation);
          const minElev = Math.min(...elevations);
          const maxElev = Math.max(...elevations);
          const heightPct = maxElev === minElev ? 50 : ((pt.elevation - minElev) / (maxElev - minElev)) * 100;
          
          const currentChartIndex = Math.floor(currentIndex / actualStepSize);
          const isCurrent = i === currentChartIndex;

          return (
            <div 
              key={i} 
              className={`flex-1 rounded-t-[1px] transition-all duration-300 ${
                isCurrent ? "bg-cyan-400 h-full" : "bg-white/[0.08] hover:bg-white/[0.15]"
              }`}
              style={{ height: `${Math.max(5, heightPct)}%`, minWidth: '3px' }}
              title={`Elevation: ${pt.elevation.toFixed(0)}m`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 font-medium font-mono">
        <span>Départ</span>
        <span className="text-cyan-400">Actuel ({elevation.toFixed(0)}m)</span>
        <span>Max ({selectedSession?.maxElevation.toFixed(0)}m)</span>
      </div>
    </div>
  );
}
