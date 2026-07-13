/**
 * Mutlukal Depo — Seed Script
 * Çalıştırma: node seed.js
 * Excel verilerini local SQLite veritabanına yükler.
 */

const XLSX = require('xlsx');
const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const { sql } = require('drizzle-orm');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = `file:${path.join(__dirname, 'mutlukal.db')}`;

async function main() {
  console.log('🌱 Mutlukal Depo Seed başlıyor...\n');

  const client = createClient({ url: DB_PATH });

  // Tabloları oluştur (schema.ts ile aynı yapı)
  await client.execute(`CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Mutlukal Depo',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    email TEXT,
    role TEXT NOT NULL DEFAULT 'Personel',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL DEFAULT '📦',
    color TEXT NOT NULL DEFAULT '#6366f1'
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    current_stock REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'Adet',
    critical_threshold REAL NOT NULL DEFAULT 10,
    attributes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    user_id TEXT,
    description TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manuel',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS product_trees (
    id TEXT PRIMARY KEY,
    parent_product_id TEXT NOT NULL,
    child_product_id TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'Adet',
    company_id TEXT NOT NULL
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS blind_counts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    category_id TEXT,
    started_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    submitted_at TEXT,
    approved_at TEXT,
    approved_by TEXT
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS blind_count_items (
    id TEXT PRIMARY KEY,
    blind_count_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    counted_qty REAL NOT NULL,
    previous_qty REAL NOT NULL DEFAULT 0,
    difference REAL NOT NULL DEFAULT 0
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS excel_sync_logs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    rows_processed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success',
    details TEXT
  )`);

  console.log('✅ Tablolar oluşturuldu.\n');

  // ── Şirket ────────────────────────────────────────────────────────────────
  const COMPANY_ID = 'mutlukal-depo-001';
  await client.execute({
    sql: `INSERT OR IGNORE INTO companies (id, name) VALUES (?, ?)`,
    args: [COMPANY_ID, 'Mutlukal Depo']
  });
  console.log('✅ Şirket oluşturuldu.');

  // ── Müdür Kullanıcısı ──────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('mutlukal1453', 12);
  const USER_ID = crypto.randomUUID();
  try {
    await client.execute({
      sql: `INSERT OR IGNORE INTO users (id, company_id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [USER_ID, COMPANY_ID, 'mutlukal', passwordHash, 'Mutlukal Müdür', 'Müdür']
    });
    console.log('✅ Müdür kullanıcısı oluşturuldu: mutlukal / mutlukal1453');
  } catch (e) {
    console.log('ℹ️  Müdür kullanıcısı zaten var.');
  }

  // ── Kategoriler ────────────────────────────────────────────────────────────
  const cats = [
    { id: 'cat-urun', name: 'Ürünler', slug: 'urun', icon: '🏭', color: '#8b5cf6' },
    { id: 'cat-koli', name: 'Koliler', slug: 'koli', icon: '📦', color: '#f59e0b' },
    { id: 'cat-poset', name: 'Poşetler', slug: 'poset', icon: '🛍️', color: '#3b82f6' },
    { id: 'cat-sarf', name: 'Sarf Malzemeleri', slug: 'sarf', icon: '🔧', color: '#10b981' },
    { id: 'cat-katki', name: 'Katkılar', slug: 'katki', icon: '🧪', color: '#ec4899' },
  ];
  for (const cat of cats) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO categories (id, name, slug, icon, color) VALUES (?, ?, ?, ?, ?)`,
      args: [cat.id, cat.name, cat.slug, cat.icon, cat.color]
    });
  }
  console.log('✅ Kategoriler oluşturuldu.\n');

  // ── Helper: Ürün Ekle ──────────────────────────────────────────────────────
  let productCount = 0;
  async function insertProduct(categoryId, name, sku, currentStock, unit, criticalThreshold, attributes) {
    const id = crypto.randomUUID();
    await client.execute({
      sql: `INSERT OR IGNORE INTO products (id, company_id, category_id, name, sku, current_stock, unit, critical_threshold, attributes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, COMPANY_ID, categoryId, name.trim(), sku || null, currentStock || 0, unit || 'Adet', criticalThreshold || 10, attributes ? JSON.stringify(attributes) : null]
    });
    productCount++;
    return id;
  }

  // ── MAMUL ÜRÜNLER (Stok sayfasından) ──────────────────────────────────────
  console.log('📋 Mamul ürünler yükleniyor...');
  const wb = XLSX.readFile('public/2026 2. \u00c7eyrek.xlsx');
  const wsStok = wb.Sheets['Stok'];
  const stokData = XLSX.utils.sheet_to_json(wsStok, {header:1, defval:''});
  for (const row of stokData.slice(3)) {
    if (!row[1] || row[1] === '') continue;
    const name = row[1].toString().trim();
    const musteri = row[2] ? row[2].toString().trim() : '';
    const temelUrun = row[3] ? row[3].toString().trim() : '';
    const cesit = row[4] ? row[4].toString().trim() : '';
    const cap = row[5] || '';
    const paketIci = row[6] || '';
    const koliIci = row[7] || '';
    const gramaj = row[8] || '';
    const stok = typeof row[9] === 'number' ? row[9] : 0;
    const birlesik = `${name} / ${musteri}`;
    await insertProduct('cat-urun', birlesik, null, stok, 'Koli',
      stok > 0 ? Math.ceil(stok * 0.1) : 5,
      { musteri, temelUrun, cesit, cap, paketIci, koliIci, gramaj }
    );
  }
  console.log(`  ✅ Mamul ürünler: ${productCount} adet\n`);

  // ── KOLİLER (Koli Depo Excel) ─────────────────────────────────────────────
  const prevCount = productCount;
  console.log('📦 Koliler yükleniyor...');
  const wbKoli = XLSX.readFile('public/Koli Depo Y\u00f6netim (20.10.2023).xlsx');
  const wsKoliBilgi = wbKoli.Sheets['Bilgiler'];
  const koliData = XLSX.utils.sheet_to_json(wsKoliBilgi, {header:1, defval:''});
  for (const row of koliData.slice(2)) {
    if (!row[2] || row[2] === '' || row[2] === 'Stok Adı') continue;
    const name = row[2].toString().trim();
    const sku = row[3] ? row[3].toString().trim() : null;
    const stok = typeof row[6] === 'number' ? row[6] : 0;
    await insertProduct('cat-koli', name, sku, stok, 'Adet', stok > 100 ? 100 : 50, { stokKodu: sku });
  }
  console.log(`  ✅ Koliler: ${productCount - prevCount} adet\n`);

  // ── POŞETLER ──────────────────────────────────────────────────────────────
  const prevCount2 = productCount;
  console.log('🛍️ Poşetler yükleniyor...');
  const wbPoset = XLSX.readFile('public/Po\u015fet Depo Y\u00f6netim (20.10.2023).xlsx');
  const wsPosetBilgi = wbPoset.Sheets['Bilgiler'];
  const posetData = XLSX.utils.sheet_to_json(wsPosetBilgi, {header:1, defval:''});
  for (const row of posetData.slice(2)) {
    if (!row[2] || row[2] === '' || row[2] === 'Stok Adı') continue;
    const name = row[2].toString().trim();
    const sku = row[3] ? row[3].toString().trim() : null;
    const stok = typeof row[6] === 'number' ? row[6] : 0;
    await insertProduct('cat-poset', name, sku, stok, 'Adet', stok > 1000 ? 1000 : 500, { stokKodu: sku });
  }
  console.log(`  ✅ Poşetler: ${productCount - prevCount2} adet\n`);

  // ── SARF MALZEME ──────────────────────────────────────────────────────────
  const prevCount3 = productCount;
  console.log('🔧 Sarf malzemeleri yükleniyor...');
  const wbSarf = XLSX.readFile('public/Sarf Malzeme Y\u00f6netim (20.10.2023).xlsx');
  const wsSarfBilgi = wbSarf.Sheets['Bilgiler'];
  const sarfData = XLSX.utils.sheet_to_json(wsSarfBilgi, {header:1, defval:''});
  for (const row of sarfData.slice(2)) {
    if (!row[2] || row[2] === '' || row[2] === 'Stok Adı') continue;
    const name = row[2].toString().trim();
    const stok = typeof row[6] === 'number' ? row[6] : 0;
    // Birim tespiti
    let unit = 'Adet';
    if (name.includes('Film') || name.includes('Tuz')) unit = 'kg';
    await insertProduct('cat-sarf', name, null, stok, unit, 100, null);
  }
  console.log(`  ✅ Sarf malzeme: ${productCount - prevCount3} adet\n`);

  // ── KATKI MADDELERİ ───────────────────────────────────────────────────────
  const prevCount4 = productCount;
  console.log('🧪 Katkı maddeleri yükleniyor...');
  const katkiTurleri = new Set();
  const wsKatki = wb.Sheets['Katkı'];
  const katkiData = XLSX.utils.sheet_to_json(wsKatki, {header:1, defval:''});
  for (const row of katkiData) {
    if (row[2] && row[2] !== '' && row[2] !== 'Ürün') {
      katkiTurleri.add(row[2].toString().trim());
    }
  }
  for (const katki of katkiTurleri) {
    await insertProduct('cat-katki', katki, null, 0, 'kg', 50, null);
  }
  console.log(`  ✅ Katkılar: ${productCount - prevCount4} adet\n`);

  await client.close();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎉 SEED TAMAMLANDI!`);
  console.log(`   Toplam ürün eklendi: ${productCount}`);
  console.log(`   DB: mutlukal.db`);
  console.log(`   Giriş: mutlukal / mutlukal1453`);
  console.log(`${'='.repeat(50)}\n`);
}

main().catch(e => {
  console.error('❌ Hata:', e);
  process.exit(1);
});
