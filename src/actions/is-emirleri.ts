"use server";

import { db } from "@/db";
import { products, productTrees, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { sendStockShortageEmail } from "@/lib/mail";

export interface MissingMaterial {
  name: string;
  needed: number;
  current: number;
  unit: string;
}

export interface WorkOrderCheck {
  machineName: string;
  firma: string;
  productName: string;
  cinsi: string;
  targetQty: number; // Koli
  status: "available" | "shortage" | "unknown_product";
  dbProductId?: string;
  missingItems: MissingMaterial[];
}

function cleanString(str: string) {
  if (!str) return "";
  return str.toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/i/g, "i")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g");
}

// Bir iş emri dosyasını ve sayfasını okuyup makinelerin sonraki 7 iş emrini çıkaran fonksiyon
async function parseWorkOrdersFromFile(filePath: string, sheetName: string): Promise<WorkOrderCheck[]> {
  console.log(`parseWorkOrdersFromFile çağrıldı. Yol: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.warn(`Dosya fiziksel olarak yok: ${filePath}`);
    return [];
  }

  let wb;
  try {
    const fileBuffer = fs.readFileSync(filePath);
    wb = XLSX.read(fileBuffer, { type: "buffer" });
    console.log(`Başarıyla okundu (ilk deneme): ${filePath}`);
  } catch (err: any) {
    console.warn(`Dosya okunamadı (${filePath}), yedek klasörler deneniyor. Hata: ${err.message}`);
    const fileName = path.basename(filePath).toUpperCase();
    const isOrman = fileName.includes("ORMAN");
    
    const fallbackDirs = [
      "D:\\Uretim\\İş Emirleri",
      "S:\\İş Emirleri",
      path.join(process.cwd(), "public"),
    ];
    
    let fallbackPath = "";
    for (const dir of fallbackDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          console.log(`Dizin taranıyor: ${dir}. Dosya sayısı: ${files.length}`);
          for (const file of files) {
            const fileUpper = file.toUpperCase();
            if (fileUpper.endsWith(".XLSX") && !file.startsWith("~$")) {
              if (isOrman && fileUpper.includes("MUTLU") && fileUpper.includes("ORMAN")) {
                fallbackPath = path.join(dir, file);
                console.log(`Orman için fallback eşleşti: ${fallbackPath}`);
                break;
              } else if (!isOrman && fileUpper.includes("MUTLUKAL") && !fileUpper.includes("ORMAN")) {
                fallbackPath = path.join(dir, file);
                console.log(`Mutlukal için fallback eşleşti: ${fallbackPath}`);
                break;
              }
            }
          }
        } catch (e) {
          console.warn(`Dizin okunamadı: ${dir}`);
        }
      }
      if (fallbackPath) break;
    }

    if (fallbackPath && fs.existsSync(fallbackPath)) {
      try {
        const fallbackBuffer = fs.readFileSync(fallbackPath);
        wb = XLSX.read(fallbackBuffer, { type: "buffer" });
        console.log(`Başarıyla okundu (fallback): ${fallbackPath}`);
      } catch (innerErr: any) {
        console.error(`Yedek dosya da okunamadı (${fallbackPath}):`, innerErr.message);
        return [];
      }
    } else {
      console.warn(`Eşleşen yedek dosya bulunamadı.`);
      return [];
    }
  }

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.warn(`Sayfa bulunamadı: ${sheetName}`);
    return [];
  }

  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[];
  const results: WorkOrderCheck[] = [];

  // Veritabanındaki tüm mamul ürünleri ve BOM ağaçlarını çekelim
  const dbProducts = await db.select().from(products);
  const mamuls = dbProducts.filter((p) => p.categoryId === "cat-urun");
  const raws = dbProducts.filter((p) => p.categoryId !== "cat-urun");

  // Reçeteleri ve BOM bağlantılarını al
  const bomEntries = await db.select().from(productTrees);

  let currentMachine = "";

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const cell0 = row[0] ? row[0].toString().trim() : "";

    // Makine satırı tespiti
    if (cell0.includes("MAKİNE") || cell0.includes("Makine") || cell0.includes("ORMAN") || cell0.includes("Orman")) {
      currentMachine = cell0;
      continue;
    }

    // Başlık veya boş satırları geç
    if (!currentMachine || cell0 === "SIRA" || !row[4] || row[4] === "") continue;

    // Bu makine için zaten 7 adet iş emri aldıysak fazlasını ekleme
    const machineOrdersCount = results.filter((r) => r.machineName === currentMachine).length;
    if (machineOrdersCount >= 7) continue;

    const firma = row[1] ? row[1].toString().trim() : "";
    const workOrderProductName = row[4].toString().trim();
    const cinsi = row[9] ? row[9].toString().trim() : "";
    const uretilecekKoli = parseFloat(row[10]) || 0;

    if (uretilecekKoli <= 0) continue;

    // Ürün eşleştirme logic'i (Fuzzy Match)
    let cap = "";
    const capMatch = workOrderProductName.match(/(\d+)\s*cm/i);
    if (capMatch) cap = capMatch[1];

    const cleanFirma = cleanString(firma);
    const cleanUrun = cleanString(workOrderProductName);

    const matchedDbProduct = mamuls.find((p) => {
      const attrs = p.attributes ? JSON.parse(p.attributes) : {};
      const cleanMusteri = cleanString(attrs.musteri);
      const cleanDbName = cleanString(p.name);

      if (cap && attrs.cap && String(attrs.cap) !== String(cap)) return false;

      // Marka kontrolü
      const brands = ["nimet", "happylla", "lazeza", "bonita", "alkafel", "durum", "samakat", "germes", "bisto", "tortillove", "taco", "donipa", "baskisiz"];
      let matchedBrand = false;
      for (const brand of brands) {
        if (cleanUrun.includes(brand) && cleanDbName.includes(brand)) {
          matchedBrand = true;
          break;
        }
      }

      if (!matchedBrand) {
        const firstPart = p.name.split("/")[0].trim().toLowerCase();
        if (workOrderProductName.toLowerCase().includes(firstPart)) {
          matchedBrand = true;
        }
      }

      if (!matchedBrand) return false;

      // Firma/Müşteri kontrolü
      if (cleanMusteri && cleanFirma && (cleanMusteri.includes(cleanFirma) || cleanFirma.includes(cleanMusteri))) return true;
      if (cleanDbName.includes(cleanFirma)) return true;
      if (cleanFirma.includes("a101") && cleanMusteri.includes("a101")) return true;
      if (cleanFirma.includes("sok") && cleanMusteri.includes("sok")) return true;
      if (cleanFirma.includes("tasteland") && cleanMusteri.includes("avrupa")) return true;

      return false;
    });

    if (!matchedDbProduct) {
      results.push({
        machineName: currentMachine,
        firma,
        productName: workOrderProductName,
        cinsi: cinsi || "",
        targetQty: uretilecekKoli,
        status: "unknown_product",
        missingItems: [],
      });
      continue;
    }

    // Ürün eşleştiyse BOM stok kontrolü yapalım
    const bom = bomEntries.filter((b) => b.parentProductId === matchedDbProduct.id);
    const missingItems: MissingMaterial[] = [];

    for (const b of bom) {
      const neededQty = b.quantity * uretilecekKoli;
      const child = raws.find((r) => r.id === b.childProductId);
      if (child) {
        const currentStock = child.currentStock || 0;
        if (currentStock < neededQty) {
          missingItems.push({
            name: child.name,
            needed: neededQty,
            current: currentStock,
            unit: child.unit,
          });
        }
      }
    }

    results.push({
      machineName: currentMachine,
      firma,
      productName: workOrderProductName,
      cinsi: cinsi || "",
      targetQty: uretilecekKoli,
      status: missingItems.length > 0 ? "shortage" : "available",
      dbProductId: matchedDbProduct.id,
      missingItems,
    });
  }

  return results;
}

// Her iki iş emri dosyasını S: klasöründen veya public'ten tarayan ana fonksiyon
export async function getNextWorkOrdersCheck() {
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };

  const searchDirs = [
    "D:\\Uretim\\İş Emirleri",
    "S:\\İş Emirleri",
    path.join(process.cwd(), "public"),
  ];

  let mutlukalPath = "";
  let ormanPath = "";

  for (const dir of searchDirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fileUpper = file.toUpperCase();
          if (fileUpper.endsWith(".XLSX") && !file.startsWith("~$")) {
            // "MUTLUKAL" içerip "ORMAN" içermeyen -> MUTLUKAL İŞ EMRİ
            if (fileUpper.includes("MUTLUKAL") && !fileUpper.includes("ORMAN")) {
              mutlukalPath = path.join(dir, file);
            }
            // "MUTLU" ve "ORMAN" içeren -> MUTLU ORMAN İŞ EMRİ
            if (fileUpper.includes("MUTLU") && fileUpper.includes("ORMAN")) {
              ormanPath = path.join(dir, file);
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Dizin okunurken hata oluştu: ${dir}`, e);
    }
    if (mutlukalPath && ormanPath) break;
  }

  if (!mutlukalPath || !ormanPath) {
    return { error: `İş emri excel dosyaları bulunamadı. (Aranan dizinler: ${searchDirs.join(", ")})` };
  }

  console.log(`İş Emirleri Okunuyor:\n- Mutlukal: ${mutlukalPath}\n- Orman: ${ormanPath}`);

  // Bugün ayın 3'ü olduğu için Sayfa3'ü tarıyoruz
  const sheetName = "Sayfa3";

  const mutlukalOrders = await parseWorkOrdersFromFile(mutlukalPath, sheetName);
  const ormanOrders = await parseWorkOrdersFromFile(ormanPath, sheetName);

  return {
    success: true,
    mutlukalOrders,
    ormanOrders,
    sheetName,
  };
}

// Eksik stok durumunda Müdür, Üretim Müdürü ve Satın Alma rollerine e-posta gönderen action
export async function sendShortageAlertEmails(shortageItems: Array<{
  machineName: string;
  productName: string;
  missingItems: MissingMaterial[];
}>) {
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };

  // E-postası tanımlı olan Müdür, Üretim Müdürü ve Satın Alma kullanıcılarını bulalım
  const alertUsers = await db
    .select({ email: users.email, role: users.role, fullName: users.fullName })
    .from(users)
    .where(and(eq(users.isActive, true), sql`${users.email} is not null and ${users.email} != ''`));

  const targetUsers = alertUsers.filter(u => 
    ["Müdür", "Üretim Müdürü", "Satın Alma"].includes(u.role)
  );

  if (targetUsers.length === 0) {
    return { error: "E-postası tanımlı Müdür, Üretim Müdürü veya Satın Alma kullanıcısı bulunamadı." };
  }

  let sentCount = 0;
  for (const user of targetUsers) {
    if (user.email) {
      await sendStockShortageEmail({
        to: user.email,
        ordersCount: shortageItems.length,
        items: shortageItems,
      });
      sentCount++;
    }
  }

  return { success: true, sentCount };
}
