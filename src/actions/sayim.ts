"use server";

import { db } from "@/db";
import { blindCounts, blindCountItems, products, stockMovements } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

// 1) Yeni Kör Sayım Başlat
export async function startBlindCount(categoryId: string) {
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };

  // Zaten aktif (in_progress) bir sayım var mı kontrol et
  const active = await db
    .select()
    .from(blindCounts)
    .where(
      and(
        eq(blindCounts.companyId, session.companyId),
        eq(blindCounts.categoryId, categoryId),
        eq(blindCounts.status, "in_progress")
      )
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  if (active) {
    return { error: "Bu kategori için zaten devam eden bir sayım var.", id: active.id };
  }

  const newId = crypto.randomUUID();
  await db.insert(blindCounts).values({
    id: newId,
    companyId: session.companyId,
    categoryId,
    startedBy: session.userId,
    status: "in_progress",
  });

  // Bu kategorideki tüm aktif ürünleri çekip blindCountItems'a previousQty ile ekleyelim
  const catProducts = await db
    .select()
    .from(products)
    .where(and(eq(products.categoryId, categoryId), eq(products.isActive, true)));

  if (catProducts.length > 0) {
    const items = catProducts.map((p) => ({
      id: crypto.randomUUID(),
      blindCountId: newId,
      productId: p.id,
      countedQty: 0,
      previousQty: p.currentStock || 0,
      difference: -(p.currentStock || 0),
    }));

    // Toplu ekle
    for (const chunk of chunkArray(items, 100)) {
      await db.insert(blindCountItems).values(chunk);
    }
  }

  revalidatePath("/dashboard", "layout");
  return { success: true, id: newId };
}

// 2) Sayım Miktarını Kaydet / Güncelle (Personel sayım yaparken)
export async function updateCountItem(itemId: string, countedQty: number) {
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };

  const item = await db
    .select()
    .from(blindCountItems)
    .where(eq(blindCountItems.id, itemId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!item) return { error: "Sayım kalemi bulunamadı." };

  const diff = countedQty - item.previousQty;

  await db
    .update(blindCountItems)
    .set({
      countedQty,
      difference: diff,
    })
    .where(eq(blindCountItems.id, itemId));

  return { success: true };
}

// 3) Sayımı Tamamla ve Onaya Gönder
export async function submitBlindCount(countId: string, note: string) {
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };

  await db
    .update(blindCounts)
    .set({
      status: "submitted",
      note,
      submittedAt: new Date().toISOString(),
    })
    .where(eq(blindCounts.id, countId));

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

// 4) Müdür Sayımı Onaylasın (Stoklar güncellenir)
export async function approveBlindCount(countId: string) {
  const session = await getSession();
  if (!session || session.role !== "Müdür") {
    return { error: "Sadece müdür onaylayabilir." };
  }

  const countObj = await db
    .select()
    .from(blindCounts)
    .where(eq(blindCounts.id, countId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!countObj || countObj.status !== "submitted") {
    return { error: "Onaylanacak uygun durumda sayım bulunamadı." };
  }

  // Sayım kalemlerini al
  const items = await db
    .select()
    .from(blindCountItems)
    .where(eq(blindCountItems.blindCountId, countId));

  // Her ürün için stoğu güncelle ve stok hareketi oluştur
  for (const item of items) {
    if (item.difference !== 0) {
      await db.batch([
        db
          .update(products)
          .set({ currentStock: item.countedQty })
          .where(eq(products.id, item.productId)),
        db.insert(stockMovements).values({
          productId: item.productId,
          companyId: session.companyId,
          type: item.difference > 0 ? "in" : "out",
          quantity: Math.abs(item.difference),
          userId: session.userId,
          description: `Kör Sayım Fark Düzeltmesi (Sayım ID: ${countId.slice(0, 8)})`,
          source: "blind_count",
        }),
      ]);
    }
  }

  await db
    .update(blindCounts)
    .set({
      status: "approved",
      approvedAt: new Date().toISOString(),
      approvedBy: session.userId,
    })
    .where(eq(blindCounts.id, countId));

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

// Helper: Chunk array
function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
