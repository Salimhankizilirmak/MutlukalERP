"use client";

import React from "react";

interface StockItem {
  id: string;
  name: string;
  sku: string | null;
  currentStock: number;
  criticalThreshold: number;
  unit: string;
  categoryName: string;
}

interface Props {
  stocks: StockItem[];
  dragHandleProps?: any; // Framer Motion drag handles pointer events
}

export default function StockStatusWidget({ stocks, dragHandleProps }: Props) {
  // Kritik ve normal ürünleri ayıralım
  const criticalItems = stocks.filter(item => item.currentStock <= item.criticalThreshold);
  const normalCount = stocks.length - criticalItems.length;

  return (
    <div className="premium-card p-6 flex flex-col h-full select-none">
      {/* Widget Header with Drag Handle */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <div>
            <h3 className="text-sm font-extrabold text-white">Anlık Depo Stok Durumu</h3>
            <p className="text-[10px] text-slate-500">Ahmet Abi için hızlı durum göstergesi</p>
          </div>
        </div>

        {/* 44x44px Geniş Dokunmatik Sürükleme Kulpu */}
        <div 
          {...dragHandleProps} 
          className="w-11 h-11 flex items-center justify-center bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 rounded-xl cursor-grab active:cursor-grabbing transition-all flex-shrink-0"
          title="Taşımak için Sürükleyin"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400">
            <circle cx="9" cy="5" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/>
            <circle cx="9" cy="19" r="1.5"/>
            <circle cx="15" cy="5" r="1.5"/>
            <circle cx="15" cy="12" r="1.5"/>
            <circle cx="15" cy="19" r="1.5"/>
          </svg>
        </div>
      </div>

      {/* Ahmet Abi için Dev Durum Göstergeleri */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Kritik Gösterge */}
        <div className={`p-4 rounded-2xl border text-center flex flex-col justify-center transition-all ${
          criticalItems.length > 0
            ? "bg-rose-500/10 border-rose-500/25 text-rose-400 shadow-lg shadow-rose-950/20"
            : "bg-slate-900/40 border-slate-800 text-slate-500"
        }`}>
          <div className="text-3xl font-black tracking-tight">{criticalItems.length}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider mt-1">KRİTİK EKSİK</div>
        </div>

        {/* Normal Gösterge */}
        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded-2xl text-center flex flex-col justify-center">
          <div className="text-3xl font-black tracking-tight">{normalCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider mt-1">STOK YETERLİ</div>
        </div>
      </div>

      {/* Kritik Malzemelerin Listesi */}
      <div className="flex-1 overflow-y-auto space-y-2 max-h-[220px] pr-1 scrollbar-thin">
        {criticalItems.map(item => (
          <div 
            key={item.id} 
            className="flex items-center justify-between p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl animate-fadeIn"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-rose-300 truncate">{item.name}</div>
              <div className="text-[9px] text-rose-400/80 font-medium uppercase tracking-wider">{item.categoryName}</div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <div className="text-xs font-extrabold text-rose-300 tabular-nums">
                {item.currentStock.toLocaleString("tr-TR")} {item.unit}
              </div>
              <div className="text-[9px] text-slate-500">Limit: {item.criticalThreshold}</div>
            </div>
          </div>
        ))}
        {criticalItems.length === 0 && (
          <div className="h-full flex items-center justify-center text-center p-6 bg-slate-950/20 border border-dashed border-slate-800 rounded-2xl">
            <div>
              <span className="text-2xl block mb-1">🎉</span>
              <p className="text-xs text-emerald-400 font-extrabold">Tüm Stoklar Güvenli Limitlerde!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
