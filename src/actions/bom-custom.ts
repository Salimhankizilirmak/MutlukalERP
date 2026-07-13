"use server";

import { db } from "@/db";
import { productTrees, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function updateBomItem(bomId: string, quantity: number) {
  const session = await getSession();
  if (!session || !["Müdür", "Yetkili"].includes(session.role)) {
    return { error: "Yetkiniz yok." };
  }

  await db
    .update(productTrees)
    .set({ quantity })
    .where(eq(productTrees.id, bomId));

  revalidatePath("/dashboard/bom");
  return { success: true };
}

export async function deleteBomItem(bomId: string) {
  const session = await getSession();
  if (!session || !["Müdür", "Yetkili"].includes(session.role)) {
    return { error: "Yetkiniz yok." };
  }

  await db.delete(productTrees).where(eq(productTrees.id, bomId));

  revalidatePath("/dashboard/bom");
  return { success: true };
}

export async function addBomItem(parentId: string, childId: string, quantity: number) {
  const session = await getSession();
  if (!session || !["Müdür", "Yetkili"].includes(session.role)) {
    return { error: "Yetkiniz yok." };
  }

  // Zaten ekli mi kontrol et
  const existing = await db
    .select()
    .from(productTrees)
    .where(
      and(
        eq(productTrees.parentProductId, parentId),
        eq(productTrees.childProductId, childId)
      )
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  if (existing) {
    return { error: "Bu bileşen zaten ürün ağacında ekli." };
  }

  const childProduct = await db
    .select()
    .from(products)
    .where(eq(products.id, childId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!childProduct) {
    return { error: "Seçilen bileşen bulunamadı." };
  }

  await db.insert(productTrees).values({
    id: crypto.randomUUID(),
    parentProductId: parentId,
    childProductId: childId,
    quantity,
    unit: childProduct.unit,
    companyId: session.companyId,
  });

  revalidatePath("/dashboard/bom");
  return { success: true };
}
