import { getNextWorkOrdersCheck } from "@/actions/is-emirleri";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import WorkOrdersClient from "@/components/WorkOrdersClient";

export const dynamic = "force-dynamic";

export default async function IsEmirleriPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const result = await getNextWorkOrdersCheck();

  return (
    <WorkOrdersClient
      initialData={result}
      session={session}
    />
  );
}
