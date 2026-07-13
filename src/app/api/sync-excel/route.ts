import { syncExcelData } from "@/actions/sync";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await syncExcelData();
  if (result.error) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, ...result });
}

export async function POST() {
  const result = await syncExcelData();
  if (result.error) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, ...result });
}
