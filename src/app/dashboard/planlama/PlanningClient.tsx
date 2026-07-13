"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateProductionPlanSequence,
  createShiftReport,
  saveMachineCapacity,
  exportWorkOrdersExcel,
  createStockProduct,
  updateProductStock,
  saveBomConnection,
  deleteBomConnection,
  deleteMachineCapacity,
} from "@/actions/erp-actions";
import { toast } from "sonner";

interface Machine {
  id: string;
  name: string;
}

interface Order {
  id: string;
  quantity: number;
  customerName: string;
  productName: string;
  productId: string;
  expectedDeliveryDate: string | null;
  factory?: string;
}

interface PlannedJob {
  id: string;
  machineId: string;
  sequence: number;
  scheduledDate: string;
  estimatedHours: number;
  actualProducedQty: number;
  status: string;
  orderId: string;
  orderQty: number;
  customerName: string;
  productName: string;
  productId: string;
  expectedDeliveryDate: string | null;
  truckArrivalTime: string | null;
  factory?: string;
}

interface Product {
  id: string;
  companyId: string;
  categoryId: string;
  name: string;
  sku: string | null;
  currentStock: number;
  unit: string;
  criticalThreshold: number;
  unitPrice: number;
  averageWastePercentage: number;
  attributes: string | null;
  isActive: boolean;
}

interface ProductTree {
  id: string;
  parentProductId: string;
  childProductId: string;
  quantity: number;
  unit: string;
}

interface Capacity {
  id: string;
  machineId: string;
  productId: string;
  koliPerHour: number;
}

interface PlanningClientProps {
  initialData: {
    machines: Machine[];
    pendingOrders: Order[];
    plannedJobs: PlannedJob[];
    activePOs: any[];
    capacities: Capacity[];
    allProducts: Product[];
    allProductTrees: ProductTree[];
  };
}

type TabType = "board" | "stock" | "bom" | "capacities";
type CategorySlug = "urun" | "koli" | "poset" | "katki" | "sarf";

