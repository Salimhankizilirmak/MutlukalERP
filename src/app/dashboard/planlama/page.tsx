import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getProductionDashboardData } from "@/actions/erp-actions";
import PlanningClient from "./PlanningClient";

export default async function PlanningPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await getProductionDashboardData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">🗓️ Üretim Planlama & İş Emirleri</h1>
          <p className="text-slate-400 text-sm">
            Onaylı siparişleri makine hatlarına yerleştirin, sıralama yapın ve vardiya raporlarını girin.
          </p>
        </div>
      </div>

      <PlanningClient initialData={data} />
    </div>
  );
}
