"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer,
  createFinishedProduct,
  createOrder,
  approveOrder,
  updateCustomer,
  deleteCustomer,
  updateFinishedProduct,
  deleteProduct,
  updateOrder,
  deleteOrder,
} from "@/actions/erp-actions";
import { toast } from "sonner";

interface RawMaterial {
  id: string;
  name: string;
  categoryId: string;
  unit: string;
}

interface Customer {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  unitPrice: number;
  averageWastePercentage: number;
  attributes: {
    musteri: string;
    temelUrun: string;
    cesit: string;
    cap: string;
    paketIci: string | number;
    koliIci: string | number;
    gramaj: string | number;
  };
  costAnalysis: {
    unitCost: number;
    componentsCost: number;
    wasteAmount: number;
    details: Array<{
      id: string;
      name: string;
      qty: number;
      unit: string;
      unitPrice: number;
      total: number;
    }>;
  };
}

interface Order {
  id: string;
  quantity: number;
  status: string;
  orderedAt: string;
  expectedDeliveryDate: string | null;
  customerName: string;
  productName: string;
  productId: string;
  customerId: string;
}

interface MarketingClientProps {
  initialData: {
    orders: Order[];
    customers: Customer[];
    products: Product[];
    rawMaterials: RawMaterial[];
  };
}

