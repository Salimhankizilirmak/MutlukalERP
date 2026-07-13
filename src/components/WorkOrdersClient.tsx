"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SessionPayload } from "@/lib/session";
import type { WorkOrderCheck } from "@/actions/is-emirleri";
import { sendShortageAlertEmails } from "@/actions/is-emirleri";
import { toast } from "sonner";

interface Props {
  initialData: any;
  session: SessionPayload;
}

export default function WorkOrdersClient({ initialData, session }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedLine, setSelectedLine] = useState<"mutlukal" | "orman">("mutlukal");

  if (initialData.error) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <span className="text-4xl block mb-3">⚠️</span>
        <h3 className="text-white font-bold mb-1">Dosya Okuma Hatası</h3>
        <p className="text-xs mb-4">{initialData.error}</p>
        <button onClick={() => router.refresh()} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold">
          Yeniden Dene
        </button>
      </div>
    );
  }

  const { mutlukalOrders = [], ormanOrders = [], sheetName = "" } = initialData;
  const currentOrders: WorkOrderCheck[] = selectedLine === "mutlukal" ? mutlukalOrders : ormanOrders;

  // Tüm eksikleri filtrele
  const shortageOrders = currentOrders.filter(o => o.status === "shortage");

  // Mail gönderimini tetikle
  const handleSendMail = () => {
    if (shortageOrders.length === 0) {
      toast.info("Stok yetersizliği olan iş emri bulunamadı.");
      return;
    }

    startTransition(async () => {
      const result = await sendShortageAlertEmails(
        shortageOrders.map(o => ({
          machineName: o.machineName,
          productName: o.productName,
          missingItems: o.missingItems,
        }))
      );

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`E-posta başarıyla gönderildi! (${result.sentCount} alıcıya ulaştırıldı) ✓`);
      }
    });
  };

  // Makinelere göre grupla
  const groupedOrders: Record<string, WorkOrderCheck[]> = {};
  currentOrders.forEach(order => {
    if (!groupedOrders[order.machineName]) {
      groupedOrders[order.machineName] = [];
    }
    groupedOrders[order.machineName].push(order);
  });

  return (
    <div className="space-y-6">
      {/* ── Üst Başlık ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-extrabold text-lg flex items-center gap-2">
            <span>📋</span> Üretim İş Emirleri Kontrolü
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            S:\İş Emirleri klasöründen en güncel üretim planları okunuyor. (Aktif Sayfa: {sheetName})
          </p>
        </div>

        {/* Hat Seçimi */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedLine("mutlukal")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              selectedLine === "mutlukal"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            Mutlukal Fabrika
          </button>
          <button
            onClick={() => setSelectedLine("orman")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              selectedLine === "orman"
                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            Mutlu Orman Fabrika
          </button>
        </div>
      </div>

      {/* ── Uyarı & Mail Paneli ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>Kritik Stok Kontrolü</span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Makinelerin sıradaki 7 iş emri için ambalaj (kutu/poşet) ve katkı stokları denetlenir. Eksik varsa yetkililere bildirin.
          </p>
        </div>

        <button
          onClick={handleSendMail}
          disabled={isPending || shortageOrders.length === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all"
        >
          {isPending ? (
            <>
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Gönderiliyor...
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
              </svg>
              Eksikleri E-posta ile Bildir
            </>
          )}
        </button>
      </div>

      {/* ── Makineler ve İş Emirleri ── */}
      <div className="flex flex-col gap-8">
        {Object.keys(groupedOrders).map((machineName) => (
          <div key={machineName} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col">
            {/* Makine Başlığı */}
            <div className="bg-slate-800/50 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-white font-extrabold text-sm flex items-center gap-2">
                <span className="text-orange-500">⚙️</span> {machineName}
              </h3>
              <span className="text-[10px] bg-slate-850 border border-slate-700/60 text-slate-350 font-extrabold px-3 py-1 rounded-lg">
                Gelecek {groupedOrders[machineName].length} İş Emri
              </span>
            </div>

            {/* Sipariş Listesi (Yatay Kaydırma) */}
            <div className="flex flex-row gap-4 p-5 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {groupedOrders[machineName].map((order, idx) => {
                const isShortage = order.status === "shortage";
                const isUnknown = order.status === "unknown_product";
                const statusBadge = isShortage
                  ? { label: "Stok Yetersiz", cls: "text-red-400 bg-red-500/10 border-red-500/20" }
                  : isUnknown
                  ? { label: "Ürün Bulunamadı", cls: "text-slate-500 bg-slate-800 border-slate-700" }
                  : { label: "Stok Yeterli", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };

                return (
                  <div 
                    key={idx} 
                    className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 hover:border-slate-700/40 transition-all space-y-3 min-w-[300px] max-w-[320px] flex-shrink-0 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider">Sıra: {idx + 1} • {order.firma}</div>
                          <h4 className="text-white font-bold text-xs mt-1 leading-tight">{order.productName}</h4>
                        </div>
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black border tracking-wide flex-shrink-0 ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-1">
                        <span className="text-slate-550">Planlanan Üretim:</span>
                        <span className="text-white font-extrabold">{order.targetQty.toLocaleString("tr-TR")} Koli</span>
                      </div>
                    </div>

                    {/* Eksik Listesi */}
                    {isShortage && order.missingItems.length > 0 && (
                      <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 space-y-1.5 mt-auto">
                        <div className="text-[9px] font-black text-red-400 uppercase tracking-wider">Eksik Depo Malzemeleri:</div>
                        <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1 scrollbar-none">
                          {order.missingItems.map((m, mIdx) => (
                            <div key={mIdx} className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-400 font-medium truncate max-w-[160px]">{m.name}</span>
                              <span className="text-red-400 font-bold tabular-nums">
                                -{(m.needed - m.current).toLocaleString("tr")} {m.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
