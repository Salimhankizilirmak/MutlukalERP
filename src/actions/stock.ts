"use server";

import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function stockInOut(
  productId: string,
  type: "in" | "out",
  quantity: number,
  description: string = ""
) {
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };
  if (!["Müdür", "Yetkili"].includes(session.role)) return { error: "Yetkiniz yok." };

  // Mevcut stok
  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!product) return { error: "Ürün bulunamadı." };

  if (type === "out" && (product.currentStock ?? 0) < quantity) {
    return { error: `Yetersiz stok. Mevcut: ${product.currentStock} ${product.unit}` };
  }

  const delta = type === "in" ? quantity : -quantity;

  await db.batch([
    db
      .update(products)
      .set({ currentStock: sql`${products.currentStock} + ${delta}` })
      .where(eq(products.id, productId)),
    db.insert(stockMovements).values({
      productId,
      companyId: product.companyId,
      type,
      quantity,
      userId: session.userId,
      description: description || (type === "in" ? "Manuel giriş" : "Manuel çıkış"),
      source: "manuel",
    }),
  ]);

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
