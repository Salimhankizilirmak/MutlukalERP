"use client";

import React from "react";

type SyncStatus = "synced" | "syncing" | "offline";

interface Props {
  username: string;
  status: SyncStatus;
  onReset: () => void;
  isResetting: boolean;
}

export default function DashboardHeader({ username, status, onReset, isResetting }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 select-none">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">👋 Hoş Geldiniz, {username}</h1>
        <p className="text-slate-400 text-xs mt-1">
          Kişiselleştirilmiş widget kontrol paneliniz. Sürükleyip bırakarak düzeninizi değiştirebilirsiniz.
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {/* Stripe Kalitesinde Mikro Eşitleme Göstergesi (Sync Status Badge) */}
        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 px-3.5 py-2 rounded-xl h-11">
          <div className="relative w-2 h-2 flex items-center justify-center flex-shrink-0">
            {status === "syncing" && (
              <span 
                className="absolute inset-0 rounded-full bg-amber-400 opacity-75 animate-ping"
                style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
              />
            )}
            <span 
              className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                status === "synced" ? "bg-emerald-400" :
                status === "syncing" ? "bg-amber-400" : "bg-amber-500"
              }`}
              style={{ willChange: "opacity", transform: "translateZ(0)" }}
            />
          </div>
          <span className="text-[10px] font-bold tracking-wide uppercase text-slate-400">
            {status === "synced" ? "Bulut Eşitlendi" :
             status === "syncing" ? "Eşitleniyor..." : "Yerelde Güvende"}
          </span>
        </div>

        {/* Linear Seviyesinde Tek Tıkla Fabrika Ayarlarına Dönüş Butonu */}
        <button
          onClick={onReset}
          disabled={isResetting}
          className="h-11 px-4 flex items-center justify-center gap-2 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 hover:border-slate-600/60 disabled:opacity-50 text-xs font-bold text-white rounded-xl transition-all active:scale-[0.98] cursor-pointer"
          style={{ minWidth: "120px" }}
          title="Düzeni varsayılan şablona sıfırlar"
        >
          {isResetting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 width-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Sıfırlanıyor
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-300">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              Düzeni Sıfırla
            </>
          )}
        </button>
      </div>
    </div>
  );
}
