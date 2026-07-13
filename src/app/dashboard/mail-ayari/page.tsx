import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getMailConfigurations } from "@/actions/erp-actions";
import MailSettingsClient from "./MailSettingsClient";

export default async function MailSettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "Müdür") {
    redirect("/dashboard");
  }

  const data = await getMailConfigurations();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">📧 Dinamik Mail & Bildirim Yapılandırması</h1>
          <p className="text-slate-400 text-sm">
            Hangi departmanın hangi olaylarda otomatik mail alacağını el ile girip yönetebilirsiniz.
          </p>
        </div>
      </div>

      <MailSettingsClient initialData={data} />
    </div>
  );
}
