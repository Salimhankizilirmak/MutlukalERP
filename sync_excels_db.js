const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = `file:${path.join(__dirname, 'mutlukal.db')}`;

async function run() {
  console.log('🔄 Salimhan Stok Kodu ve İş Emirlerinden veritabanı tohumlanıyor...');
  const client = createClient({ url: DB_PATH });

  const companyId = 'mutlukal-depo-001';
  const publicDir = path.join(__dirname, 'public');

  const stockCodesPath = path.join(publicDir, 'Salimhan Stok kodu.xlsx');
  const mutlukalPath = path.join(publicDir, 'MUTLUKAL_IS_EMRI_01062026.xlsx');
  const ormanPath = path.join(publicDir, 'MUTLU_ORMAN_YENI_IS_EMRI_01062026.xlsx');

  const bcrypt = require('bcryptjs');

  // 1) Clear Database
  await client.execute("DELETE FROM products");
  await client.execute("DELETE FROM product_trees");
  await client.execute("DELETE FROM orders");
  await client.execute("DELETE FROM production_plans");
  await client.execute("DELETE FROM customers");
  await client.execute("DELETE FROM machine_capacities");
  await client.execute("DELETE FROM logistic_bookings");
  await client.execute("DELETE FROM shift_reports");
  await client.execute("DELETE FROM users");
  await client.execute("DELETE FROM companies");
  await client.execute("DELETE FROM categories");
  await client.execute("DELETE FROM machines");

  // 1.1) Seed Company
  await client.execute({
    sql: "INSERT OR IGNORE INTO companies (id, name) VALUES (?, ?)",
    args: [companyId, 'Mutlukal Depo']
  });

  // 1.2) Seed Users
  const passwordHash = await bcrypt.hash('mutlukal1453', 12);
  await client.execute({
    sql: "INSERT OR IGNORE INTO users (id, company_id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?, ?)",
    args: [crypto.randomUUID(), companyId, 'mutlukal', passwordHash, 'Mutlukal Müdür', 'Müdür']
  });

  // 1.3) Seed Categories
  const cats = [
    { id: 'cat-urun', name: 'Ürünler', slug: 'urun', icon: '🏭', color: '#8b5cf6' },
    { id: 'cat-koli', name: 'Koliler', slug: 'koli', icon: '📦', color: '#f59e0b' },
    { id: 'cat-poset', name: 'Poşetler', slug: 'poset', icon: '🛍️', color: '#3b82f6' },
    { id: 'cat-sarf', name: 'Sarf Malzemeleri', slug: 'sarf', icon: '🔧', color: '#10b981' },
    { id: 'cat-katki', name: 'Katkılar', slug: 'katki', icon: '🧪', color: '#ec4899' },
  ];
  for (const cat of cats) {
    await client.execute({
      sql: "INSERT OR IGNORE INTO categories (id, name, slug, icon, color) VALUES (?, ?, ?, ?, ?)",
      args: [cat.id, cat.name, cat.slug, cat.icon, cat.color]
    });
  }

  // 1.4) Seed Machines
  const initialMachines = [
    { name: 'Makine 1', id: 'machine-makine-1' },
    { name: 'Makine 2', id: 'machine-makine-2' },
    { name: 'Makine 4', id: 'machine-makine-4' },
    { name: 'Makine 5', id: 'machine-makine-5' },
    { name: 'Makine 6', id: 'machine-makine-6' },
    { name: 'Orman 1', id: 'machine-orman-1' },
    { name: 'Orman 2', id: 'machine-orman-2' },
    { name: 'Orman 3', id: 'machine-orman-3' },
  ];
  for (const m of initialMachines) {
    await client.execute({
      sql: "INSERT OR IGNORE INTO machines (id, company_id, name, is_active) VALUES (?, ?, ?, 1)",
      args: [m.id, companyId, m.name]
    });
  }
  console.log('✅ Temel yapılar (Şirket, Kullanıcılar, Kategoriler ve Makineler) yüklendi.');

  // 2) Parse Salimhan Stok kodu.xlsx
  console.log('📖 Salimhan Stok kodu.xlsx okunuyor...');
  const stockWb = XLSX.readFile(stockCodesPath);
  
  // A) Satışlar -> Mamul Ürünler
  const salesWs = stockWb.Sheets['Satışlar'];
  const salesData = XLSX.utils.sheet_to_json(salesWs, { header: 1, defval: '' });
  console.log(`🛒 Satışlar sayfasından ${salesData.length - 1} mamul yükleniyor...`);
  
  const insertedIds = new Set();

  for (let i = 1; i < salesData.length; i++) {
    const row = salesData[i];
    const code = row[0] ? row[0].toString().trim() : "";
    const desc = row[1] ? row[1].toString().trim() : "";
    if (!code || !desc || insertedIds.has(code)) continue;

    // Attributes parser for finished products
    const attributes = {
      musteri: desc.split(' ')[0] || "",
      temelUrun: desc.includes("Lavaş") ? "Lavaş" : desc.includes("Tortilla") ? "Tortilla" : "Diğer",
      cesit: desc.includes("Kepekli") ? "Kepekli" : desc.includes("Sade") ? "Sade" : "Klasik",
      cap: desc.match(/\d+\s*Cm/i) ? desc.match(/\d+\s*Cm/i)[0] : "25 Cm",
      paketIci: 10,
      koliIci: 100,
      gramaj: desc.match(/\d+\s*Gr/i) ? parseFloat(desc.match(/\d+\s*Gr/i)[0]) : 250
    };

    await client.execute({
      sql: `INSERT INTO products (id, company_id, category_id, name, sku, current_stock, unit, critical_threshold, unit_price, average_waste_percentage, attributes, is_active)
            VALUES (?, ?, 'cat-urun', ?, ?, 0.0, 'Koli', 50, 15.0, 5, ?, 1)`,
      args: [code, companyId, desc, code, JSON.stringify(attributes)]
    });
    insertedIds.add(code);
  }

  // B) Alışlar -> Hammadde ve Ambalaj Bileşenleri
  const buyWs = stockWb.Sheets['Alışlar'];
  const buyData = XLSX.utils.sheet_to_json(buyWs, { header: 1, defval: '' });
  console.log(`🌾 Alışlar sayfasından ${buyData.length - 1} malzeme yükleniyor...`);

  for (let i = 1; i < buyData.length; i++) {
    const row = buyData[i];
    const code = row[0] ? row[0].toString().trim() : "";
    const desc = row[1] ? row[1].toString().trim() : "";
    if (!code || !desc || insertedIds.has(code)) continue;

    // Determine category based on name keywords
    let catId = "cat-katki"; // Default to additive/ingredient
    let unit = "Kg";
    const descLower = desc.toLowerCase();

    if (descLower.includes("koli") || descLower.includes("kutu")) {
      catId = "cat-koli";
      unit = "Adet";
    } else if (descLower.includes("poşet") || descLower.includes("jelatin") || descLower.includes("opp") || descLower.includes("cpp") || descLower.includes("torba")) {
      catId = "cat-poset";
      unit = "Adet";
    } else if (descLower.includes("sarf") || descLower.includes("bant") || descLower.includes("şerit") || descLower.includes("stretch") || descLower.includes("etiket")) {
      catId = "cat-sarf";
      unit = "Adet";
    } else if (descLower.includes("un (") || descLower.includes("margarin") || descLower.includes("tuz") || descLower.includes("maya") || descLower.includes("gluten")) {
      catId = "cat-katki";
      unit = "Kg";
    }

    await client.execute({
      sql: `INSERT INTO products (id, company_id, category_id, name, sku, current_stock, unit, critical_threshold, unit_price, average_waste_percentage, attributes, is_active)
            VALUES (?, ?, ?, ?, ?, 1000.0, ?, 100, 1.25, 0, ?, 1)`,
      args: [code, companyId, catId, desc, code, unit, JSON.stringify({ stokKodu: code, tedarikci: "Varsayılan Tedarikçi" })]
    });
    insertedIds.add(code);
  }

  // 3) Create Seed Product Trees (BOM)
  // Let's create default recipe mappings for Triton and other products
  const dbProducts = (await client.execute("SELECT * FROM products")).rows;
  const finishedProds = dbProducts.filter(p => p.category_id === 'cat-urun');
  const componentProds = dbProducts.filter(p => p.category_id !== 'cat-urun');

  // Find some components
  const unComponent = componentProds.find(c => c.name.toLowerCase().includes("un (")) || { id: "150.01.025", unit: "Kg" };
  const saltComponent = componentProds.find(c => c.name.toLowerCase().includes("tuz")) || { id: "150.01.023", unit: "Kg" };
  const koliComponent = componentProds.find(c => c.category_id === "cat-koli") || { id: "150.01.296", unit: "Adet" };
  const posetComponent = componentProds.find(c => c.category_id === "cat-poset") || { id: "150.01.307", unit: "Adet" };

  console.log('🌲 Triton ve diğer mamuller için varsayılan ürün ağaçları tanımlanıyor...');
  // Loop through finished products and add standard BOM components (1 Koli için)
  for (const fp of finishedProds) {
    // Un
    await client.execute({
      sql: "INSERT INTO product_trees (id, parent_product_id, child_product_id, quantity, unit, company_id) VALUES (?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), fp.id, unComponent.id, 0.12, 'Kg', companyId]
    });
    // Tuz
    await client.execute({
      sql: "INSERT INTO product_trees (id, parent_product_id, child_product_id, quantity, unit, company_id) VALUES (?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), fp.id, saltComponent.id, 0.02, 'Kg', companyId]
    });
    // Koli
    await client.execute({
      sql: "INSERT INTO product_trees (id, parent_product_id, child_product_id, quantity, unit, company_id) VALUES (?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), fp.id, koliComponent.id, 1, 'Adet', companyId]
    });
    // Poşet
    await client.execute({
      sql: "INSERT INTO product_trees (id, parent_product_id, child_product_id, quantity, unit, company_id) VALUES (?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), fp.id, posetComponent.id, 10, 'Adet', companyId]
    });
  }

  // 4) Parse Work Orders Excel Files
  const dbCustomers = [];
  
  const parseAndSync = async (filePath, factory) => {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets['Sayfa3'];
    if (!ws) return;

    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let currentMachineId = "";
    const scheduledDate = new Date().toISOString().split('T')[0];
    const isOrman = filePath.toUpperCase().includes("ORMAN");

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const cell0 = row[0] ? row[0].toString().trim() : "";

      if (cell0.toUpperCase().includes('MAKİNE') || cell0.toUpperCase().includes('ORMAN')) {
        const numMatch = cell0.match(/\d+/);
        const num = numMatch ? numMatch[0] : "1";
        if (isOrman) {
          currentMachineId = `machine-orman-${num}`;
        } else {
          currentMachineId = `machine-makine-${num}`;
        }
        continue;
      }

      if (!currentMachineId || cell0 === 'SIRA' || !row[4] || row[4] === '') continue;

      const customerRaw = row[1] ? row[1].toString().trim() : "Bilinmeyen Müşteri";
      const productRaw = row[4].toString().trim();
      const quantity = parseFloat(row[10]) || 0;

      if (quantity <= 0) continue;

      // Match Customer
      let matchedCust = dbCustomers.find(c => c.name.toLowerCase() === customerRaw.toLowerCase());
      let customerId = "";
      if (matchedCust) {
        customerId = matchedCust.id;
      } else {
        customerId = `cust-${crypto.randomUUID().slice(0, 8)}`;
        await client.execute({
          sql: "INSERT INTO customers (id, name) VALUES (?, ?)",
          args: [customerId, customerRaw]
        });
        dbCustomers.push({ id: customerId, name: customerRaw });
      }

      // Fuzzy Match Product from Satışlar
      const clean = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
      const rClean = clean(productRaw);
      let matchedProd = finishedProds.find(p => clean(p.name).includes(rClean) || rClean.includes(clean(p.name)));
      
      let productId = "";
      if (matchedProd) {
        productId = matchedProd.id;
      } else {
        // If not found, look up by words
        const rWords = productRaw.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        let bestMatch = null;
        let maxScore = 0;
        for (const p of finishedProds) {
          const pNorm = p.name.toLowerCase();
          let score = 0;
          for (const w of rWords) {
            if (pNorm.includes(w)) score++;
          }
          if (score > maxScore) {
            maxScore = score;
            bestMatch = p;
          }
        }
        if (maxScore >= 2) {
          productId = bestMatch.id;
        } else {
          // Dynamic product creation as fallback
          productId = `prod-${crypto.randomUUID().slice(0, 8)}`;
          await client.execute({
            sql: `INSERT INTO products (id, company_id, category_id, name, unit, unit_price, average_waste_percentage, attributes, is_active)
                  VALUES (?, ?, 'cat-urun', ?, 'Koli', 15.0, 5, ?, 1)`,
            args: [productId, companyId, productRaw, JSON.stringify({
              musteri: customerRaw,
              temelUrun: productRaw,
              cesit: "",
              cap: "",
              paketIci: 10,
              koliIci: 100,
              gramaj: 250
            })]
          });
          finishedProds.push({ id: productId, name: productRaw });
        }
      }

      // Create Order & Plan with correct Factory
      const orderId = `ord-${crypto.randomUUID().slice(0, 8)}`;
      await client.execute({
        sql: "INSERT INTO orders (id, company_id, customer_id, product_id, quantity, status, expected_delivery_date, factory) VALUES (?, ?, ?, ?, ?, 'planned', ?, ?)",
        args: [orderId, companyId, customerId, productId, quantity, scheduledDate, factory]
      });

      // Get count for sequence
      const seqCheck = await client.execute({
        sql: "SELECT count(*) as count FROM production_plans WHERE machine_id = ? AND scheduled_date = ?",
        args: [currentMachineId, scheduledDate]
      });
      const seq = seqCheck.rows[0].count;

      await client.execute({
        sql: "INSERT INTO production_plans (id, company_id, order_id, machine_id, sequence, scheduled_date, estimated_hours, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')",
        args: [`plan-${crypto.randomUUID().slice(0, 8)}`, companyId, orderId, currentMachineId, seq, scheduledDate, quantity / 50]
      });
    }
  };

  await parseAndSync(mutlukalPath, 'mutlukal');
  console.log('✅ Mutlukal iş emirleri ve fabrika ayrımı yüklendi.');
  
  await parseAndSync(ormanPath, 'orman');
  console.log('✅ Mutlu Orman iş emirleri ve fabrika ayrımı yüklendi.');

  client.close();
  console.log('🎉 Excel to DB tohumlama işlemi başarıyla tamamlandı!');
}

run();
