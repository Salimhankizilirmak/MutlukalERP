"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProductUnitPrice, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } from "@/actions/erp-actions";
import { toast } from "sonner";

interface Material {
  id: string;
  name: string;
  categoryId: string;
  currentStock: number;
  unit: string;
  unitPrice: number;
  criticalThreshold: number;
}

interface PurchaseOrder {
  id: string;
  quantity: number;
  leadDate: string | null;
  status: string;
  materialName: string;
  productId: string;
}

interface TruckBooking {
  id: string;
  truckArrivalTime: string | null;
  driverInfo: string | null;
  status: string;
  customerName: string;
  productName: string;
  quantity: number;
}

interface PurchasingClientProps {
  initialData: {
    materials: Material[];
    purchaseOrders: PurchaseOrder[];
    truckBookings: TruckBooking[];
  };
}

export default function PurchasingClient({ initialData }: PurchasingClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"prices" | "pos" | "trucks">("prices");

  // Local state
  const [materialsList, setMaterialsList] = useState<Material[]>(initialData.materials);
  const [poList, setPoList] = useState<PurchaseOrder[]>(initialData.purchaseOrders);
  const [truckBookings] = useState<TruckBooking[]>(initialData.truckBookings || []);
  
  // Inline editing prices
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});
  const [showPOModal, setShowPOModal] = useState(false);
  const [poForm, setPoForm] = useState({
    productId: "",
    quantity: 1000,
    leadDate: "",
  });

  const [loading, setLoading] = useState(false);

  // Search states
  const [pricesSearchQuery, setPricesSearchQuery] = useState("");
  const [posSearchQuery, setPosSearchQuery] = useState("");
  const [trucksSearchQuery, setTrucksSearchQuery] = useState("");

  // CRUD Editing states
  const [selectedPOForEdit, setSelectedPOForEdit] = useState<PurchaseOrder | null>(null);

  const handlePriceChange = (productId: string, val: string) => {
    const num = parseFloat(val) || 0;
    setEditingPrices(prev => ({
      ...prev,
      [productId]: num,
    }));
  };

  const handleSavePrice = async (productId: string) => {
    const price = editingPrices[productId];
    if (price === undefined || price < 0) return;
    setLoading(true);
    try {
      const res = await updateProductUnitPrice(productId, price);
      if (res.success) {
        toast.success("Birim fiyat başarıyla güncellendi.");
        setMaterialsList(prev =>
          prev.map(m => (m.id === productId ? { ...m, unitPrice: price } : m))
        );
        router.refresh();
      }
    } catch (e: any) {
      toast.error(e.message || "Fiyat güncellenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.productId || poForm.quantity <= 0 || !poForm.leadDate) {
      toast.warning("Lütfen tüm alanları doldurun.");
      return;
    }
    setLoading(true);
    try {
      const res = await createPurchaseOrder(poForm.productId, poForm.quantity, poForm.leadDate);
      if (res.success) {
        toast.success("Tedarik siparişi girildi ve üretime mail gönderildi!");
        setShowPOModal(false);
        setPoForm({ productId: "", quantity: 1000, leadDate: "" });
        router.refresh();
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Tedarik siparişi kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOForEdit) return;
    setLoading(true);
    try {
      const res = await updatePurchaseOrder(selectedPOForEdit.id, {
        productId: selectedPOForEdit.productId,
        quantity: selectedPOForEdit.quantity,
        leadDate: selectedPOForEdit.leadDate,
        status: selectedPOForEdit.status,
      });
      if (res.success) {
        toast.success("Tedarik siparişi güncellendi.");
        setSelectedPOForEdit(null);
        router.refresh();
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (e: any) {
      toast.error(e.message || "Güncellenirken hata.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePO = async (id: string) => {
    if (!confirm("Bu tedarik siparişini silmek istediğinize emin misiniz?")) return;
    setLoading(true);
    try {
      const res = await deletePurchaseOrder(id);
      if (res.success) {
        toast.success("Tedarik siparişi silindi.");
        setPoList(prev => prev.filter(p => p.id !== id));
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
          onClick={() => setActiveTab("prices")}
          className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
            activeTab === "prices"
              ? "bg-indigo-600 text-white font-black shadow-lg shadow-indigo-650/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          🪙 Malzeme Birim Fiyatları & Stok
        </button>
        <button
          onClick={() => setActiveTab("pos")}
          className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
            activeTab === "pos"
              ? "bg-indigo-600 text-white font-black shadow-lg shadow-indigo-650/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          📦 Temrin Siparişleri & Girişler ({poList.length})
        </button>
        <button
          onClick={() => setActiveTab("trucks")}
          className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
            activeTab === "trucks"
              ? "bg-indigo-600 text-white font-black shadow-lg shadow-indigo-650/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          🚚 Aktif Sevkiyat & Araç Gelişleri ({truckBookings.length})
        </button>
      </div>

      {/* Tab Content 1: Prices & Stock */}
      {activeTab === "prices" && (() => {
        const filteredMaterials = materialsList.filter(mat => 
          mat.name.toLowerCase().includes(pricesSearchQuery.toLowerCase())
        );

        return (
          <div className="space-y-4 animate-fadeIn">
            {/* Search bar */}
            <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
              <h2 className="text-xs font-bold text-slate-400">Malzeme Birim Fiyat Listesi</h2>
              <input
                type="text"
                placeholder="Malzemelerde arama yapın..."
                value={pricesSearchQuery}
                onChange={e => setPricesSearchQuery(e.target.value)}
                className="px-4 py-2 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            {/* Card list */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMaterials.map(mat => {
                const isCritical = mat.currentStock < mat.criticalThreshold;
                const isEditing = editingPrices[mat.id] !== undefined;
                const currentVal = isEditing ? editingPrices[mat.id] : mat.unitPrice;

                return (
                  <div key={mat.id} className="premium-card p-4 flex flex-col justify-between gap-4 border border-slate-800 hover:border-slate-700/80 transition-all">
                    <div className="flex justify-between items-start">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          mat.categoryId === "cat-koli"
                            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            : mat.categoryId === "cat-poset"
                            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                            : mat.categoryId === "cat-katki"
                            ? "bg-pink-500/10 text-pink-400 border border-pink-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {mat.categoryId.replace("cat-", "")}
                      </span>
                      
                      <span className="text-[10px] text-slate-500 font-mono">
                        {mat.id}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-white leading-tight min-h-[32px]">{mat.name}</h3>
                      
                      <div className="flex justify-between items-center text-[10px] mt-2 bg-slate-950/40 p-2 rounded-lg">
                        <span className="text-slate-550">Mevcut Stok:</span>
                        <span className={`font-bold ${isCritical ? "text-rose-455 font-black" : "text-emerald-450"}`}>
                          {mat.currentStock.toFixed(2)} {mat.unit} {isCritical && "⚠️"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-850 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1 rounded-xl border border-slate-800 focus-within:border-indigo-500 transition-all flex-1">
                        <span className="text-slate-550 text-xs">₺</span>
                        <input
                          type="number"
                          step="0.01"
                          value={currentVal}
                          onChange={e => handlePriceChange(mat.id, e.target.value)}
                          className="w-full bg-transparent text-white text-xs font-semibold focus:outline-none"
                        />
                      </div>
                      {isEditing && editingPrices[mat.id] !== mat.unitPrice && (
                        <button
                          onClick={() => handleSavePrice(mat.id)}
                          disabled={loading}
                          className="px-3 py-2 text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-md shadow-indigo-600/20 shrink-0"
                        >
                          Kaydet
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Tab Content 2: Tedarik & Temrin Siparişleri */}
      {activeTab === "pos" && (() => {
        const filteredPOs = poList.filter(po => 
          po.materialName.toLowerCase().includes(posSearchQuery.toLowerCase())
        );

        return (
          <div className="premium-card p-6 animate-fadeIn space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-sm font-bold text-white">Tedarik Temrin Sipariş Takibi</h2>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Siparişlerde arama yapın..."
                  value={posSearchQuery}
                  onChange={e => setPosSearchQuery(e.target.value)}
                  className="px-4 py-2 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => setShowPOModal(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition"
                >
                  ➕ Yeni Temrin Siparişi Gir
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-850/50 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 rounded-l-xl">Sipariş ID</th>
                    <th className="p-4">Malzeme Adı</th>
                    <th className="p-4">Sipariş Miktarı</th>
                    <th className="p-4">Tahmini Teslimat (Temrin Tarihi)</th>
                    <th className="p-4 rounded-r-xl text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredPOs.map(po => (
                    <tr key={po.id} className="hover:bg-slate-850/10 transition">
                      <td className="p-4 text-xs font-bold text-slate-500">{po.id}</td>
                      <td className="p-4 font-semibold text-white">{po.materialName}</td>
                      <td className="p-4">{po.quantity} Adet/Kg</td>
                      <td className="p-4 text-xs text-indigo-400 font-semibold">
                        {po.leadDate ? new Date(po.leadDate).toLocaleDateString("tr-TR") : "Girilmedi"}
                      </td>
                      <td className="p-4 text-right flex justify-end gap-2 items-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border mr-2 ${
                          po.status === "completed" 
                            ? "bg-emerald-500/10 text-emerald-450 border-emerald-500/20" 
                            : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        }`}>
                          {po.status === "completed" ? "Teslim Alındı" : "Yolda / Bekleniyor"}
                        </span>
                        <button
                          onClick={() => setSelectedPOForEdit(po)}
                          className="px-2.5 py-1.5 text-[10px] font-bold text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 rounded-lg transition"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleDeletePO(po.id)}
                          className="px-2.5 py-1.5 text-[10px] font-bold text-rose-455 border border-rose-500/20 hover:bg-rose-500/10 rounded-lg transition"
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPOs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Tedarik aşamasında sipariş bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Tab Content 3: Truck Arrivals (Consolidated View) */}
      {activeTab === "trucks" && (() => {
        const filteredTrucks = truckBookings.filter(t => 
          t.customerName.toLowerCase().includes(trucksSearchQuery.toLowerCase()) ||
          t.productName.toLowerCase().includes(trucksSearchQuery.toLowerCase())
        );

        return (
          <div className="premium-card p-6 animate-fadeIn space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-white">Lojistik Sevkiyat & Araç Varış Takibi</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Üretimdeki siparişler için planlanan lojistik sevkiyat araçları ve şoförlerin varış zamanı.
                </p>
              </div>
              <input
                type="text"
                placeholder="Araç veya sipariş ara..."
                value={trucksSearchQuery}
                onChange={e => setTrucksSearchQuery(e.target.value)}
                className="px-4 py-2 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-850/50 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 rounded-l-xl">Müşteri</th>
                    <th className="p-4">Mamul Ürün</th>
                    <th className="p-4">Miktar</th>
                    <th className="p-4">Şoför / Plaka</th>
                    <th className="p-4 rounded-r-xl text-right">Varış Saati</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredTrucks.map(t => (
                    <tr key={t.id} className="hover:bg-slate-850/10 transition">
                      <td className="p-4 font-semibold text-white">{t.customerName}</td>
                      <td className="p-4 text-xs">{t.productName}</td>
                      <td className="p-4 text-xs">{t.quantity} Koli</td>
                      <td className="p-4 text-xs font-mono text-slate-400">{t.driverInfo || "Belirtilmemiş"}</td>
                      <td className="p-4 text-right text-xs text-indigo-400 font-bold">
                        {t.truckArrivalTime ? new Date(t.truckArrivalTime).toLocaleString("tr-TR") : "Belirtilmemiş"}
                      </td>
                    </tr>
                  ))}
                  {filteredTrucks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                        Aktif sevkiyat veya planlanmış araç bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Yeni PO / Temrin Gir */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="premium-modal w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-white">➕ Yeni Tedarik & Temrin Siparişi</h3>
            
            <form onSubmit={handleCreatePO} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Tedarik Edilecek Malzeme</label>
                <select
                  required
                  value={poForm.productId}
                  onChange={e => setPoForm(prev => ({ ...prev, productId: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                >
                  <option value="">Malzeme Seçin...</option>
                  {materialsList.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Sipariş Miktarı (Adet/Kg)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={poForm.quantity}
                  onChange={e => setPoForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Teslimat Tarihi (Temrin)</label>
                <input
                  type="date"
                  required
                  value={poForm.leadDate}
                  onChange={e => setPoForm(prev => ({ ...prev, leadDate: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPOModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition"
                >
                  {loading ? "Tetikleniyor..." : "Temrin Siparişi Gir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PO MODAL */}
      {selectedPOForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="premium-modal w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-white">📝 Temrin Siparişini Düzenle</h3>
            <form onSubmit={handleUpdatePO} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Tedarik Edilecek Malzeme</label>
                <select
                  disabled
                  value={selectedPOForEdit.productId}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs opacity-50 cursor-not-allowed"
                >
                  {materialsList.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Sipariş Miktarı</label>
                <input
                  type="number"
                  required
                  value={selectedPOForEdit.quantity}
                  onChange={e => setSelectedPOForEdit({ ...selectedPOForEdit, quantity: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Tahmini Teslimat (Temrin Tarihi)</label>
                <input
                  type="date"
                  required
                  value={selectedPOForEdit.leadDate ? selectedPOForEdit.leadDate.split("T")[0] : ""}
                  onChange={e => setSelectedPOForEdit({ ...selectedPOForEdit, leadDate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Durum</label>
                <select
                  value={selectedPOForEdit.status}
                  onChange={e => setSelectedPOForEdit({ ...selectedPOForEdit, status: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                >
                  <option value="pending">Yolda / Teslimat Bekleniyor</option>
                  <option value="completed">Teslim Alındı</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setSelectedPOForEdit(null)}
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
