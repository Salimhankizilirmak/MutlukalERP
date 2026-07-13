import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getLogisticsDashboardData } from "@/actions/erp-actions";
import LogisticsClient from "./LogisticsClient";

export default async function LogisticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await getLogisticsDashboardData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">🚚 Lojistik Araç & Sevkiyat Yönetimi</h1>
          <p className="text-slate-400 text-sm">
            Sevkiyat araçlarının varış saatlerini girerek üretimin önceliklendirilmesini sağlayabilirsiniz.
          </p>
        </div>
      </div>

      <LogisticsClient initialData={data} />
    </div>
  );
}
