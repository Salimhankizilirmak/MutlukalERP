"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveLogisticBooking, updateLogisticBooking, deleteLogisticBooking } from "@/actions/erp-actions";
import { toast } from "sonner";

interface Booking {
  id: string;
  truckArrivalTime: string | null;
  driverInfo: string | null;
  status: string;
  orderId: string;
  orderQty: number;
  customerName: string;
  productName: string;
}

interface EligibleOrder {
  id: string;
  quantity: number;
  customerName: string;
  productName: string;
}

interface PlannedJob {
  id: string;
  machineName: string;
  sequence: number;
  scheduledDate: string;
  estimatedHours: number;
  status: string;
  orderQty: number;
  customerName: string;
  productName: string;
  truckArrivalTime: string | null;
  driverInfo: string | null;
}

interface LogisticsClientProps {
  initialData: {
    bookings: Booking[];
    eligibleOrders: EligibleOrder[];
    plannedJobs: PlannedJob[];
  };
}

export default function LogisticsClient({ initialData }: LogisticsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"bookings" | "production">("bookings");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    orderId: "",
    truckArrivalTime: "",
    driverInfo: "",
  });

  const [loading, setLoading] = useState(false);

  // Search states
  const [bookingsSearchQuery, setBookingsSearchQuery] = useState("");
  const [productionSearchQuery, setProductionSearchQuery] = useState("");

  // CRUD Edit state
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<Booking | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.orderId || !form.truckArrivalTime) {
      toast.warning("Lütfen tüm alanları doldurun.");
      return;
    }
    setLoading(true);

    try {
      const res = await saveLogisticBooking(form.orderId, form.truckArrivalTime, form.driverInfo);
      if (res.success) {
        toast.success("Sevkiyat aracı planı başarıyla kaydedildi, üretime mail gönderildi!");
        setShowModal(false);
        setForm({ orderId: "", truckArrivalTime: "", driverInfo: "" });
        router.refresh();
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Plan kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForEdit) return;
    setLoading(true);
    try {
      const res = await updateLogisticBooking(selectedBookingForEdit.id, {
        truckArrivalTime: selectedBookingForEdit.truckArrivalTime,
        driverInfo: selectedBookingForEdit.driverInfo,
        status: selectedBookingForEdit.status,
      });
      if (res.success) {
        toast.success("Sevkiyat kaydı güncellendi.");
        setSelectedBookingForEdit(null);
        router.refresh();
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (e: any) {
      toast.error(e.message || "Güncellenirken hata.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!confirm("Bu sevkiyat plan kaydını silmek istediğinize emin misiniz?")) return;
    setLoading(true);
    try {
      const res = await deleteLogisticBooking(id);
      if (res.success) {
        toast.success("Sevkiyat kaydı silindi.");
        router.refresh();
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (e: any) {
      toast.error(e.message || "Silinirken hata.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 p-1.5 rounded-2xl gap-2 w-fit">
        <button
          onClick={() => setActiveTab("bookings")}
          className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
            activeTab === "bookings"
              ? "bg-indigo-600 text-white font-black shadow-lg shadow-indigo-650/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          🚚 Araç Sevkiyat Planları
        </button>
        <button
          onClick={() => setActiveTab("production")}
          className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
            activeTab === "production"
              ? "bg-indigo-600 text-white font-black shadow-lg shadow-indigo-650/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          🏭 Üretimdeki Aktif Siparişler & Araç Takibi ({initialData.plannedJobs?.length || 0})
        </button>
      </div>

      {activeTab === "bookings" && (() => {
        const filteredBookings = initialData.bookings.filter(b => 
          b.customerName.toLowerCase().includes(bookingsSearchQuery.toLowerCase()) ||
          b.productName.toLowerCase().includes(bookingsSearchQuery.toLowerCase())
        );

        return (
          <div className="premium-card p-6 space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-white">Planlanan Sevkiyat Araçları</h2>
                <p className="text-xs text-slate-455 mt-1">Araç geliş saatlerini belirterek üretime mail gönderin.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Araç sevkiyatlarında ara..."
                  value={bookingsSearchQuery}
                  onChange={e => setBookingsSearchQuery(e.target.value)}
                  className="px-4 py-2 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition"
                >
                  ➕ Sevkiyat Aracı Planla
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-850/50 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 rounded-l-xl">Müşteri</th>
                    <th className="p-4">Mamul Ürün</th>
                    <th className="p-4">Miktar (Koli)</th>
                    <th className="p-4">Tahmini Geliş Saati</th>
                    <th className="p-4">Şoför / Plaka</th>
                    <th className="p-4 rounded-r-xl text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredBookings.map(book => (
                    <tr key={book.id} className="hover:bg-slate-850/10 transition">
                      <td className="p-4 font-semibold text-white">{book.customerName}</td>
                      <td className="p-4">{book.productName}</td>
                      <td className="p-4">{book.orderQty} Koli</td>
                      <td className="p-4 text-xs text-indigo-400 font-bold">
                        {book.truckArrivalTime
                          ? new Date(book.truckArrivalTime).toLocaleString("tr-TR")
                          : "-"}
                      </td>
                      <td className="p-4 text-xs">{book.driverInfo || "Belirtilmemiş"}</td>
                      <td className="p-4 text-right flex justify-end gap-2 items-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mr-2">
                          {book.status === "completed" ? "Yüklendi/Gönderildi" : "🚚 ARAÇ YOLDA"}
                        </span>
                        <button
                          onClick={() => setSelectedBookingForEdit(book)}
                          className="px-2.5 py-1.5 text-[10px] font-bold text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 rounded-lg transition"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleDeleteBooking(book.id)}
                          className="px-2.5 py-1.5 text-[10px] font-bold text-rose-455 border border-rose-500/20 hover:bg-rose-500/10 rounded-lg transition"
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredBookings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        Planlanmış sevkiyat aracı bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {activeTab === "production" && (() => {
        const filteredProduction = initialData.plannedJobs.filter(job => 
          job.customerName.toLowerCase().includes(productionSearchQuery.toLowerCase()) ||
          job.productName.toLowerCase().includes(productionSearchQuery.toLowerCase()) ||
          job.machineName.toLowerCase().includes(productionSearchQuery.toLowerCase())
        );

        return (
          <div className="premium-card p-6 animate-fadeIn space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-white">Üretim Kuyruğu & Araç Durumları</h2>
                <p className="text-xs text-slate-400 mt-1">Makinelerde planlı olan işlerin listesi ve bu işlere atanmış araç durumları.</p>
              </div>
              <input
                type="text"
                placeholder="Üretim kuyruğunda ara..."
                value={productionSearchQuery}
                onChange={e => setProductionSearchQuery(e.target.value)}
                className="px-4 py-2 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-850/50 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 rounded-l-xl">Hat / Makine</th>
                    <th className="p-4">Sıra</th>
                    <th className="p-4">Müşteri</th>
                    <th className="p-4">Ürün</th>
                    <th className="p-4">Miktar</th>
                    <th className="p-4">Atanan Araç / Şoför</th>
                    <th className="p-4 rounded-r-xl text-right">Varış Zamanı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredProduction.map(job => (
                    <tr key={job.id} className="hover:bg-slate-850/10 transition">
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-350 text-[10px] font-bold">
                          {job.machineName}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-bold text-indigo-400">#{job.sequence + 1}</td>
                      <td className="p-4 font-semibold text-white">{job.customerName}</td>
                      <td className="p-4 text-xs">{job.productName}</td>
                      <td className="p-4 text-xs">{job.orderQty} Koli</td>
                      <td className="p-4 text-xs">
                        {job.driverInfo ? (
                          <span className="text-cyan-400 font-semibold">🚚 {job.driverInfo}</span>
                        ) : (
                          <span className="text-rose-400">⚠️ Araç Planlanmadı</span>
                        )}
                      </td>
                      <td className="p-4 text-right text-xs font-bold">
                        {job.truckArrivalTime ? (
                          <span className="text-indigo-400">{new Date(job.truckArrivalTime).toLocaleString("tr-TR")}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredProduction.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 text-xs">
                        Makinelerde planlı aktif iş bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Planla */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="premium-modal w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-white">🚚 Sevkiyat Aracı Planlama</h3>

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Hangi Sipariş İçin?</label>
                <select
                  required
                  value={form.orderId}
                  onChange={e => setForm(prev => ({ ...prev, orderId: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                >
                  <option value="">Sipariş Seçin...</option>
                  {initialData.eligibleOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.customerName} - {o.productName} ({o.quantity} Koli)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Araç Varış Tarihi & Saati</label>
                <input
                  type="datetime-local"
                  required
                  value={form.truckArrivalTime}
                  onChange={e => setForm(prev => ({ ...prev, truckArrivalTime: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Şoför Bilgisi & Araç Plakası</label>
                <input
                  type="text"
                  value={form.driverInfo}
                  onChange={e => setForm(prev => ({ ...prev, driverInfo: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                  placeholder="Örn: Ahmet Yılmaz - 34 ABC 123"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition"
                >
                  {loading ? "Tetikleniyor..." : "Araç Planını Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LOGISTIC BOOKING MODAL */}
      {selectedBookingForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="premium-modal w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-white">📝 Sevkiyat Kaydını Düzenle</h3>
            <form onSubmit={handleUpdateBooking} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Sipariş</label>
                <input
                  type="text"
                  disabled
                  value={`${selectedBookingForEdit.customerName} - ${selectedBookingForEdit.productName}`}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs opacity-50 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Miktar</label>
                <input
                  type="text"
                  disabled
                  value={`${selectedBookingForEdit.orderQty} Koli`}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs opacity-50 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Araç Varış Tarihi & Saati</label>
                <input
                  type="datetime-local"
                  required
                  value={selectedBookingForEdit.truckArrivalTime ? selectedBookingForEdit.truckArrivalTime.slice(0, 16) : ""}
                  onChange={e => setSelectedBookingForEdit({ ...selectedBookingForEdit, truckArrivalTime: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Şoför Bilgisi & Araç Plakası</label>
                <input
                  type="text"
                  value={selectedBookingForEdit.driverInfo || ""}
                  onChange={e => setSelectedBookingForEdit({ ...selectedBookingForEdit, driverInfo: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Durum</label>
                <select
                  value={selectedBookingForEdit.status}
                  onChange={e => setSelectedBookingForEdit({ ...selectedBookingForEdit, status: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                >
                  <option value="scheduled">Araç Yolda</option>
                  <option value="completed">Yüklendi / Gönderildi</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setSelectedBookingForEdit(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-650 rounded-xl hover:bg-indigo-600 transition"
                >
                  {loading ? "Güncelleniyor..." : "Güncelle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
