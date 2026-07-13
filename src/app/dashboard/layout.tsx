import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import DashboardNavClient from "@/components/DashboardNavClient";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import EmailPromptModal from "@/components/EmailPromptModal";

const NAV_ITEMS = [
  { label: "Üretim & Stok Planlama", href: "/dashboard/planlama", icon: "🗓️", slug: "planlama" },
  { label: "Pazarlama", href: "/dashboard/pazarlama", icon: "📈", slug: "pazarlama" },
  { label: "Satın Alma", href: "/dashboard/satinalma", icon: "🛒", slug: "satinalma" },
  { label: "Lojistik", href: "/dashboard/lojistik", icon: "🚚", slug: "lojistik" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Kullanıcının güncel email bilgisini veritabanından sorgulayalım
  const dbUser = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)
    .then((r) => r[0] ?? null);

  const hasEmail = !!dbUser?.email;

  // Eğer müdür ise, kullanıcılar ve mail ayarları sekmesini listeye dinamik olarak ekle
  const dynamicNavItems = [...NAV_ITEMS];
  if (session.role === "Müdür") {
    dynamicNavItems.push({ label: "Kullanıcılar", href: "/dashboard/kullanicilar", icon: "👥", slug: "kullanicilar" });
    dynamicNavItems.push({ label: "Mail Ayarları", href: "/dashboard/mail-ayari", icon: "📧", slug: "mail-ayari" });
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {!hasEmail && <EmailPromptModal userId={session.userId} />}
      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo & Firma */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className="hidden sm:block">
              <span className="text-white font-bold text-sm tracking-tight">Mutlukal Depo</span>
              <span className="block text-slate-500 text-[10px]">Stok Yönetim Sistemi</span>
            </div>
          </div>

          {/* Sağ: Kullanıcı Bilgisi & Çıkış */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-white text-xs font-semibold">{session.fullName || session.username}</span>
              <span className="text-slate-500 text-[10px]">{session.role}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-xs">
              {(session.fullName || session.username).charAt(0).toUpperCase()}
            </div>
            <Link
              href="/api/auth/logout"
              className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
              title="Çıkış Yap"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </Link>
          </div>
        </div>

        {/* ── Tab Navigasyon ──────────────────────────────────────────────────── */}
        <DashboardNavClient navItems={dynamicNavItems} />
      </header>

      {/* ── İçerik ─────────────────────────────────────────────────────────── */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
