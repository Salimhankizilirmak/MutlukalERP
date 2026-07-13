import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

// SMTP Yapılandırması (Müşteri kendi SMTP bilgilerini .env.local üzerinden girebilir)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || "test@gmail.com",
    pass: process.env.SMTP_PASS || "password",
  },
});

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}) {
  const from = `"Mutlukal Depo" <${process.env.SMTP_FROM || "mutlukaldepo@gmail.com"}>`;

  // 1) E-postayı log dosyasına yaz (Test/Doğrulama kolaylığı için)
  try {
    const logDir = path.join(process.cwd(), "public");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }
    const logPath = path.join(logDir, "emails.log");
    const logEntry = `\n[${new Date().toISOString()}]\nTO: ${to}\nSUBJECT: ${subject}\nTEXT: ${text || "HTML"}\nHTML: ${html || ""}\n${"=".repeat(80)}\n`;
    fs.appendFileSync(logPath, logEntry, "utf8");
    console.log(`📧 E-posta gönderim logu kaydedildi: public/emails.log`);
  } catch (err) {
    console.error("E-posta log dosyasına yazılamadı:", err);
  }

  // 2) Gerçek SMTP üzerinden göndermeyi dene
  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    console.log(`📧 Gerçek E-posta gönderildi! MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.warn(`⚠️ E-posta SMTP üzerinden gönderilemedi (Bu lokalde normaldir, log dosyasına yazıldı): ${error.message}`);
    return { success: false, warning: "SMTP gönderimi başarısız ancak log kaydedildi." };
  }
}

// Hoşgeldin Maili Gönder
export async function sendWelcomeEmail(toEmail: string, fullName: string, username: string) {
  const subject = "Mutlukal Depo Sistemine Hoş Geldiniz!";
  const text = `Merhaba ${fullName},\n\nMutlukal Depo Yönetim Sistemine başarıyla kayıt oldunuz. Kullanıcı adınız: @${username}\n\nİyi çalışmalar dileriz.`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #0f172a; background-color: #f8fafc;">
      <h2 style="color: #ea580c;">Mutlukal Depo Sistemine Hoş Geldiniz!</h2>
      <p>Merhaba <strong>${fullName}</strong>,</p>
      <p>Mutlukal Depo Yönetim Sistemine e-posta adresiniz başarıyla tanımlandı.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 14px;">Kullanıcı Adınız: <strong>@${username}</strong></p>
      <p style="font-size: 14px;">Bu e-posta adresine sistem üzerinden stok yetersizlik uyarıları ve kritik bildirimler gönderilecektir.</p>
      <p style="font-size: 13px; color: #64748b; margin-top: 30px;">© 2026 Mutlukal Gıda San. ve Tic. A.Ş.</p>
    </div>
  `;
  return sendEmail({ to: toEmail, subject, text, html });
}

// Stok Yetersizliği Maili Gönder
export async function sendStockShortageEmail({
  to,
  ordersCount,
  items,
}: {
  to: string;
  ordersCount: number;
  items: Array<{
    machineName: string;
    productName: string;
    missingItems: Array<{ name: string; needed: number; current: number; unit: string }>;
  }>;
}) {
  const subject = `⚠️ UYARI: İş Emirlerinde Stok Yetersizliği Tespit Edildi!`;

  let text = `Merhaba,\n\nPlanlanan iş emirlerinde stok yetersizliği tespit edilmiştir.\n\n`;
  let tableRowsHtml = "";

  items.forEach((item) => {
    text += `Makine: ${item.machineName} - Ürün: ${item.productName}\n`;
    item.missingItems.forEach((m) => {
      text += `  - Eksik Malzeme: ${m.name} | Gerekli: ${m.needed} ${m.unit} | Mevcut: ${m.current} ${m.unit}\n`;
      tableRowsHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-size: 13px;"><strong>${item.machineName}</strong></td>
          <td style="padding: 10px; font-size: 13px;">${item.productName}</td>
          <td style="padding: 10px; font-size: 13px; color: #dc2626;"><strong>${m.name}</strong></td>
          <td style="padding: 10px; font-size: 13px; text-align: right;">${m.needed} ${m.unit}</td>
          <td style="padding: 10px; font-size: 13px; text-align: right; color: #dc2626;">${m.current} ${m.unit}</td>
        </tr>
      `;
    });
    text += `\n`;
  });

  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #0f172a; background-color: #f8fafc;">
      <h2 style="color: #dc2626; margin-bottom: 10px;">⚠️ Kritik Stok Yetersizliği Bildirimi</h2>
      <p>Merhaba,</p>
      <p>S:\u0130\u015f Emirleri dizinindeki yeni iş emirlerine göre üretilecek <strong>${ordersCount} iş emri</strong> için depoda bazı ambalaj ve katkı malzemelerinin yetersiz olduğu tespit edilmiştir:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background-color: #f1f5f9; text-align: left;">
            <th style="padding: 10px; font-size: 12px; font-weight: bold; color: #475569;">Makine</th>
            <th style="padding: 10px; font-size: 12px; font-weight: bold; color: #475569;">Hedef Ürün</th>
            <th style="padding: 10px; font-size: 12px; font-weight: bold; color: #475569;">Eksik Malzeme</th>
            <th style="padding: 10px; font-size: 12px; font-weight: bold; color: #475569; text-align: right;">Gereken</th>
            <th style="padding: 10px; font-size: 12px; font-weight: bold; color: #475569; text-align: right;">Mevcut</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <p style="margin-top: 20px; font-size: 14px; color: #475569;">
        Lütfen üretim aksamadan önce satın alma ve tedarik süreçlerini başlatınız.
      </p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 40px;">© 2026 Mutlukal Gıda San. ve Tic. A.Ş.</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}
