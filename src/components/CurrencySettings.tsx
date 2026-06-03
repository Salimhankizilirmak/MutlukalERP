"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { updateCompanyCurrency } from "@/actions/team";
import { toast } from "sonner";

interface CurrencySettingsProps {
  companyId: string;
  initialCurrency: string;
}

export default function CurrencySettings({
  companyId,
  initialCurrency = "TRY",
}: CurrencySettingsProps) {
  const t = useTranslations("Dashboard");
  const [isPending, startTransition] = useTransition();
  const [currency, setCurrency] = useState(initialCurrency);

  const currencies = [
    { code: "TRY", name: "Türk Lirası", symbol: "₺" },
    { code: "USD", name: "Amerikan Doları", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
  ];

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateCompanyCurrency(companyId, currency);
        toast.success("Para birimi başarıyla güncellendi.");
      } catch (error) {
        console.error("Currency update failed:", error);
        toast.error("Para birimi güncellenirken hata oluştu.");
      }
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl shadow-black/20">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Para Birimi Ayarları</h2>
          <p className="text-slate-400 text-xs mt-0.5">Uygulama genelinde gösterilecek fiyat birimini belirleyin.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {currencies.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => setCurrency(item.code)}
              className={`flex flex-col items-center justify-center p-5 rounded-2xl border transition-all duration-300 relative group cursor-pointer ${
                currency === item.code
                  ? "bg-emerald-600/10 border-emerald-500 ring-1 ring-emerald-500"
                  : "bg-slate-800/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60"
              }`}
            >
              <span className={`text-3xl font-extrabold mb-2 transition-colors ${currency === item.code ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-400"}`}>
                {item.symbol}
              </span>
              <span className="text-white text-xs font-bold">{item.code}</span>
              <span className="text-slate-500 text-[10px] mt-1">{item.name}</span>
              {currency === item.code && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>
          ))}
        </div>

        <div className="pt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isPending || currency === initialCurrency}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] cursor-pointer"
          >
            {isPending ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
