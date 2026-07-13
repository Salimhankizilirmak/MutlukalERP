import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

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

    const payload = {
      updatedAt: new Date().toISOString(),
      stocks,
    };

    // Vercel Blob'a yükle (stocks.json)
    const blob = await put("stocks.json", JSON.stringify(payload), {
      access: "public",
      addRandomSuffix: false, // Her seferinde aynı isimle üzerine yazar
    });

    return NextResponse.json({ success: true, url: blob.url, count: stocks.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server Error" }, { status: 500 });
  }
}
