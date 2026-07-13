# MutlukalERP Proje Geliştirme Raporu

Bu rapor, Salimhankizilirmak/MutlukalERP projesinin yerel depolama yönetiminden başlayıp departmanlar arası (Pazarlama, Planlama, Satın Alma, Lojistik, Üretim) uçtan uca entegre bir kurumsal çözüm haline getirilmesine kadar yapılan tüm teknik çalışmaları, mimari yapıyı ve gelecek adımları içermektedir.

---

## 1. Proje Hedefi ve Kapsamı
MutlukalERP; fabrikadaki hammadde girişlerinden ürün reçetelerine (BOM), pazarlama maliyet hesaplamalarından sipariş onayına, üretim planlamasından lojistik araç sevkiyatlarına kadar tüm iş süreçlerini tek panelden yöneten bütünleşik bir sistemdir.
* **Hassas Veri Politikası:** Ürün formülleri, fiyatlar, müşteri listeleri ve maliyetler yerel ağda (`mutlukal.db` SQLite) tutulurken; dışarıdaki satış temsilcilerinin erişimi için anonimleştirilmiş stok miktarları güvenli bir şekilde buluta (Vercel Blob) aktarılmaktadır.

---

## 2. Teknik Altyapı ve Veritabanı Mimarisi

### Veritabanı Şeması (Drizzle ORM & SQLite)
Veritabanı ilişkileri `src/db/schema.ts` altında tanımlanmıştır. Temel tablolar ve rolleri şunlardır:
* **companies:** Fabrika kimliğini tutar.
* **users:** Kullanıcı adı, şifre hash'i, e-posta, rol ve aktiflik durumu.
* **categories:** Ürün grupları (Mamul Ürünler, Koliler, Poşetler, Katkı Maddeleri, Sarf Malzemeleri).
* **products:** Ürün kartları. `attributes` sütununda JSON formatında mamul parametreleri (Gramaj, Koli İçi, Paket İçi vb.) saklanır.
* **stockMovements:** Giriş, çıkış ve düzeltme hareketleri.
* **productTrees (BOM):** Mamul ürünlerin reçeteleri (Hangi Triton ürünü için kaç gram un, hangi poşet, hangi koli kullanılacağı).
* **purchaseOrders (Tedarik):** Satın alma siparişleri ve temrin (teslimat) tarihleri.
* **logisticBookings (Sevkiyat):** Satış siparişlerine atanan araç geliş zamanı ve şoför bilgileri.
* **excelSyncLogs:** Üretim iş emirleri Excel senkronizasyon kayıtları.

---

## 3. Yetkilendirme Hiyerarşisi (RBAC)
Kullanıcı rolleri ve yetki sınırları JWT tabanlı oturum yönetimi (`src/lib/session.ts`) ve middleware katmanı ile korunur:
1. **Müdür (Manager):** Tüm sistemde tam yetki (CRUD + Kullanıcı Yönetimi).
2. **Üretim Müdürü / Yetkili:** Sipariş onaylandığında otomatik mail alır, sürükle-bırak ile üretim sırasını planlar ve iş emirlerini takip eder.
3. **Satın Alma:** Hammadde ve ambalaj birim fiyatlarını girer, temrin siparişlerini (PO) yönetir.
4. **Lojistik:** Sevkiyat araçlarını planlar, şoför/plaka atar ve araç yolda bildirimlerini yönetir.
5. **Personel:** Depo kör sayımlarını gerçekleştirir.

---

## 4. Departman Modülleri ve Geliştirilen Özellikler

### A. Pazarlama (Marketing)
* **Maliyet Analizi:** Bir mamulün reçetesindeki (BOM) tüm girdilerin güncel satın alma fiyatları ve üretim fire oranları (`averageWastePercentage`) hesaba katılarak anlık birim maliyet hesaplanır.
* **CRUD & Arama:** Müşteri/Firma kartları, mamul kartları ve alınan siparişler için filtreleme panelleri ile tam CRUD modalları entegre edildi.
* **Sipariş Onay Maili:** Sipariş onaylandığında üretim müdürüne "Yeni sipariş onaylandı" e-postası gider.

