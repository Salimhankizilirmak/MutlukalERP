import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { products, stockMovements, categories } from "@/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AnalizPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Kategori bazlı özet
  const catStats = await db
    .select({
      catName: categories.name,
      catIcon: categories.icon,
      total: count(products.id),
      totalStock: sql<number>`sum(${products.currentStock})`,
      criticalCount: sql<number>`sum(case when ${products.currentStock} <= ${products.criticalThreshold} and ${products.currentStock} > 0 then 1 else 0 end)`,
      zeroCount: sql<number>`sum(case when ${products.currentStock} = 0 then 1 else 0 end)`,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .groupBy(categories.id);

  // Son 20 hareket
  const sonHareketler = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      description: stockMovements.description,
      createdAt: stockMovements.createdAt,
      productName: products.name,
      unit: products.unit,
    })
    .from(stockMovements)
    .leftJoin(products, eq(stockMovements.productId, products.id))
    .orderBy(desc(stockMovements.createdAt))
    .limit(20);

  return (
    <div className="space-y-6">
      {/* Kategori Özeti */}
      <div>
        <h2 className="text-white font-bold text-base mb-4">Kategori Özeti</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {catStats.map((cat) => (
            <div key={cat.catName} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="text-2xl mb-3">{cat.catIcon}</div>
              <div className="text-white font-bold text-sm mb-3">{cat.catName}</div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Toplam ürün</span>
                  <span className="text-white font-semibold">{cat.total}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-amber-400">Kritik</span>
                  <span className="text-amber-400 font-semibold">{Number(cat.criticalCount ?? 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-red-400">Stok Yok</span>
                  <span className="text-red-400 font-semibold">{Number(cat.zeroCount ?? 0)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Son Hareketler */}
      <div>
        <h2 className="text-white font-bold text-base mb-4">Son Stok Hareketleri</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {sonHareketler.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">Henüz hareket yok.</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {sonHareketler.map((h) => (
                <div key={h.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      h.type === "in" ? "bg-emerald-500/20 text-emerald-400" : h.type === "out" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
                    }`}>
                      {h.type === "in" ? "▲" : h.type === "out" ? "▼" : "~"}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{h.productName}</div>
                      <div className="text-xs text-slate-500">{h.description}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${h.type === "in" ? "text-emerald-400" : "text-red-400"}`}>
                      {h.type === "in" ? "+" : "-"}{h.quantity.toLocaleString("tr")} {h.unit}
                    </div>
                    <div className="text-xs text-slate-500">{new Date(h.createdAt).toLocaleString("tr-TR")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
