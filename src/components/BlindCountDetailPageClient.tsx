"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, BlindCount, User } from "@/db/schema";
import type { SessionPayload } from "@/lib/session";
import { updateCountItem, submitBlindCount, approveBlindCount } from "@/actions/sayim";
import { toast } from "sonner";

interface CountItem {
  id: string;
  productId: string;
  countedQty: number;
  previousQty: number;
  difference: number;
  productName: string;
  productUnit: string;
}

interface Props {
  countObj: BlindCount;
  category: Category | null;
  starter: User | null;
  items: CountItem[];
  session: SessionPayload;
}

export default function BlindCountDetailPageClient({
  countObj, category, starter, items, session
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    items.forEach((item) => {
      init[item.id] = String(item.countedQty || 0);
    });
    return init;
  });
  const [note, setNote] = useState(countObj.note || "");
  const [filter, setFilter] = useState<"all" | "uncounted" | "counted">("all");
  const [search, setSearch] = useState("");

  const isMudur = session.role === "Müdür";
  const isPendingApproval = countObj.status === "submitted";
  const isApproved = countObj.status === "approved";
  const isEditable = countObj.status === "in_progress";

  const handleQtyChange = (itemId: string, val: string) => {
    setQuantities((prev) => ({ ...prev, [itemId]: val }));
  };

  const handleSaveItem = (itemId: string) => {
    const qty = parseFloat(quantities[itemId] || "0") || 0;
    startTransition(async () => {
      const result = await updateCountItem(itemId, qty);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Miktar güncellendi ✓", { duration: 1000 });
      }
    });
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await submitBlindCount(countObj.id, note);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Sayım müdür onayına gönderildi.");
        router.refresh();
      }
    });
  };

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveBlindCount(countObj.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Sayım onaylandı ve stoklar güncellendi ✓");
        router.push("/dashboard/analiz");
      }
    });
  };

  // Filtreler
  const filteredItems = items.filter((item) => {
    const nameMatch = item.productName.toLowerCase().includes(search.toLowerCase());
    if (!nameMatch) return false;

    const isCounted = parseFloat(quantities[item.id] || "0") > 0;
    if (filter === "uncounted") return !isCounted;
    if (filter === "counted") return isCounted;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ── Üst Bilgi Kartı ──────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-60 h-60 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{category?.icon || "📦"}</span>
              <h2 className="text-white font-extrabold text-lg">Kör Sayım: {category?.name}</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isApproved
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : isPendingApproval
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  : "bg-purple-500/15 text-purple-400 border border-purple-500/20"
              }`}>
                {isApproved ? "Onaylandı" : isPendingApproval ? "Onay Bekliyor" : "Devam Ediyor"}
              </span>
            </div>
            <p className="text-slate-400 text-xs">
              Başlatan: <span className="text-slate-200 font-semibold">{starter?.fullName || starter?.username}</span> • Başlangıç:{" "}
              <span className="text-slate-200 font-semibold">{new Date(countObj.createdAt).toLocaleString("tr-TR")}</span>
            </p>
          </div>

          <div className="flex gap-2">
            {isEditable && (
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl px-5 py-3 transition-all active:scale-[0.98] shadow-lg shadow-purple-600/20"
              >
                Sayımı Bitir ve Gönder
              </button>
            )}
            {isMudur && isPendingApproval && (
              <button
                onClick={handleApprove}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl px-5 py-3 transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/20"
              >
                Sayımı Onayla (Stokları Güncelle)
              </button>
            )}
            <button
              onClick={() => router.push(`/dashboard/${category?.slug || ""}`)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl px-4 py-3 transition-all"
            >
              Geri Dön
            </button>
          </div>
        </div>

        {isEditable && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Müdüre Not</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Sayım ile ilgili not ekleyin..."
              rows={2}
              className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500 transition-all"
            />
          </div>
        )}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Ürün adı ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500 transition-all"
            />
          </div>

          <div className="flex gap-2">
            {[
              { key: "all", label: "Tümü" },
              { key: "uncounted", label: "Sayılmayanlar" },
              { key: "counted", label: "Sayılanlar" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  filter === f.key
                    ? "bg-purple-500 text-white shadow-lg"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Ürün Listesi ────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5 border-r border-slate-800">Ürün Adı</th>
                {(!isEditable && isMudur) && (
                  <>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Önceki Stok</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Fark</th>
                  </>
                )}
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5" style={{ width: "200px" }}>Sayım Miktarı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredItems.map((item) => {
                const isItemCounted = parseFloat(quantities[item.id] || "0") > 0;
                return (
                  <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-4 border-r border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isItemCounted ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
                        <span className="text-sm font-medium text-white">{item.productName}</span>
                      </div>
                    </td>
                    {(!isEditable && isMudur) && (
                      <>
                        <td className="px-5 py-4 text-right text-sm text-slate-400 tabular-nums">
                          {item.previousQty} {item.productUnit}
                        </td>
                        <td className={`px-5 py-4 text-right text-sm font-bold tabular-nums ${
                          item.difference > 0 ? "text-emerald-400" : item.difference < 0 ? "text-red-400" : "text-slate-500"
                        }`}>
                          {item.difference > 0 ? `+${item.difference}` : item.difference} {item.productUnit}
                        </td>
                      </>
                    )}
                    <td className="px-5 py-4 text-right">
                      {isEditable ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={quantities[item.id]}
                            onChange={(e) => handleQtyChange(item.id, e.target.value)}
                            onBlur={() => handleSaveItem(item.id)}
                            className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-right font-bold text-white text-sm outline-none focus:border-purple-500 transition-all tabular-nums"
                          />
                          <span className="text-xs text-slate-500">{item.productUnit}</span>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-white tabular-nums">
                          {item.countedQty} {item.productUnit}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
