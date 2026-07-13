"use client";

import { useState, useTransition } from "react";
import { updateUserEmail } from "@/actions/users";
import { toast } from "sonner";

interface Props {
  userId: string;
}

export default function EmailPromptModal({ userId }: Props) {
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Geçerli bir e-posta adresi girin.");
      return;
    }

    startTransition(async () => {
      const res = await updateUserEmail(userId, email);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("E-posta başarıyla kaydedildi! Hoşgeldin maili gönderildi ✓");
        setOpen(false);
      }
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md pointer-events-none" />
      <div className="relative bg-slate-900 border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-2xl shadow-black/80 z-[110]">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/20 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <h3 className="text-white font-extrabold text-base">E-posta Adresinizi Tanımlayın</h3>
          <p className="text-slate-400 text-xs mt-2 px-4">
            Kritik stok yetersizlik uyarılarını ve depo hareket özetlerini alabilmek için lütfen e-posta adresinizi giriniz.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">E-posta Adresiniz</label>
            <input
              type="email"
              required
              placeholder="örn: ahmet@mutlukal.com.tr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 text-white font-bold text-sm rounded-xl px-6 py-3 transition-all duration-200 shadow-lg shadow-orange-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isPending ? "Kaydediliyor..." : "Kaydet ve Devam Et"}
          </button>
        </form>
      </div>
    </div>
  );
}
