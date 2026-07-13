import { db } from "@/db";
import { productionPlans, orders, customers, products, machines, logisticBookings } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Oturum bulunamadı", { status: 401 });
  }

  try {
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

    const aoa: any[][] = [];

    Object.entries(grouped).forEach(([mName, jobs]) => {
      aoa.push([mName.toUpperCase()]);
      aoa.push(["SIRA", "MÜŞTERİ", "TEMEL ÜRÜN", "ÇAP", "AMBALAJ ADI", "AMBALAJ ÇAPI", "PAKET İÇİ ADET", "KOLİ İÇİ ADET", "GRAMAJ", "CİNSİ", "KOLİ"]);

      jobs.forEach((job, index) => {
        let musteri = job.customerName;
        let temelUrun = "";
        let cap = "";
        let ambalajCapi = "";
        let paketIci = "";
        let koliIci = "";
        let gramaj = "";
        let cinsi = "";

        try {
          if (job.productAttributes) {
            const attr = JSON.parse(job.productAttributes);
            musteri = attr.musteri || job.customerName;
            temelUrun = attr.temelUrun || "";
            cap = attr.cap || "";
            ambalajCapi = attr.ambalajCapi || "";
            paketIci = attr.paketIci || "";
            koliIci = attr.koliIci || "";
            gramaj = attr.gramaj || "";
            cinsi = attr.cesit || "";
          }
        } catch (e) {}

        aoa.push([
          index + 1,
          musteri,
          temelUrun,
          cap,
          job.productName,
          ambalajCapi,
          paketIci,
          koliIci,
          gramaj,
          cinsi,
          job.orderQty,
        ]);
      });

      aoa.push([]); 
      aoa.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sayfa3");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=MUTLUKAL_IS_EMRI_${new Date().toISOString().split("T")[0].replace(/-/g, "")}.xlsx`,
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message || "Excel oluşturulamadı", { status: 500 });
  }
}
