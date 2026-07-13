import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// ─── Şirket (tek kayıt: Mutlukal Depo) ────────────────────────────────────────
export const companies = sqliteTable("companies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().default("Mutlukal Depo"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Kullanıcılar (kendi auth) ─────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull().default(""),
  email: text("email"),
  // Roller: Müdür | Üretim Müdürü | Satın Alma | Yetkili | Personel
  role: text("role").notNull().default("Personel"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => ({
  usernameIdx: uniqueIndex("username_idx").on(table.username),
}));

// ─── Ürün Kategorileri ──────────────────────────────────────────────────────────
// Koli | Poşet | Sarf | Katkı | Ürün (mamul)
export const categories = sqliteTable("categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(), // "Koliler" | "Poşetler" | "Sarf Malzemeleri" | "Katkılar" | "Ürünler"
  slug: text("slug").notNull(), // "koli" | "poset" | "sarf" | "katki" | "urun"
  icon: text("icon").notNull().default("📦"),
  color: text("color").notNull().default("#6366f1"),
});

// ─── Ürünler ───────────────────────────────────────────────────────────────────
export const products = sqliteTable("products", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  categoryId: text("category_id").notNull(), // FK → categories.id
  name: text("name").notNull(),
  sku: text("sku"),
  currentStock: real("current_stock").notNull().default(0),
  unit: text("unit").notNull().default("Adet"),
  criticalThreshold: real("critical_threshold").notNull().default(10),
  unitPrice: real("unit_price").notNull().default(0),
  averageWastePercentage: real("average_waste_percentage").notNull().default(0),
  // Ürünlere özel alanlar (JSON)
  // Mamul ürünler için: { musteri, temelUrun, cesit, cap, paketIci, koliIci, gramaj }
  // Koli/Poşet için: { stokKodu, tedarikci }
  attributes: text("attributes"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Stok Hareketleri ──────────────────────────────────────────────────────────
export const stockMovements = sqliteTable("stock_movements", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id").notNull(),
  companyId: text("company_id").notNull(),
  type: text("type", { enum: ["in", "out", "adjustment"] }).notNull(),
  quantity: real("quantity").notNull(),
  userId: text("user_id"),
  description: text("description").notNull().default(""),
  source: text("source").notNull().default("manuel"), // "manuel" | "excel_sync" | "blind_count"
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Ürün Ağaçları (BOM) ──────────────────────────────────────────────────────
export const productTrees = sqliteTable("product_trees", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  parentProductId: text("parent_product_id").notNull(), // mamul ürün
  childProductId: text("child_product_id").notNull(), // koli/poşet/sarf/katkı
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull().default("Adet"),
  companyId: text("company_id").notNull(),
});

// ─── Kör Sayım ─────────────────────────────────────────────────────────────────
export const blindCounts = sqliteTable("blind_counts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  categoryId: text("category_id"), // hangi kategoride sayım yapıldı
  startedBy: text("started_by").notNull(), // user_id
  status: text("status", { enum: ["in_progress", "submitted", "approved", "rejected"] }).notNull().default("in_progress"),
  note: text("note").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  submittedAt: text("submitted_at"),
  approvedAt: text("approved_at"),
  approvedBy: text("approved_by"),
});

export const blindCountItems = sqliteTable("blind_count_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  blindCountId: text("blind_count_id").notNull(),
  productId: text("product_id").notNull(),
  countedQty: real("counted_qty").notNull(),
  previousQty: real("previous_qty").notNull().default(0),
  difference: real("difference").notNull().default(0), // counted - previous
});

// ─── Excel Sync Log ───────────────────────────────────────────────────────────
export const excelSyncLogs = sqliteTable("excel_sync_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  filePath: text("file_path").notNull(),
  syncedAt: text("synced_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  rowsProcessed: integer("rows_processed").notNull().default(0),
  status: text("status", { enum: ["success", "error"] }).notNull().default("success"),
  details: text("details"),
});

