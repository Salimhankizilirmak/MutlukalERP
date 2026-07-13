"use server";

import { db } from "@/db";
import {
  products,
  productTrees,
  customers,
  orders,
  machines,
  machineCapacities,
  productionPlans,
  purchaseOrders,
  logisticBookings,
  shiftReports,
  mailConfigurations,
  stockMovements,
  userDashboardLayouts,
  categories,
} from "@/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { CostCalculator } from "@/lib/services/CostCalculator";
import { NotificationService } from "@/lib/services/NotificationService";
import { ThroughputEstimator } from "@/lib/services/ThroughputEstimator";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

// ==========================================
// 1. PAZARLAMA (MARKETING) ACTIONS
// ==========================================

export async function getCustomers() {
  return db.select().from(customers).orderBy(asc(customers.name));
}

export async function createCustomer(name: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");
  
  const id = `cust-${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(customers).values({
    id,
    name: name.trim(),
  });
  return { success: true, id };
}

export async function getFinishedProducts() {
  const allProducts = await db
    .select()
    .from(products)
    .where(eq(products.categoryId, "cat-urun"));

  const calculator = CostCalculator.getInstance();
  const productsWithCosts = [];

  for (const prod of allProducts) {
    const costAnalysis = await calculator.calculateProductCost(prod.id);
    let attributesParsed = { musteri: "", temelUrun: "", cesit: "", cap: "", paketIci: "", koliIci: "", gramaj: "" };
    try {
      if (prod.attributes) {
        attributesParsed = JSON.parse(prod.attributes);
      }
    } catch (e) {}

    productsWithCosts.push({
      ...prod,
      attributes: attributesParsed,
      costAnalysis,
    });
  }

  return productsWithCosts;
}

export async function createFinishedProduct(data: {
  name: string;
  customerId: string;
  attributes: {
    temelUrun: string;
    cesit: string;
    cap: string;
    paketIci: number;
    koliIci: number;
    gramaj: number;
  };
  unQty: number; // kg per koli
  margarinQty: number; // kg per koli
  katkiId: string;
  katkiQty: number; // kg per koli
  koliId: string;
  posetId: string;
  wastePercentage: number;
  unitPrice: number; // Satış fiyatı/hedef fiyatı
}) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const companyId = "mutlukal-depo-001";
  const [cust] = await db.select().from(customers).where(eq(customers.id, data.customerId));
  const customerName = cust?.name ?? "";

  const productId = `prod-${crypto.randomUUID().slice(0, 8)}`;
  
  // 1) Insert Product Card
  await db.insert(products).values({
    id: productId,
    companyId,
    categoryId: "cat-urun",
    name: `${data.name} / ${customerName}`,
    unit: "Koli",
    unitPrice: data.unitPrice,
    averageWastePercentage: data.wastePercentage,
    attributes: JSON.stringify({
      musteri: customerName,
      temelUrun: data.attributes.temelUrun,
      cesit: data.attributes.cesit,
      cap: data.attributes.cap,
      paketIci: data.attributes.paketIci,
      koliIci: data.attributes.koliIci,
      gramaj: data.attributes.gramaj,
    }),
  });

  // 2) Create BOM entries
  const bomEntries = [];

  // Margarin
  if (data.margarinQty > 0) {
    const allProducts = await db.select().from(products);
    let margarin = allProducts.find(p => p.name.includes("Margarin") || p.name.includes("Yağ"));
    if (margarin) {
      bomEntries.push({
        id: crypto.randomUUID(),
        parentProductId: productId,
        childProductId: margarin.id,
        quantity: data.margarinQty,
        unit: "Kg",
        companyId,
      });
    }
  }

  // Un
  if (data.unQty > 0) {
    const allProducts = await db.select().from(products);
    let un = allProducts.find(p => p.name.includes("Un") || p.name.toLowerCase() === "un");
    if (un) {
      bomEntries.push({
        id: crypto.randomUUID(),
        parentProductId: productId,
        childProductId: un.id,
        quantity: data.unQty,
        unit: "Kg",
        companyId,
      });
    }
  }

  // Katkı
  if (data.katkiId && data.katkiQty > 0) {
    bomEntries.push({
      id: crypto.randomUUID(),
      parentProductId: productId,
      childProductId: data.katkiId,
      quantity: data.katkiQty,
      unit: "Kg",
      companyId,
    });
  }

  // Koli
  if (data.koliId) {
    bomEntries.push({
      id: crypto.randomUUID(),
      parentProductId: productId,
      childProductId: data.koliId,
      quantity: 1, // Genelde 1 koliye 1 koli girer
      unit: "Adet",
      companyId,
    });
  }

  // Poşet
  if (data.posetId) {
    // 1 Koliye kaç adet poşet girer? Koli içi / Paket içi veya attributes.paketIci gibi
    // Genellikle koli içi adedi kadar poşetlenmiş ürün veya koli içi / paket içi adedi kadar poşet girer.
    // Varsayılan olarak koliİci / paketIci yapıyoruz (örn: 1 koliye 10 poşet/paket girer).
    const posetCount = data.attributes.paketIci > 0 ? (data.attributes.koliIci / data.attributes.paketIci) : 1;
    bomEntries.push({
      id: crypto.randomUUID(),
      parentProductId: productId,
      childProductId: data.posetId,
      quantity: parseFloat(posetCount.toFixed(2)),
      unit: "Adet",
      companyId,
    });
  }

  if (bomEntries.length > 0) {
    await db.insert(productTrees).values(bomEntries);
  }

  return { success: true, productId };
}

export async function createOrder(data: {
  customerId: string;
  productId: string;
  quantity: number;
  expectedDeliveryDate: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const orderId = `ord-${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(orders).values({
    id: orderId,
    companyId: "mutlukal-depo-001",
    customerId: data.customerId,
    productId: data.productId,
    quantity: data.quantity,
    status: "pending",
    expectedDeliveryDate: data.expectedDeliveryDate,
  });

  return { success: true, orderId };
}

export async function approveOrder(orderId: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db
    .update(orders)
    .set({ status: "approved" })
    .where(eq(orders.id, orderId));

  // Sipariş detayı alıp mail gönderelim
  const [orderData] = await db
    .select({
      id: orders.id,
      quantity: orders.quantity,
      expectedDeliveryDate: orders.expectedDeliveryDate,
      customerName: customers.name,
      productName: products.name,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.id, orderId));

  if (orderData) {
    const notifier = NotificationService.getInstance();
    await notifier.notifyMarketingApproval({
      id: orderData.id,
      customerName: orderData.customerName,
      productName: orderData.productName,
      quantity: orderData.quantity,
      expectedDeliveryDate: orderData.expectedDeliveryDate ?? "",
    });
  }

  return { success: true };
}

export async function getMarketingDashboardData() {
  const allOrders = await db
    .select({
      id: orders.id,
      quantity: orders.quantity,
      status: orders.status,
      orderedAt: orders.orderedAt,
      expectedDeliveryDate: orders.expectedDeliveryDate,
      customerName: customers.name,
      productName: products.name,
      productId: products.id,
      customerId: orders.customerId,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(products, eq(orders.productId, products.id))
    .orderBy(asc(orders.orderedAt));

  const allCustomers = await getCustomers();
  const allProducts = await getFinishedProducts();

  const allRawProducts = await db
    .select()
    .from(products)
    .where(sql`${products.categoryId} != 'cat-urun'`)
    .orderBy(asc(products.name));

  return {
    orders: allOrders,
    customers: allCustomers,
    products: allProducts,
    rawMaterials: allRawProducts,
  };
}

// ==========================================
// 2. SATIN ALMA (PURCHASING) ACTIONS
// ==========================================

export async function getPurchasingDashboardData() {
  // Tüm hammadde ve ambalaj kategorilerini alalım (urun dışındakiler)
  const allProducts = await db
    .select()
    .from(products)
    .orderBy(asc(products.name));

  const materials = allProducts.filter(p => p.categoryId !== "cat-urun");
  
  const allPurchaseOrders = await db
    .select({
      id: purchaseOrders.id,
      quantity: purchaseOrders.quantity,
      leadDate: purchaseOrders.leadDate,
      status: purchaseOrders.status,
      materialName: products.name,
      productId: products.id,
    })
    .from(purchaseOrders)
    .innerJoin(products, eq(purchaseOrders.productId, products.id))
    .orderBy(asc(purchaseOrders.leadDate));

  const truckBookings = await db
    .select({
      id: logisticBookings.id,
      truckArrivalTime: logisticBookings.truckArrivalTime,
      driverInfo: logisticBookings.driverInfo,
      status: logisticBookings.status,
      customerName: customers.name,
      productName: products.name,
      quantity: orders.quantity,
    })
    .from(logisticBookings)
    .innerJoin(orders, eq(logisticBookings.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(products, eq(orders.productId, products.id))
    .orderBy(asc(logisticBookings.truckArrivalTime));

  return {
    materials,
    purchaseOrders: allPurchaseOrders,
    truckBookings,
  };
}

export async function updateProductUnitPrice(productId: string, price: number) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db
    .update(products)
    .set({ unitPrice: price })
    .where(eq(products.id, productId));

  return { success: true };
}

export async function createPurchaseOrder(productId: string, quantity: number, leadDate: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const poId = `po-${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(purchaseOrders).values({
    id: poId,
    companyId: "mutlukal-depo-001",
    productId,
    quantity,
    leadDate,
    status: "pending",
  });

  // Tedarik bildirim maili tetikle
  const [prod] = await db.select().from(products).where(eq(products.id, productId));
  if (prod) {
    const notifier = NotificationService.getInstance();
    await notifier.notifyPurchaseLead({
      materialName: prod.name,
      quantity,
      leadDate,
    });
  }

  return { success: true };
}

// ==========================================
// 3. LOJİSTİK (LOGISTICS) ACTIONS
// ==========================================

export async function getLogisticsDashboardData() {
  const allBookings = await db
    .select({
      id: logisticBookings.id,
      truckArrivalTime: logisticBookings.truckArrivalTime,
      driverInfo: logisticBookings.driverInfo,
      status: logisticBookings.status,
      orderId: orders.id,
      orderQty: orders.quantity,
      customerName: customers.name,
      productName: products.name,
    })
    .from(logisticBookings)
    .innerJoin(orders, eq(logisticBookings.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(products, eq(orders.productId, products.id))
    .orderBy(asc(logisticBookings.truckArrivalTime));

  const planlanabilirSiparisler = await db
    .select({
      id: orders.id,
      quantity: orders.quantity,
      customerName: customers.name,
      productName: products.name,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(products, eq(orders.productId, products.id))
    .where(sql`${orders.status} IN ('approved', 'planned', 'running')`);

  const plannedJobs = await db
    .select({
      id: productionPlans.id,
      machineName: machines.name,
      sequence: productionPlans.sequence,
      scheduledDate: productionPlans.scheduledDate,
      estimatedHours: productionPlans.estimatedHours,
      status: productionPlans.status,
      orderQty: orders.quantity,
      customerName: customers.name,
      productName: products.name,
      truckArrivalTime: logisticBookings.truckArrivalTime,
      driverInfo: logisticBookings.driverInfo,
    })
    .from(productionPlans)
    .innerJoin(orders, eq(productionPlans.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(products, eq(orders.productId, products.id))
    .innerJoin(machines, eq(productionPlans.machineId, machines.id))
    .leftJoin(logisticBookings, eq(logisticBookings.orderId, orders.id))
    .orderBy(asc(machines.name), asc(productionPlans.sequence));

  return {
    bookings: allBookings,
    eligibleOrders: planlanabilirSiparisler,
    plannedJobs,
  };
}

export async function saveLogisticBooking(orderId: string, truckArrivalTime: string, driverInfo: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const companyId = "mutlukal-depo-001";
  
  // Check if booking already exists for this order
  const [existing] = await db
    .select()
    .from(logisticBookings)
    .where(eq(logisticBookings.orderId, orderId));

  if (existing) {
    await db
      .update(logisticBookings)
      .set({
        truckArrivalTime,
        driverInfo,
        status: "scheduled",
      })
      .where(eq(logisticBookings.id, existing.id));
  } else {
    await db.insert(logisticBookings).values({
      id: `log-${crypto.randomUUID().slice(0, 8)}`,
      companyId,
      orderId,
      truckArrivalTime,
      driverInfo,
      status: "scheduled",
    });
  }

  // Lojistik mailini gönderelim
  const [orderData] = await db
    .select({
      customerName: customers.name,
      productName: products.name,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.id, orderId));

  if (orderData) {
    const notifier = NotificationService.getInstance();
    await notifier.notifyLogisticArrival({
      customerName: orderData.customerName,
      productName: orderData.productName,
      truckArrivalTime,
      driverInfo,
    });
  }

  return { success: true };
}

// ==========================================
// 4. ÜRETİM (PRODUCTION) ACTIONS
// ==========================================

export async function getProductionDashboardData() {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const allMachines = await db.select().from(machines).where(eq(machines.isActive, true));

  // Bekleyen (planlanmamış) ama onaylanmış siparişler
  const pendingOrders = await db
    .select({
      id: orders.id,
      quantity: orders.quantity,
      customerName: customers.name,
      productName: products.name,
      productId: products.id,
      expectedDeliveryDate: orders.expectedDeliveryDate,
      factory: orders.factory,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.status, "approved"))
    .orderBy(asc(orders.orderedAt));

  // Planlanmış iş emirleri
  const plannedJobs = await db
    .select({
      id: productionPlans.id,
      machineId: productionPlans.machineId,
      sequence: productionPlans.sequence,
      scheduledDate: productionPlans.scheduledDate,
      estimatedHours: productionPlans.estimatedHours,
      actualProducedQty: productionPlans.actualProducedQty,
      status: productionPlans.status,
      orderId: orders.id,
      orderQty: orders.quantity,
      customerName: customers.name,
      productName: products.name,
      productId: products.id,
      expectedDeliveryDate: orders.expectedDeliveryDate,
      truckArrivalTime: logisticBookings.truckArrivalTime,
      factory: orders.factory,
    })
    .from(productionPlans)
    .innerJoin(orders, eq(productionPlans.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(products, eq(orders.productId, products.id))
    .leftJoin(logisticBookings, eq(logisticBookings.orderId, orders.id))
    .orderBy(asc(productionPlans.sequence));

  // Temrin Tarihleri (Satın alma siparişleri)
  const activePOs = await db
    .select({
      materialName: products.name,
      quantity: purchaseOrders.quantity,
      leadDate: purchaseOrders.leadDate,
      status: purchaseOrders.status,
    })
    .from(purchaseOrders)
    .innerJoin(products, eq(purchaseOrders.productId, products.id))
    .where(eq(purchaseOrders.status, "pending"));

  // Kapasite matrisi
  const capacities = await db.select().from(machineCapacities);

  // Depo & Stok Entegrasyonu için tüm ürünleri, kategorileri ve reçeteleri çekelim
  const allProducts = await db.select().from(products).orderBy(asc(products.name));
  const allProductTrees = await db.select().from(productTrees);

  return {
    machines: allMachines,
    pendingOrders,
    plannedJobs,
    activePOs,
    capacities,
    allProducts,
    allProductTrees,
  };
}

export async function updateProductionPlanSequence(
  planSequence: Record<string, Array<{ orderId: string; scheduledDate: string }>>
) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const companyId = "mutlukal-depo-001";
  const estimator = ThroughputEstimator.getInstance();

  // Transaksiyon yerine pratik olarak sırayla silelim/yazalım (SQLite için güvenlidir)
  // Sadece tamamlanmamış planları güncelliyoruz
  const activePlans = await db
    .select()
    .from(productionPlans)
    .where(sql`${productionPlans.status} != 'completed'`);
  
  const completedOrderIds = (await db
    .select({ orderId: productionPlans.orderId })
    .from(productionPlans)
    .where(eq(productionPlans.status, "completed")))
    .map(p => p.orderId);

  // Aktif planları sıfırlayalım
  if (activePlans.length > 0) {
    const activeIds = activePlans.map(p => p.id);
    for (const pid of activeIds) {
      await db.delete(productionPlans).where(eq(productionPlans.id, pid));
    }
  }

  // Siparişlerin durumunu 'approved' yapalım (tamamlanmamış olanları)
  await db
    .update(orders)
    .set({ status: "approved" })
    .where(
      sql`${orders.id} NOT IN (${completedOrderIds.length > 0 ? completedOrderIds.map(id => `'${id}'`).join(",") : "''"}) 
      AND ${orders.status} IN ('planned', 'running')`
    );

  const shortagesDetected: Array<{
    productName: string;
    missingMaterial: string;
    needed: number;
    current: number;
    unit: string;
  }> = [];

  // Tüm hammadde/stok kartlarını alalım ki stok kontrolünü bellek üstünde hızlı yapalım
  const allProducts = await db.select().from(products);
  const productMap = new Map(allProducts.map(p => [p.id, p]));
  const productTreeList = await db.select().from(productTrees);

  // Yeni planları sırasıyla yazalım
  for (const [machineId, list] of Object.entries(planSequence)) {
    let index = 0;
    for (const item of list) {
      // Sipariş detayını alalım
      const [ord] = await db.select().from(orders).where(eq(orders.id, item.orderId));
      if (!ord) continue;

      // Süre hesabı yapalım
      const estimatedHours = await estimator.estimateDuration(machineId, ord.productId, ord.quantity);

      const planId = `plan-${crypto.randomUUID().slice(0, 8)}`;
      await db.insert(productionPlans).values({
        id: planId,
        companyId,
        orderId: ord.id,
        machineId,
        sequence: index++,
        scheduledDate: item.scheduledDate,
        estimatedHours,
        status: "scheduled",
      });

      // Siparişi 'planned' yapalım
      await db.update(orders).set({ status: "planned" }).where(eq(orders.id, ord.id));

      // ─── STOK EKSİKLİĞİ VE KRİTİK DENETİM ───
      const bom = productTreeList.filter(t => t.parentProductId === ord.productId);
      const parentProd = productMap.get(ord.productId);

      for (const ingredient of bom) {
        const child = productMap.get(ingredient.childProductId);
        if (!child) continue;

        // Fire eklenmiş net miktar hesabı
        const wastePct = parentProd?.averageWastePercentage ?? 0;
        const baseNeeded = ingredient.quantity * ord.quantity;
        const needed = baseNeeded * (1 + wastePct / 100);

        if (child.currentStock < needed) {
          shortagesDetected.push({
            productName: parentProd?.name ?? "Bilinmeyen Mamul",
            missingMaterial: child.name,
            needed: parseFloat(needed.toFixed(2)),
            current: parseFloat(child.currentStock.toFixed(2)),
            unit: child.unit,
          });
        }
      }
    }
  }

  // Eğer stok eksikliği varsa mailleri tetikleyelim
  if (shortagesDetected.length > 0) {
    const notifier = NotificationService.getInstance();
    await notifier.notifyStockShortage(shortagesDetected);
  }

  return { success: true };
}

export async function createShiftReport(data: {
  productionPlanId: string;
  shiftDate: string;
  shiftType: "Vardiya 1" | "Vardiya 2" | "Vardiya 3";
  producedQty: number; // koli
  wasteQty: number; // fire paket/koli
  actualHours: number;
  notes?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const companyId = "mutlukal-depo-001";
  
  // 1) Raporu insert edelim
  const reportId = `rep-${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(shiftReports).values({
    id: reportId,
    productionPlanId: data.productionPlanId,
    shiftDate: data.shiftDate,
    shiftType: data.shiftType,
    producedQty: data.producedQty,
    wasteQty: data.wasteQty,
    actualHours: data.actualHours,
    notes: data.notes,
  });

  // 2) Planı alalım
  const [plan] = await db
    .select()
    .from(productionPlans)
    .where(eq(productionPlans.id, data.productionPlanId));

  if (plan) {
    const newProduced = plan.actualProducedQty + data.producedQty;
    
    // Siparişi alalım
    const [ord] = await db.select().from(orders).where(eq(orders.id, plan.orderId));
    
    // Üretim durumunu güncelle
    let planStatus: "scheduled" | "running" | "completed" = "running";
    if (ord && newProduced >= ord.quantity) {
      planStatus = "completed";
      await db.update(orders).set({ status: "completed" }).where(eq(orders.id, ord.id));
    }

    await db
      .update(productionPlans)
      .set({
        actualProducedQty: newProduced,
        status: planStatus,
      })
      .where(eq(productionPlans.id, plan.id));

    // 3) STOK DÜŞÜMÜ (BOM bazında)
    if (ord) {
      const [prod] = await db.select().from(products).where(eq(products.id, ord.productId));
      const bom = await db
        .select()
        .from(productTrees)
        .where(eq(productTrees.parentProductId, ord.productId));

      for (const item of bom) {
        // Toplam üretilen koli + fire oranına göre düşüm
        const qtyToDeduct = item.quantity * (data.producedQty + data.wasteQty);

        // Stok hareketi yaz
        await db.insert(stockMovements).values({
          id: crypto.randomUUID(),
          companyId,
          productId: item.childProductId,
          type: "out",
          quantity: qtyToDeduct,
          userId: session.userId,
          description: `${prod?.name ?? "Mamul"} üretimi için sarf edildi. (Rapor: ${data.shiftType})`,
          source: "excel_sync",
        });

        // Ürünün mevcut stoğunu düşelim
        await db
          .update(products)
          .set({
            currentStock: sql`max(0, current_stock - ${qtyToDeduct})`
          })
          .where(eq(products.id, item.childProductId));
      }
    }
  }

  return { success: true };
}

export async function saveMachineCapacity(machineId: string, productId: string, koliPerHour: number) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const [existing] = await db
    .select()
    .from(machineCapacities)
    .where(
      and(
        eq(machineCapacities.machineId, machineId),
        eq(machineCapacities.productId, productId)
      )
    );

  if (existing) {
    await db
      .update(machineCapacities)
      .set({ koliPerHour })
      .where(eq(machineCapacities.id, existing.id));
  } else {
    await db.insert(machineCapacities).values({
      id: `cap-${crypto.randomUUID().slice(0, 8)}`,
      machineId,
      productId,
      koliPerHour,
    });
  }

  return { success: true };
}

export async function getMachines() {
  return db.select().from(machines).orderBy(asc(machines.name));
}

// ==========================================
// 5. MAİL YAPILANDIRMASI (ALERT CONFIGS) ACTIONS
// ==========================================

export async function getMailConfigurations() {
  return db.select().from(mailConfigurations).orderBy(asc(mailConfigurations.email));
}

export async function saveMailConfiguration(email: string, fullName: string, alertType: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const companyId = "mutlukal-depo-001";
  const id = `mail-${crypto.randomUUID().slice(0, 8)}`;
  
  await db.insert(mailConfigurations).values({
    id,
    companyId,
    email: email.trim().toLowerCase(),
    fullName: fullName.trim(),
    alertType,
  });

  return { success: true };
}

export async function deleteMailConfiguration(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db.delete(mailConfigurations).where(eq(mailConfigurations.id, id));
  return { success: true };
}

export async function exportWorkOrdersExcel() {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  // Get all planned jobs
  const plannedJobs = await db
    .select({
      id: productionPlans.id,
      machineId: productionPlans.machineId,
      sequence: productionPlans.sequence,
      scheduledDate: productionPlans.scheduledDate,
      orderQty: orders.quantity,
      customerName: customers.name,
      productName: products.name,
      productAttributes: products.attributes,
      machineName: machines.name,
    })
    .from(productionPlans)
    .innerJoin(orders, eq(productionPlans.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(products, eq(orders.productId, products.id))
    .innerJoin(machines, eq(productionPlans.machineId, machines.id))
    .orderBy(asc(machines.name), asc(productionPlans.sequence));

  // Group by machine name
  const grouped: Record<string, typeof plannedJobs> = {};
  for (const job of plannedJobs) {
    if (!grouped[job.machineName]) {
      grouped[job.machineName] = [];
    }
    grouped[job.machineName].push(job);
  }

  // Construct AOA (Array of Arrays)
  const aoa: any[][] = [];

  // Title Row
  aoa.push(["MUTLUKAL GIDA SAN. VE TİC. A.Ş. ÜRETİM İŞ EMİRLERİ PLANI", "", "", "", "", "", "", "", "", "", ""]);
  aoa.push([]); // Empty spacing

  for (const [mName, jobs] of Object.entries(grouped)) {
    // Machine header row
    aoa.push([mName.toUpperCase(), "", "", "", "", "", "", "", "", "", ""]);
    
    // Column headers
    aoa.push([
      "SIRA",
      "FİRMA",
      "",
      "",
      "ÜRÜN ADI",
      "",
      "",
      "",
      "",
      "CİNSİ",
      "ÜRETİLECEK KOLİ",
    ]);

    jobs.forEach((job, index) => {
      let cinsi = "";
      try {
        if (job.productAttributes) {
          const attrs = JSON.parse(job.productAttributes);
          cinsi = attrs.cesit || "";
        }
      } catch (e) {}

      aoa.push([
        index + 1,
        job.customerName,
        "",
        "",
        job.productName,
        "",
        "",
        "",
        "",
        cinsi,
        job.orderQty,
      ]);
    });

    aoa.push([]); // Empty row after each machine group
    aoa.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sayfa3");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const base64 = buf.toString("base64");

  return {
    success: true,
    fileName: `MUTLUKAL_IS_EMRI_${new Date().toISOString().split("T")[0].replace(/-/g, "")}.xlsx`,
    base64,
  };
}

export async function syncWorkOrdersFromExcel() {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const companyId = "mutlukal-depo-001";
  const publicDir = path.join(process.cwd(), "public");

  let mutlukalPath = "";
  let ormanPath = "";

  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    for (const file of files) {
      const fileUpper = file.toUpperCase();
      if (fileUpper.endsWith(".XLSX")) {
        if (fileUpper.includes("MUTLUKAL") && !fileUpper.includes("ORMAN")) {
          mutlukalPath = path.join(publicDir, file);
        } else if (fileUpper.includes("MUTLU") && fileUpper.includes("ORMAN")) {
          ormanPath = path.join(publicDir, file);
        }
      }
    }
  }

  if (!mutlukalPath || !ormanPath) {
    throw new Error("Lojistik iş emri Excel dosyaları public klasöründe bulunamadı.");
  }

  // Helper to parse sheets and insert into db
  const parseAndSync = async (filePath: string) => {
    const fileBuffer = fs.readFileSync(filePath);
    const wb = XLSX.read(fileBuffer, { type: "buffer" });
    const ws = wb.Sheets["Sayfa3"];
    if (!ws) return;

    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[];
    
    // Fetch current state of DB
    const dbCustomers = await db.select().from(customers);
    const dbProducts = await db.select().from(products).where(eq(products.categoryId, "cat-urun"));
    const dbMachines = await db.select().from(machines);

    let currentMachineId = "";
    const scheduledDate = new Date().toISOString().split("T")[0];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const cell0 = row[0] ? row[0].toString().trim() : "";

      if (cell0.toUpperCase().includes("MAKİNE") || cell0.toUpperCase().includes("ORMAN")) {
        const isOrman = filePath.toUpperCase().includes("ORMAN");
        const numMatch = cell0.match(/\d+/);
        const num = numMatch ? numMatch[0] : "1";
        
        if (isOrman) {
          currentMachineId = `machine-orman-${num}`;
        } else {
          currentMachineId = `machine-makine-${num}`;
        }
        continue;
      }

      // Skip invalid header rows
      if (!currentMachineId || cell0 === "SIRA" || !row[4] || row[4] === "") continue;

      const customerRaw = row[1] ? row[1].toString().trim() : "Bilinmeyen Müşteri";
      const productRaw = row[4].toString().trim();
      const cinsi = row[9] ? row[9].toString().trim() : "";
      const quantity = parseFloat(row[10]) || 0;

      if (quantity <= 0) continue;

      // 1) Find/Insert Customer
      let matchedCust = dbCustomers.find(c => c.name.toLowerCase() === customerRaw.toLowerCase());
      let customerId = "";
      if (matchedCust) {
        customerId = matchedCust.id;
      } else {
        customerId = `cust-${crypto.randomUUID().slice(0, 8)}`;
        await db.insert(customers).values({
          id: customerId,
          name: customerRaw,
        });
        dbCustomers.push({ id: customerId, name: customerRaw, createdAt: "" });
      }

      // 2) Find/Insert Product
      let matchedProd = dbProducts.find(p => p.name.toLowerCase().includes(productRaw.toLowerCase()) || productRaw.toLowerCase().includes(p.name.toLowerCase()));
      let productId = "";
      if (matchedProd) {
        productId = matchedProd.id;
      } else {
        productId = `prod-${crypto.randomUUID().slice(0, 8)}`;
        await db.insert(products).values({
          id: productId,
          companyId,
          categoryId: "cat-urun",
          name: `${productRaw} / ${customerRaw}`,
          unit: "Koli",
          unitPrice: 15.0,
          averageWastePercentage: 5,
          attributes: JSON.stringify({
            musteri: customerRaw,
            temelUrun: productRaw,
            cesit: cinsi,
            cap: "",
            paketIci: 10,
            koliIci: 100,
            gramaj: 25,
          }),
        });
        dbProducts.push({
          id: productId,
          companyId,
          categoryId: "cat-urun",
          name: `${productRaw} / ${customerRaw}`,
          sku: null,
          currentStock: 0,
          unit: "Koli",
          criticalThreshold: 10,
          unitPrice: 15.0,
          averageWastePercentage: 5,
          attributes: "",
          isActive: true,
          externalId: null,
          createdAt: "",
        });
      }

      // 3) Create Order & Production Plan
      const orderId = `ord-${crypto.randomUUID().slice(0, 8)}`;
      await db.insert(orders).values({
        id: orderId,
        companyId,
        customerId,
        productId,
        quantity,
        status: "planned",
        expectedDeliveryDate: scheduledDate,
      });

      // Fetch sequence order
      const currentPlans = await db
        .select()
        .from(productionPlans)
        .where(and(eq(productionPlans.machineId, currentMachineId), eq(productionPlans.scheduledDate, scheduledDate)));
      
      const seq = currentPlans.length;
      await db.insert(productionPlans).values({
        id: `plan-${crypto.randomUUID().slice(0, 8)}`,
        companyId,
        orderId,
        machineId: currentMachineId,
        sequence: seq,
        scheduledDate,
        estimatedHours: quantity / 50,
        status: "scheduled",
      });
    }
  };

  // Clear existing orders and plans first to ensure a clean sync!
  await db.delete(orders);
  await db.delete(productionPlans);

  await parseAndSync(mutlukalPath);
  await parseAndSync(ormanPath);

  return { success: true };
}

export async function createStockProduct(data: {
  categoryId: string;
  name: string;
  sku?: string;
  currentStock: number;
  unit: string;
  criticalThreshold: number;
  unitPrice: number;
}) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const id = `prod-${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(products).values({
    id,
    companyId: "mutlukal-depo-001",
    categoryId: data.categoryId,
    name: data.name.trim(),
    sku: data.sku?.trim() || null,
    currentStock: data.currentStock,
    unit: data.unit,
    criticalThreshold: data.criticalThreshold,
    unitPrice: data.unitPrice,
    averageWastePercentage: 0,
  });

  return { success: true, id };
}

export async function updateProductStock(productId: string, quantity: number, type: "in" | "out" | "adjustment", description: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const companyId = "mutlukal-depo-001";
  
  // 1) Write stock movement log
  await db.insert(stockMovements).values({
    id: crypto.randomUUID(),
    companyId,
    productId,
    type,
    quantity,
    userId: session.userId,
    description,
    source: "manuel",
  });

  // 2) Update current stock in product card
  if (type === "in") {
    await db.update(products).set({
      currentStock: sql`current_stock + ${quantity}`
    }).where(eq(products.id, productId));
  } else if (type === "out") {
    await db.update(products).set({
      currentStock: sql`max(0, current_stock - ${quantity})`
    }).where(eq(products.id, productId));
  } else {
    // Adjustment
    await db.update(products).set({
      currentStock: quantity
    }).where(eq(products.id, productId));
  }

  return { success: true };
}

export async function saveBomConnection(parentProductId: string, childProductId: string, quantity: number, unit: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const companyId = "mutlukal-depo-001";
  
  // Check if exists
  const [existing] = await db
    .select()
    .from(productTrees)
    .where(
      and(
        eq(productTrees.parentProductId, parentProductId),
        eq(productTrees.childProductId, childProductId)
      )
    );

  if (existing) {
    await db
      .update(productTrees)
      .set({ quantity, unit })
      .where(eq(productTrees.id, existing.id));
  } else {
    await db.insert(productTrees).values({
      id: crypto.randomUUID(),
      parentProductId,
      childProductId,
      quantity,
      unit,
      companyId,
    });
  }

  return { success: true };
}

export async function deleteBomConnection(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db.delete(productTrees).where(eq(productTrees.id, id));
  return { success: true };
}

// ==========================================
// CRUD ACTIONS FOR CUSTOMER, PRODUCTS, ORDERS, POs, AND LOGISTICS BOOKINGS
// ==========================================

export async function updateCustomer(id: string, name: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db
    .update(customers)
    .set({ name: name.trim() })
    .where(eq(customers.id, id));

  return { success: true };
}

export async function deleteCustomer(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db.delete(customers).where(eq(customers.id, id));
  return { success: true };
}

export async function updateFinishedProduct(id: string, data: any) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const companyId = "mutlukal-depo-001";

  // Update attributes JSON
  const attributesObj = {
    musteri: data.musteri || "",
    temelUrun: data.temelUrun || "",
    cesit: data.cesit || "",
    cap: data.cap || "",
    paketIci: data.paketIci || 10,
    koliIci: data.koliIci || 100,
    gramaj: data.gramaj || 25,
  };

  await db
    .update(products)
    .set({
      name: data.name.trim(),
      unitPrice: Number(data.unitPrice) || 0,
      averageWastePercentage: Number(data.averageWastePercentage) || 0,
      attributes: JSON.stringify(attributesObj),
      criticalThreshold: Number(data.criticalThreshold) || 10,
      currentStock: Number(data.currentStock) || 0,
      unit: data.unit || "Adet",
    })
    .where(eq(products.id, id));

  // If BOM component details are provided, recreate BOM Connections
  if (data.recreateBom && Array.isArray(data.bomDetails)) {
    // Delete old
    await db.delete(productTrees).where(eq(productTrees.parentProductId, id));
    // Insert new
    for (const item of data.bomDetails) {
      if (item.childProductId && item.quantity > 0) {
        await db.insert(productTrees).values({
          id: crypto.randomUUID(),
          parentProductId: id,
          childProductId: item.childProductId,
          quantity: Number(item.quantity) || 0,
          unit: item.unit || "Adet",
          companyId,
        });
      }
    }
  }

  return { success: true };
}

export async function deleteProduct(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db.delete(products).where(eq(products.id, id));
  await db.delete(productTrees).where(eq(productTrees.parentProductId, id));
  return { success: true };
}

export async function updateOrder(id: string, data: any) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db
    .update(orders)
    .set({
      customerId: data.customerId,
      productId: data.productId,
      quantity: Number(data.quantity) || 100,
      expectedDeliveryDate: data.expectedDeliveryDate || null,
      status: data.status || "approved",
    })
    .where(eq(orders.id, id));

  return { success: true };
}

export async function deleteOrder(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db.delete(orders).where(eq(orders.id, id));
  await db.delete(productionPlans).where(eq(productionPlans.orderId, id));
  await db.delete(logisticBookings).where(eq(logisticBookings.orderId, id));
  return { success: true };
}

export async function updatePurchaseOrder(id: string, data: any) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db
    .update(purchaseOrders)
    .set({
      quantity: Number(data.quantity) || 1000,
      leadDate: data.leadDate || null,
      status: data.status || "pending",
    })
    .where(eq(purchaseOrders.id, id));

  return { success: true };
}

export async function deletePurchaseOrder(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  return { success: true };
}

export async function updateLogisticBooking(id: string, data: any) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db
    .update(logisticBookings)
    .set({
      truckArrivalTime: data.truckArrivalTime || null,
      driverInfo: data.driverInfo || "",
      status: data.status || "scheduled",
    })
    .where(eq(logisticBookings.id, id));

  return { success: true };
}

export async function deleteLogisticBooking(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db.delete(logisticBookings).where(eq(logisticBookings.id, id));
  return { success: true };
}

export async function deleteMachineCapacity(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  await db.delete(machineCapacities).where(eq(machineCapacities.id, id));
  return { success: true };
}

export async function saveDashboardLayoutAction(layoutData: string, clientVersion: number) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");
  const userId = session.userId;

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(userDashboardLayouts)
      .where(eq(userDashboardLayouts.userId, userId))
      .limit(1);

    if (existing) {
      if (existing.version > clientVersion) {
        return {
          success: false,
          conflict: true,
          layoutData: existing.layoutData,
          version: existing.version,
        };
      }

      const nextVersion = existing.version + 1;
      await tx
        .update(userDashboardLayouts)
        .set({
          layoutData,
          isSynced: true,
          version: nextVersion,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userDashboardLayouts.userId, userId));

      return { success: true, version: nextVersion };
    } else {
      const newId = crypto.randomUUID();
      await tx.insert(userDashboardLayouts).values({
        id: newId,
        userId,
        layoutData,
        isSynced: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return { success: true, version: 1 };
    }
  });
}

export async function resetDashboardLayoutAction() {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");
  const userId = session.userId;
  const role = session.role;

  const getDefaultLayoutByRole = (userRole: string): string[] => {
    switch (userRole) {
      case "Personel":
        return ["stocks"];
      default:
        return ["stocks", "orders"];
    }
  };

  const defaultLayout = getDefaultLayoutByRole(role);

  return await db.transaction(async (tx) => {
    await tx
      .delete(userDashboardLayouts)
      .where(eq(userDashboardLayouts.userId, userId));

    return {
      success: true,
      layoutData: JSON.stringify(defaultLayout),
      version: 1
    };
  });
}

export async function exportExcelStocksAction() {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");

  const allProducts = await db
    .select({
      id: products.id,
      externalId: products.externalId,
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

  const { ExcelSyncEngine } = require("@/lib/excel/ExcelSyncEngine");
  const excelBase64 = ExcelSyncEngine.generateTemplate(allProducts);
  return { success: true, base64: excelBase64 };
}

export async function importExcelStocksAction(rows: any[]) {
  const session = await getSession();
  if (!session) throw new Error("Oturum bulunamadı.");
  const companyId = "mutlukal-depo-001";

  return await db.transaction(async (tx) => {
    const existingCats = await tx.select().from(categories);
    const catMap = new Map(existingCats.map(c => [c.name.toLowerCase().trim(), c.id]));

    for (const row of rows) {
      const { externalId, name, sku, currentStock, criticalThreshold, unit, categoryName } = row;

      const catKey = categoryName.toLowerCase().trim();
      let categoryId = catMap.get(catKey);

      if (!categoryId) {
        categoryId = `cat-${catKey.replace(/[^a-z0-9]/g, "-")}`;
        await tx.insert(categories).values({
          id: categoryId,
          name: categoryName,
          slug: catKey.replace(/[^a-z0-9]/g, "-"),
          icon: "📦",
          color: "#6366f1",
        });
        catMap.set(catKey, categoryId);
      }

      let matchedProduct = null;
      if (externalId) {
        [matchedProduct] = await tx
          .select()
          .from(products)
          .where(eq(products.externalId, externalId))
          .limit(1);

        if (!matchedProduct) {
          [matchedProduct] = await tx
            .select()
            .from(products)
            .where(eq(products.id, externalId))
            .limit(1);
        }
      }

      if (matchedProduct) {
        const stockDiff = currentStock - matchedProduct.currentStock;
        
        await tx
          .update(products)
          .set({
            name,
            sku,
            currentStock,
            criticalThreshold,
            unit,
            categoryId,
          })
          .where(eq(products.id, matchedProduct.id));

        if (stockDiff !== 0) {
          await tx.insert(stockMovements).values({
            id: crypto.randomUUID(),
            productId: matchedProduct.id,
            companyId,
            type: stockDiff > 0 ? "in" : "out",
            quantity: Math.abs(stockDiff),
            source: "excel_sync",
          });
        }
      } else {
        const productId = crypto.randomUUID();
        const pExtId = externalId || crypto.randomUUID();

        await tx.insert(products).values({
          id: productId,
          companyId,
          categoryId,
          name,
          sku,
          currentStock,
          criticalThreshold,
          unit,
          isActive: true,
          externalId: pExtId,
        });

        if (currentStock > 0) {
          await tx.insert(stockMovements).values({
            id: crypto.randomUUID(),
            productId,
            companyId,
            type: "in",
            quantity: currentStock,
            source: "excel_sync",
          });
        }
      }
    }

    return { success: true };
  });
}


