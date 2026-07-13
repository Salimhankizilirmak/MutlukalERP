/**
 * Mutlukal Depo - Yerel Stok Senkronizasyon Scripti
 * Bu script fabrikadaki yerel bilgisayarda çalıştırılmalıdır (örn. Windows Task Scheduler / Cron Job ile her 5-10 dakikada bir).
 * Sadece stok kodlarını, isimlerini ve miktarlarını canlı sunucuya (Vercel KV) güvenli bir şekilde aktarır.
 * Fiyatlar, müşteri isimleri, kullanıcılar ve diğer hassas veriler fabrikada yerel kalır.
 */

const Database = require("better-sqlite3");
const path = require("path");

// Yapılandırma - Bu bilgileri canlı sunucu adresinize göre güncelleyin
const VERCEL_APP_URL = "https://mutlukalerp.vercel.app"; // Canlı web sitenizin adresi
const SYNC_TOKEN = "PROD_STOK_SYNC_GIVEN_SECRET_TOKEN"; // Canlıdaki .env dosyasındaki SYNC_TOKEN ile aynı olmalıdır.

// Veritabanı Yolu
const dbPath = path.join(__dirname, "mutlukal.db");

async function syncStocks() {
  console.log(`[${new Date().toISOString()}] Stok senkronizasyonu başlatılıyor...`);

  try {
    const db = new Database(dbPath, { fileMustExist: true });

    // Sadece aktif ve stok miktarı olan ürün/malzemeleri çekelim
    const products = db.prepare(`
      SELECT id, name, category_id as categoryId, sku, unit, critical_threshold as criticalThreshold, current_stock as stock 
      FROM products 
      WHERE is_active = 1
    `).all();

    console.log(`Lokal veritabanından ${products.length} ürün/malzeme okundu.`);

    if (products.length === 0) {
      console.log("Gönderilecek ürün verisi bulunamadı.");
      db.close();
      return;
    }

    // Vercel API'sine gönder
    const response = await fetch(`${VERCEL_APP_URL}/api/sync-stocks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SYNC_TOKEN}`
      },
      body: JSON.stringify({ stocks: products })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log(`✓ Başarıyla senkronize edildi! Güncellenen kayıt sayısı: ${result.count}`);
    } else {
      console.error(`❌ Senkronizasyon başarısız oldu:`, result.error || response.statusText);
    }

    db.close();
  } catch (error) {
    console.error("❌ Hata oluştu:", error.message);
  }
}

// Senkronizasyonu çalıştır
syncStocks();
