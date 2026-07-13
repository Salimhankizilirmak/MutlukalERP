import { db } from "@/db";
import { products, productTrees } from "@/db/schema";
import { eq } from "drizzle-orm";

export class CostCalculator {
  private static instance: CostCalculator | null = null;

  private constructor() {}

  public static getInstance(): CostCalculator {
    if (!CostCalculator.instance) {
      CostCalculator.instance = new CostCalculator();
    }
    return CostCalculator.instance;
  }

  /**
   * Calculates the unit cost for a parent (finished) product.
   * Formula: Cost = [Sum(Component_Qty * Component_UnitPrice)] * (1 + Waste_Percentage / 100)
   */
  public async calculateProductCost(parentProductId: string): Promise<{
    unitCost: number;
    componentsCost: number;
    wasteAmount: number;
    details: Array<{
      id: string;
      name: string;
      qty: number;
      unit: string;
      unitPrice: number;
      total: number;
    }>;
  }> {
    // 1) Fetch parent product details
    const [parent] = await db
      .select()
      .from(products)
      .where(eq(products.id, parentProductId));

    if (!parent) {
      return { unitCost: 0, componentsCost: 0, wasteAmount: 0, details: [] };
    }

    // 2) Fetch BOM components (child items)
    const bom = await db
      .select()
      .from(productTrees)
      .where(eq(productTrees.parentProductId, parentProductId));

    if (bom.length === 0) {
      return { unitCost: 0, componentsCost: 0, wasteAmount: 0, details: [] };
    }

    // Get all unique child product IDs
    const childIds = bom.map(item => item.childProductId);

    // Fetch child products with their current unit prices
    const allProducts = await db.select().from(products);
    const childProductMap = new Map(allProducts.map(p => [p.id, p]));

    let componentsCost = 0;
    const details = [];

    for (const item of bom) {
      const child = childProductMap.get(item.childProductId);
      const unitPrice = child?.unitPrice ?? 0;
      const total = item.quantity * unitPrice;
      componentsCost += total;

      details.push({
        id: item.childProductId,
        name: child?.name ?? "Bilinmeyen Ürün",
        qty: item.quantity,
        unit: item.unit,
        unitPrice,
        total,
      });
    }

    const wastePct = parent.averageWastePercentage ?? 0;
    const wasteAmount = componentsCost * (wastePct / 100);
    const unitCost = componentsCost + wasteAmount;

    return {
      unitCost: parseFloat(unitCost.toFixed(4)),
      componentsCost: parseFloat(componentsCost.toFixed(4)),
      wasteAmount: parseFloat(wasteAmount.toFixed(4)),
      details,
    };
  }
}
