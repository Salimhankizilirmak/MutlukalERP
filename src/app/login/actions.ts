"use server";

import { db } from "@/db";
import { users, companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession, setSessionCookie } from "@/lib/session";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

export async function loginAction(_: unknown, formData: FormData) {
  const username = formData.get("username")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!username || !password) {
    return { error: "Kullanıcı adı ve şifre gereklidir." };
  }

  if (process.env.VERCEL) {
    const mockUsers: Record<string, any> = {
      mudur: { id: "user-mudur", username: "mudur", fullName: "Müdür Bey", role: "Müdür", companyId: "mutlukal-depo-001" },
      personel: { id: "user-personel", username: "personel", fullName: "Ahmet Abi", role: "Personel", companyId: "mutlukal-depo-001" },
      satin_alma: { id: "user-satin", username: "satin_alma", fullName: "Satın Alma Sorumlusu", role: "Satın Alma", companyId: "mutlukal-depo-001" },
      lojistik: { id: "user-lojistik", username: "lojistik", fullName: "Lojistik Sorumlusu", role: "Lojistik", companyId: "mutlukal-depo-001" },
    };

    const user = mockUsers[username.toLowerCase()];
    if (!user || password !== "123456") {
      return { error: "Kullanıcı adı veya şifre hatalı." };
    }

    const token = await createSession({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      companyId: user.companyId,
    });

    await setSessionCookie(token);
    return { success: true };
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!user || !user.isActive) {
    return { error: "Kullanıcı adı veya şifre hatalı." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "Kullanıcı adı veya şifre hatalı." };
  }

  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, user.companyId))
    .limit(1)
    .then((r) => r[0] ?? null);

  const token = await createSession({
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    companyId: user.companyId,
  });

  await setSessionCookie(token);
  return { success: true };
}
