import { db } from "@/db";
import { machineCapacities } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export class ThroughputEstimator {
  private static instance: ThroughputEstimator | null = null;
  private readonly DEFAULT_KOLI_PER_HOUR = 50;

  private constructor() {}

  public static getInstance(): ThroughputEstimator {
    if (!ThroughputEstimator.instance) {
      ThroughputEstimator.instance = new ThroughputEstimator();
    }
    return ThroughputEstimator.instance;
  }

  /**
   * Estimates the production duration (in hours) for a given quantity of a finished product on a specific machine.
   * Formula: Hours = Quantity (Koli) / Throughput (Koli/Hour)
   */
  public async estimateDuration(
    machineId: string,
    productId: string,
    quantityKoli: number
  ): Promise<number> {
    if (quantityKoli <= 0) return 0;

    // Fetch custom machine capacity for this product
    const [capacity] = await db
      .select()
      .from(machineCapacities)
      .where(
        and(
          eq(machineCapacities.machineId, machineId),
          eq(machineCapacities.productId, productId)
        )
      );

    const koliPerHour = capacity?.koliPerHour ?? this.DEFAULT_KOLI_PER_HOUR;
    const estimatedHours = quantityKoli / koliPerHour;

    // Return rounded to 2 decimal places
    return parseFloat(estimatedHours.toFixed(2));
  }

  /**
   * Gets the speed (koli/hour) for a product on a machine.
   */
  public async getProductSpeed(machineId: string, productId: string): Promise<number> {
    const [capacity] = await db
      .select()
      .from(machineCapacities)
      .where(
        and(
          eq(machineCapacities.machineId, machineId),
          eq(machineCapacities.productId, productId)
        )
      );
    return capacity?.koliPerHour ?? this.DEFAULT_KOLI_PER_HOUR;
  }
}
