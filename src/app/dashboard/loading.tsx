import React from "react";
import WidgetSkeleton from "@/components/dashboard/widgets/WidgetSkeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Başlık İskeleti */}
      <div>
        <div className="w-56 h-8 rounded-xl bg-slate-800/40 animate-pulse mb-2" />
        <div className="w-80 h-4 rounded-md bg-slate-800/20 animate-pulse" />
      </div>

      {/* Kontrol Şeridi İskeleti */}
      <div className="w-full h-11 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse" />

      {/* Widget Izgarası İskeleti */}
      <div className="flex flex-col md:flex-row gap-6">
        <WidgetSkeleton className="w-full md:flex-1" />
        <WidgetSkeleton className="w-full md:flex-1" />
      </div>
    </div>
  );
}