export default function MarketingClient({ initialData }: MarketingClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"orders" | "products">("orders");

  // Local state
  const [customersList, setCustomersList] = useState<Customer[]>(initialData.customers);
  const [productsList, setProductsList] = useState<Product[]>(initialData.products);
  const [ordersList, setOrdersList] = useState<Order[]>(initialData.orders);

  // Modals state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState("");
  
  const [orderForm, setOrderForm] = useState({
    customerId: "",
    productId: "",
    quantity: 100,
    expectedDeliveryDate: "",
  });

  const [productForm, setProductForm] = useState({
    name: "",
    customerId: "",
    temelUrun: "",
    cesit: "",
    cap: "",
    paketIci: 10,
    koliIci: 100,
    gramaj: 25,
    unQty: 0.1,
    margarinQty: 0.05,
    katkiId: "",
    katkiQty: 0.01,
    koliId: "",
    posetId: "",
    wastePercentage: 5,
    unitPrice: 15.0, // Satış fiyatı
  });

  const [loading, setLoading] = useState(false);

  // Search states
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");

  // Edit/Delete selection states
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<Order | null>(null);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);
  const [selectedCustomerForEdit, setSelectedCustomerForEdit] = useState<Customer | null>(null);

  // Handlers
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return;
    setLoading(true);
    try {
      const res = await createCustomer(customerName);
      if (res.success) {
        toast.success("Müşteri/Firma kartı başarıyla açıldı.");
        setCustomersList(prev => [...prev, { id: res.id, name: customerName.trim() }]);
        setCustomerName("");
        setShowCustomerModal(false);
      }
    } catch (e: any) {
      toast.error(e.message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.customerId || !orderForm.productId || orderForm.quantity <= 0) {
      toast.warning("Lütfen tüm alanları doldurun.");
      return;
    }
    setLoading(true);
    try {
      const res = await createOrder(orderForm);
      if (res.success) {
        toast.success("Sipariş pazarlama onay bekleyenlerine eklendi.");
        router.refresh();
        setShowOrderModal(false);
        // Force refresh listing
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Sipariş oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    setLoading(true);
    try {
      const res = await approveOrder(orderId);
      if (res.success) {
        toast.success("Sipariş onaylandı ve üretime mail gönderildi!");
        router.refresh();
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Sipariş onaylanırken hata.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.customerId) {
      toast.warning("Ürün adı ve firma zorunludur.");
      return;
    }
    setLoading(true);
    try {
      const res = await createFinishedProduct({
        name: productForm.name,
        customerId: productForm.customerId,
        attributes: {
          temelUrun: productForm.temelUrun,
          cesit: productForm.cesit,
          cap: productForm.cap,
          paketIci: Number(productForm.paketIci),
          koliIci: Number(productForm.koliIci),
          gramaj: Number(productForm.gramaj),
        },
        unQty: Number(productForm.unQty),
        margarinQty: Number(productForm.margarinQty),
        katkiId: productForm.katkiId,
        katkiQty: Number(productForm.katkiQty),
        koliId: productForm.koliId,
        posetId: productForm.posetId,
        wastePercentage: Number(productForm.wastePercentage),
        unitPrice: Number(productForm.unitPrice),
      });

      if (res.success) {
        toast.success("Yeni ürün kartı ve BOM reçetesi başarıyla kaydedildi.");
        setShowProductModal(false);
        router.refresh();
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Ürün kartı oluşturulurken hata.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCustomer = async (id: string, name: string) => {
    setLoading(true);
    try {
      const res = await updateCustomer(id, name);
      if (res.success) {
        toast.success("Müşteri ismi güncellendi.");
        setCustomersList(prev => prev.map(c => c.id === id ? { ...c, name } : c));
        setSelectedCustomerForEdit(null);
      }
    } catch (e: any) {
      toast.error(e.message || "Güncellenirken hata.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Bu müşteriyi silmek istediğinize emin misiniz?")) return;
    setLoading(true);
    try {
      const res = await deleteCustomer(id);
      if (res.success) {
        toast.success("Müşteri silindi.");
        setCustomersList(prev => prev.filter(c => c.id !== id));
      }
    } catch (e: any) {
      toast.error(e.message || "Silinirken hata.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForEdit) return;
    setLoading(true);
    try {
      const res = await updateOrder(selectedOrderForEdit.id, {
        customerId: selectedOrderForEdit.customerId,
        productId: selectedOrderForEdit.productId,
        quantity: Number(selectedOrderForEdit.quantity),
        expectedDeliveryDate: selectedOrderForEdit.expectedDeliveryDate,
        status: selectedOrderForEdit.status,
      });
      if (res.success) {
        toast.success("Sipariş başarıyla güncellendi.");
        setSelectedOrderForEdit(null);
        router.refresh();
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (e: any) {
      toast.error(e.message || "Güncellenirken hata.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm("Bu siparişi silmek istediğinize emin misiniz? Planı ve lojistik kaydı da silinecektir.")) return;
    setLoading(true);
    try {
      const res = await deleteOrder(id);
      if (res.success) {
        toast.success("Sipariş silindi.");
        setOrdersList(prev => prev.filter(o => o.id !== id));
        router.refresh();
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (e: any) {
      toast.error(e.message || "Silinirken hata.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForEdit) return;
    setLoading(true);
    try {
      const res = await updateFinishedProduct(selectedProductForEdit.id, {
        name: selectedProductForEdit.name,
        unitPrice: Number(selectedProductForEdit.unitPrice),
        averageWastePercentage: Number(selectedProductForEdit.averageWastePercentage),
        musteri: selectedProductForEdit.attributes.musteri,
        temelUrun: selectedProductForEdit.attributes.temelUrun,
        cesit: selectedProductForEdit.attributes.cesit,
        cap: selectedProductForEdit.attributes.cap,
        paketIci: Number(selectedProductForEdit.attributes.paketIci),
        koliIci: Number(selectedProductForEdit.attributes.koliIci),
        gramaj: Number(selectedProductForEdit.attributes.gramaj),
      });
      if (res.success) {
        toast.success("Ürün başarıyla güncellendi.");
        setSelectedProductForEdit(null);
        router.refresh();
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (e: any) {
      toast.error(e.message || "Güncellenirken hata.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Bu ürünü ve reçetesini silmek istediğinize emin misiniz?")) return;
    setLoading(true);
    try {
      const res = await deleteProduct(id);
      if (res.success) {
        toast.success("Ürün silindi.");
        setProductsList(prev => prev.filter(p => p.id !== id));
        router.refresh();
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (e: any) {
      toast.error(e.message || "Silinirken hata.");
    } finally {
      setLoading(false);
    }
  };

  // Filter materials
  const koliler = initialData.rawMaterials.filter(m => m.categoryId === "cat-koli");
  const posetler = initialData.rawMaterials.filter(m => m.categoryId === "cat-poset");
  const katkilar = initialData.rawMaterials.filter(m => m.categoryId === "cat-katki");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 p-1.5 rounded-2xl gap-2 w-fit">
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
            activeTab === "orders"
              ? "bg-indigo-600 text-white font-black shadow-lg shadow-indigo-650/25"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          📋 Sipariş Yönetimi ({ordersList.length})
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
            activeTab === "products"
              ? "bg-indigo-600 text-white font-black shadow-lg shadow-indigo-650/25"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          🏷️ Ürün Kartları & Maliyet Analizi ({productsList.length})
        </button>
      </div>

      {/* Tab Content 1: Orders */}
      {activeTab === "orders" && (() => {
        const filteredOrders = ordersList.filter(o => 
          o.customerName.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
          o.productName.toLowerCase().includes(orderSearchQuery.toLowerCase())
        );

        return (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-white">Sipariş Kayıtları</h2>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Siparişlerde arama yapın..."
                  value={orderSearchQuery}
                  onChange={e => setOrderSearchQuery(e.target.value)}
                  className="px-4 py-2 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="px-4 py-2 text-xs font-semibold text-orange-400 border border-orange-500/30 rounded-xl hover:bg-orange-500/10 transition"
                >
                  🏢 Yeni Müşteri/Firma Ekle
                </button>
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/20 transition"
                >
                  ➕ Yeni Sipariş Gir
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 rounded-l-xl">Müşteri</th>
                    <th className="p-4">Ürün</th>
                    <th className="p-4">Miktar (Koli)</th>
                    <th className="p-4">Tarih</th>
                    <th className="p-4">Termin</th>
                    <th className="p-4">Durum</th>
                    <th className="p-4 rounded-r-xl text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-800/10 transition">
                      <td className="p-4 font-semibold text-white">{order.customerName}</td>
                      <td className="p-4">{order.productName}</td>
                      <td className="p-4">{order.quantity} Koli</td>
                      <td className="p-4 text-xs text-slate-500">
                        {new Date(order.orderedAt).toLocaleDateString("tr-TR")}
                      </td>
                      <td className="p-4 text-xs text-orange-400 font-medium">
                        {order.expectedDeliveryDate
                          ? new Date(order.expectedDeliveryDate).toLocaleDateString("tr-TR")
                          : "Girilmedi"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            order.status === "pending"
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : order.status === "approved"
                              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              : order.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                          }`}
                        >
                          {order.status === "pending"
                            ? "Onay Bekliyor"
                            : order.status === "approved"
                            ? "Onaylandı / Üretime Gönderildi"
                            : order.status === "planned"
                            ? "Planlandı"
                            : order.status === "running"
                            ? "Üretimde"
                            : order.status === "completed"
                            ? "Tamamlandı"
                            : "Sevk Edildi"}
                        </span>
                      </td>
                      <td className="p-4 text-right flex justify-end gap-2 items-center">
                        {order.status === "pending" && (
                          <button
                            onClick={() => handleApproveOrder(order.id)}
                            className="px-2.5 py-1.5 text-[10px] font-bold text-slate-950 bg-emerald-450 hover:bg-emerald-400 rounded-lg transition"
                          >
                            Onayla
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedOrderForEdit(order)}
                          className="px-2.5 py-1.5 text-[10px] font-bold text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 rounded-lg transition"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="px-2.5 py-1.5 text-[10px] font-bold text-rose-455 border border-rose-500/20 hover:bg-rose-500/10 rounded-lg transition"
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Kayıtlı sipariş bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Tab Content 2: Product Cards & Cost Analysis */}
      {activeTab === "products" && (() => {
        const filteredProducts = productsList.filter(p => 
          p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
          (p.attributes?.musteri || "").toLowerCase().includes(productSearchQuery.toLowerCase())
        );

        return (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-white">Mamul Kartları ve Karlılık Analizleri</h2>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Mamullerde arama yapın..."
                  value={productSearchQuery}
                  onChange={e => setProductSearchQuery(e.target.value)}
                  className="px-4 py-2 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => setShowProductModal(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl hover:from-orange-600 hover:to-amber-700 shadow-md transition shrink-0"
                >
                  ➕ Yeni Mamul Kartı Aç
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 rounded-l-xl">Ürün / Müşteri</th>
                    <th className="p-4">Çeşit</th>
                    <th className="p-4">Ölçü/Çap</th>
                    <th className="p-4">Hedef Fiyat (Satış)</th>
                    <th className="p-4">BOM Maliyeti</th>
                    <th className="p-4">Fire (% / Tutar)</th>
                    <th className="p-4">Toplam Birim Maliyet</th>
                    <th className="p-4">Brüt Kâr Marjı</th>
                    <th className="p-4">Durum</th>
                    <th className="p-4 rounded-r-xl text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredProducts.map(prod => {
                    const profit = prod.unitPrice - prod.costAnalysis.unitCost;
                    const profitPct = prod.unitPrice > 0 ? (profit / prod.unitPrice) * 100 : 0;
                    const isLowProfit = profitPct < 10;

                    return (
                      <tr key={prod.id} className="hover:bg-slate-800/10 transition">
                        <td className="p-4">
                          <div className="font-semibold text-white">{prod.name}</div>
                          <div className="text-[10px] text-slate-500">Müşteri: {prod.attributes?.musteri || "Genel"}</div>
                        </td>
                        <td className="p-4 text-xs">{prod.attributes?.cesit || "-"}</td>
                        <td className="p-4 text-xs">{prod.attributes?.cap || "-"}</td>
                        <td className="p-4 font-semibold text-indigo-400">
                          ₺{prod.unitPrice.toFixed(2)}
                        </td>
                        <td className="p-4 text-slate-400">
                          ₺{prod.costAnalysis.componentsCost.toFixed(2)}
                        </td>
                        <td className="p-4 text-xs text-slate-400">
                          %{prod.averageWastePercentage} (₺{prod.costAnalysis.wasteAmount.toFixed(2)})
                        </td>
                        <td className="p-4 font-semibold text-amber-500">
                          ₺{prod.costAnalysis.unitCost.toFixed(2)}
                        </td>
                        <td
                          className={`p-4 font-bold ${
                            profit >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          ₺{profit.toFixed(2)} ({profitPct.toFixed(1)}%)
                        </td>
                        <td className="p-4">
                          {profit < 0 ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-lg shadow-rose-500/10">
                              🚨 ZARARINA SATIŞ!
                            </span>
                          ) : isLowProfit ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              ⚠️ DÜŞÜK KÂR
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              🟢 SAĞLIKLI KÂR
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2 items-center">
                          <button
                            onClick={() => setSelectedProductForEdit(prod)}
                            className="px-2.5 py-1.5 text-[10px] font-bold text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 rounded-lg transition"
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="px-2.5 py-1.5 text-[10px] font-bold text-rose-455 border border-rose-500/20 hover:bg-rose-500/10 rounded-lg transition"
                          >
                            Sil
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500 text-xs">
                        Bu aramaya uygun mamul bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* MODAL 1: Müşteri Ekle & CRUD */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="premium-modal w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-white mb-4">🏢 Yeni Müşteri/Firma Kartı Aç</h3>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Firma Adı</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
                  placeholder="Örn: Nimet Unlu Mamüller"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition"
                >
                  {loading ? "Ekleniyor..." : "Firma Kartı Aç"}
                </button>
              </div>
            </form>

            {/* Customer List with inline CRUD */}
            <div className="border-t border-slate-800 pt-4 mt-4">
              <h4 className="text-xs font-bold text-slate-350 mb-2">Mevcut Müşteriler</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {customersList.map(c => {
                  const isEditing = selectedCustomerForEdit?.id === c.id;
                  return (
                    <div key={c.id} className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      {isEditing ? (
                        <input
                          type="text"
                          defaultValue={c.name}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              handleUpdateCustomer(c.id, e.currentTarget.value);
                            }
                          }}
                          className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                          autoFocus
                        />
                      ) : (
                        <span className="text-xs text-white">{c.name}</span>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedCustomerForEdit(isEditing ? null : c)}
                          className="text-[10px] text-orange-400 hover:underline"
                        >
                          {isEditing ? "Vazgeç" : "Düzenle"}
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(c.id)}
                          className="text-[10px] text-rose-455 hover:underline"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* EDIT ORDER MODAL */}
      {selectedOrderForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="premium-modal w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-white mb-2">📝 Siparişi Düzenle</h3>
            <form onSubmit={handleUpdateOrder} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Müşteri / Firma</label>
                <select
                  value={selectedOrderForEdit.customerId}
                  onChange={e => setSelectedOrderForEdit({ ...selectedOrderForEdit, customerId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                >
                  {customersList.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Mamul Ürün</label>
                <select
                  value={selectedOrderForEdit.productId}
                  onChange={e => setSelectedOrderForEdit({ ...selectedOrderForEdit, productId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                >
                  {productsList.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Sipariş Miktarı (Koli)</label>
                <input
                  type="number"
                  value={selectedOrderForEdit.quantity}
                  onChange={e => setSelectedOrderForEdit({ ...selectedOrderForEdit, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Tahmini Teslimat Tarihi</label>
                <input
                  type="date"
                  value={selectedOrderForEdit.expectedDeliveryDate ? selectedOrderForEdit.expectedDeliveryDate.split("T")[0] : ""}
                  onChange={e => setSelectedOrderForEdit({ ...selectedOrderForEdit, expectedDeliveryDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForEdit(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-650 rounded-xl hover:bg-indigo-600 transition"
                >
                  {loading ? "Kaydediliyor..." : "Siparişi Güncelle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {selectedProductForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="premium-modal w-full max-w-lg p-6 space-y-4 my-8">
            <h3 className="text-lg font-bold text-white mb-2">📝 Ürün Kartını Düzenle</h3>
            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ürün Adı</label>
                <input
                  type="text"
                  required
                  value={selectedProductForEdit.name}
                  onChange={e => setSelectedProductForEdit({ ...selectedProductForEdit, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Satış Fiyatı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedProductForEdit.unitPrice}
                    onChange={e => setSelectedProductForEdit({ ...selectedProductForEdit, unitPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fire Oranı (%)</label>
                  <input
                    type="number"
                    value={selectedProductForEdit.averageWastePercentage}
                    onChange={e => setSelectedProductForEdit({ ...selectedProductForEdit, averageWastePercentage: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Temel Ürün</label>
                  <input
                    type="text"
                    value={selectedProductForEdit.attributes?.temelUrun || ""}
                    onChange={e => setSelectedProductForEdit({
                      ...selectedProductForEdit,
                      attributes: { ...selectedProductForEdit.attributes, temelUrun: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Çeşit</label>
                  <input
                    type="text"
                    value={selectedProductForEdit.attributes?.cesit || ""}
                    onChange={e => setSelectedProductForEdit({
                      ...selectedProductForEdit,
                      attributes: { ...selectedProductForEdit.attributes, cesit: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Ölçü/Çap</label>
                  <input
                    type="text"
                    value={selectedProductForEdit.attributes?.cap || ""}
                    onChange={e => setSelectedProductForEdit({
                      ...selectedProductForEdit,
                      attributes: { ...selectedProductForEdit.attributes, cap: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Paket İçi Adet</label>
                  <input
                    type="number"
                    value={selectedProductForEdit.attributes?.paketIci || 10}
                    onChange={e => setSelectedProductForEdit({
                      ...selectedProductForEdit,
                      attributes: { ...selectedProductForEdit.attributes, paketIci: Number(e.target.value) }
                    })}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Koli İçi Adet</label>
                  <input
                    type="number"
                    value={selectedProductForEdit.attributes?.koliIci || 100}
                    onChange={e => setSelectedProductForEdit({
                      ...selectedProductForEdit,
                      attributes: { ...selectedProductForEdit.attributes, koliIci: Number(e.target.value) }
                    })}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Ürün Gramajı (g)</label>
                  <input
                    type="number"
                    value={selectedProductForEdit.attributes?.gramaj || 25}
                    onChange={e => setSelectedProductForEdit({
                      ...selectedProductForEdit,
                      attributes: { ...selectedProductForEdit.attributes, gramaj: Number(e.target.value) }
                    })}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedProductForEdit(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-650 rounded-xl hover:bg-indigo-600 transition"
                >
                  {loading ? "Kaydediliyor..." : "Kartı Güncelle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Sipariş Gir */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="premium-modal w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-bold text-white mb-4">➕ Yeni Sipariş Kaydı</h3>
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Alıcı Müşteri/Firma</label>
                  <select
                    required
                    value={orderForm.customerId}
                    onChange={e => setOrderForm(prev => ({ ...prev, customerId: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                  >
                    <option value="">Firma Seçin...</option>
                    {customersList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Talep Edilen Ürün</label>
                  <select
                    required
                    value={orderForm.productId}
                    onChange={e => setOrderForm(prev => ({ ...prev, productId: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                  >
                    <option value="">Ürün Seçin...</option>
                    {productsList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Sipariş Miktarı (Koli)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={orderForm.quantity}
                    onChange={e => setOrderForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Beklenen Teslimat (Temrin)</label>
                  <input
                    type="date"
                    required
                    value={orderForm.expectedDeliveryDate}
                    onChange={e => setOrderForm(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition"
                >
                  {loading ? "Kaydediliyor..." : "Sipariş Kaydını Gir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Reçete ve Kart Oluştur */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="premium-modal w-full max-w-2xl p-6 space-y-4 my-8">
            <h3 className="text-lg font-bold text-white mb-4">🏷️ Yeni Ürün Kartı & BOM Tanımı</h3>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              
              {/* Bölüm 1: Genel */}
              <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wide">Genel Bilgiler</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Ürün Adı</label>
                    <input
                      type="text"
                      required
                      value={productForm.name}
                      onChange={e => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                      placeholder="Örn: Nimet Lavaş 25cm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Firma / Müşteri</label>
                    <select
                      required
                      value={productForm.customerId}
                      onChange={e => setProductForm(prev => ({ ...prev, customerId: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                    >
                      <option value="">Firma Seçin...</option>
                      {customersList.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Bölüm 2: Özellikler */}
              <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wide">Ürün Özellikleri</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Temel Ürün</label>
                    <input
                      type="text"
                      value={productForm.temelUrun}
                      onChange={e => setProductForm(prev => ({ ...prev, temelUrun: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                      placeholder="Lavaş"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Çeşit</label>
                    <input
                      type="text"
                      value={productForm.cesit}
                      onChange={e => setProductForm(prev => ({ ...prev, cesit: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                      placeholder="Sade"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Çap</label>
                    <input
                      type="text"
                      value={productForm.cap}
                      onChange={e => setProductForm(prev => ({ ...prev, cap: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                      placeholder="25cm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Gramaj (gr)</label>
                    <input
                      type="number"
                      value={productForm.gramaj}
                      onChange={e => setProductForm(prev => ({ ...prev, gramaj: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Paket İçi (Adet)</label>
                    <input
                      type="number"
                      value={productForm.paketIci}
                      onChange={e => setProductForm(prev => ({ ...prev, paketIci: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Koli İçi (Adet)</label>
                    <input
                      type="number"
                      value={productForm.koliIci}
                      onChange={e => setProductForm(prev => ({ ...prev, koliIci: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Fire Oranı (%)</label>
                    <input
                      type="number"
                      value={productForm.wastePercentage}
                      onChange={e => setProductForm(prev => ({ ...prev, wastePercentage: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Satış Fiyatı (Hedef)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.unitPrice}
                      onChange={e => setProductForm(prev => ({ ...prev, unitPrice: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Bölüm 3: Reçete (BOM) Malzemeleri */}
              <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wide">BOM Reçete Yapılandırması (Koli Başına)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Buğday Unu (Kg/Koli)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={productForm.unQty}
                      onChange={e => setProductForm(prev => ({ ...prev, unQty: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Margarin / Yağ (Kg/Koli)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={productForm.margarinQty}
                      onChange={e => setProductForm(prev => ({ ...prev, margarinQty: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Ambalaj Kolisi</label>
                    <select
                      value={productForm.koliId}
                      onChange={e => setProductForm(prev => ({ ...prev, koliId: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                    >
                      <option value="">Koli Kartı Seçin...</option>
                      {koliler.map(k => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Ambalaj Poşeti</label>
                    <select
                      value={productForm.posetId}
                      onChange={e => setProductForm(prev => ({ ...prev, posetId: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                    >
                      <option value="">Poşet Kartı Seçin...</option>
                      {posetler.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Katkı Maddesi</label>
                    <select
                      value={productForm.katkiId}
                      onChange={e => setProductForm(prev => ({ ...prev, katkiId: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                    >
                      <option value="">Katkı Seçin...</option>
                      {katkilar.map(k => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Katkı Miktarı (Kg/Koli)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={productForm.katkiQty}
                      onChange={e => setProductForm(prev => ({ ...prev, katkiQty: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition"
                >
                  {loading ? "Hesaplanıyor..." : "Reçeteyi & Kartı Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