// ─── Müşteriler (Firma Kartları) ────────────────────────────────────────────────
export const customers = sqliteTable("customers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Siparişler (Pazarlama Girişi) ──────────────────────────────────────────────
export const orders = sqliteTable("orders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  customerId: text("customer_id").notNull(), // FK -> customers.id
  productId: text("product_id").notNull(),   // FK -> products.id
  quantity: real("quantity").notNull(),      // Koli Adedi
  status: text("status", { enum: ["pending", "approved", "planned", "running", "completed", "shipped"] })
    .notNull()
    .default("pending"),
  orderedAt: text("ordered_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  expectedDeliveryDate: text("expected_delivery_date"),
  factory: text("factory").notNull().default("mutlukal"),
});

// ─── Üretim Makineleri / Hatları ───────────────────────────────────────────────
export const machines = sqliteTable("machines", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  name: text("name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ─── Makine Kapasite Matrisi (Ürün Hızları) ──────────────────────────────────────
export const machineCapacities = sqliteTable("machine_capacities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  machineId: text("machine_id").notNull(), // FK -> machines.id
  productId: text("product_id").notNull(), // FK -> products.id
  koliPerHour: real("koli_per_hour").notNull().default(50),
});

// ─── Üretim Planı (Sequence Drag-Drop) ──────────────────────────────────────────
export const productionPlans = sqliteTable("production_plans", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  orderId: text("order_id").notNull(),     // FK -> orders.id
  machineId: text("machine_id").notNull(),   // FK -> machines.id
  sequence: integer("sequence").notNull(),
  scheduledDate: text("scheduled_date").notNull(), // YYYY-MM-DD
  estimatedHours: real("estimated_hours").notNull(),
  actualProducedQty: real("actual_produced_qty").notNull().default(0),
  status: text("status", { enum: ["scheduled", "running", "completed"] }).notNull().default("scheduled"),
});

// ─── Satın Alma Siparişleri & Temrin Tarihleri ─────────────────────────────────
export const purchaseOrders = sqliteTable("purchase_orders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  productId: text("product_id").notNull(), // FK -> products.id (raw material / packaging)
  quantity: real("quantity").notNull(),
  leadDate: text("lead_date"),             // Temrin Tarihi (YYYY-MM-DD)
  status: text("status", { enum: ["pending", "ordered", "received"] }).notNull().default("pending"),
});

// ─── Lojistik Takip Tablosu ─────────────────────────────────────────────────────
export const logisticBookings = sqliteTable("logistic_bookings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  orderId: text("order_id").notNull(),     // FK -> orders.id
  truckArrivalTime: text("truck_arrival_time"), // YYYY-MM-DD HH:MM
  driverInfo: text("driver_info"),
  status: text("status").notNull().default("scheduled"),
});

// ─── Vardiya Üretim Raporları ───────────────────────────────────────────────────
export const shiftReports = sqliteTable("shift_reports", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productionPlanId: text("production_plan_id").notNull(), // FK -> productionPlans.id
  shiftDate: text("shift_date").notNull(), // YYYY-MM-DD
  shiftType: text("shift_type", { enum: ["Vardiya 1", "Vardiya 2", "Vardiya 3"] }).notNull(),
  producedQty: real("produced_qty").notNull(),
  wasteQty: real("waste_qty").notNull(),
  actualHours: real("actual_hours").notNull(),
  notes: text("notes"),
});

// ─── Dinamik Mail Ayarları Tablosu ──────────────────────────────────────────────
export const mailConfigurations = sqliteTable("mail_configurations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  alertType: text("alert_type").notNull(), // "marketing_approval" | "stock_shortage" | "purchase_lead" | "logistic_arrival"
});

// ─── Type Helpers ──────────────────────────────────────────────────────────────
export type Company = typeof companies.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
export type ProductTree = typeof productTrees.$inferSelect;
export type BlindCount = typeof blindCounts.$inferSelect;
export type BlindCountItem = typeof blindCountItems.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Machine = typeof machines.$inferSelect;
export type MachineCapacity = typeof machineCapacities.$inferSelect;
export type ProductionPlan = typeof productionPlans.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type LogisticBooking = typeof logisticBookings.$inferSelect;
export type ShiftReport = typeof shiftReports.$inferSelect;
export type MailConfiguration = typeof mailConfigurations.$inferSelect;
