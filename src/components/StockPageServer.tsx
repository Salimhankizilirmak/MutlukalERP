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
  let category: any = null;
  if (!process.env.VERCEL) {
    category = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, categorySlug))
      .limit(1)
      .then((r) => r[0] ?? null);
  } else {
    // Vercel üzerinde statik fallback kategori objesi
    const catMap: Record<string, any> = {
      urun: { id: "cat-urun", name: "Mamul Ürünler", slug: "urun", icon: "🏭", color: "#6366f1" },
      koli: { id: "cat-koli", name: "Koliler", slug: "koli", icon: "📦", color: "#3b82f6" },
      poset: { id: "cat-poset", name: "Poşetler", slug: "poset", icon: "🛍️", color: "#ec4899" },
      katki: { id: "cat-katki", name: "Katkı Maddeleri", slug: "katki", icon: "🧪", color: "#10b981" },
      sarf: { id: "cat-sarf", name: "Sarf Malzemeleri", slug: "sarf", icon: "🔧", color: "#f59e0b" },
    };
    category = catMap[categorySlug] || { id: `cat-${categorySlug}`, name: categorySlug, slug: categorySlug, icon: "📦", color: "#6366f1" };
  }

  if (!category) return <div className="text-red-400">Kategori bulunamadı.</div>;

  let urunler: any[] = [];
  let totalItems = 0;
  let lastSyncInfo = "Canlı Senkronizasyon";
  let stats = { total: 0, critical: 0, outOfStock: 0 };

  if (process.env.VERCEL) {
    const { kv } = require("@vercel/kv");
    // Vercel KV'den tüm stock_meta anahtarlarını çekelim
    const keys = await kv.keys("stock_meta:*");
    const metaList = keys.length > 0 ? await kv.mget(...keys) : [];
    
    // Kategoriye ait olan ve filtreye uyanları bulalım
    const allItems = metaList
      .filter(Boolean)
      .map((item: any, idx: number) => ({
        id: keys[idx].replace("stock_meta:", ""),
        name: item.name,
        currentStock: item.stock,
        categoryId: item.categoryId || category.id,
        unit: item.unit || "Adet",
        criticalThreshold: item.criticalThreshold || 10,
        sku: item.sku || "",
      }))
      .filter((item: any) => {
        if (item.categoryId !== category.id) return false;
        const matchesSearch = searchTerm ? item.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
        if (!matchesSearch) return false;
        if (filter === "critical") return item.currentStock <= item.criticalThreshold;
        if (filter === "zero") return item.currentStock === 0;
        return true;
      });

    totalItems = allItems.length;
    urunler = allItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    
    stats = {
      total: allItems.length,
      critical: allItems.filter((i: any) => i.currentStock <= i.criticalThreshold && i.currentStock > 0).length,
      outOfStock: allItems.filter((i: any) => i.currentStock === 0).length,
    };
    
    if (metaList.length > 0 && metaList[0]?.updatedAt) {
      const d = new Date(metaList[0].updatedAt);
      lastSyncInfo = d.toLocaleTimeString("tr-TR") + " " + d.toLocaleDateString("tr-TR");
    }
  } else {
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

    lastSyncInfo = lastSync
      ? new Date(lastSync).toLocaleTimeString("tr-TR") + " " + new Date(lastSync).toLocaleDateString("tr-TR")
      : "Yapılmadı";

    const totalCountResult = await db
      .select({ total: count() })
      .from(products)
      .where(whereClause);
    totalItems = totalCountResult[0]?.total ?? 0;

    urunler = await db
      .select()
      .from(products)
      .where(whereClause)
      .limit(pageSize)
      .offset((currentPage - 1) * pageSize)
      .orderBy(products.name);

    // Özet istatistikler
    const dbStats = await db
      .select({
        total: count(),
        critical: sql<number>`sum(case when ${products.currentStock} <= ${products.criticalThreshold} and ${products.currentStock} > 0 then 1 else 0 end)`,
        outOfStock: sql<number>`sum(case when ${products.currentStock} = 0 then 1 else 0 end)`,
      })
      .from(products)
      .where(eq(products.categoryId, category.id))
      .then((r) => r[0]);

    stats = {
      total: dbStats?.total ?? 0,
      critical: Number(dbStats?.critical ?? 0),
      outOfStock: Number(dbStats?.outOfStock ?? 0),
    };
  }

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <StockPageClient
      category={category}
      products={urunler}
      session={session}
      totalItems={totalItems}
      totalPages={totalPages}
      currentPage={currentPage}
      lastSyncInfo={lastSyncInfo}
      stats={stats}
    />
  );
}
