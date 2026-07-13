import { db } from "@/db";
import { products, productTrees, categories } from "@/db/schema";
import { eq, and, like } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import BomManagerClient from "@/components/BomManagerClient";

export const dynamic = "force-dynamic";

export default async function BomPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const q = sp.q || "";

  // 1) Sadece mamul ürünleri çek (categoryId = cat-urun olanlar)
  const conditions = [eq(products.categoryId, "cat-urun")];
  if (q) {
    conditions.push(like(products.name, `%${q}%`));
  }

  const mamulList = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(products.name);

  // 2) Diğer tüm ürünleri (koli, poşet, katkı, sarf) hammadde olarak seçilebilmesi için çek
  const rawMaterials = await db
    .select({
      id: products.id,
      name: products.name,
      unit: products.unit,
      categoryName: categories.name,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.isActive, true))
    .orderBy(products.name);

  // 3) Mevcut tüm BOM ilişkilerini çek
  const bomEntries = await db
    .select({
      id: productTrees.id,
      parentProductId: productTrees.parentProductId,
      childProductId: productTrees.childProductId,
      quantity: productTrees.quantity,
      unit: productTrees.unit,
      childName: products.name,
      childUnit: products.unit,
    })
    .from(productTrees)
    .innerJoin(products, eq(productTrees.childProductId, products.id));

  return (
    <BomManagerClient
      mamulList={mamulList}
      rawMaterials={rawMaterials}
      bomEntries={bomEntries}
      session={session}
    />
  );
}
