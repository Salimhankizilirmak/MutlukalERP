import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { userDashboardLayouts, products, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getNextWorkOrdersCheck } from "@/actions/is-emirleri";
import WidgetGrid from "@/components/dashboard/WidgetGrid";

// Sayfa önbelleklemesini tamamen kapatalım (no-store)
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardIndexPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const role = session.role;
  const userId = session.userId;

  // 1) Kullanıcının kayıtlı düzen şablonunu çek
  const [layoutRecord] = await db
    .select()
    .from(userDashboardLayouts)
    .where(eq(userDashboardLayouts.userId, userId))
    .limit(1);

  const initialLayout = layoutRecord ? layoutRecord.layoutData : null;
  const initialVersion = layoutRecord ? layoutRecord.version : 1;

  // 2) Stok Verilerini Çek (Bulut/Vercel ve Yerel Uyumlu)
  let stocksData: any[] = [];
  if (process.env.VERCEL) {
    const { list } = require("@vercel/blob");
    let blobList = [];
    try {
      const res = await list({ prefix: "stocks.json" });
      blobList = res.blobs;
    } catch (err) {
      console.error("Dashboard Blob listeleme hatası:", err);
    }

    const stocksBlob = blobList[0];
    let payload = { stocks: [] };

    if (stocksBlob) {
      try {
        const fetchRes = await fetch(stocksBlob.url, { cache: 'no-store' });
        payload = await fetchRes.json();
      } catch (err) {
        console.error("Dashboard Blob veri okuma hatası:", err);
      }
    }

    const stocksList = payload.stocks || [];
    stocksData = stocksList.map((item: any) => ({
      id: item.id,
      name: item.name,
      sku: item.sku || "",
      currentStock: item.stock,
      criticalThreshold: item.criticalThreshold || 10,
      unit: item.unit || "Adet",
      categoryName: item.categoryId === "cat-urun" ? "Mamul Ürünler" : "Malzemeler",
    }));
  } else {
    try {
      stocksData = await db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          currentStock: products.currentStock,
          criticalThreshold: products.criticalThreshold,
          unit: products.unit,
          categoryName: categories.name,
        })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(eq(products.isActive, true));
    } catch (err) {
      console.error("Dashboard yerel veritabanı stok okuma hatası:", err);
    }
  }

  // 3) Rol Tabanlı Güvenlik (RBAC) Veri İzolasyonu
  // Personel rolündeki kullanıcılar için arka planda sipariş/iş emri sorgusunu KESİNLİKLE çalıştırmıyoruz.
  let ordersData: any[] = [];
  if (role !== "Personel") {
    try {
      const result = await getNextWorkOrdersCheck();
      if (result && !result.error) {
        const mutlukal = result.mutlukalOrders || [];
        const orman = result.ormanOrders || [];
        // Tüm makinelere ait işleri birleştir
        ordersData = [...mutlukal, ...orman];
      }
    } catch (err) {
      console.warn("Dashboard iş emirleri okuma hatası (Vercel ortamında normaldir):", err);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">👋 Hoş Geldiniz, {session.username}</h1>
        <p className="text-slate-400 text-xs mt-1">
          Kişiselleştirilmiş widget kontrol paneliniz. Sürükleyip bırakarak düzeninizi değiştirebilirsiniz.
        </p>
      </div>

      <WidgetGrid
        role={role}
        initialLayout={initialLayout}
        initialVersion={initialVersion}
        stocksData={stocksData}
        ordersData={ordersData}
      />
    </div>
  );
}
