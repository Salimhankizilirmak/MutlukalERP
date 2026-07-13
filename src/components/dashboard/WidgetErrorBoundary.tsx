"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class WidgetErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Sonraki render'da hata arayüzünü göstermek için state'i güncelle
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Widget Hatası Yakalandı:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="premium-card p-8 flex flex-col items-center justify-center text-center h-[350px] border border-rose-500/20 bg-rose-500/5 rounded-2xl select-none animate-fadeIn">
          <div className="w-12 h-12 flex items-center justify-center bg-rose-500/10 rounded-2xl mb-4 border border-rose-500/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-rose-400">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h4 className="text-sm font-extrabold text-rose-300">Widget Yüklenemedi</h4>
          <p className="text-[10px] text-rose-400/80 mt-1 max-w-[200px] leading-relaxed">
            Lütfen sayfayı yenileyin veya sistem yöneticinize bildirin.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