### B. Planlama (Planning)
* **Kapasite ve Hız Matrisi:** Her ürünün hangi makinede saatte kaç koli üretilebileceği (`estimatedHours` hesabı için) kapasite matrisinde tutulur ve CRUD ile düzenlenebilir.
* **Sürükle-Bırak Planlama:** Gelen siparişler, makinelerin üretim kuyruğuna sürüklenerek sıralanabilir.
* **BOM Yönetimi:** Mamullerin ürün ağaçları dinamik olarak düzenlenebilir.

### C. Satın Alma (Purchasing)
* **Birim Fiyat Yönetimi:** Girdi malzemelerinin fiyatları bu panelden güncellenir.
* **Temrin Takibi (PO):** Hammadde/ambalaj sipariş miktarı ve beklenen temrin tarihi girilir. Teslim alındığında stoklara otomatik yansır.
* **Lojistik Entegrasyonu:** Lojistiğin planladığı araç varış saatleri anlık izlenir.

### D. Lojistik (Logistics)
* **Araç Planlama:** Onaylı siparişlere tır varış saati, şoför adı ve plaka ataması yapılır.
* **Üretim Takibi:** Hangi işin hangi makinede kaçıncı sırada olduğunu canlı izleyerek araç çıkış durumunu günceller.

---

## 5. Üretim İş Emirleri ve Excel Senkronizasyonu
* **Excel Entegrasyonu:** `S:\İş Emirleri` klasöründeki veya yerel public dizindeki en güncel Excel plan dosyası okunur.
* **Stok Kontrolü & Alarm:** Sıradaki 7 iş emrinin reçetesindeki (Butu/Poşet/Katkı) miktarlar depodaki stoklarla karşılaştırılır. Eksik varsa yetkililere e-posta ile bildirim tetiklenir.
* **Yatay Tasarım:** Kullanıcı kolaylığı için makineler dikey sıralanırken, gelecek 7 iş emrinin detay kutuları yan yana yatay (`flex-row overflow-x-auto`) şerit halinde yeniden tasarlandı.

---

## 6. Güvenli Canlı Stok Senkronizasyonu (Vercel Blob)
Hassas fabrika verilerini bulut ortamına taşımadan, dışarıdaki satış temsilcilerinin stok miktarlarını anlık görebilmesi için **Push-Based Sync** yapısı kuruldu:
1. **[sync_stocks_to_vercel.js](file:///c:/Users/Lenovo/MutlukalDepo/sync_stocks_to_vercel.js) (Lokal Sunucu):** Fabrikadaki bilgisayarda periyodik olarak çalışır. SQLite'tan sadece stok kodlarını ve miktarlarını çekip API'ye yollar.
2. **[route.ts](file:///c:/Users/Lenovo/MutlukalDepo/src/app/api/sync-stocks/route.ts) (Bulut API):** Gelen stok verisini doğrular ve Vercel Blob üzerinde tamamen ücretsiz olan `stocks.json` dosyasına yazar.
3. **[StockPageServer.tsx](file:///c:/Users/Lenovo/MutlukalDepo/src/components/StockPageServer.tsx):** Canlı sunucuda (Vercel) çalışırken veritabanına bağlanmak yerine stok listesini doğrudan Vercel Blob üzerindeki `stocks.json` dosyasından okuyarak listeler.

---

## 7. Gelecek Adımlar ve Canlıya Geçiş Planı

### Adım 1: Fabrikadaki Yerel Sunucunun Hazırlanması
* Fabrika bilgisayarına Node.js (v18+) kurun.
* Proje dizininde bağımlılıkları yükleyin ve yerel veritabanını oluşturun:
  ```bash
  npm install
  npm run build
  ```

### Adım 2: Canlı Dağıtım (Vercel)
* Kodları içeren GitHub reposunu Vercel'e bağlayın.
* Vercel panelinden **Storage** -> **Blob** bağlantısını kurun ve "System Environment Variables" iznini aktif edin.
* Vercel çevre değişkenlerine yerel senkronizasyon şifresini (`SYNC_TOKEN`) ekleyin.

### Adım 3: Yerel Senkronizasyonun Zamanlanması
* `sync_stocks_to_vercel.js` dosyasındaki `VERCEL_APP_URL` ve `SYNC_TOKEN` alanlarını güncelleyin.
* Windows Görev Zamanlayıcı (Task Scheduler) ile bu scripti her 10 dakikada bir çalışacak şekilde ayarlayın:
  - **Eylem:** Program başlat.
  - **Program:** `node`
  - **Argüman:** `sync_stocks_to_vercel.js` (tam dosya yoluyla birlikte).
