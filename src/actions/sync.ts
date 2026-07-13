"use server";

import { db } from "@/db";
import { products, productTrees, stockMovements, excelSyncLogs } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import crypto from "crypto";

// Excel Sync İşlemi
export async function syncExcelData() {
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };

  // 1) S:\ veya local public dizininden en güncel excel dosyasını bulalım
  const pathsToSearch = [
    "S:\\Üretim\\2026 Üretim",
    path.join(process.cwd(), "public"),
  ];

  let selectedFilePath = "";
  let latestMtime = 0;

  for (const dirPath of pathsToSearch) {
    try {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          if (file.endsWith(".xlsx") && !file.startsWith("~$")) {
            const fullPath = path.join(dirPath, file);
            const stat = fs.statSync(fullPath);
            if (stat.mtimeMs > latestMtime) {
              latestMtime = stat.mtimeMs;
              selectedFilePath = fullPath;
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Dizin taranamadı: ${dirPath}`, e);
    }
  }

  if (!selectedFilePath) {
    return { error: "Senkronizasyon yapılacak *.xlsx dosyası bulunamadı." };
  }

  console.log(`Excel Sync Başlıyor. Dosya: ${selectedFilePath}`);

  try {
    const wb = XLSX.readFile(selectedFilePath);

    // 2) "Stok" sayfasından Üretim kolonlarını okuyalım.
    // Stok sayfasındaki her mamul için 'Üretim' kolonu o mamulün üretilen koli adedini verir.
    // Biz bu Üretim miktarını alıp BOM'daki koli, poşet ve katkı maddelerini stoktan düşeceğiz.
    const wsStok = wb.Sheets["Stok"];
    if (!wsStok) {
      return { error: "Excel dosyasında 'Stok' sayfası bulunamadı." };
    }

    const stokData = XLSX.utils.sheet_to_json(wsStok, { header: 1, defval: "" });
    const rows = stokData.slice(3); // Başlıkları geç

    let processedCount = 0;
    let fallbackLog = "";

    // Mevcut tüm mamul ürünleri veritabanından çekelim
    const dbMamulProducts = await db
      .select()
      .from(products)
      .where(eq(products.categoryId, "cat-urun"));

    // Her bir Excel satırını incele
    for (const r of rows) {
      const row = r as any;
      if (!row[1] || row[1] === "") continue;

      const excelUrunAd = row[1].toString().trim();
      const excelMusteri = row[2] ? row[2].toString().trim() : "";
      const fullUrunAd = `${excelUrunAd} / ${excelMusteri}`;
      
      // Excel'deki Üretim kolonu: İndeks 10 (11. kolon)
      const uretimMiktarı = parseFloat(row[10]) || 0;

      if (uretimMiktarı <= 0) continue;

      // Veritabanındaki ürünü bul
      const dbProduct = dbMamulProducts.find((p) => p.name === fullUrunAd);
      if (!dbProduct) {
        console.warn(`DB'de bulunamayan mamul ürün: ${fullUrunAd}`);
        continue;
      }

      // Bu mamulün BOM ağacını çek
      const bomItems = await db
        .select()
        .from(productTrees)
        .where(eq(productTrees.parentProductId, dbProduct.id));

      if (bomItems.length === 0) {
        fallbackLog += `${fullUrunAd} için BOM ağacı tanımlı değil.\n`;
        continue;
      }

      // BOM ağacındaki her bir bileşen için stok düşümü yap
      for (const bom of bomItems) {
        const dusulecekMiktar = bom.quantity * uretimMiktarı;

        // Hammadde ürününü bulalım
        const rawProduct = await db
          .select()
          .from(products)
          .where(eq(products.id, bom.childProductId))
          .limit(1)
          .then((r) => r[0] ?? null);

        if (rawProduct) {
          // Stok düş
          await db
            .update(products)
            .set({ currentStock: sql`${products.currentStock} - ${dusulecekMiktar}` })
            .where(eq(products.id, rawProduct.id));

          // Stok Hareketi oluştur
          await db.insert(stockMovements).values({
            id: crypto.randomUUID(),
            productId: rawProduct.id,
            companyId: session.companyId,
            type: "out",
            quantity: dusulecekMiktar,
            userId: session.userId,
            description: `Otomatik Üretim Düşümü: ${uretimMiktarı} Koli ${dbProduct.name}`,
            source: "excel_sync",
          });
        }
      }

      processedCount++;
    }

    // Başarılı log yaz
    await db.insert(excelSyncLogs).values({
      id: crypto.randomUUID(),
      companyId: session.companyId,
      filePath: path.basename(selectedFilePath),
      rowsProcessed: processedCount,
      status: "success",
      details: `Excel'den ${processedCount} mamul üretim hareketi işlendi.\n${fallbackLog}`,
    });

    revalidatePath("/dashboard", "layout");
    return { success: true, processedCount, fileName: path.basename(selectedFilePath) };
  } catch (e: any) {
    // Hatalı log yaz
    await db.insert(excelSyncLogs).values({
      id: crypto.randomUUID(),
      companyId: session.companyId,
      filePath: path.basename(selectedFilePath),
      rowsProcessed: 0,
      status: "error",
      details: e.message || "Excel okuma hatası.",
    });
    return { error: `Senkronizasyon başarısız: ${e.message}` };
  }
}
