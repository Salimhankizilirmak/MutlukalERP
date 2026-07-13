"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// 1) Yeni Kullanıcı Ekle
export async function addUserAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "Müdür") {
    return { error: "Yetkiniz yok." };
  }

  const username = formData.get("username")?.toString().trim();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("fullName")?.toString().trim() || "";
  const role = formData.get("role")?.toString() || "Personel";

  if (!username || !password) {
    return { error: "Kullanıcı adı ve şifre gereklidir." };
  }

  // Kullanıcı adı benzersiz mi kontrol et
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (existing) {
    return { error: "Bu kullanıcı adı zaten alınmış." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    id: crypto.randomUUID(),
    companyId: session.companyId,
    username,
    passwordHash,
    fullName,
    role,
    isActive: true,
  });

  revalidatePath("/dashboard/kullanicilar");
  return { success: true };
}

// 2) Kullanıcı Şifresi Sıfırla (Override)
export async function resetUserPassword(userId: string, newPass: string) {
  const session = await getSession();
  if (!session || session.role !== "Müdür") {
    return { error: "Yetkiniz yok." };
  }

  if (!newPass || newPass.length < 4) {
    return { error: "Şifre en az 4 karakter olmalıdır." };
  }

  const passwordHash = await bcrypt.hash(newPass, 10);

  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));

  return { success: true };
}

// 3) Kullanıcı Durumunu Değiştir (Aktif/Pasif)
export async function toggleUserStatus(userId: string, currentStatus: boolean) {
  const session = await getSession();
  if (!session || session.role !== "Müdür") {
    return { error: "Yetkiniz yok." };
  }

  // Kendisini pasife almasını engelle
  if (userId === session.userId) {
    return { error: "Kendi hesabınızı pasifleştiremezsiniz." };
  }

  await db
    .update(users)
    .set({ isActive: !currentStatus })
    .where(eq(users.id, userId));

  revalidatePath("/dashboard/kullanicilar");
  return { success: true };
}

// 4) Kullanıcı Sil
export async function deleteUserAction(userId: string) {
  const session = await getSession();
  if (!session || session.role !== "Müdür") {
    return { error: "Yetkiniz yok." };
  }

  if (userId === session.userId) {
    return { error: "Kendi hesabınızı silemezsiniz." };
  }

  await db.delete(users).where(eq(users.id, userId));

  revalidatePath("/dashboard/kullanicilar");
  return { success: true };
}

// 5) Kullanıcı E-posta Güncelle (İlk giriş için)
export async function updateUserEmail(userId: string, email: string) {
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };

  if (!email || !email.includes("@")) {
    return { error: "Geçerli bir e-posta adresi girin." };
  }

  // Veritabanını güncelle
  await db
    .update(users)
    .set({ email })
    .where(eq(users.id, userId));

  // Hoşgeldin maili gönder
  const { sendWelcomeEmail } = await import("@/lib/mail");
  await sendWelcomeEmail(email, session.fullName || session.username, session.username);

  return { success: true };
}
