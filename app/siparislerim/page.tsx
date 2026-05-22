"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { DURUM_CLASS, DURUM_LABEL } from "@/lib/constants";
import LoadingSkeleton from "../components/LoadingSkeleton";

type SiparisUrun = { urunAdi: string; marka: string; miktar: number; olcu: string; birimFiyat: number; toplam: number };
type Siparis = { id: string; ogretmenId: number; dersAdi: string; hafta: string; urunler: SiparisUrun[]; genelToplam: number; tarih: string; durum: string };

export default function SiparislerimPage() {
  const { yetkili, yukleniyor } = useAuth("/siparislerim");

 const [siparisler, setSiparisler] = useState<Siparis[]>([]);
 const [detay, setDetay] = useState<Siparis | null>(null);
 const [filtreDers, setFiltreDers] = useState("tumu");
 const [filtreHafta, setFiltreHafta] = useState("tumu");

 useEffect(() => {
 const fetchData = async () => {
 const id = localStorage.getItem("aktifKullaniciId");
 if (!id) return;
 const { data } = await supabase.from("siparisler").select("*").eq("ogretmen_id", id).order("tarih", { ascending: false });
 setSiparisler((data || []).map((s: any) => ({
 id: s.id, ogretmenId: s.ogretmen_id, dersAdi: s.ders_adi, hafta: s.hafta,
 urunler: s.urunler || [], genelToplam: s.genel_toplam, tarih: s.tarih, durum: s.durum,
 })));
 };
 fetchData();
 }, []);

 const dersler = ["tumu", ...Array.from(new Set(siparisler.map((s) => s.dersAdi)))];
 const haftalar = ["tumu", ...Array.from(new Set(siparisler.map((s) => s.hafta)))];

 const filtrelenmis = siparisler.filter((s) =>
 (filtreDers === "tumu" || s.dersAdi === filtreDers) &&
 (filtreHafta === "tumu" || s.hafta === filtreHafta)
 );

 if (yukleniyor || !yetkili) return <LoadingSkeleton />;
 return (
 <DashboardLayout title="Siparişlerim" subtitle="Gönderdiğiniz alışveriş listelerini takip edin">
 <div className="max-w-6xl space-y-5">
 <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-wrap gap-4 items-end">
 <div>
 <label className="text-xs font-medium text-gray-700 block mb-1">Ders</label>
 <select value={filtreDers} onChange={(e) => setFiltreDers(e.target.value)}
 className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[220px]">
 {dersler.map((d) => <option key={d} value={d}>{d === "tumu" ? "Tüm Dersler" : d}</option>)}
 </select>
 </div>
 <div>
 <label className="text-xs font-medium text-gray-700 block mb-1">Hafta</label>
 <select value={filtreHafta} onChange={(e) => setFiltreHafta(e.target.value)}
 className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
 {haftalar.map((h) => <option key={h} value={h}>{h === "tumu" ? "Tüm Haftalar" : h}</option>)}
 </select>
 </div>
 <div className="ml-auto self-end text-sm text-gray-500">
 <span className="font-semibold text-gray-800">{filtrelenmis.length}</span> sipariş
 </div>
 </div>

 <div className="flex gap-5">
 <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
 {filtrelenmis.length === 0 ? (
 <div className="py-20 text-center text-gray-400 text-sm">
 {siparisler.length === 0 ? "Henüz sipariş göndermediniz." : "Bu filtreye uygun sipariş bulunamadı."}
 </div>
 ) : (
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-gray-50 border-b border-gray-100 text-left">
 {["DERS", "HAFTA", "ÜRÜN SAYISI", "TUTAR", "DURUM", "TARİH", ""].map((h) => (
 <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {filtrelenmis.map((s) => (
 <tr key={s.id} onClick={() => setDetay(detay?.id === s.id ? null : s)}
 className={`cursor-pointer transition-colors ${detay?.id === s.id ? "bg-red-50" : "hover:bg-gray-50"}`}>
 <td className="px-5 py-4 font-medium text-gray-800 max-w-[200px] truncate">{s.dersAdi}</td>
 <td className="px-5 py-4 text-gray-600">{s.hafta}</td>
 <td className="px-5 py-4 text-gray-600">{s.urunler.length} ürün</td>
 <td className="px-5 py-4 font-semibold text-red-700">
 {s.genelToplam > 0 ? `₺${s.genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "—"}
 </td>
 <td className="px-5 py-4">
 <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${DURUM_CLASS[s.durum] ?? DURUM_CLASS.bekliyor}`}>
 {DURUM_LABEL[s.durum] ?? s.durum}
 </span>
 </td>
 <td className="px-5 py-4 text-gray-400 text-xs">{s.tarih}</td>
 <td className="px-5 py-4 text-right text-xs text-red-600 font-medium">{detay?.id === s.id ? "Kapat" : "Detay"}</td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>

 {detay && (
 <div className="w-80 flex-shrink-0">
 <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-semibold text-gray-800 text-sm">Sipariş Detayı</h3>
 <button type="button" onClick={() => setDetay(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
 </div>
 <div className="space-y-2 text-sm mb-4">
 <div className="flex justify-between"><span className="text-gray-400">Ders</span><span className="font-medium text-gray-800 text-right max-w-[180px]">{detay.dersAdi}</span></div>
 <div className="flex justify-between"><span className="text-gray-400">Hafta</span><span className="font-medium text-gray-800">{detay.hafta}</span></div>
 <div className="flex justify-between"><span className="text-gray-400">Tarih</span><span className="font-medium text-gray-800">{detay.tarih}</span></div>
 <div className="flex justify-between items-center">
 <span className="text-gray-400">Durum</span>
 <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${DURUM_CLASS[detay.durum] ?? DURUM_CLASS.bekliyor}`}>
 {DURUM_LABEL[detay.durum] ?? detay.durum}
 </span>
 </div>
 </div>
 <div className="border-t border-gray-100 pt-4">
 <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Ürünler</h4>
 <div className="space-y-2 max-h-72 overflow-y-auto">
 {detay.urunler.map((u, i) => (
 <div key={i} className="flex justify-between items-start text-xs py-2 border-b border-gray-50 last:border-0">
 <div><p className="font-medium text-gray-800">{u.urunAdi}</p><p className="text-gray-400">{u.marka && `${u.marka} · `}{u.miktar} {u.olcu}</p></div>
 <span className="font-semibold text-gray-700 ml-3">{u.toplam > 0 ? `₺${u.toplam.toFixed(2)}` : "—"}</span>
 </div>
 ))}
 </div>
 <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
 <span className="text-sm font-semibold text-gray-800">Toplam</span>
 <span className="text-base font-bold text-red-700">
 {detay.genelToplam > 0 ? `₺${detay.genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "—"}
 </span>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </DashboardLayout>
 );
}