export default function PlanningClient({ initialData }: PlanningClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("board");

  // Selection states
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [stockCategory, setStockCategory] = useState<CategorySlug>("urun");
  const [bomSelectedParentId, setBomSelectedParentId] = useState<string>("");
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [factoryFilter, setFactoryFilter] = useState<"mutlukal" | "orman">("mutlukal");
  
  // New Search & Edit states for CRUD/Search request
  const [boardSearchQuery, setBoardSearchQuery] = useState("");
  const [bomSearchQuery, setBomSearchQuery] = useState("");
  const [capacitySearchQuery, setCapacitySearchQuery] = useState("");
  const [selectedCapacityForEdit, setSelectedCapacityForEdit] = useState<Capacity | null>(null);

  // Lists state
  const [pendingOrders, setPendingOrders] = useState<Order[]>(initialData.pendingOrders);
  const [plannedJobs, setPlannedJobs] = useState<PlannedJob[]>(initialData.plannedJobs);
  const [allProducts, setAllProducts] = useState<Product[]>(initialData.allProducts);
  const [allProductTrees, setAllProductTrees] = useState<ProductTree[]>(initialData.allProductTrees);
  const [capacities, setCapacities] = useState<Capacity[]>(initialData.capacities);

  // Modals state
  const [selectedPlanForReport, setSelectedPlanForReport] = useState<PlannedJob | null>(null);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);
  const [showProductCreateModal, setShowProductCreateModal] = useState(false);
  const [showBomModal, setShowBomModal] = useState(false);

  // Forms state
  const [shiftForm, setShiftForm] = useState({
    shiftDate: new Date().toISOString().split("T")[0],
    shiftType: "Vardiya 1" as "Vardiya 1" | "Vardiya 2" | "Vardiya 3",
    producedQty: 0,
    wasteQty: 0,
    actualHours: 8.0,
    notes: "",
  });

  const [stockUpdateForm, setStockUpdateForm] = useState({
    quantity: 10,
    type: "in" as "in" | "out" | "adjustment",
    description: "Manuel stok girişi",
  });

  const [productForm, setProductForm] = useState({
    name: "",
    categoryId: "cat-urun",
    sku: "",
    currentStock: 0,
    unit: "Adet",
    criticalThreshold: 10,
    unitPrice: 0,
  });

  const [bomForm, setBomForm] = useState({
    childProductId: "",
    quantity: 1.0,
    unit: "Adet",
  });

  const [capacityForm, setCapacityForm] = useState({
    machineId: "",
    productId: "",
    koliPerHour: 50,
  });

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const categoryIds: Record<CategorySlug, string> = {
    urun: "cat-urun",
    koli: "cat-koli",
    poset: "cat-poset",
    katki: "cat-katki",
    sarf: "cat-sarf",
  };

  const currentProducts = allProducts.filter(
    p =>
      p.categoryId === categoryIds[stockCategory] &&
      (stockSearchQuery === "" || p.name.toLowerCase().includes(stockSearchQuery.toLowerCase()))
  );

  const getJobsForMachine = (machineId: string) => {
    return plannedJobs
      .filter(job => job.machineId === machineId && job.scheduledDate === selectedDate)
      .sort((a, b) => a.sequence - b.sequence);
  };

  // Re-save plan sequence
  const saveSequenceState = async (updatedJobs: PlannedJob[], updatedPending: Order[]) => {
    setLoading(true);
    try {
      const seqRecord: Record<string, Array<{ orderId: string; scheduledDate: string }>> = {};
      initialData.machines.forEach(m => {
        seqRecord[m.id] = [];
      });

      updatedJobs.forEach(job => {
        if (seqRecord[job.machineId]) {
          seqRecord[job.machineId].push({
            orderId: job.orderId,
            scheduledDate: job.scheduledDate,
          });
        }
      });

      const res = await updateProductionPlanSequence(seqRecord);
      if (res.success) {
        toast.success("Üretim plan sıralaması güncellendi.");
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Sıralama güncellenemedi.");
    } finally {
      setLoading(false);
    }
  };

  // Assign order to machine
  const handleAssignToMachine = (order: Order, machineId: string) => {
    if (!machineId) return;
    const newPending = pendingOrders.filter(o => o.id !== order.id);
    const nextSeq = plannedJobs.filter(j => j.machineId === machineId && j.scheduledDate === selectedDate).length;

    const newJob: PlannedJob = {
      id: `temp-${Date.now()}`,
      machineId,
      sequence: nextSeq,
      scheduledDate: selectedDate,
      estimatedHours: order.quantity / 50,
      actualProducedQty: 0,
      status: "scheduled",
      orderId: order.id,
      orderQty: order.quantity,
      customerName: order.customerName,
      productName: order.productName,
      productId: order.productId,
      expectedDeliveryDate: order.expectedDeliveryDate,
      truckArrivalTime: null,
    };

    const newJobs = [...plannedJobs, newJob];
    setPendingOrders(newPending);
    setPlannedJobs(newJobs);
    saveSequenceState(newJobs, newPending);
  };

  // Cancel machine schedule
  const handleRemoveFromMachine = (job: PlannedJob) => {
    const newJobs = plannedJobs.filter(j => j.id !== job.id);
    const restoredOrder: Order = {
      id: job.orderId,
      quantity: job.orderQty,
      customerName: job.customerName,
      productName: job.productName,
      productId: job.productId,
      expectedDeliveryDate: job.expectedDeliveryDate,
    };

    const newPending = [...pendingOrders, restoredOrder];
    setPendingOrders(newPending);
    setPlannedJobs(newJobs);
    saveSequenceState(newJobs, newPending);
  };

  // Move up sequence
  const handleMoveUp = (job: PlannedJob) => {
    const machineJobs = getJobsForMachine(job.machineId);
    const idx = machineJobs.findIndex(j => j.id === job.id);
    if (idx <= 0) return;

    const prevJob = machineJobs[idx - 1];
    const newJobs = plannedJobs.map(j => {
      if (j.id === job.id) return { ...j, sequence: prevJob.sequence };
      if (j.id === prevJob.id) return { ...j, sequence: job.sequence };
      return j;
    });

    setPlannedJobs(newJobs);
    saveSequenceState(newJobs, pendingOrders);
  };

  // Move down sequence
  const handleMoveDown = (job: PlannedJob) => {
    const machineJobs = getJobsForMachine(job.machineId);
    const idx = machineJobs.findIndex(j => j.id === job.id);
    if (idx < 0 || idx >= machineJobs.length - 1) return;

    const nextJob = machineJobs[idx + 1];
    const newJobs = plannedJobs.map(j => {
      if (j.id === job.id) return { ...j, sequence: nextJob.sequence };
      if (j.id === nextJob.id) return { ...j, sequence: job.sequence };
      return j;
    });

    setPlannedJobs(newJobs);
    saveSequenceState(newJobs, pendingOrders);
  };

  // Shift report save
  const handleSaveShiftReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForReport) return;
    setLoading(true);

    try {
      const res = await createShiftReport({
        productionPlanId: selectedPlanForReport.id,
        shiftDate: shiftForm.shiftDate,
        shiftType: shiftForm.shiftType,
        producedQty: Number(shiftForm.producedQty),
        wasteQty: Number(shiftForm.wasteQty),
        actualHours: Number(shiftForm.actualHours),
        notes: shiftForm.notes,
      });

      if (res.success) {
        toast.success("Vardiya raporu girildi, reçete stokları düşüldü!");
        setSelectedPlanForReport(null);
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Vardiya raporu kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  };

  // Create Product card (Stock)
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name) {
      toast.warning("Ürün adı boş olamaz.");
      return;
    }
    setLoading(true);
    try {
      const res = await createStockProduct({
        categoryId: productForm.categoryId,
        name: productForm.name,
        sku: productForm.sku,
        currentStock: Number(productForm.currentStock),
        unit: productForm.unit,
        criticalThreshold: Number(productForm.criticalThreshold),
        unitPrice: Number(productForm.unitPrice),
      });

      if (res.success) {
        toast.success("Kart başarıyla tanımlandı.");
        setShowProductCreateModal(false);
        setProductForm({
          name: "",
          categoryId: "cat-urun",
          sku: "",
          currentStock: 0,
          unit: "Adet",
          criticalThreshold: 10,
          unitPrice: 0,
        });
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Ürün kartı oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  };

  // Update Stock quantity
  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForStock || stockUpdateForm.quantity <= 0) return;
    setLoading(true);

    try {
      const res = await updateProductStock(
        selectedProductForStock.id,
        Number(stockUpdateForm.quantity),
        stockUpdateForm.type,
        stockUpdateForm.description
      );

      if (res.success) {
        toast.success("Stok başarıyla güncellendi.");
        setSelectedProductForStock(null);
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Stok güncellenemedi.");
    } finally {
      setLoading(false);
    }
  };

  // Add BOM connection
  const handleSaveBom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomSelectedParentId || !bomForm.childProductId) return;
    setLoading(true);

    try {
      const res = await saveBomConnection(
        bomSelectedParentId,
        bomForm.childProductId,
        Number(bomForm.quantity),
        bomForm.unit
      );

      if (res.success) {
        toast.success("Reçete bağlantısı başarıyla eklendi/güncellendi.");
        setShowBomModal(false);
        setBomForm({ childProductId: "", quantity: 1.0, unit: "Adet" });
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Bağlantı eklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  // Delete BOM connection
  const handleDeleteBom = async (id: string) => {
    if (!confirm("Bu reçete bağlantısını silmek istediğinize emin misiniz?")) return;
    setLoading(true);

    try {
      const res = await deleteBomConnection(id);
      if (res.success) {
        toast.success("Reçete bağlantısı silindi.");
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Bağlantı silinemedi.");
    } finally {
      setLoading(false);
    }
  };

  // Save machine speed
  const handleSaveCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capacityForm.machineId || !capacityForm.productId) return;
    setLoading(true);

    try {
      const res = await saveMachineCapacity(
        capacityForm.machineId,
        capacityForm.productId,
        Number(capacityForm.koliPerHour)
      );

      if (res.success) {
        toast.success("Hız bilgisi kaydedildi.");
        setCapacityForm({ machineId: "", productId: "", koliPerHour: 50 });
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Hız kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCapacity = async (id: string) => {
    if (!confirm("Bu makine üretim hız kapasite kartını silmek istediğinize emin misiniz?")) return;
    setLoading(true);
    try {
      const res = await deleteMachineCapacity(id);
      if (res.success) {
        toast.success("Kapasite kartı silindi.");
        setCapacities(prev => prev.filter(c => c.id !== id));
      }
    } catch (e: any) {
      toast.error(e.message || "Kapasite silinemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCapacityForEdit) return;
    setLoading(true);
    try {
      const res = await saveMachineCapacity(
        selectedCapacityForEdit.machineId,
        selectedCapacityForEdit.productId,
        Number(selectedCapacityForEdit.koliPerHour)
      );
      if (res.success) {
        toast.success("Kapasite başarıyla güncellendi.");
        setSelectedCapacityForEdit(null);
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (e: any) {
      toast.error(e.message || "Güncellenirken hata.");
    } finally {
      setLoading(false);
    }
  };

  const handleExcelExport = () => {
    toast.success("Excel dosyası hazırlanıyor ve indiriliyor...");
    window.location.href = "/api/export-excel";
  };

  // Stats
  const activeBoms = allProductTrees.filter(t => t.parentProductId === bomSelectedParentId);
  const finishedProducts = allProducts.filter(p => p.categoryId === "cat-urun");
  const componentProducts = allProducts.filter(p => p.categoryId !== "cat-urun");

  return (
    <div className="space-y-6">
      {/* ── Tab Navigation ────────────────────────────────── */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 p-1.5 rounded-2xl gap-2 w-fit">
        {[
          { key: "board", label: "🗓️ Üretim Planlama & İş Emirleri" },
          { key: "stock", label: "📦 Depo & Stok Yönetimi" },
          { key: "bom", label: "🌳 Reçete (BOM) Yönetimi" },
          { key: "capacities", label: "⚡ Makine Üretim Hızları" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            className={`px-6 py-2.5 rounded-xl font-semibold text-xs transition-all ${
              activeTab === tab.key
                ? "bg-indigo-600 text-white font-black shadow-lg shadow-indigo-600/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Üretim Planlama Panosu ───────────────────────────────────────── */}
      {activeTab === "board" && (() => {
        const activeMachines = initialData.machines.filter(m => 
          factoryFilter === "orman" ? m.id.includes("orman") : !m.id.includes("orman")
        );
        const activePending = pendingOrders.filter(o => 
          o.factory === factoryFilter &&
          (o.customerName.toLowerCase().includes(boardSearchQuery.toLowerCase()) ||
           o.productName.toLowerCase().includes(boardSearchQuery.toLowerCase()))
        );
        const hasRecipe = (prodId: string) => 
          allProductTrees.some(t => t.parentProductId === prodId);

        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Factory Selector Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900/60 p-2.5 rounded-2xl border border-slate-800 gap-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setFactoryFilter("mutlukal")}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    factoryFilter === "mutlukal"
                      ? "bg-indigo-650 text-white font-black shadow-lg shadow-indigo-600/30"
                      : "text-slate-450 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  🏢 Mutlukal Üretim Hattı
                </button>
                <button
                  onClick={() => setFactoryFilter("orman")}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    factoryFilter === "orman"
                      ? "bg-indigo-650 text-white font-black shadow-lg shadow-indigo-600/30"
                      : "text-slate-450 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  🌲 Mutlu Orman Üretim Hattı
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pr-2">
                <input
                  type="text"
                  placeholder="İş veya sipariş ara..."
                  value={boardSearchQuery}
                  onChange={e => setBoardSearchQuery(e.target.value)}
                  className="px-3 py-1.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Planlama Günü:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Quick Export Excel */}
            <div className="flex justify-between items-center bg-slate-900/40 border border-slate-800 p-4 rounded-2xl">
              <span className="text-xs text-slate-400">
                Oluşturulan sıralı iş emirlerini üretim biriminin kullanabilmesi için Excel formatında indirin.
              </span>
              <button
                onClick={handleExcelExport}
                disabled={exporting}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition flex items-center gap-2"
              >
                📥 {exporting ? "Excel Oluşturuluyor..." : "İş Emirlerini Excel'e Aktar"}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Unplanned column */}
              <div className="lg:col-span-3 premium-card p-4 space-y-4">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>Planlanmamış Siparişler</span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-xs font-bold">
                      {activePending.length}
                    </span>
                  </h3>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {activePending.map(order => {
                    const isRecipeMissing = !hasRecipe(order.productId);
                    return (
                      <div
                        key={order.id}
                        className="p-3 bg-slate-900/40 border border-slate-800 hover:border-indigo-500/20 rounded-xl transition space-y-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-white truncate">{order.customerName}</div>
                          <div className="text-[11px] text-slate-400 truncate">{order.productName}</div>
                        </div>

                        {isRecipeMissing && (
                          <div className="flex items-center justify-between text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-455 p-2 rounded-lg">
                            <span>⚠️ Reçete Tanımsız!</span>
                            <button
                              onClick={() => {
                                setBomSelectedParentId(order.productId);
                                setActiveTab("bom");
                              }}
                              className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-350 font-bold rounded transition"
                            >
                              Oluştur
                            </button>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500">Miktar: {order.quantity} Koli</span>
                          <span className="text-indigo-400 font-semibold">
                            Termin: {order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString("tr-TR") : "Girilmedi"}
                          </span>
                        </div>
                        
                        <div className="pt-2 border-t border-slate-850">
                          <select
                            onChange={e => handleAssignToMachine(order, e.target.value)}
                            value=""
                            className="w-full text-[10px] py-1.5 bg-slate-850 border border-slate-700 text-indigo-400 font-semibold rounded-lg focus:outline-none"
                          >
                            <option value="">Üretime Ekle...</option>
                            {activeMachines.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                  {activePending.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-600">
                      Planlanacak sipariş yok.
                    </div>
                  )}
                </div>
              </div>

              {/* Lanes */}
              <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                {activeMachines.map(machine => {
                  const jobs = getJobsForMachine(machine.id).filter(j => 
                    j.customerName.toLowerCase().includes(boardSearchQuery.toLowerCase()) ||
                    j.productName.toLowerCase().includes(boardSearchQuery.toLowerCase())
                  );
                  const totalHours = jobs.reduce((sum, j) => sum + j.estimatedHours, 0);

                  return (
                    <div
                      key={machine.id}
                      className="premium-card p-4 space-y-4"
                    >
                      <div className="border-b border-slate-850 pb-3 flex justify-between items-center">
                        <div>
                          <h4 className="text-xs font-bold text-white">{machine.name}</h4>
                          <span className="text-[9px] text-slate-500">
                            {jobs.length} İş | {totalHours.toFixed(1)} Saat
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            totalHours > 16
                              ? "bg-rose-500/10 text-rose-450 border border-rose-500/20"
                              : "bg-indigo-500/10 text-indigo-455 border border-indigo-500/20"
                          }`}
                        >
                          {totalHours > 16 ? "Yoğun" : "Müsait"}
                        </span>
                      </div>

                      <div className="space-y-3 min-h-[300px] max-h-[500px] overflow-y-auto pr-1">
                        {jobs.map((job, idx) => {
                          const isCompleted = job.status === "completed";
                          const isRecipeMissing = !hasRecipe(job.productId);
                          return (
                            <div
                              key={job.id}
                              className={`p-3 border rounded-xl space-y-2.5 transition relative group ${
                                isCompleted
                                  ? "bg-emerald-950/20 border-emerald-900/30 text-slate-500"
                                  : "bg-slate-900/40 border-slate-800 hover:border-indigo-500/30 text-white"
                              }`}
                            >
                              <div className="flex justify-between items-start gap-1">
                                <div>
                                  <span className="text-[9px] text-indigo-450 font-bold block">
                                    #{idx + 1} - {job.customerName}
                                  </span>
                                  <span className="text-xs font-semibold block leading-tight">{job.productName}</span>
                                </div>
                                <button
                                  onClick={() => handleRemoveFromMachine(job)}
                                  className="text-slate-500 hover:text-rose-455 p-0.5 rounded transition text-xs"
                                >
                                  ✕
                                </button>
                              </div>

                              {isRecipeMissing && (
                                <div className="flex items-center justify-between text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2 rounded-lg">
                                  <span>⚠️ Reçete Tanımsız!</span>
                                  <button
                                    onClick={() => {
                                      setBomSelectedParentId(job.productId);
                                      setActiveTab("bom");
                                    }}
                                    className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-350 font-bold rounded transition"
                                  >
                                    Oluştur
                                  </button>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded-lg">
                                <div>
                                  <span className="block text-slate-500 text-[8px] uppercase font-bold">Plan</span>
                                  {job.orderQty} Koli
                                </div>
                                <div>
                                  <span className="block text-slate-500 text-[8px] uppercase font-bold">Üretilen</span>
                                  {job.actualProducedQty} Koli
                                </div>
                                <div>
                                  <span className="block text-slate-500 text-[8px] uppercase font-bold">Süre</span>
                                  {job.estimatedHours} Saat
                                </div>
                                <div>
                                  <span className="block text-slate-500 text-[8px] uppercase font-bold">Durum</span>
                                  {job.status === "running" ? "Üretimde ⚡" : isCompleted ? "Tamamlandı" : "Sırada"}
                                </div>
                              </div>

                              {job.truckArrivalTime && (
                                <div className="flex items-center gap-1.5 text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-1 rounded-lg">
                                  🚚 Sevkiyat: {new Date(job.truckArrivalTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-1 border-t border-slate-850">
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveUp(job)}
                                    disabled={idx === 0}
                                    className="p-1 text-[9px] bg-slate-850 rounded border border-slate-750 hover:bg-slate-700 transition"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveDown(job)}
                                    disabled={idx === jobs.length - 1}
                                    className="p-1 text-[9px] bg-slate-850 rounded border border-slate-750 hover:bg-slate-700 transition"
                                  >
                                    ▼
                                  </button>
                                </div>

                                {!isCompleted && (
                                  <button
                                    onClick={() => {
                                      setSelectedPlanForReport(job);
                                      setShiftForm(prev => ({
                                        ...prev,
                                        producedQty: job.orderQty - job.actualProducedQty,
                                      }));
                                    }}
                                    className="px-2.5 py-1 text-[9px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition"
                                  >
                                    Rapor Gir
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── TAB 2: Depo & Stok Yönetimi ─────────────────────────────────────────── */}
      {activeTab === "stock" && (
        <div className="premium-card p-6 space-y-6 animate-fadeIn">
          {/* Sub tabs and Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            
            {/* Category selection tabs */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: "urun", label: "🏭 Mamul Ürünler" },
                { key: "koli", label: "📦 Koliler" },
                { key: "poset", label: "🛍️ Poşetler" },
                { key: "katki", label: "🧪 Katkı Maddeleri" },
                { key: "sarf", label: "🔧 Sarf Malzemeler" },
              ].map(sub => (
                <button
                  key={sub.key}
                  onClick={() => setStockCategory(sub.key as CategorySlug)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    stockCategory === sub.key
                      ? "bg-indigo-650 text-white border border-indigo-550"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Toolbar search & Add button */}
            <div className="flex gap-3 shrink-0">
              <input
                type="text"
                placeholder="Arama yapın..."
                value={stockSearchQuery}
                onChange={e => setStockSearchQuery(e.target.value)}
                className="px-4 py-2 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-550"
              />
              <button
                onClick={() => {
                  setProductForm(prev => ({ ...prev, categoryId: categoryIds[stockCategory] }));
                  setShowProductCreateModal(true);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition"
              >
                ➕ Yeni Kart Tanımla
              </button>
            </div>

          </div>

          {/* Stock Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-850/50 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4 rounded-l-xl">Kart Adı</th>
                  <th className="p-4">SKU / Kod</th>
                  <th className="p-4">Stok Seviyesi</th>
                  <th className="p-4">Kritik Eşik</th>
                  <th className="p-4">Birim Fiyat</th>
                  <th className="p-4 rounded-r-xl text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {currentProducts.map(prod => {
                  const isCritical = prod.currentStock <= prod.criticalThreshold;
                  return (
                    <tr key={prod.id} className="hover:bg-slate-850/10 transition">
                      <td className="p-4 font-semibold text-white">{prod.name}</td>
                      <td className="p-4 text-xs font-mono text-slate-500">{prod.sku || "—"}</td>
                      <td className="p-4 font-semibold text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-md ${
                            isCritical
                              ? "bg-rose-500/10 text-rose-450 border border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-450 border border-emerald-500/20"
                          }`}
                        >
                          {prod.currentStock.toFixed(2)} {prod.unit}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        {prod.criticalThreshold} {prod.unit}
                      </td>
                      <td className="p-4 text-slate-400">₺{prod.unitPrice.toFixed(2)}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedProductForStock(prod);
                            setStockUpdateForm({
                              quantity: 10,
                              type: "in",
                              description: "Stok girişi",
                            });
                          }}
                          className="px-3 py-1.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/10 rounded-lg transition"
                        >
                          Stok Güncelle
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {currentProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                      Bu kategoride kayıtlı kart bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Reçete (BOM) Yönetimi ─────────────────────────────────────────── */}
      {activeTab === "bom" && (
        <div className="premium-card p-6 space-y-6 animate-fadeIn">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Mamul ara..."
                value={bomSearchQuery}
                onChange={e => setBomSearchQuery(e.target.value)}
                className="px-3 py-1.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none"
              />
              <span className="text-xs font-semibold text-slate-400">Mamul Seçin:</span>
              <select
                value={bomSelectedParentId}
                onChange={e => setBomSelectedParentId(e.target.value)}
                className="px-4 py-2 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
              >
                <option value="">Mamul Seçin...</option>
                {finishedProducts
                  .filter(p => p.name.toLowerCase().includes(bomSearchQuery.toLowerCase()))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            {bomSelectedParentId && (
              <button
                onClick={() => setShowBomModal(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition"
              >
                ➕ Reçeteye Bileşen Bağlantısı Ekle
              </button>
            )}
          </div>

          {bomSelectedParentId ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-850/50 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="p-4 rounded-l-xl">Bileşen Adı</th>
                    <th className="p-4">Miktar (Katsayı)</th>
                    <th className="p-4">Birim</th>
                    <th className="p-4 rounded-r-xl text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {activeBoms.map(bom => {
                    const child = allProducts.find(p => p.id === bom.childProductId);
                    return (
                      <tr key={bom.id} className="hover:bg-slate-850/10 transition">
                        <td className="p-4 font-semibold text-white">{child?.name ?? "Bilinmeyen Malzeme"}</td>
                        <td className="p-4 font-bold text-indigo-400">{bom.quantity}</td>
                        <td className="p-4 text-xs text-slate-400">{bom.unit}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteBom(bom.id)}
                            className="px-2.5 py-1 text-[10px] font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 rounded-md transition"
                          >
                            Bağlantıyı Kaldır
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {activeBoms.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 text-xs">
                        Bu mamul ürün için henüz reçete (BOM) bileşenleri tanımlanmamış.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-16 text-center text-slate-500 text-xs">
              Reçete yapısını incelemek ve bileşen eklemek için lütfen yukarıdan bir mamul seçin.
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: Makine Üretim Hızları ─────────────────────────────────────────── */}
      {activeTab === "capacities" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
          {/* Left panel: Add capacity */}
          <div className="premium-card p-6 h-fit">
            <h3 className="text-xs font-bold text-white mb-4">Hız Kapasite Kartı Tanımla</h3>
            <form onSubmit={handleSaveCapacity} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-2">Makine Seçin</label>
                <select
                  required
                  value={capacityForm.machineId}
                  onChange={e => setCapacityForm(prev => ({ ...prev, machineId: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Seçin...</option>
                  {initialData.machines.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-2">Mamul Ürün</label>
                <select
                  required
                  value={capacityForm.productId}
                  onChange={e => setCapacityForm(prev => ({ ...prev, productId: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Seçin...</option>
                  {finishedProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-2">Üretim Hızı (Koli/Saat)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={capacityForm.koliPerHour}
                  onChange={e => setCapacityForm(prev => ({ ...prev, koliPerHour: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition shadow-md shadow-indigo-650/15"
              >
                Kapasite Hızı Kaydet
              </button>
            </form>
          </div>

          {/* Right panel: Listing matrix */}
          <div className="md:col-span-2 premium-card p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold text-white">Ürün Hız Matrisi</h3>
              <input
                type="text"
                placeholder="Makine veya ürün ara..."
                value={capacitySearchQuery}
                onChange={e => setCapacitySearchQuery(e.target.value)}
                className="px-3 py-1.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-850/50 text-slate-400 text-xs">
                  <tr>
                    <th className="p-3 rounded-l-lg">Makine</th>
                    <th className="p-3">Mamul Ürün</th>
                    <th className="p-3">Üretim Hızı</th>
                    <th className="p-3 rounded-r-lg text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {capacities
                    .filter(c => {
                      const m = initialData.machines.find(mac => mac.id === c.machineId);
                      const p = finishedProducts.find(prod => prod.id === c.productId);
                      const query = capacitySearchQuery.toLowerCase();
                      return (
                        (m?.name ?? "").toLowerCase().includes(query) ||
                        (p?.name ?? "").toLowerCase().includes(query)
                      );
                    })
                    .map(c => {
                      const m = initialData.machines.find(mac => mac.id === c.machineId);
                      const p = finishedProducts.find(prod => prod.id === c.productId);
                      return (
                        <tr key={c.id} className="hover:bg-slate-800/10">
                          <td className="p-3 font-semibold text-white">{m?.name ?? "Bilinmeyen"}</td>
                          <td className="p-3 text-xs">{p?.name ?? "Bilinmeyen"}</td>
                          <td className="p-3 text-emerald-400 font-bold">
                            {c.koliPerHour} koli/saat
                          </td>
                          <td className="p-3 text-right flex justify-end gap-2 items-center">
                            <button
                              onClick={() => setSelectedCapacityForEdit(c)}
                              className="px-2 py-1 text-[9px] font-bold text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 rounded transition"
                            >
                              Düzenle
                            </button>
                            <button
                              onClick={() => handleDeleteCapacity(c.id)}
                              className="px-2 py-1 text-[9px] font-bold text-rose-455 border border-rose-500/20 hover:bg-rose-500/10 rounded transition"
                            >
                              Sil
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────── */}
      {/* (Vardiya report modal) */}
      {selectedPlanForReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="premium-modal w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Vardiya Üretim Raporu Gir</h3>
              <p className="text-xs text-slate-400 mt-1">
                {selectedPlanForReport.customerName} - {selectedPlanForReport.productName}
              </p>
            </div>

            <form onSubmit={handleSaveShiftReport} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Rapor Tarihi</label>
                  <input
                    type="date"
                    required
                    value={shiftForm.shiftDate}
                    onChange={e => setShiftForm(prev => ({ ...prev, shiftDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Vardiya Tipi</label>
                  <select
                    required
                    value={shiftForm.shiftType}
                    onChange={e => setShiftForm(prev => ({ ...prev, shiftType: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  >
                    <option value="Vardiya 1">Vardiya 1 (08:00 - 16:00)</option>
                    <option value="Vardiya 2">Vardiya 2 (16:00 - 24:00)</option>
                    <option value="Vardiya 3">Vardiya 3 (24:00 - 08:00)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Üretilen Koli Adedi</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={shiftForm.producedQty}
                    onChange={e => setShiftForm(prev => ({ ...prev, producedQty: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fire (Paket/Koli)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={shiftForm.wasteQty}
                    onChange={e => setShiftForm(prev => ({ ...prev, wasteQty: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Fiili Çalışma Süresi (Saat)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={shiftForm.actualHours}
                  onChange={e => setShiftForm(prev => ({ ...prev, actualHours: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Açıklama / Duruş Nedenleri</label>
                <textarea
                  value={shiftForm.notes}
                  onChange={e => setShiftForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setSelectedPlanForReport(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition"
                >
                  {loading ? "Kaydediliyor..." : "Raporu Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* (Update stock modal) */}
      {selectedProductForStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="premium-modal w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Stok Miktarı Güncelle</h3>
              <p className="text-xs text-slate-400 mt-1">{selectedProductForStock.name}</p>
            </div>

            <form onSubmit={handleUpdateStock} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Güncelleme Tipi</label>
                <select
                  required
                  value={stockUpdateForm.type}
                  onChange={e => setStockUpdateForm(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                >
                  <option value="in">➕ Giriş (Stok Ekle)</option>
                  <option value="out">➖ Çıkış (Stok Eksilt)</option>
                  <option value="adjustment">🔧 Düzeltme (Net Değer Gir)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Miktar ({selectedProductForStock.unit})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min={0.01}
                  value={stockUpdateForm.quantity}
                  onChange={e => setStockUpdateForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Açıklama / Sebebi</label>
                <input
                  type="text"
                  required
                  value={stockUpdateForm.description}
                  onChange={e => setStockUpdateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setSelectedProductForStock(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition"
                >
                  Stoku Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* (Create stock modal) */}
      {showProductCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="premium-modal w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-white">➕ Yeni Malzeme / Stok Kartı Aç</h3>
            
            <form onSubmit={handleCreateProduct} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Kategori</label>
                <select
                  value={productForm.categoryId}
                  onChange={e => setProductForm(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                >
                  <option value="cat-urun">🏭 Mamul Ürünler</option>
                  <option value="cat-koli">📦 Koliler</option>
                  <option value="cat-poset">🛍️ Poşetler</option>
                  <option value="cat-katki">🧪 Katkı Maddeleri</option>
                  <option value="cat-sarf">🔧 Sarf Malzemeler</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Kart Adı</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={e => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">SKU / Stok Kodu</label>
                  <input
                    type="text"
                    value={productForm.sku}
                    onChange={e => setProductForm(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Ölçü Birimi</label>
                  <select
                    value={productForm.unit}
                    onChange={e => setProductForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  >
                    <option value="Adet">Adet</option>
                    <option value="Kg">Kg</option>
                    <option value="Koli">Koli</option>
                    <option value="Rulo">Rulo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Başlangıç Stok</label>
                  <input
                    type="number"
                    value={productForm.currentStock}
                    onChange={e => setProductForm(prev => ({ ...prev, currentStock: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Kritik Eşik</label>
                  <input
                    type="number"
                    value={productForm.criticalThreshold}
                    onChange={e => setProductForm(prev => ({ ...prev, criticalThreshold: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Birim Fiyat (TL)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.unitPrice}
                    onChange={e => setProductForm(prev => ({ ...prev, unitPrice: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowProductCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition"
                >
                  Kartı Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* (Create BOM connection modal) */}
      {showBomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="premium-modal w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-white">➕ Reçeteye Bileşen Ekle</h3>

            <form onSubmit={handleSaveBom} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Tüketilecek Hammadde/Ambalaj</label>
                <select
                  required
                  value={bomForm.childProductId}
                  onChange={e => setBomForm(prev => ({ ...prev, childProductId: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                >
                  <option value="">Seçin...</option>
                  {componentProducts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2">Miktar (1 Koli İçin)</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={bomForm.quantity}
                    onChange={e => setBomForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-2">Ölçü Birimi</label>
                  <select
                    value={bomForm.unit}
                    onChange={e => setBomForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                  >
                    <option value="Adet">Adet</option>
                    <option value="Kg">Kg</option>
                    <option value="Koli">Koli</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowBomModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition"
                >
                  Bağlantıyı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CAPACITY MODAL */}
      {selectedCapacityForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="premium-modal w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-white">📝 Hız Kapasite Kartını Düzenle</h3>
            <form onSubmit={handleUpdateCapacity} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Makine</label>
                <select
                  disabled
                  value={selectedCapacityForEdit.machineId}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs opacity-50 cursor-not-allowed"
                >
                  {initialData.machines.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Mamul Ürün</label>
                <select
                  disabled
                  value={selectedCapacityForEdit.productId}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs opacity-50 cursor-not-allowed"
                >
                  {finishedProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Üretim Hızı (Koli/Saat)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={selectedCapacityForEdit.koliPerHour}
                  onChange={e => setSelectedCapacityForEdit({ ...selectedCapacityForEdit, koliPerHour: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setSelectedCapacityForEdit(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-650 rounded-xl hover:bg-indigo-600 transition"
                >
                  Hızı Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
