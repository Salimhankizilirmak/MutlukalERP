import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getMarketingDashboardData } from "@/actions/erp-actions";
import MarketingClient from "./MarketingClient";

export default async function MarketingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await getMarketingDashboardData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">📈 Pazarlama Sipariş & Maliyet Yönetimi</h1>
          <p className="text-slate-400 text-sm">
            Yeni sipariş girişleri yapabilir, maliyet hesaplayabilir ve ürün kartları oluşturabilirsiniz.
          </p>
        </div>
      </div>

      <MarketingClient initialData={data} />
    </div>
  );
}
