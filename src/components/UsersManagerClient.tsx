"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addUserAction, deleteUserAction, toggleUserStatus, resetUserPassword } from "@/actions/users";
import { toast } from "sonner";
import type { SessionPayload } from "@/lib/session";

interface UserItem {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface Props {
  userList: UserItem[];
  session: SessionPayload;
}

export default function UsersManagerClient({ userList, session }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Şifre sıfırlama modal state'leri
  const [resetUserId, setResetUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Ekleme form state'i
  const [openAdd, setOpenAdd] = useState(false);

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`${name} kullanıcısını tamamen silmek istediğinize emin misiniz?`)) return;

    startTransition(async () => {
      const res = await deleteUserAction(id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Kullanıcı silindi ✓");
        router.refresh();
      }
    });
  };

  const handleToggle = (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      const res = await toggleUserStatus(id, currentStatus);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(currentStatus ? "Kullanıcı pasifleştirildi" : "Kullanıcı aktifleştirildi");
        router.refresh();
      }
    });
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      toast.error("Şifre en az 4 karakter olmalıdır.");
      return;
    }

    startTransition(async () => {
      const res = await resetUserPassword(resetUserId, newPassword);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Kullanıcı şifresi başarıyla sıfırlandı ✓");
        setResetModalOpen(false);
        setNewPassword("");
        router.refresh();
      }
    });
  };

  const handleAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await addUserAction(formData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Yeni kullanıcı başarıyla oluşturuldu ✓");
        setOpenAdd(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Üst Bilgi & Ekle Butonu ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-extrabold text-lg">Kullanıcı Yönetimi</h2>
          <p className="text-slate-500 text-xs mt-0.5">Sistemi kullanacak personelleri ve rollerini tanımlayın.</p>
        </div>
        <button
          onClick={() => setOpenAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Kullanıcı Ekle
        </button>
      </div>

      {/* ── Kullanıcı Listesi ────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Ad Soyad</th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Kullanıcı Adı</th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Yetki Rolü</th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Durum</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {userList.map((usr) => (
                <tr key={usr.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                        {(usr.fullName || usr.username).charAt(0)}
                      </div>
                      <span className="text-sm font-semibold text-white">{usr.fullName || "—"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-300 font-medium">@{usr.username}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                      usr.role === "Müdür"
                        ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        : usr.role === "Yetkili"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {usr.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleToggle(usr.id, usr.isActive)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all border ${
                        usr.isActive
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {usr.isActive ? "Aktif" : "Pasif"}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-right space-x-2">
                    <button
                      onClick={() => {
                        setResetUserId(usr.id);
                        setResetModalOpen(true);
                      }}
                      className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      Şifre Değiştir
                    </button>
                    {usr.id !== session.userId && (
                      <button
                        onClick={() => handleDelete(usr.id, usr.fullName || usr.username)}
                        className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
                      >
                        Sil
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Kullanıcı Ekleme Modalı ────────────────────────────────────────── */}
      {openAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpenAdd(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold">Yeni Kullanıcı Ekle</h3>
              <button onClick={() => setOpenAdd(false)} className="text-slate-500 hover:text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Ad Soyad</label>
                <input name="fullName" required placeholder="örn: Ahmet Yılmaz" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Kullanıcı Adı</label>
                <input name="username" required placeholder="örn: ahmetyilmaz" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">İlk Şifre</label>
                <input name="password" type="password" required placeholder="••••" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Kullanıcı Rolü</label>
                <select name="role" defaultValue="Personel" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500 cursor-pointer">
                  <option>Personel</option>
                  <option>Yetkili</option>
                  <option>Müdür</option>
                </select>
              </div>
              <button type="submit" disabled={isPending} className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 text-white font-bold text-sm rounded-xl px-6 py-3 shadow-lg transition-all active:scale-[0.98]">
                {isPending ? "Ekleniyor..." : "Kullanıcı Oluştur"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Şifre Sıfırlama Modalı ─────────────────────────────────────────── */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setResetModalOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold">Yeni Şifre Belirle</h3>
              <button onClick={() => setResetModalOpen(false)} className="text-slate-500 hover:text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Yeni Şifre</label>
                <input
                  type="password"
                  required
                  placeholder="••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500 transition-all"
                />
              </div>
              <button type="submit" disabled={isPending} className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 text-white font-bold text-sm rounded-xl px-6 py-3 shadow-lg transition-all active:scale-[0.98]">
                Şifreyi Güncelle
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
