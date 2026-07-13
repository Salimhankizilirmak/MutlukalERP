"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/db/schema";
import type { SessionPayload } from "@/lib/session";
import { updateBomItem, deleteBomItem, addBomItem } from "@/actions/bom-custom";
import { toast } from "sonner";

interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  categoryName: string;
}

interface BomEntry {
  id: string;
  parentProductId: string;
  childProductId: string;
  quantity: number;
  unit: string;
  childName: string;
  childUnit: string;
}

interface Props {
  mamulList: Product[];
  rawMaterials: RawMaterial[];
  bomEntries: BomEntry[];
  session: SessionPayload;
}

export default function BomManagerClient({
  mamulList, rawMaterials, bomEntries, session
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedParentId, setSelectedParentId] = useState(mamulList[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");

  // Hammadde ekleme formu state'leri
  const [selectedChildId, setSelectedChildId] = useState("");
  const [newQty, setNewQty] = useState("1");

  const canManage = ["Müdür", "Yetkili"].includes(session.role);

  // Seçili ürüne ait BOM kayıtları
  const currentBom = bomEntries.filter((b) => b.parentProductId === selectedParentId);

  // Arama filtresi uygulanan mamuller listesi
  const filteredMamuls = mamulList.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUpdateQty = (bomId: string, qtyStr: string) => {
    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty <= 0) return;

    startTransition(async () => {
      const res = await updateBomItem(bomId, qty);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Miktar güncellendi ✓", { duration: 1000 });
        router.refresh();
      }
    });
  };

  const handleDelete = (bomId: string) => {
    if (!confirm("Bu bileşeni ürün ağacından kaldırmak istediğinize emin misiniz?")) return;

    startTransition(async () => {
      const res = await deleteBomItem(bomId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Bileşen kaldırıldı ✓");
        router.refresh();
      }
    });
  };

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChildId) {
      toast.error("Lütfen bir hammadde veya ambalaj seçin.");
      return;
    }
    const quantity = parseFloat(newQty);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Geçerli bir miktar girin.");
      return;
    }

    startTransition(async () => {
      const res = await addBomItem(selectedParentId, selectedChildId, quantity);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Bileşen ürün ağacına eklendi ✓");
        setSelectedChildId("");
        setNewQty("1");
        router.refresh();
      }
    });
  };

  // Seçili mamul ürünün detayları
  const selectedMamul = mamulList.find((m) => m.id === selectedParentId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Sol Kolon: Mamul Ürün Seçici ─────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[600px]">
        <div className="mb-4">
          <h3 className="text-white font-bold text-sm mb-3">Mamul Ürün Seçin</h3>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Mamul ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-orange-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 scrollbar-none pr-1">
          {filteredMamuls.map((mamul) => (
            <button
              key={mamul.id}
              onClick={() => setSelectedParentId(mamul.id)}
              className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-center justify-between text-xs ${
                selectedParentId === mamul.id
                  ? "bg-orange-500/10 text-orange-400 font-bold border border-orange-500/25"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="truncate">{mamul.name}</span>
              <span className="text-[10px] text-slate-500 ml-2">{(mamul.attributes ? JSON.parse(mamul.attributes).cap : "") || ""}cm</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Sağ Kolon: Ürün Ağacı (BOM) Yönetimi ─────────────────────────────── */}
      <div className="lg:col-span-2 space-y-6">
        {selectedMamul ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            {/* Mamul Başlık */}
            <div className="border-b border-slate-800 pb-4">
              <span className="text-2xl mb-1 block">🏭</span>
              <h2 className="text-white font-extrabold text-lg">{selectedMamul.name}</h2>
              <p className="text-slate-400 text-xs mt-1">
                Bu mamul üretildiğinde stoktan otomatik düşecek ambalaj ve katkı listesi aşağıdadır.
              </p>
            </div>

            {/* Bileşen Listesi */}
            <div className="space-y-3">
              <h3 className="text-white font-bold text-xs uppercase tracking-wider text-slate-400">Ürün Ağacı Bileşenleri</h3>
              {currentBom.length === 0 ? (
                <div className="text-center py-8 bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
                  Bu ürün için tanımlanmış bileşen bulunamadı.
                </div>
              ) : (
                <div className="space-y-2">
                  {currentBom.map((bom) => (
                    <div
                      key={bom.id}
                      className="bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">{bom.childName}</div>
                        <div className="text-[10px] text-slate-500 font-medium">Bileşen</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {canManage ? (
                          <input
                            type="number"
                            step="any"
                            defaultValue={bom.quantity}
                            onBlur={(e) => handleUpdateQty(bom.id, e.target.value)}
                            className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs font-bold text-white outline-none focus:border-orange-500 transition-all tabular-nums"
                          />
                        ) : (
                          <span className="text-sm font-bold text-white tabular-nums">{bom.quantity}</span>
                        )}
                        <span className="text-xs text-slate-500 font-medium w-8">{bom.childUnit}</span>
                        {canManage && (
                          <button
                            onClick={() => handleDelete(bom.id)}
                            className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                            title="Bileşeni Kaldır"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Yeni Bileşen Ekleme Formu */}
            {canManage && (
              <form onSubmit={handleAddChild} className="border-t border-slate-800 pt-6 space-y-4">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider text-slate-400">Yeni Bileşen Ekle</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <select
                      value={selectedChildId}
                      onChange={(e) => setSelectedChildId(e.target.value)}
                      className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-orange-500 cursor-pointer"
                    >
                      <option value="">Bileşen seçin...</option>
                      {rawMaterials.map((rm) => (
                        <option key={rm.id} value={rm.id}>
                          [{rm.categoryName}] {rm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      placeholder="Miktar"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-bold text-right outline-none focus:border-orange-500 transition-all"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold text-xs rounded-xl px-5 py-2.5 transition-all shadow-lg shadow-orange-500/25 active:scale-[0.98]"
                  >
                    Bileşen Ekle
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">
            Lütfen sol menüden bir mamul ürün seçin.
          </div>
        )}
      </div>
    </div>
  );
}
