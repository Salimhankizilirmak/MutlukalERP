"use client";

import React, { useState, useRef, useEffect } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { saveDashboardLayoutAction } from "@/actions/erp-actions";
import StockStatusWidget from "./widgets/StockStatusWidget";
import ActiveOrdersWidget from "./widgets/ActiveOrdersWidget";
import { toast } from "sonner";
import WidgetErrorBoundary from "./WidgetErrorBoundary";

interface Props {
  role: string;
  initialLayout: string | null;
  initialVersion: number;
  stocksData: any[];
  ordersData: any[];
}

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

export default function WidgetGrid({ role, initialLayout, initialVersion, stocksData, ordersData }: Props) {
  // Rol bazlı varsayılan yerleşim sıralamaları
  const getDefaultLayoutByRole = (userRole: string): string[] => {
    switch (userRole) {
      case "Personel":
        return ["stocks"]; // Personel sadece stok durumunu görebilir (Fiyat/Sipariş yetkisi yok)
      case "Müdür":
      case "Yetkili":
      case "Satın Alma":
      default:
        return ["stocks", "orders"]; // Yetkililer her iki widget'ı da görebilir
    }
  };

  const defaultOrder = initialLayout ? JSON.parse(initialLayout) : getDefaultLayoutByRole(role);
  const [items, setItems] = useState<string[]>(defaultOrder);
  const [isSynced, setIsSynced] = useState(true);
  const [version, setVersion] = useState(initialVersion);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced DB Kaydı ve Offline-First Akışı
  const triggerDebouncedSave = (newLayout: string[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsSynced(false); // Çevrimdışı mod desteği için anında senkronize değil durumuna al

    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await saveDashboardLayoutAction(JSON.stringify(newLayout), version);
        
        if (res.success) {
          setIsSynced(true);
          setVersion(res.version);
          toast.success("Panel düzeni kaydedildi. ✓");
        } else if (res.conflict) {
          // Çatışma çözümü: Buluttaki/Sunucudaki güncel versiyonu ve yerleşimi geri yükle
          toast.warning("Çakışma algılandı. Yerleşim güncellendi.");
          if (res.layoutData) {
            setItems(JSON.parse(res.layoutData));
          }
          if (res.version) {
            setVersion(res.version);
          }
          setIsSynced(true);
        }
      } catch (err: any) {
        // Hata durumunda (örneğin internet kesildiğinde) arayüz kilitlenmez, isSynced false olarak kalır
        console.warn("Çevrimdışı Mod: Değişiklik yerel olarak uygulandı.");
      }
    }, 1000);
  };

  const handleReorder = (newItems: string[]) => {
    setItems(newItems);
    triggerDebouncedSave(newItems);
  };

  // Temizleme işlemi
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Senkronizasyon ve Rol Durum Çubuğu */}
      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 px-4 py-2.5 rounded-2xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span>Yetki Seviyesi: <strong className="text-white">{role}</strong></span>
        </div>

        {/* Offline-First Durum Göstergesi */}
        <div className="flex items-center gap-1.5 text-[10px] font-bold">
          {isSynced ? (
            <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 border border-emerald-500/20 rounded-lg">
              ● Senkronize Edildi
            </span>
          ) : (
            <span className="text-amber-400 bg-amber-500/10 px-2.5 py-1 border border-amber-500/20 rounded-lg animate-pulse">
              ▲ Değişiklikler Kaydediliyor (Çevrimdışı Hazır)
            </span>
          )}
        </div>
      </div>

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
