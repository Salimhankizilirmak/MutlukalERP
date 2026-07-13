import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const expectedToken = process.env.SYNC_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { stocks } = body;

    if (!Array.isArray(stocks)) {
      return NextResponse.json({ error: "Invalid data format. 'stocks' array is required." }, { status: 400 });
    }

    // Vercel KV'ye toplu yazma işlemi yapalım (pipeline)
    const pipeline = kv.pipeline();
    for (const item of stocks) {
      if (item.id && typeof item.stock === "number") {
        // Hem ham stok miktarını tutalım
        pipeline.set(`stock:${item.id}`, item.stock);
        // Hem de meta verisini tutalım
        pipeline.set(`stock_meta:${item.id}`, {
          name: item.name,
          stock: item.stock,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    await pipeline.exec();

    return NextResponse.json({ success: true, count: stocks.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server Error" }, { status: 500 });
  }
}
