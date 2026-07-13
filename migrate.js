const { createClient } = require('@libsql/client');
const path = require('path');

const DB_PATH = `file:${path.join(__dirname, 'mutlukal.db')}`;

async function migrate() {
  console.log('🚀 Mutlukal SQLite veritabanı migrasyonu başlıyor...');
  const client = createClient({ url: DB_PATH });

  try {
    // 1) products tablosuna yeni kolonlar ekleme
    const pragma = await client.execute("PRAGMA table_info(products)");
    const cols = pragma.rows.map(r => r.name);

    if (!cols.includes('unit_price')) {
      console.log('Adding column "unit_price" to table "products"...');
      await client.execute("ALTER TABLE products ADD COLUMN unit_price REAL NOT NULL DEFAULT 0");
    }
    if (!cols.includes('average_waste_percentage')) {
      console.log('Adding column "average_waste_percentage" to table "products"...');
      await client.execute("ALTER TABLE products ADD COLUMN average_waste_percentage REAL NOT NULL DEFAULT 0");
    }
    if (!cols.includes('external_id')) {
      console.log('Adding column "external_id" to table "products"...');
      await client.execute("ALTER TABLE products ADD COLUMN external_id TEXT");
    }

    // 2) Yeni tabloları oluşturma
    console.log('Creating new tables if not exist...');

    // Customers Table
    await client.execute(`CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    // Orders Table
    await client.execute(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      ordered_at TEXT NOT NULL DEFAULT (datetime('now')),
      expected_delivery_date TEXT
    )`);

    // Machines Table
    await client.execute(`CREATE TABLE IF NOT EXISTS machines (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    )`);

    // Machine capacities Table
    await client.execute(`CREATE TABLE IF NOT EXISTS machine_capacities (
      id TEXT PRIMARY KEY,
      machine_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      koli_per_hour REAL NOT NULL DEFAULT 50
    )`);

    // Production plans Table
    await client.execute(`CREATE TABLE IF NOT EXISTS production_plans (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      machine_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      scheduled_date TEXT NOT NULL,
      estimated_hours REAL NOT NULL,
      actual_produced_qty REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'scheduled'
    )`);

    // Purchase orders Table
    await client.execute(`CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      lead_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
    )`);

    // Logistic bookings Table
    await client.execute(`CREATE TABLE IF NOT EXISTS logistic_bookings (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      truck_arrival_time TEXT,
      driver_info TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled'
    )`);

    // Shift reports Table
    await client.execute(`CREATE TABLE IF NOT EXISTS shift_reports (
      id TEXT PRIMARY KEY,
      production_plan_id TEXT NOT NULL,
      shift_date TEXT NOT NULL,
      shift_type TEXT NOT NULL,
      produced_qty REAL NOT NULL,
      waste_qty REAL NOT NULL,
      actual_hours REAL NOT NULL,
      notes TEXT
    )`);

    // Mail configurations Table
    await client.execute(`CREATE TABLE IF NOT EXISTS mail_configurations (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      alert_type TEXT NOT NULL
    )`);

    // User Dashboard Layouts Table
    await client.execute(`CREATE TABLE IF NOT EXISTS user_dashboard_layouts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      layout_data TEXT NOT NULL,
      is_synced INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    // Seed some initial machines if empty
    const machinesCheck = await client.execute("SELECT count(*) as count FROM machines");
    if (machinesCheck.rows[0].count === 0) {
      console.log('Seeding initial machines...');
      const COMPANY_ID = 'mutlukal-depo-001';
      const initialMachines = ['Makine 1', 'Makine 2', 'Makine 4', 'Makine 5', 'Makine 6', 'Orman 1', 'Orman 2', 'Orman 3'];
      for (const mName of initialMachines) {
        const id = `machine-${mName.toLowerCase().replace(/\s+/g, '-')}`;
        await client.execute({
          sql: "INSERT INTO machines (id, company_id, name, is_active) VALUES (?, ?, ?, 1)",
          args: [id, COMPANY_ID, mName]
        });
      }
    }

    // Seed some initial customers if empty
    const customersCheck = await client.execute("SELECT count(*) as count FROM customers");
    if (customersCheck.rows[0].count === 0) {
      console.log('Seeding initial customers...');
      const initialCustomers = ['A101', 'BİM', 'Şok Market', 'Taste Land Bulgaristan', 'Avrupa', 'MOPAŞ', 'Migros'];
      for (const cName of initialCustomers) {
        const id = `cust-${cName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        await client.execute({
          sql: "INSERT INTO customers (id, name) VALUES (?, ?)",
          args: [id, cName]
        });
      }
    }

    // Seed some default prices for raw materials to prevent 0 cost
    console.log('Seeding default raw material unit prices...');
    await client.execute(`
      UPDATE products 
      SET unit_price = CASE 
        WHEN category_id = 'cat-koli' THEN 12.50
        WHEN category_id = 'cat-poset' THEN 0.45
        WHEN category_id = 'cat-katki' THEN 35.00
        WHEN category_id = 'cat-sarf' THEN 2.10
        ELSE 0
      END
      WHERE unit_price = 0
    `);

    console.log('✅ Migrasyon başarıyla tamamlandı!');
  } catch (err) {
    console.error('❌ Migrasyon sırasında hata:', err);
  } finally {
    client.close();
  }
}

migrate();
