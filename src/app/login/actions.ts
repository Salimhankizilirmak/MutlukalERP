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
  redirect("/dashboard");
}
