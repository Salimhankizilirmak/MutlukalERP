"use client";

import React, { useState, useRef, useEffect } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { saveDashboardLayoutAction, resetDashboardLayoutAction } from "@/actions/erp-actions";
import StockStatusWidget from "./widgets/StockStatusWidget";
import ActiveOrdersWidget from "./widgets/ActiveOrdersWidget";
import DashboardHeader from "./DashboardHeader";
import { toast } from "sonner";
import WidgetErrorBoundary from "./WidgetErrorBoundary";

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
    // 1) Debounce kuyruğunda bekleyen kaydetme işlemini tamamen iptal et (clearTimeout)
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

  // Temizleme işlemi
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Sayfa Üst Başlığı, Eşitleme Göstergesi ve Sıfırlama Butonu */}
      <DashboardHeader 
        username={username}
        status={syncStatus}
        onReset={handleReset}
        isResetting={isResetting}
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
