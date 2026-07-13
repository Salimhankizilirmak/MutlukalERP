"use client";

import React, { useState, useRef, useEffect } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { saveDashboardLayoutAction, resetDashboardLayoutAction, exportExcelStocksAction } from "@/actions/erp-actions";
import StockStatusWidget from "./widgets/StockStatusWidget";
import ActiveOrdersWidget from "./widgets/ActiveOrdersWidget";
import DashboardHeader from "./DashboardHeader";
import ExcelUploadModal from "../excel/ExcelUploadModal";
import { toast } from "sonner";
import WidgetErrorBoundary from "./WidgetErrorBoundary";
import { useRouter } from "next/navigation";

interface Props {
  username: string;
  role: string;
  initialLayout: string | null;
  initialVersion: number;
  stocksData: any[];
  ordersData: any[];
}

type SyncStatus = "synced" | "syncing" | "offline";

function WidgetCardWrapper({ id, value, children }: { id: string; value: string; children: (dragHandleProps: any) => React.ReactNode }) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={dragControls}
      className="list-none w-full md:flex-1 md:min-w-[380px] select-none"
      whileDrag={{ 
        scale: 1.02, 
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(99, 102, 241, 0.15)",
        zIndex: 50 
      }}
      style={{ touchAction: "none" }} // Dokunmatik ekranlarda kaydırma çakışmasını önler (Ahmet Abi)
    >
      {children({
        onPointerDown: (e: React.PointerEvent) => {
          e.preventDefault();
          dragControls.start(e);
        }
      })}
    </Reorder.Item>
  );
}

export default function WidgetGrid({ username, role, initialLayout, initialVersion, stocksData, ordersData }: Props) {
  // Rol bazlı varsayılan yerleşim sıralamaları
  const getDefaultLayoutByRole = (userRole: string): string[] => {
    switch (userRole) {
      case "Personel":
        return ["stocks"];
      default:
        return ["stocks", "orders"];
    }
  };

  const defaultOrder = initialLayout ? JSON.parse(initialLayout) : getDefaultLayoutByRole(role);
  const [items, setItems] = useState<string[]>(defaultOrder);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [version, setVersion] = useState(initialVersion);
  const [isResetting, setIsResetting] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const router = useRouter();
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced DB Kaydı ve Offline-First Akışı
  const triggerDebouncedSave = (newLayout: string[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSyncStatus("syncing"); // Eşitleniyor moduna al (Stripe yavaşça yanıp sönen amber)

    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await saveDashboardLayoutAction(JSON.stringify(newLayout), version);
        
        if (res.success) {
          setSyncStatus("synced");
          setVersion(res.version);
          toast.success("Panel düzeni kaydedildi. ✓");
        } else if (res.conflict) {
          // Çatışma çözümü (Force Sync): Buluttaki/Sunucudaki güncel versiyonu ve yerleşimi geri yükle
          toast.warning("Çakışma algılandı. Sunucu düzeni geri yüklendi.");
          if (res.layoutData) {
            setItems(JSON.parse(res.layoutData));
          }
          if (res.version) {
            setVersion(res.version);
          }
          setSyncStatus("synced");
        }
      } catch (err: any) {
        // Hata veya internet kopmasında durum 'offline' olur (Yerelde Güvende amber göstergesi)
        setSyncStatus("offline");
        console.warn("Çevrimdışı Mod: Değişiklik yerel olarak uygulandı.");
      }
    }, 1000);
  };

  const handleReorder = (newItems: string[]) => {
    setItems(newItems);
    triggerDebouncedSave(newItems);
  };

  // Düzeni Sıfırlama (Reset Layout) Aksiyonu
  const handleReset = async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setIsResetting(true);
    try {
      const res = await resetDashboardLayoutAction();
      if (res.success) {
        setItems(JSON.parse(res.layoutData));
        setVersion(res.version);
        setSyncStatus("synced");
        toast.success("Panel düzeni varsayılan fabrika ayarlarına sıfırlandı. ✓");
      }
    } catch (err: any) {
      toast.error("Düzen sıfırlanırken hata oluştu.");
    } finally {
      setIsResetting(false);
    }
  };

  // Excel Şablonunu İndirme (Export)
  const handleExport = async () => {
    try {
      const res = await exportExcelStocksAction();
      if (res.success && res.base64) {
        const link = document.createElement("a");
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`;
        link.download = `mutlukal_stok_sablonu_${new Date().toISOString().split("T")[0]}.xlsx`;
        link.click();
        toast.success("Excel şablonu başarıyla indirildi. ✓");
      }
    } catch (err) {
      toast.error("Excel şablonu oluşturulurken hata oluştu.");
    }
  };

  // Excel İçe Aktarım Başarı Callback'i (Reaktif Yenileme)
  const handleImportSuccess = () => {
    router.refresh(); // Sayfayı yenilemeden veriyi reaktif olarak sunucudan tekrar çeker
  };

  // Temizleme işlemi
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Sayfa Üst Başlığı, Eşitleme Göstergesi, Excel İşlemleri ve Sıfırlama Butonu */}
      <DashboardHeader 
        username={username}
        status={syncStatus}
        onReset={handleReset}
        isResetting={isResetting}
        onImportClick={() => setIsUploadOpen(true)}
        onExportClick={handleExport}
      />

      {/* Excel Yükleme Önizleme Modali */}
      <ExcelUploadModal 
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleImportSuccess}
      />

      {/* Sürükle Bırak Grubu */}
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={handleReorder}
        className="flex flex-col md:flex-row md:flex-wrap gap-6 p-0 m-0"
      >
        {items.map((itemKey) => {
          if (itemKey === "stocks") {
            return (
              <WidgetCardWrapper key="stocks" id="stocks" value="stocks">
                {(dragHandleProps) => (
                  <WidgetErrorBoundary>
                    <StockStatusWidget stocks={stocksData} dragHandleProps={dragHandleProps} />
                  </WidgetErrorBoundary>
                )}
              </WidgetCardWrapper>
            );
          }

          if (itemKey === "orders" && role !== "Personel") {
            return (
              <WidgetCardWrapper key="orders" id="orders" value="orders">
                {(dragHandleProps) => (
                  <WidgetErrorBoundary>
                    <ActiveOrdersWidget workOrders={ordersData} dragHandleProps={dragHandleProps} />
                  </WidgetErrorBoundary>
                )}
              </WidgetCardWrapper>
            );
          }

          return null;
        })}
      </Reorder.Group>
    </div>
  );
}
