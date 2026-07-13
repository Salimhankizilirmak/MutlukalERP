import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import UsersManagerClient from "@/components/UsersManagerClient";

export const dynamic = "force-dynamic";

export default async function KullanicilarPage() {
  const session = await getSession();
  // Sadece müdür kullanıcı yönetimine erişebilir
  if (!session || session.role !== "Müdür") {
    redirect("/dashboard");
  }

  // Tüm kullanıcıları çekelim
  const userList = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return (
    <UsersManagerClient
      userList={userList}
      session={session}
    />
  );
}
