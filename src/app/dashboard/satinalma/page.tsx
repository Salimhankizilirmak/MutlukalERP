import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getPurchasingDashboardData } from "@/actions/erp-actions";
import PurchasingClient from "./PurchasingClient";

export default async function PurchasingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await getPurchasingDashboardData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">🛒 Satın Alma & Temrin Yönetimi</h1>
          <p className="text-slate-400 text-sm">
            Malzeme birim fiyatlarını güncelleyebilir, eksik stoklar için tedarik temrin tarihleri tanımlayabilirsiniz.
          </p>
        </div>
      </div>

      <PurchasingClient initialData={data} />
    </div>
  );
}
