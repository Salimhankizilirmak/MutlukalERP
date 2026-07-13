"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveMailConfiguration, deleteMailConfiguration } from "@/actions/erp-actions";
import { toast } from "sonner";

interface MailConfig {
  id: string;
  email: string;
  fullName: string;
  alertType: string;
}

interface MailSettingsClientProps {
  initialData: MailConfig[];
}

export default function MailSettingsClient({ initialData }: MailSettingsClientProps) {
  const router = useRouter();
  const [list, setList] = useState<MailConfig[]>(initialData);
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    alertType: "marketing_approval",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.fullName || !form.alertType) {
      toast.warning("Lütfen tüm alanları doldurun.");
      return;
    }
    setLoading(true);

    try {
      const res = await saveMailConfiguration(form.email, form.fullName, form.alertType);
      if (res.success) {
        toast.success("E-posta bildirim alıcısı başarıyla eklendi.");
        setForm({ email: "", fullName: "", alertType: "marketing_approval" });
        router.refresh();
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu e-posta kaydını silmek istediğinize emin misiniz?")) return;
    setLoading(true);
    try {
      const res = await deleteMailConfiguration(id);
      if (res.success) {
        toast.success("E-posta kaydı silindi.");
        setList(prev => prev.filter(item => item.id !== id));
        router.refresh();
      }
    } catch (e: any) {
      toast.error(e.message || "Silinemedi.");
    } finally {
      setLoading(false);
    }
  };

  const alertLabels: Record<string, string> = {
    marketing_approval: "📈 Pazarlama Sipariş Onayı (Üretime Bildir)",
    stock_shortage: "⚠️ Üretim Stok Eksikliği (Satın Almaya Bildir)",
    purchase_lead: "🚚 Satın Alma Temrin Güncellemesi (Üretime Bildir)",
    logistic_arrival: "🚛 Lojistik Araç Geliş Bildirimi (Üretime Bildir)",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      
      {/* Left panel: Add config */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <h3 className="text-base font-bold text-white mb-4">Yeni Bildirim Alıcısı Tanımla</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Alıcı Adı Soyadı</label>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={e => setForm(prev => ({ ...prev, fullName: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
              placeholder="Örn: Ahmet Üretim"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">E-posta Adresi</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
              placeholder="ahmet@mutlukal.com.tr"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Hangi Olayda Mail Alsın?</label>
            <select
              required
              value={form.alertType}
              onChange={e => setForm(prev => ({ ...prev, alertType: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
            >
              <option value="marketing_approval">📈 Pazarlama Sipariş Onayı (Üretime Bildir)</option>
              <option value="stock_shortage">⚠️ Üretim Stok Eksikliği (Satın Almaya Bildir)</option>
              <option value="purchase_lead">🚚 Satın Alma Temrin Güncellemesi (Üretime Bildir)</option>
              <option value="logistic_arrival">🚛 Lojistik Araç Geliş Bildirimi (Üretime Bildir)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-xs font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition"
          >
            Alıcıyı Kaydet
          </button>
        </form>
      </div>

      {/* Right panel: Config list */}
      <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <h3 className="text-base font-bold text-white mb-4 font-semibold">Aktif Mail Alıcı Listesi</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/50 text-slate-400 text-xs">
              <tr>
                <th className="p-3 rounded-l-lg">Alıcı Adı</th>
                <th className="p-3">E-posta</th>
                <th className="p-3">Bildirim Olayı</th>
                <th className="p-3 rounded-r-lg text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {list.map(item => (
                <tr key={item.id} className="hover:bg-slate-800/10">
                  <td className="p-3 font-semibold text-white">{item.fullName}</td>
                  <td className="p-3 text-xs">{item.email}</td>
                  <td className="p-3 text-xs text-orange-400 font-medium">
                    {alertLabels[item.alertType] || item.alertType}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={loading}
                      className="px-2.5 py-1 text-[10px] font-bold text-rose-400 border border-rose-500/20 hover:bg-rose-500/10 rounded-md transition"
                    >
                      Kaldır
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    Kayıtlı e-posta alıcısı bulunamadı. (Sistem varsayılan alıcılara mail gönderecektir)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
