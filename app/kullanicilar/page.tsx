"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";
import LoadingSkeleton from "../components/LoadingSkeleton";

type Kullanici = {
 id: number;
 username: string;
 ad_soyad: string;
 password_hash: string;
 role: string;
 dersler: string[];
};

type Ders = { id: string; kod: string; ad: string };

const ROLLER = [
 { value: "ogretmen", label: "Öğretmen" },
 { value: "admin", label: "Admin" },
 { value: "bolum_baskani", label: "Bölüm Başkanı" },
 { value: "satin_alma", label: "Satın Alma" },
 { value: "stok", label: "Stok" },
];

const ROL_RENK: Record<string, string> = {
 admin: "bg-rose-100 text-rose-700 border-rose-200",
 ogretmen: "bg-sky-100 text-sky-700 border-sky-200",
 bolum_baskani: "bg-purple-100 text-purple-700 border-purple-200",
 satin_alma: "bg-amber-100 text-amber-700 border-amber-200",
 stok: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const BOSH_FORM = { username: "", ad_soyad: "", password_hash: "", role: "ogretmen", dersler: [] as string[] };

export default function KullanicilarPage() {
  const { yetkili, yukleniyor: authYukleniyor } = useAuth("/kullanicilar");

 const [sekme, setSekme] = useState<"liste" | "ekle" | "guncelle">("liste");
 const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
 const [dersler, setDersler] = useState<Ders[]>([]);
 const [form, setForm] = useState(BOSH_FORM);
 const [duzenleId, setDuzenleId] = useState<number | null>(null);
 const [hata, setHata] = useState("");
 const [basari, setBasari] = useState("");
 const [yukleniyor, setYukleniyor] = useState(true);

 useEffect(() => {
 fetchData();
 }, []);

 const fetchData = async () => {
 setYukleniyor(true);
 const [{ data: k }, { data: d }] = await Promise.all([
 supabase.from("kullanicilar").select("*").order("id"),
 supabase.from("dersler").select("*").order("kod"),
 ]);
 setKullanicilar(k || []);
 setDersler(d || []);
 setYukleniyor(false);
 };

 const mesaj = (tip: "basari" | "hata", metin: string) => {
 if (tip === "basari") { setBasari(metin); setTimeout(() => setBasari(""), 3000); }
 else { setHata(metin); setTimeout(() => setHata(""), 3000); }
 };

 const handleEkle = async () => {
 if (!form.username.trim() || !form.ad_soyad.trim() || !form.password_hash.trim()) {
 mesaj("hata", "Tüm zorunlu alanları doldurun."); return;
 }
 const { error } = await supabase.from("kullanicilar").insert({
 username: form.username.trim(),
 ad_soyad: form.ad_soyad.trim(),
 password_hash: form.password_hash,
 role: form.role,
 dersler: form.dersler,
 });
 if (error) { mesaj("hata", "Hata: " + error.message); return; }
 mesaj("basari", `"${form.ad_soyad}" eklendi.`);
 setForm(BOSH_FORM);
 fetchData();
 };

 const handleGuncelle = async () => {
 if (!duzenleId) return;
 const guncelleme: any = {
 ad_soyad: form.ad_soyad,
 role: form.role,
 dersler: form.dersler,
 };
 if (form.password_hash) guncelleme.password_hash = form.password_hash;
 const { error } = await supabase.from("kullanicilar").update(guncelleme).eq("id", duzenleId);
 if (error) { mesaj("hata", "Hata: " + error.message); return; }
 mesaj("basari", "Kullanıcı güncellendi.");
 setDuzenleId(null);
 setForm(BOSH_FORM);
 setSekme("liste");
 fetchData();
 };

 const handleSil = async (id: number) => {
 if (!confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) return;
 const { error } = await supabase.from("kullanicilar").delete().eq("id", id);
 if (error) { mesaj("hata", "Hata: " + error.message); return; }
 mesaj("basari", "Kullanıcı silindi.");
 fetchData();
 };

 const handleDuzenleBaslat = (k: Kullanici) => {
 setDuzenleId(k.id);
 setForm({ username: k.username, ad_soyad: k.ad_soyad, password_hash: "", role: k.role, dersler: k.dersler || [] });
 setSekme("guncelle");
 };

 const toggleDers = (dersId: string) => {
 setForm((f) => ({
 ...f,
 dersler: f.dersler.includes(dersId)
 ? f.dersler.filter((d) => d !== dersId)
 : [...f.dersler, dersId],
 }));
 };

 const inputClass = "mt-1 w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500";

 if (authYukleniyor || !yetkili) return <LoadingSkeleton />;
 return (
 <DashboardLayout title="Kullanıcı & Erişim Yönetimi" subtitle="Sistemdeki personel ve kullanıcı bilgilerini yönetin">
 <div className="max-w-5xl space-y-5">

 {basari && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">{basari}</div>}
 {hata && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{hata}</div>}

 <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
 <div className="flex border-b border-gray-100">
 {([
 { key: "liste", label: "Liste & Silme" },
 { key: "ekle", label: "+ Yeni Kullanıcı" },
 { key: "guncelle", label: "Veri Güncelle" },
 ] as const).map((s) => (
 <button type="button" key={s.key} onClick={() => setSekme(s.key)}
 className={`px-6 py-4 text-sm font-medium border-b-2 transition ${sekme === s.key ? "border-red-600 text-red-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
 {s.label}
 </button>
 ))}
 </div>

 <div className="p-6">
 {sekme === "liste" && (
 <div>
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-semibold text-gray-800">Mevcut Kullanıcı Listesi</h3>
 <span className="text-xs bg-red-100 text-red-700 font-medium px-3 py-1 rounded-full">{kullanicilar.length} Kullanıcı</span>
 </div>
 {yukleniyor ? (
 <p className="text-center text-gray-400 text-sm py-12">Yükleniyor...</p>
 ) : kullanicilar.length === 0 ? (
 <p className="text-center text-gray-400 text-sm py-12">Henüz kullanıcı eklenmedi.</p>
 ) : (
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-gray-50 border-b border-gray-100 text-left">
 <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
 <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kullanıcı Adı</th>
 <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ad Soyad</th>
 <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
 <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">İşlemler</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {kullanicilar.map((k) => (
 <tr key={k.id} className="hover:bg-gray-50 transition-colors">
 <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{k.id}</td>
 <td className="px-4 py-3 font-semibold text-gray-800">{k.username}</td>
 <td className="px-4 py-3 text-gray-600">{k.ad_soyad || "—"}</td>
 <td className="px-4 py-3">
 <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${ROL_RENK[k.role] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
 {ROLLER.find((r) => r.value === k.role)?.label ?? k.role}
 </span>
 </td>
 <td className="px-4 py-3 text-right">
 <div className="flex justify-end gap-2">
 <button type="button" onClick={() => handleDuzenleBaslat(k)}
 className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-3 py-1.5 rounded-lg transition">
 Düzenle
 </button>
 <button type="button" onClick={() => handleSil(k.id)}
 className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium px-3 py-1.5 rounded-lg transition">
 Sil
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>
 )}

 {sekme === "ekle" && (
 <div className="space-y-4 max-w-2xl">
 <h3 className="font-semibold text-gray-800 mb-2">Yeni Kullanıcı Ekle</h3>
 <div>
 <label className="text-xs font-medium text-gray-700">Kullanıcı Adı *</label>
 <input className={inputClass} placeholder="örn. enis.akici" value={form.username}
 onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
 </div>
 <div>
 <label className="text-xs font-medium text-gray-700">Ad Soyad *</label>
 <input className={inputClass} placeholder="örn. Enis Edip AKICI" value={form.ad_soyad}
 onChange={(e) => setForm((f) => ({ ...f, ad_soyad: e.target.value }))} />
 </div>
 <div>
 <label className="text-xs font-medium text-gray-700">Şifre *</label>
 <input type="password" className={inputClass} placeholder="••••••••" value={form.password_hash}
 onChange={(e) => setForm((f) => ({ ...f, password_hash: e.target.value }))} />
 </div>
 <div>
 <label className="text-xs font-medium text-gray-700">Rol</label>
 <select className={inputClass + " bg-white"} value={form.role}
 onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
 {ROLLER.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
 </select>
 </div>
 {form.role === "ogretmen" && dersler.length > 0 && (
 <div>
 <label className="text-xs font-medium text-gray-700">Atanacak Dersler</label>
 <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3">
 {dersler.map((d) => (
 <label key={d.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-1">
 <input type="checkbox" className="accent-red-600" checked={form.dersler.includes(d.id)}
 onChange={() => toggleDers(d.id)} />
 <span className="text-sm text-gray-700">{d.kod} - {d.ad}</span>
 </label>
 ))}
 </div>
 </div>
 )}
 <button type="button" onClick={handleEkle}
 className="mt-2 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition">
 Kullanıcı Ekle
 </button>
 </div>
 )}

 {sekme === "guncelle" && (
 <div>
 {!duzenleId ? (
 <div className="text-center py-12">
 <p className="text-gray-400 text-sm">Güncellemek için Liste sekmesinden bir kullanıcı seçin.</p>
 <button type="button" onClick={() => setSekme("liste")}
 className="mt-3 text-red-600 text-sm font-medium hover:underline">Listeye git →</button>
 </div>
 ) : (
 <div className="space-y-4 max-w-2xl">
 <div className="flex items-center gap-3 mb-2">
 <h3 className="font-semibold text-gray-800">Kullanıcı Düzenle</h3>
 <span className="text-sm text-gray-400">— {form.username}</span>
 </div>
 <div>
 <label className="text-xs font-medium text-gray-700">Ad Soyad *</label>
 <input className={inputClass} value={form.ad_soyad}
 onChange={(e) => setForm((f) => ({ ...f, ad_soyad: e.target.value }))} />
 </div>
 <div>
 <label className="text-xs font-medium text-gray-700">Yeni Şifre (boş bırakılırsa değişmez)</label>
 <input type="password" className={inputClass} placeholder="••••••••" value={form.password_hash}
 onChange={(e) => setForm((f) => ({ ...f, password_hash: e.target.value }))} />
 </div>
 <div>
 <label className="text-xs font-medium text-gray-700">Rol</label>
 <select className={inputClass + " bg-white"} value={form.role}
 onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
 {ROLLER.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
 </select>
 </div>
 {form.role === "ogretmen" && dersler.length > 0 && (
 <div>
 <label className="text-xs font-medium text-gray-700">Atanacak Dersler</label>
 <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3">
 {dersler.map((d) => (
 <label key={d.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-1">
 <input type="checkbox" className="accent-red-600" checked={form.dersler.includes(d.id)}
 onChange={() => toggleDers(d.id)} />
 <span className="text-sm text-gray-700">{d.kod} - {d.ad}</span>
 </label>
 ))}
 </div>
 </div>
 )}
 <div className="flex gap-3 pt-2">
 <button type="button" onClick={handleGuncelle}
 className="bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition">
 Güncelle
 </button>
 <button type="button" onClick={() => { setDuzenleId(null); setSekme("liste"); }}
 className="text-gray-500 text-sm border border-gray-200 px-6 py-2.5 rounded-xl hover:bg-gray-50 transition">
 İptal
 </button>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 </div>
 </DashboardLayout>
 );
}