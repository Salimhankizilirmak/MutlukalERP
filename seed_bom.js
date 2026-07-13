/**
 * Mutlukal Depo — Seed Script with BOM (Product Trees)
 * Çalıştırma: node seed.js
 * Excel verilerini ve ürün ağaçlarını local SQLite veritabanına yükler.
 */

const XLSX = require('xlsx');
const { createClient } = require('@libsql/client');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DB_PATH = `file:${path.join(__dirname, 'mutlukal.db')}`;

async function main() {
  console.log('🌱 Mutlukal Depo Seed & BOM oluşturma başlıyor...\n');

  const client = createClient({ url: DB_PATH });

  // Tabloları temizle ve yeniden oluştur (sıfır hata için)
  await client.execute(`DROP TABLE IF EXISTS product_trees`);
  await client.execute(`CREATE TABLE product_trees (
    id TEXT PRIMARY KEY,
    parent_product_id TEXT NOT NULL,
    child_product_id TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'Adet',
    company_id TEXT NOT NULL
  )`);

  const COMPANY_ID = 'mutlukal-depo-001';

  // 1) Veritabanındaki ürünleri ve kategorileri oku
  const allProductsRes = await client.execute(`SELECT * FROM products`);
  const allProducts = allProductsRes.rows;

  const categoriesRes = await client.execute(`SELECT * FROM categories`);
  const allCats = categoriesRes.rows;

  const catUrun = allCats.find(c => c.slug === 'urun');
  const catKoli = allCats.find(c => c.slug === 'koli');
  const catPoset = allCats.find(c => c.slug === 'poset');
  const catKatki = allCats.find(c => c.slug === 'katki');

  if (!catUrun || !catKoli || !catPoset || !catKatki) {
    console.error('❌ Hata: Kategoriler eksik. Önce normal seed.js çalıştırılmalı.');
    process.exit(1);
  }

  // 2) Koli, Poşet ve Katkı ürünlerini ayrı listelere ayır
  const koliProducts = allProducts.filter(p => p.category_id === catKoli.id);
  const posetProducts = allProducts.filter(p => p.category_id === catPoset.id);
  const katkiProducts = allProducts.filter(p => p.category_id === catKatki.id);
  const mamulProducts = allProducts.filter(p => p.category_id === catUrun.id);

  // 3) Reçete varsayımlarını oku
  const wb = XLSX.readFile('public/2026 2. \u00c7eyrek.xlsx');
  const wsVars = wb.Sheets['Varsayımlar'];
  const varsRows = XLSX.utils.sheet_to_json(wsVars, {header:1, defval:''}).slice(2);
  const recipes = [];
  varsRows.forEach(r => {
    if (r[0] && r[0] !== '') {
      recipes.push({
        temelUrun: r[0].toString().trim(),
        size: parseFloat(r[1]) || 0,
        cesit: r[2].toString().trim(),
        katkiMiktari: parseFloat(r[8]) || 0,
        toplamAgirlik: parseFloat(r[11]) || 0,
      });
    }
  });

  const recipeMapping = {
    'standart': 'Yurtiçi S.',
    'soft': 'Soft 150',
    'irak soft': 'Irak-150',
    'pizza 6': 'Pizza 6 - 150',
    'syd': 'SYD',
    'talento': 'Talento'
  };

  console.log(`Mamul ürün sayısı: ${mamulProducts.length}`);
  console.log(`Koli çeşit sayısı: ${koliProducts.length}`);
  console.log(`Poşet çeşit sayısı: ${posetProducts.length}`);
  console.log(`Katkı çeşit sayısı: ${katkiProducts.length}\n`);

  let bomCount = 0;

  for (const mamul of mamulProducts) {
    const attrs = mamul.attributes ? JSON.parse(mamul.attributes) : {};
    const cap = parseFloat(attrs.cap) || 0;
    const koliIci = parseFloat(attrs.koliIci) || 0;
    const gramaj = parseFloat(attrs.gramaj) || 0; // Tek bir paketin gramajı (örn: 260 gr)
    const musteri = attrs.musteri || '';
    const nameOnly = mamul.name.split('/')[0].trim(); // "Nimet" veya "Happylla" vb.

    // ── A) KOLI BAĞLANTISI (1 Koli için 1 Kutu) ─────────────────────────────
    let matchedKoli = koliProducts.find(kp => {
      const kName = kp.name.toLowerCase();
      const capStr = `${cap} cm`;
      const capStr2 = `${cap}cm`;
      return (kName.includes(capStr) || kName.includes(capStr2)) &&
             (kName.includes(nameOnly.toLowerCase()) || kName.includes(musteri.toLowerCase()));
    });

    if (!matchedKoli) {
      matchedKoli = koliProducts.find(kp => kp.name.includes(`${cap} cm`) || kp.name.includes(`${cap}cm`));
    }

    if (matchedKoli) {
      await client.execute({
        sql: `INSERT INTO product_trees (id, parent_product_id, child_product_id, quantity, unit, company_id) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [crypto.randomUUID(), mamul.id, matchedKoli.id, 1, 'Adet', COMPANY_ID]
      });
      bomCount++;
    }

    // ── B) POŞET BAĞLANTISI (1 Koli için 'koliIci' kadar poşet) ──────────────
    let matchedPoset = posetProducts.find(pp => {
      const pName = pp.name.toLowerCase();
      const capStr = `${cap} cm`;
      const capStr2 = `${cap}cm`;
      return (pName.includes(capStr) || pName.includes(capStr2)) &&
             (pName.includes(nameOnly.toLowerCase()) || pName.includes(musteri.toLowerCase()));
    });

    if (!matchedPoset) {
      matchedPoset = posetProducts.find(pp => pp.name.includes(`${cap} cm`) || pp.name.includes(`${cap}cm`));
    }

    if (matchedPoset && koliIci > 0) {
      await client.execute({
        sql: `INSERT INTO product_trees (id, parent_product_id, child_product_id, quantity, unit, company_id) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [crypto.randomUUID(), mamul.id, matchedPoset.id, koliIci, 'Adet', COMPANY_ID]
      });
      bomCount++;
    }

    // ── C) KATKI BAĞLANTISI (Un / Katkı oranı) ─────────────────────────────────
    // Formül: Katkı Miktarı (kg) / Kazan Toplam Ağırlığı (kg) = Bir adet hamurdaki katkı oranı.
    // Bir koli için toplam katkı kg = (koliIci * gramaj / 1000) * (katkiMiktari / toplamAgirlik)
    const recipeKey = recipeMapping[attrs.temelUrun?.toLowerCase()] || attrs.temelUrun || '';
    const recipe = recipes.find(r => {
      return r.temelUrun.toLowerCase() === recipeKey.toLowerCase() &&
             r.size === cap &&
             r.cesit.toLowerCase() === (attrs.cesit || '').toLowerCase();
    });

    if (recipe && recipe.toplamAgirlik > 0 && koliIci > 0 && gramaj > 0) {
      const katkiOrani = recipe.katkiMiktari / recipe.toplamAgirlik; // örn: 7.83 / 244.08 = 0.032
      const koliKatkiKg = (koliIci * gramaj / 1000) * katkiOrani; // 1 koli için katkı kg

      // İlgili katkı maddesini bulalım (örn: Soft AP 2, Soft 150 vb.)
      const matchedKatki = katkiProducts.find(kp => kp.name.toLowerCase() === recipe.temelUrun.toLowerCase());
      if (matchedKatki) {
        await client.execute({
          sql: `INSERT INTO product_trees (id, parent_product_id, child_product_id, quantity, unit, company_id) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [crypto.randomUUID(), mamul.id, matchedKatki.id, parseFloat(koliKatkiKg.toFixed(4)), 'kg', COMPANY_ID]
        });
        bomCount++;
      }
    }
  }

  console.log(`\n🎉 Ürün Ağaçları (BOM) Seed başarıyla tamamlandı!`);
  console.log(`   Oluşturulan BOM bağlantı sayısı: ${bomCount}`);

  await client.close();
}

main().catch(e => {
  console.error('❌ Hata:', e);
  process.exit(1);
});
