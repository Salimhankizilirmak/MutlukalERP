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
    <div className="space-y-6 select-none">
      {/* ── Üst Başlık ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-extrabold text-lg flex items-center gap-2">
            <span>📋</span> Üretim İş Emirleri İzleme Paneli
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            D:\Uretim\İş Emirleri klasöründen en güncel Excel planları otomatik okunur. Düzenleme yapılamaz. (Aktif Sayfa: {sheetName})
          </p>
        </div>

        {/* Hat Seçimi */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedLine("mutlukal")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedLine === "mutlukal"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            Mutlukal Fabrika
          </button>
          <button
            onClick={() => setSelectedLine("orman")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
            İş emirlerindeki ambalaj ve katkı stokları otomatik denetlenir. Eksik durumunda yetkililere bildirim gönderebilirsiniz.
          </p>
        </div>

        <button
          onClick={handleSendMail}
          disabled={isPending || shortageOrders.length === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer"
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

      {/* ── Makineler ve Excel Tarzı Tablo Görünümü ── */}
      <div className="flex flex-col gap-8">
        {Object.keys(groupedOrders).map((machineName) => (
          <div key={machineName} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col">
            {/* Makine Başlığı */}
            <div className="bg-slate-850 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-white font-extrabold text-sm flex items-center gap-2">
                <span className="text-orange-500">⚙️</span> {machineName}
              </h3>
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 font-extrabold px-3 py-1 rounded-lg">
                Gelecek {groupedOrders[machineName].length} İş Emri
              </span>
            </div>

            {/* Excel Tablosu */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                    <th className="p-4 w-16 text-center">SIRA</th>
                    <th className="p-4 w-36">FİRMA / MÜŞTERİ</th>
                    <th className="p-4 min-w-[200px]">ÜRÜN ADI</th>
                    <th className="p-4 w-32">CİNSİ</th>
                    <th className="p-4 w-44 text-right">PLANLANAN ÜRETİM</th>
                    <th className="p-4 w-36 text-center">STOK DURUMU</th>
                    <th className="p-4 min-w-[250px]">EKSİK MALZEMELER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {groupedOrders[machineName].map((order, idx) => {
                    const isShortage = order.status === "shortage";
                    const isUnknown = order.status === "unknown_product";
                    
                    const statusBadge = isShortage
                      ? { label: "Stok Yetersiz", cls: "text-red-400 bg-red-500/10 border-red-500/20" }
                      : isUnknown
                      ? { label: "Ürün Tanımsız", cls: "text-slate-400 bg-slate-800 border-slate-700" }
                      : { label: "Stok Yeterli", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };

                    return (
                      <tr 
                        key={idx} 
                        className={`hover:bg-slate-850/30 transition-all ${
                          isShortage ? "bg-red-500/[0.01]" : ""
                        }`}
                      >
                        {/* Sıra */}
                        <td className="p-4 font-bold text-slate-500 text-center border-r border-slate-800/40">
                          {idx + 1}
                        </td>
                        
                        {/* Müşteri */}
                        <td className="p-4 font-extrabold text-white truncate max-w-[150px]">
                          {order.firma}
                        </td>
                        
                        {/* Ürün Adı */}
                        <td className="p-4 font-semibold text-slate-200">
                          {order.productName}
                        </td>

                        {/* Cinsi */}
                        <td className="p-4 text-slate-400">
                          {order.cinsi || "-"}
                        </td>
                        
                        {/* Miktar */}
                        <td className="p-4 text-right font-black text-white tabular-nums">
                          {order.targetQty.toLocaleString("tr-TR")} Koli
                        </td>
                        
                        {/* Stok Durumu */}
                        <td className="p-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-[9px] font-black border tracking-wide ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                        </td>

                        {/* Eksikler */}
                        <td className="p-4">
                          {isShortage && order.missingItems.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-[400px]">
                              {order.missingItems.map((m, mIdx) => (
                                <span 
                                  key={mIdx}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/5 border border-red-500/10 text-[10px] text-red-400 font-medium tabular-nums"
                                >
                                  <span className="truncate max-w-[120px]">{m.name}</span>
                                  <span className="font-extrabold font-mono text-[9px]">
                                    -{Math.ceil(m.needed - m.current).toLocaleString("tr")} {m.unit}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
