"use client";

import { useTransition, useState } from "react";
import { syncExcelData } from "@/actions/sync";
import { toast } from "sonner";

export default function SyncExcelButton({ lastSyncInfo }: { lastSyncInfo: string }) {
  const [isPending, startTransition] = useTransition();
  const [info, setInfo] = useState(lastSyncInfo);

  const handleSync = () => {
    startTransition(async () => {
      const result = await syncExcelData();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `Senkronizasyon Başarılı! ${result.processedCount} mamul üretim hareketi işlendi ve BOM hammadde stokları düşüldü.`
        );
        setInfo(new Date().toLocaleTimeString("tr-TR"));
      }
    });
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      {info && (
        <span className="text-slate-500 text-[10px] sm:text-xs">
          Son Güncelleme: <span className="text-slate-300 font-semibold">{info}</span>
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={isPending}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all"
      >
        {isPending ? (
          <>
            <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Senkronize Ediliyor...
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            Excel'den Eşitle
          </>
        )}
      </button>
    </div>
  );
}
