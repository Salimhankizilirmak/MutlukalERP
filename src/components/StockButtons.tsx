"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { stockInOut } from "@/actions/stock";

interface Props {
  productId: string;
  productName: string;
  unit: string;
}

export default function StockButtons({ productId, productName, unit }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("1");
  const [desc, setDesc] = useState("");
  const [isPending, startTransition] = useTransition();

  const openModal = (t: "in" | "out") => {
    setType(t);
    setQty("1");
    setDesc("");
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseFloat(qty);
    if (!quantity || quantity <= 0) {
      toast.error("Geçerli bir miktar girin.");
      return;
    }
    startTransition(async () => {
      const result = await stockInOut(productId, type, quantity, desc);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          type === "in"
            ? `${quantity} ${unit} giriş yapıldı ✓`
            : `${quantity} ${unit} çıkış yapıldı ✓`
        );
        setOpen(false);
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => openModal("in")}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold transition-all active:scale-95"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Giriş
        </button>
        <button
          onClick={() => openModal("out")}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold transition-all active:scale-95"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Çıkış
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${type === "in" ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-red-500/20 border border-red-500/30"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={type === "in" ? "#34d399" : "#f87171"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {type === "in" ? (
                    <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                  ) : (
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  )}
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Stok {type === "in" ? "Girişi" : "Çıkışı"}</h3>
                <p className="text-slate-400 text-xs truncate max-w-[200px]">{productName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="ml-auto text-slate-500 hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Miktar ({unit})</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-lg font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Açıklama</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="İsteğe bağlı..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className={`w-full font-bold text-sm rounded-xl px-6 py-3 transition-all duration-200 shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 ${
                  type === "in"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20"
                    : "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-500/20"
                }`}
              >
                {isPending ? (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : null}
                {type === "in" ? "Stok Girişi Kaydet" : "Stok Çıkışı Kaydet"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
