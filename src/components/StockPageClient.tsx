"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Category, Product } from "@/db/schema";
import type { SessionPayload } from "@/lib/session";
import StockButtons from "./StockButtons";
import BlindCountButton from "./BlindCountButton";
import AddProductModal from "./AddProductModal";
import SyncExcelButton from "./SyncExcelButton";

interface Stats {
  total: number;
  critical: number;
  outOfStock: number;
}

interface Props {
  category: Category;
  products: Product[];
  session: SessionPayload;
  totalItems: number;
  totalPages: number;
  currentPage: number;
  lastSyncInfo: string;
  stats: Stats;
}

export default function StockPageClient({
  category, products, session, totalItems, totalPages, currentPage, lastSyncInfo, stats
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const canManage = ["Müdür", "Yetkili"].includes(session.role);
  const isMudur = session.role === "Müdür";

  const currentQ = searchParams.get("q") ?? "";
  const currentF = searchParams.get("f") ?? "all";

  const updateSearch = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("p");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const goPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("p", String(page));
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  return (
    <div className="space-y-6">
      {/* ── İstatistik Kartları ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Toplam Ürün", value: stats.total, color: "from-blue-500 to-indigo-600", icon: "📋" },
          { label: "Kritik Stok", value: stats.critical, color: "from-amber-500 to-orange-600", icon: "⚠️" },
          { label: "Stok Yok", value: stats.outOfStock, color: "from-red-500 to-rose-600", icon: "❌" },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-lg shadow-lg shrink-0`}>
              {stat.icon}
            </div>
            <div>
              <div className="text-2xl font-black text-white tabular-nums">{stat.value.toLocaleString("tr")}</div>
              <div className="text-slate-500 text-xs font-medium">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Arama */}
          <div className="relative w-full sm:max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Ürün ara..."
              defaultValue={currentQ}
              onChange={(e) => updateSearch("q", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
          </div>

          {/* Filtreler */}
          <div className="flex gap-2">
            {[
              { key: "all", label: "Tümü" },
              { key: "critical", label: "Kritik" },
              { key: "zero", label: "Stok Yok" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => updateSearch("f", f.key)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  currentF === f.key
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Eylemler */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {canManage && <BlindCountButton categoryId={category.id} categoryName={category.name} />}
            {isMudur && <AddProductModal categoryId={category.id} />}
            {canManage && <SyncExcelButton lastSyncInfo={lastSyncInfo} />}
          </div>
        </div>
      </div>

      {/* ── Ürün Tablosu ────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{category.icon}</span>
            <h2 className="text-white font-semibold text-sm">{category.name}</h2>
            <span className="text-slate-500 text-xs">({totalItems} ürün)</span>
          </div>
          {isPending && (
            <svg className="animate-spin text-orange-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          )}
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-sm font-medium">Ürün bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="sticky left-0 z-10 bg-slate-900 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3 whitespace-nowrap border-r border-slate-800">
                    Ürün Adı
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3 whitespace-nowrap">Kod</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3 whitespace-nowrap">Stok</th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3 whitespace-nowrap">Durum</th>
                  {canManage && (
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3 whitespace-nowrap">İşlem</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.map((urun) => {
                  const stok = urun.currentStock ?? 0;
                  const threshold = urun.criticalThreshold ?? 10;
                  const isCritical = stok > 0 && stok <= threshold;
                  const isZero = stok === 0;
                  const status = isZero
                    ? { label: "Yok", cls: "text-red-400 bg-red-500/10 border-red-500/20" }
                    : isCritical
                    ? { label: "Kritik", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" }
                    : { label: "Yeterli", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };

                  return (
                    <tr
                      key={urun.id}
                      className={`group transition-colors ${
                        isZero
                          ? "bg-red-500/5 hover:bg-red-500/10"
                          : isCritical
                          ? "bg-amber-500/5 hover:bg-amber-500/10"
                          : "hover:bg-slate-800/30"
                      }`}
                    >
                      <td className={`sticky left-0 z-10 border-r border-slate-800 px-5 py-3.5 transition-colors ${
                        isZero ? "bg-[#1a0808] group-hover:bg-[#240d0d]" : isCritical ? "bg-[#1a1408] group-hover:bg-[#241c0d]" : "bg-slate-900 group-hover:bg-slate-800/80"
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shrink-0 text-white font-bold text-[11px]">
                            {urun.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-white">{urun.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {urun.sku ? (
                          <span className="font-mono text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-md px-2 py-1">{urun.sku}</span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-2xl font-black text-white tabular-nums">
                          {stok.toLocaleString("tr")}
                        </span>
                        <span className="text-slate-500 text-xs ml-1">{urun.unit}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-1 ${status.cls}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {status.label}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-5 py-3.5 text-right">
                          <StockButtons
                            productId={urun.id}
                            productName={urun.name}
                            unit={urun.unit}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-slate-500 text-xs">{totalItems} üründen {Math.min((currentPage - 1) * 50 + 1, totalItems)}–{Math.min(currentPage * 50, totalItems)} gösteriliyor</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ← Önceki
              </button>
              <span className="text-slate-400 text-xs font-medium px-2">{currentPage} / {totalPages}</span>
              <button
                onClick={() => goPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Sonraki →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
