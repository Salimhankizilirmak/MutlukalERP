const { createClient } = require('@libsql/client');
const path = require('path');

const DB_PATH = `file:${path.join(__dirname, 'mutlukal.db')}`;

async function purge() {
  console.log('🧹 Tüm ERP ve Stok verileri temizleniyor (Sıfır Slate)...');
  const client = createClient({ url: DB_PATH });

  try {
    // Sırayla tabloları boşaltalım (Foreign key kısıtlamalarını devre dışı bırakmaya gerek yok SQLite için)
    const tablesToPurge = [
      'orders',
      'production_plans',
      'purchase_orders',
      'logistic_bookings',
      'shift_reports',
      'products',
      'product_trees',
      'stock_movements',
      'blind_counts',
      'blind_count_items',
      'excel_sync_logs',
      'customers',
      'machine_capacities',
      'mail_configurations'
    ];

    for (const table of tablesToPurge) {
      await client.execute(`DELETE FROM ${table}`);
      console.log(`  - ${table} temizlendi.`);
    }

    console.log('✅ Veritabanı temizlendi! Admin/Müdür kullanıcısı ve Kategoriler korunuyor.');
  } catch (err) {
    console.error('❌ Temizleme sırasında hata:', err);
  } finally {
    client.close();
  }
}

purge();
