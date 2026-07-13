import { StockPageServer } from "@/components/StockPageServer";
import { Suspense } from "react";
export const dynamic = "force-dynamic";
export default async function PosetlerPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; p?: string }> }) {
  const sp = await searchParams;
  return <Suspense fallback={<div className="text-slate-400 text-sm">Yükleniyor...</div>}><StockPageServer categorySlug="poset" searchParams={sp} /></Suspense>;
}
