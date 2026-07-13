import { db } from "@/db";
import { mailConfigurations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/mail";

export class NotificationService {
  private static instance: NotificationService | null = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Fetches all registered emails for a specific alert type.
   */
  private async getEmailsForAlert(alertType: string): Promise<string[]> {
    const configs = await db
      .select()
      .from(mailConfigurations)
      .where(eq(mailConfigurations.alertType, alertType));
    
    // Always fallback to a default email if no config is set, to guarantee someone receives it
    if (configs.length === 0) {
      return ["mudur@mutlukal.com.tr", "satinalma@mutlukal.com.tr"];
    }
    return configs.map(c => c.email);
  }

  /**
   * Triggers marketing approval notification (sent to Production Managers).
   */
  public async notifyMarketingApproval(order: {
    id: string;
    customerName: string;
    productName: string;
    quantity: number;
    expectedDeliveryDate: string;
  }): Promise<void> {
    const emails = await this.getEmailsForAlert("marketing_approval");
    const subject = `🆕 Yeni Sipariş Onaylandı: ${order.customerName} - ${order.productName}`;
    const text = `Merhaba,\n\nPazarlama departmanı yeni bir sipariş onayladı:\n\nMüşteri: ${order.customerName}\nÜrün: ${order.productName}\nMiktar: ${order.quantity} Koli\nTermin: ${order.expectedDeliveryDate || "Belirtilmemiş"}\n\nLütfen üretim paneli üzerinden planlamasını yapınız.`;
    
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #0f172a; background-color: #f8fafc;">
        <h2 style="color: #6366f1;">🆕 Yeni Sipariş Onaylandı</h2>
        <p>Merhaba,</p>
        <p>Pazarlama departmanı yeni bir sipariş kaydı onayladı ve üretime gönderdi:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr style="background: #f1f5f9;">
            <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Müşteri</th>
            <td style="padding: 10px; border: 1px solid #cbd5e1;">${order.customerName}</td>
          </tr>
          <tr>
            <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Ürün</th>
            <td style="padding: 10px; border: 1px solid #cbd5e1;">${order.productName}</td>
          </tr>
          <tr style="background: #f1f5f9;">
            <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Sipariş Miktarı</th>
            <td style="padding: 10px; border: 1px solid #cbd5e1;"><strong>${order.quantity} Koli</strong></td>
          </tr>
          <tr>
            <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Beklenen Teslimat</th>
            <td style="padding: 10px; border: 1px solid #cbd5e1;">${order.expectedDeliveryDate || "Belirtilmemiş"}</td>
          </tr>
        </table>
        <p style="font-size: 14px;">Lütfen üretim paneli üzerinden planlama ve sürükle-bırak sıralama işlemlerini yapınız.</p>
        <p style="font-size: 12px; color: #64748b; margin-top: 30px;">© 2026 Mutlukal Gıda San. ve Tic. A.Ş.</p>
      </div>
    `;

    for (const email of emails) {
      await sendEmail({ to: email, subject, text, html });
    }
  }

  /**
   * Triggers stock shortage notification (sent to Purchasing & Production Manager).
   */
  public async notifyStockShortage(shortages: Array<{
    productName: string;
    missingMaterial: string;
    needed: number;
    current: number;
    unit: string;
  }>): Promise<void> {
    const emails = await this.getEmailsForAlert("stock_shortage");
    const subject = `⚠️ KRİTİK UYARI: Üretim Planı İçin Stok Yetersizliği!`;
    
    let text = `Merhaba,\n\nÜretim planı yapılırken stok yetersizliği tespit edilmiştir:\n\n`;
    let tableRows = "";
    
    for (const s of shortages) {
      text += `- Planlanan Ürün: ${s.productName}\n  Eksik Malzeme: ${s.missingMaterial} | Gerekli: ${s.needed} ${s.unit} | Mevcut: ${s.current} ${s.unit}\n\n`;
      tableRows += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; border: 1px solid #cbd5e1;">${s.productName}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; color: #dc2626;"><strong>${s.missingMaterial}</strong></td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;">${s.needed} ${s.unit}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; color: #dc2626;">${s.current} ${s.unit}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; color: #e11d48;"><strong>${(s.needed - s.current).toFixed(2)} ${s.unit}</strong></td>
        </tr>
      `;
    }

    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #0f172a; background-color: #f8fafc;">
        <h2 style="color: #dc2626;">⚠️ Kritik Malzeme Eksikliği Bildirimi</h2>
        <p>Merhaba,</p>
        <p>Yeni planlanan veya sıralanan iş emirleri için depoda yeterli koli/ambalaj/katkı bulunmamaktadır:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Planlanan Mamul</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Eksik Malzeme</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;">Gerekli</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;">Mevcut</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;">Net İhtiyaç</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <p style="font-size: 14px;">Satın alma departmanının temrin (tedarik teslimat) tarihi girmesi gerekmektedir.</p>
        <p style="font-size: 12px; color: #64748b; margin-top: 30px;">© 2026 Mutlukal Gıda San. ve Tic. A.Ş.</p>
      </div>
    `;

    for (const email of emails) {
      await sendEmail({ to: email, subject, text, html });
    }
  }

  /**
   * Triggers lead time notification when purchasing updates delivery dates (sent to Production).
   */
  public async notifyPurchaseLead(item: {
    materialName: string;
    quantity: number;
    leadDate: string;
  }): Promise<void> {
    const emails = await this.getEmailsForAlert("purchase_lead");
    const subject = `🚚 Satın Alma Temrin Bilgisi: ${item.materialName}`;
    const text = `Merhaba,\n\nSatın alma departmanı eksik malzeme için temrin (varış) tarihi girdi:\n\nMalzeme: ${item.materialName}\nMiktar: ${item.quantity}\nTahmini Teslimat Tarihi: ${item.leadDate}\n\nÜretim planı bu tarihe göre güncellenecektir.`;
    
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #0f172a; background-color: #f8fafc;">
        <h2 style="color: #059669;">🚚 Malzeme Tedarik (Temrin) Bildirimi</h2>
        <p>Merhaba,</p>
        <p>Satın alma departmanı tarafından eksik bir malzeme için temrin tarihi girişi yapılmıştır:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr style="background: #f1f5f9;">
            <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Malzeme Adı</th>
            <td style="padding: 10px; border: 1px solid #cbd5e1;">${item.materialName}</td>
          </tr>
          <tr>
            <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Sipariş Edilen Miktar</th>
            <td style="padding: 10px; border: 1px solid #cbd5e1;">${item.quantity}</td>
          </tr>
          <tr style="background: #f1f5f9;">
            <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Teslimat Tarihi (Temrin)</th>
            <td style="padding: 10px; border: 1px solid #cbd5e1; color: #059669;"><strong>${item.leadDate}</strong></td>
          </tr>
        </table>
        <p style="font-size: 14px;">Lütfen üretimi planlarken bu malzemelerin varış tarihini dikkate alınız.</p>
        <p style="font-size: 12px; color: #64748b; margin-top: 30px;">© 2026 Mutlukal Gıda San. ve Tic. A.Ş.</p>
      </div>
    `;

    for (const email of emails) {
      await sendEmail({ to: email, subject, text, html });
    }
  }

  /**
   * Triggers logistics arrival time notification (sent to Production & Managers).
   */
  public async notifyLogisticArrival(booking: {
    customerName: string;
    productName: string;
    truckArrivalTime: string;
    driverInfo?: string;
  }): Promise<void> {
    const emails = await this.getEmailsForAlert("logistic_arrival");
    const subject = `🚛 Lojistik Araç Geliş Planı: ${booking.customerName}`;
    const text = `Merhaba,\n\nLojistik departmanı sevkiyat için araç geliş planı girdi:\n\nMüşteri: ${booking.customerName}\nÜrün: ${booking.productName}\nAraç Varış Zamanı: ${booking.truckArrivalTime}\nŞoför: ${booking.driverInfo || "Belirtilmemiş"}\n\nLütfen üretim önceliğini bu sevkiyat saatine göre ayarlayınız.`;
    
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #0f172a; background-color: #f8fafc;">
        <h2 style="color: #2563eb;">🚛 Lojistik Araç Geliş Bildirimi</h2>
        <p>Merhaba,</p>
        <p>Lojistik ekibi tarafından araç geliş saati tanımlanmıştır:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr style="background: #f1f5f9;">
            <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Müşteri</th>
            <td style="padding: 10px; border: 1px solid #cbd5e1;">${booking.customerName}</td>
          </tr>
          <tr>
            <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Yüklenecek Ürün</th>
            <td style="padding: 10px; border: 1px solid #cbd5e1;">${booking.productName}</td>
          </tr>
          <tr style="background: #f1f5f9;">
            <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Araç Geliş Zamanı</th>
            <td style="padding: 10px; border: 1px solid #cbd5e1; color: #2563eb;"><strong>${booking.truckArrivalTime}</strong></td>
          </tr>
          <tr>
            <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Sürücü / Plaka</th>
            <td style="padding: 10px; border: 1px solid #cbd5e1;">${booking.driverInfo || "Belirtilmemiş"}</td>
          </tr>
        </table>
        <p style="font-size: 14px;">Üretimin bu araca yetişebilmesi için planlama önceliği güncellenmiştir.</p>
        <p style="font-size: 12px; color: #64748b; margin-top: 30px;">© 2026 Mutlukal Gıda San. ve Tic. A.Ş.</p>
      </div>
    `;

    for (const email of emails) {
      await sendEmail({ to: email, subject, text, html });
    }
  }
}
