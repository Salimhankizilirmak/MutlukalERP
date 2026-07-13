"use client";

import React, { useState, useRef } from "react";
import { ExcelSyncEngine, SyncRowResult } from "@/lib/excel/ExcelSyncEngine";
import { importExcelStocksAction } from "@/actions/erp-actions";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ExcelUploadModal({ isOpen, onClose, onSuccess }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<SyncRowResult[]>([]);
  const [hasErrors, setHasErrors] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Sürükle Bırak Olayları
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  // Excel dosyasını istemci tarafında parse etme
  const processFile = async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Lütfen sadece *.xlsx veya *.xls uzantılı Excel dosyaları yükleyin.");
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        
        // ExcelSyncEngine ile doğrula
        const syncResult = ExcelSyncEngine.parseAndSync(base64);
        setResults(syncResult.results);
        setHasErrors(syncResult.hasError);
        setIsProcessing(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      toast.error("Dosya okunurken hata oluştu.");
      setIsProcessing(false);
    }
  };

  // Doğrulanan verileri veritabanına aktarma
  const handleConfirmImport = async () => {
    if (hasErrors) {
      toast.error("Lütfen veritabanına aktarmadan önce hatalı satırları düzeltin.");
      return;
    }

    setIsImporting(true);
    try {
      const validRows = results
        .filter((r) => !r.error && r.data)
        .map((r) => r.data!);

      const res = await importExcelStocksAction(validRows);
      if (res.success) {
        toast.success("Excel stok verileri başarıyla senkronize edildi! ✓");
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error("Veriler aktarılırken hata oluştu: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetModal = () => {
    setResults([]);
    setHasErrors(false);
    setFileName("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none animate-fadeIn">
      <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-900">
          <div>
            <h3 className="text-base font-extrabold text-white">Excel ile Çift Yönlü Stok Eşitleme</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Stok şablonunuzu yükleyin, kontrol edin ve eşitleyin</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {fileName === "" ? (
            // Sürükle Bırak Yükleme Alanı
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                dragActive
                  ? "border-indigo-500 bg-indigo-500/5"
                  : "border-slate-800 hover:border-slate-700 bg-slate-900/10"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 flex items-center justify-center bg-indigo-500/10 rounded-2xl mb-4 border border-indigo-500/20 text-indigo-400">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
              </div>
              <h4 className="text-xs font-extrabold text-white">Excel dosyasını sürükleyin veya seçin</h4>
              <p className="text-[9px] text-slate-500 mt-1">Sadece *.xlsx veya *.xls dosyaları (Maks 10MB)</p>
            </div>
          ) : (
            // Önizleme ve Doğrulama Alanı
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Seçilen Dosya</div>
                  <div className="text-xs font-extrabold text-white truncate mt-0.5">{fileName}</div>
                </div>
                <button
                  onClick={handleResetModal}
                  className="px-3 py-1.5 text-[10px] font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg cursor-pointer"
                >
                  Dosyayı Değiştir
                </button>
              </div>

              {/* Yükleniyor Göstergesi */}
              {isProcessing && (
                <div className="p-12 text-center">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-400">Dosya çözümleniyor, lütfen bekleyin...</p>
                </div>
              )}

              {/* Doğrulama Listesi */}
              {!isProcessing && results.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                    <span>Satır Bazlı Kontrol Raporu</span>
                    <span className={hasErrors ? "text-rose-400" : "text-emerald-400"}>
                      {hasErrors ? "⚠️ Hatalı Satırlar Bulundu" : "✓ Tüm Satırlar Geçerli"}
                    </span>
                  </div>

                  <div className="border border-slate-900 rounded-2xl divide-y divide-slate-900 max-h-[220px] overflow-y-auto scrollbar-thin">
                    {results.map((res, index) => (
                      <div 
                        key={index} 
                        className={`p-3 flex items-center justify-between text-xs ${
                          res.error ? "bg-rose-500/5 text-rose-300" : "bg-emerald-500/5 text-emerald-300"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold mr-2 border ${
                            res.error ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          }`}>
                            Satır {res.rowNum}
                          </span>
                          <span className="font-medium text-[11px]">
                            {res.error ? res.error : `${res.data?.name} (${res.data?.categoryName})`}
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold flex-shrink-0 ml-3">
                          {res.error ? "Hata" : (res.isNew ? "+ Yeni" : "✎ Güncelle")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-900 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="h-11 px-4 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
          >
            Vazgeç
          </button>
          {fileName !== "" && !isProcessing && (
            <button
              onClick={handleConfirmImport}
              disabled={hasErrors || isImporting}
              className="h-11 px-6 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl cursor-pointer"
            >
              {isImporting ? "Veriler Aktarılıyor..." : "Değişiklikleri Onayla ve Eşitle"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
