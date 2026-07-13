"use client";

import React from "react";

interface Props {
  height?: string; // İskelet yüksekliği
  className?: string;
}

export default function WidgetSkeleton({ height = "380px", className = "" }: Props) {
  return (
    <div 
      className={`premium-card p-6 flex flex-col justify-between overflow-hidden relative select-none ${className}`}
      style={{ 
        height, 
        transform: "translateZ(0)", // GPU Donanım Hızlandırmasını Etkinleştirir
        willChange: "opacity" 
      }}
    >
      {/* İskelet Pulse Animasyonu */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/10 via-slate-800/10 to-slate-900/10 animate-pulse" />

      {/* Header İskelet */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/40 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-800/50" />
          <div className="space-y-1.5">
            <div className="w-32 h-3.5 rounded-lg bg-slate-800/50" />
            <div className="w-20 h-2 rounded-md bg-slate-800/30" />
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-slate-800/30" />
      </div>

      {/* Body İçerik İskelet */}
      <div className="flex-1 py-6 space-y-4 relative z-10">
        <div className="grid grid-cols-2 gap-4">
          <div className="h-16 rounded-2xl bg-slate-800/40" />
          <div className="h-16 rounded-2xl bg-slate-800/40" />
        </div>
        
        <div className="space-y-2.5 pt-2">
          <div className="h-12 rounded-xl bg-slate-800/25" />
          <div className="h-12 rounded-xl bg-slate-800/25" />
        </div>
      </div>
    </div>
  );
}
