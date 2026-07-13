"use server";

import { db } from "@/db";
import { products } from "@/db/schema";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function addProduct(categoryId: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "Müdür") return { error: "Yetkiniz yok." };

  const name = formData.get("name")?.toString().trim();
  if (!name) return { error: "Ürün adı gereklidir." };

  const sku = formData.get("sku")?.toString().trim() || null;
  const unit = formData.get("unit")?.toString() || "Adet";
  const currentStock = parseFloat(formData.get("currentStock")?.toString() || "0") || 0;
  const criticalThreshold = parseFloat(formData.get("criticalThreshold")?.toString() || "10") || 10;

  await db.insert(products).values({
    companyId: session.companyId,
    categoryId,
    name,
    sku,
    unit,
    currentStock,
    criticalThreshold,
  });

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
