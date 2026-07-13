import { db } from "@/db";
import { products, categories, stockMovements, excelSyncLogs } from "@/db/schema";
import { eq, and, like, lte, count, desc, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import StockPageClient from "@/components/StockPageClient";

export const dynamic = "force-dynamic";

interface Props {
  categorySlug: string;
  searchParams: { q?: string; f?: string; p?: string };
}

export async function StockPageServer({ categorySlug, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { q = "", f = "all", p = "1" } = searchParams;
  const searchTerm = q;
  const filter = f;
  const currentPage = parseInt(p) || 1;
  const pageSize = 50;

  // Kategori bul
  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, categorySlug))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!category) return <div className="text-red-400">Kategori bulunamadı.</div>;

  // Koşullar
  const conditions = [eq(products.categoryId, category.id)];
  if (searchTerm) conditions.push(like(products.name, `%${searchTerm}%`));
  if (filter === "critical") conditions.push(lte(products.currentStock, products.criticalThreshold));
  if (filter === "zero") conditions.push(eq(products.currentStock, 0));

  const whereClause = and(...conditions);

  // Son başarılı senkronizasyon logunu çekelim
  const lastSync = await db
    .select({ syncedAt: excelSyncLogs.syncedAt })
    .from(excelSyncLogs)
    .where(eq(excelSyncLogs.status, "success"))
    .orderBy(desc(excelSyncLogs.syncedAt))
    .limit(1)
    .then((r) => r[0]?.syncedAt ?? "");

  const lastSyncInfo = lastSync
    ? new Date(lastSync).toLocaleTimeString("tr-TR") + " " + new Date(lastSync).toLocaleDateString("tr-TR")
    : "Yapılmadı";

  const totalCountResult = await db
    .select({ total: count() })
    .from(products)
    .where(whereClause);
  const totalItems = totalCountResult[0]?.total ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const urunler = await db
    .select()
    .from(products)
    .where(whereClause)
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize)
    .orderBy(products.name);

  // Özet istatistikler
  const stats = await db
    .select({
      total: count(),
      critical: sql<number>`sum(case when ${products.currentStock} <= ${products.criticalThreshold} and ${products.currentStock} > 0 then 1 else 0 end)`,
      outOfStock: sql<number>`sum(case when ${products.currentStock} = 0 then 1 else 0 end)`,
    })
    .from(products)
    .where(eq(products.categoryId, category.id))
    .then((r) => r[0]);

  return (
    <StockPageClient
      category={category}
      products={urunler}
      session={session}
      totalItems={totalItems}
      totalPages={totalPages}
      currentPage={currentPage}
      lastSyncInfo={lastSyncInfo}
      stats={{
        total: stats?.total ?? 0,
        critical: Number(stats?.critical ?? 0),
        outOfStock: Number(stats?.outOfStock ?? 0),
      }}
    />
  );
}
