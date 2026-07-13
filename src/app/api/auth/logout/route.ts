import { clearSessionCookie } from "@/lib/session";
import { redirect } from "next/navigation";

export async function GET() {
  await clearSessionCookie();
  redirect("/login");
}
