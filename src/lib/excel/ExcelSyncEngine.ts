import * as XLSX from "xlsx";
import { z } from "zod";

// Zod Doğrulama Şeması (Ahmet Abi için basit hata mesajları)
export const excelProductSchema = z.object({
  externalId: z.string().nullable().optional(),
  name: z.string().min(1, "Ürün adı boş olamaz"),
  sku: z.string().nullable().optional().transform(v => v || null),
  currentStock: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 0 : Number(val)),
    z.number({ message: "Stok miktarı sayı olmalıdır" })
  ),
  criticalThreshold: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 10 : Number(val)),
    z.number({ message: "Kritik limit sayı olmalıdır" })
  ),
  unit: z.string().default("Adet"),
  categoryName: z.string().min(1, "Kategori belirtilmelidir"),
});

export type ExcelProductData = z.infer<typeof excelProductSchema>;

export interface SyncRowResult {
  rowNum: number;
  data?: ExcelProductData;
  error?: string;
  isNew: boolean;
}

export class ExcelSyncEngine {
  /**
   * Base64 formatındaki Excel dosyasını parse edip doğrular.
   */
  public static parseAndSync(base64Data: string): { results: SyncRowResult[]; hasError: boolean } {
    const buffer = Buffer.from(base64Data, "base64");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Excel satırlarını JSON listesi olarak oku
    const rawRows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });
    const results: SyncRowResult[] = [];
    let hasError = false;

    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // Başlık satırı hariç 2-indexed

      // Hücre sütun isimlerini İngilizce/Sistem formatına map edelim
      const mappedData = {
        externalId: row["ID (Değiştirmeyin)"] || row["external_id"] || null,
        name: row["Ürün Adı"] || row["name"] || "",
        sku: row["SKU"] || row["sku"] || null,
        currentStock: row["Mevcut Stok"] || row["current_stock"] || 0,
        criticalThreshold: row["Kritik Eşik"] || row["critical_threshold"] || 10,
        unit: row["Birim"] || row["unit"] || "Adet",
        categoryName: row["Kategori"] || row["category_name"] || "",
      };

      // Zod doğrulaması yapalım
      const validation = excelProductSchema.safeParse(mappedData);

      if (!validation.success) {
        hasError = true;
        // İlk doğrulama hatasını Ahmet Abi'nin anlayacağı dilde seçip alalım
        const firstError = validation.error.issues[0]?.message || "Hatalı veri formatı";
        results.push({
          rowNum,
          error: `Satır ${rowNum}: ${firstError}`,
          isNew: !mappedData.externalId,
        });
      } else {
        results.push({
          rowNum,
          data: validation.data,
          isNew: !validation.data.externalId,
        });
      }
    });

    return { results, hasError };
  }

  /**
   * Mevcut ürünlerden kilitli ID kolonuna sahip Excel şablonu (Base64) üretir.
   */
  public static generateTemplate(productsList: any[]): string {
    // Sütun başlıkları Türkçe olacak
    const headers = [
      "ID (Değiştirmeyin)",
      "Ürün Adı",
      "SKU",
      "Mevcut Stok",
      "Kritik Eşik",
      "Birim",
      "Kategori"
    ];

    const dataRows = productsList.map((p) => [
      p.externalId || p.id, // Shadow ID Mapping
      p.name,
      p.sku || "",
      p.currentStock,
      p.criticalThreshold,
      p.unit,
      p.categoryName || ""
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // ID hücresini kilitleme (read-only) desteği için SheetJS hücre koruması
    worksheet["!protect"] = {
      password: "mutlukalerp_safe",
      selectLockedCells: true,
      selectUnlockedCells: true
    };

    // İlk sütundaki (ID) tüm hücreleri kilitli olarak işaretleyelim
    for (let i = 1; i <= dataRows.length + 1; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: i - 1, c: 0 });
      if (worksheet[cellRef]) {
        worksheet[cellRef].s = { locked: true };
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stok Kartları");

    // Excel dosyasını base64 formatında yaz
    const excelBase64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    return excelBase64;
  }
}
