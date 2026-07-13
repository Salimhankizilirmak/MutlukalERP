"use client";

import React from "react";

interface WorkOrder {
  id: string;
  firma: string;
  productName: string;
  machineName: string;
  targetQty: number;
  status: string; // "ok" | "shortage" | "unknown_product"
  missingItems: Array<{ name: string; needed: number; current: number; unit: string }>;
}

interface Props {
  workOrders: WorkOrder[];
  dragHandleProps?: any;
}

export default function ActiveOrdersWidget({ workOrders, dragHandleProps }: Props) {
  // En kritik (stok yetersizliği olan) ilk işleri yukarı alalım
  const sortedOrders = [...workOrders].sort((a, b) => {
    if (a.status === "shortage" && b.status !== "shortage") return -1;
    if (a.status !== "shortage" && b.status === "shortage") return 1;
    return 0;
  }).slice(0, 7); // Gelecek ilk 7 iş emrini sınırla

  return (
    <div className="premium-card p-6 flex flex-col h-full select-none">
      {/* Widget Header with Drag Handle */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚙️</span>
          <div>
            <h3 className="text-sm font-extrabold text-white">Aktif Üretim Kuyruğu</h3>
            <p className="text-[10px] text-slate-500">Sıradaki 7 kritik iş emri ve depo kontrolü</p>
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

      {/* Sipariş Listesi */}
      <div className="flex-1 overflow-y-auto space-y-3 max-h-[300px] pr-1 scrollbar-thin">
        {sortedOrders.map((order, idx) => {
          const isShortage = order.status === "shortage";
          const isUnknown = order.status === "unknown_product";
          
          let statusBadge = { label: "Hazır", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
          if (isShortage) {
            statusBadge = { label: "Eksik Var", cls: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
          } else if (isUnknown) {
            statusBadge = { label: "Tanımsız", cls: "text-slate-400 bg-slate-800 border-slate-700" };
          }

          return (
            <div 
              key={idx} 
              className="bg-slate-950/40 border border-slate-800/80 hover:border-slate-700/40 transition-all rounded-xl p-3.5 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">
                    {order.machineName} • Sıra: {idx + 1}
                  </div>
                  <h4 className="text-white font-bold text-xs mt-0.5 truncate leading-tight">
                    {order.productName}
                  </h4>
                  <div className="text-[9px] text-slate-500 font-medium mt-0.5">{order.firma}</div>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black border tracking-wide flex-shrink-0 ${statusBadge.cls}`}>
                  {statusBadge.label}
                </span>
              </div>

              <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-900/50">
                <span className="text-slate-500">Planlanan Hedef:</span>
                <span className="text-white font-extrabold">{order.targetQty.toLocaleString("tr-TR")} Koli</span>
              </div>

              {/* Eksik Malzemeler Alt Detayı */}
              {isShortage && order.missingItems.length > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-lg p-2.5 space-y-1 mt-1 text-[10px]">
                  <div className="text-[8px] font-black text-rose-400 uppercase tracking-wider mb-1">
                    Eksik Depo Malzemeleri:
                  </div>
                  {order.missingItems.slice(0, 3).map((item, itemIdx) => (
                    <div key={itemIdx} className="flex justify-between text-rose-300">
                      <span className="truncate max-w-[150px]">{item.name}</span>
                      <span className="font-bold tabular-nums">
                        -{(item.needed - item.current).toLocaleString("tr")} {item.unit}
                      </span>
                    </div>
                  ))}
                  {order.missingItems.length > 3 && (
                    <div className="text-[8px] text-slate-500 text-center pt-1 font-bold">
                      +{order.missingItems.length - 3} kalem daha eksik var
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sortedOrders.length === 0 && (
          <div className="h-full flex items-center justify-center text-center p-8 bg-slate-950/20 border border-dashed border-slate-800 rounded-2xl">
            <div>
              <span className="text-2xl block mb-1">📦</span>
              <p className="text-xs text-slate-500">Üretim kuyruğu boş veya iş emri yüklenmemiş.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
