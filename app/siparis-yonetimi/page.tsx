"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

type SiparisUrun = { urunId: string; urunAdi: string; marka: string; miktar: number; olcu: string; birimFiyat: number; toplam: number };
type Siparis = { id: string; ogretmenId: number; ogretmenAdi: string; dersId: string; dersAdi: string; hafta: string; urunler: SiparisUrun[]; genelToplam: number; tarih: string; durum: string };
type KiyasItem = { urunId: string; urunAdi: string; olcu: string; toplamTalep: number; hocalar: string[]; mevcutStok: number; paketMiktari: number | null; eksikMiktar: number; siparisEdilecekPaket: number | null; tamKarsilandi: boolean };

export default function SiparisYonetimiPage() {
  const { yetkili, yukleniyor } = useAuth("/siparis-yonetimi");

  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [sekme, setSekme] = useState<"hepsi" | "filtre">("hepsi");
  const [filtreOgretmen, setFiltreOgretmen] = useState("tumu");
  const [filtreDers, setFiltreDers] = useState("tumu");
  const [filtreHafta, setFiltreHafta] = useState("tumu");
  const [detaySiparis, setDetaySiparis] = useState<Siparis | null>(null);

  // Stok karşılaştırma
  const [stokKiyasModal, setStokKiyasModal] = useState(false);
  const [kiyasVerisi, setKiyasVerisi] = useState<KiyasItem[]>([]);
  const [kiyasYukleniyor, setKiyasYukleniyor] = useState(false);
  const [kiyasHafta, setKiyasHafta] = useState("");

  useEffect(() => { fetchSiparisler(); }, []);

  const fetchSiparisler = async () => {
    const { data } = await supabase.from("siparisler").select("*").order("tarih", { ascending: false });
    setSiparisler((data || []).map((s: any) => ({
      id: s.id, ogretmenId: s.ogretmen_id, ogretmenAdi: s.ogretmen_adi,
      dersId: s.ders_id, dersAdi: s.ders_adi, hafta: s.hafta,
      urunler: s.urunler || [], genelToplam: s.genel_toplam, tarih: s.tarih, durum: s.durum,
    })));
  };

  const handleSil = async (id: string) => {
    if (!confirm("Bu siparişi silmek istediğinizden emin misiniz?")) return;
    await supabase.from("siparisler").delete().eq("id", id);
    setSiparisler((prev) => prev.filter((s) => s.id !== id));
    if (detaySiparis?.id === id) setDetaySiparis(null);
  };

  const handleDurumGuncelle = async (id: string, durum: string) => {
    await supabase.from("siparisler").update({ durum }).eq("id", id);
    setSiparisler((prev) => prev.map((s) => s.id === id ? { ...s, durum } : s));
    if (detaySiparis?.id === id) setDetaySiparis((prev) => prev ? { ...prev, durum } : null);
  };

  // ── Stok Karşılaştırma ───────────────────────────────────────────────
  const handleStokKiyas = async (hafta: string) => {
    setKiyasHafta(hafta);
    setKiyasYukleniyor(true);
    setStokKiyasModal(true);
    setKiyasVerisi([]);

    const { data: haftaSiparisler } = await supabase.from("siparisler").select("*").eq("hafta", hafta);
    const urunMap: Record<string, { urunAdi: string; urunId: string; olcu: string; toplamTalep: number; hocalar: string[] }> = {};

    (haftaSiparisler || []).forEach((s: any) => {
      (s.urunler || []).forEach((u: any) => {
        if (!urunMap[u.urunId]) urunMap[u.urunId] = { urunAdi: u.urunAdi, urunId: u.urunId, olcu: u.olcu, toplamTalep: 0, hocalar: [] };
        urunMap[u.urunId].toplamTalep += u.miktar;
        if (!urunMap[u.urunId].hocalar.includes(s.ogretmen_adi)) urunMap[u.urunId].hocalar.push(s.ogretmen_adi);
      });
    });

    const urunIdler = Object.keys(urunMap);
    if (urunIdler.length === 0) { setKiyasYukleniyor(false); return; }

    const { data: stoklar } = await supabase.from("urunler").select("id, stok, paket_miktari, paket_birimi, olcu").in("id", urunIdler);

    const sonuc: KiyasItem[] = Object.values(urunMap).map((u) => {
      const stokBilgi = (stoklar || []).find((s: any) => s.id === u.urunId);
      const mevcutStok = stokBilgi?.stok ?? 0;
      const paketMiktari = stokBilgi?.paket_miktari ?? null;
      const eksik = Math.max(0, u.toplamTalep - mevcutStok);
      const siparisEdilecekPaket = paketMiktari && eksik > 0 ? Math.ceil(eksik / paketMiktari) : null;
      return { ...u, mevcutStok, paketMiktari, eksikMiktar: eksik, siparisEdilecekPaket, tamKarsilandi: eksik === 0 };
    }).sort((a, b) => {
      if (a.tamKarsilandi && !b.tamKarsilandi) return 1;
      if (!a.tamKarsilandi && b.tamKarsilandi) return -1;
      return a.urunAdi.localeCompare(b.urunAdi, "tr");
    });

    setKiyasVerisi(sonuc);
    setKiyasYukleniyor(false);
  };

  const handleKiyasExcel = () => {
    if (!kiyasVerisi.length) return;
    const ws = XLSX.utils.json_to_sheet(kiyasVerisi.map((u) => ({
      "Ürün": u.urunAdi, "Toplam Talep": u.toplamTalep, "Ölçü": u.olcu,
      "Depoda Mevcut": u.mevcutStok, "Eksik Miktar": u.eksikMiktar,
      "Sipariş (Paket)": u.siparisEdilecekPaket ?? "Paket bilgisi yok",
      "Durum": u.tamKarsilandi ? "✓ Tamam" : "⚠ Eksik", "Hocalar": u.hocalar.join(", "),
    })));
    ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${kiyasHafta} Stok Kıyas`);
    XLSX.writeFile(wb, `${kiyasHafta.replace(/\s/g, "_")}_stok_kiyas.xlsx`);
  };
  // ────────────────────────────────────────────────────────────────────

  const ogretmenler = ["tumu", ...Array.from(new Set(siparisler.map((s) => s.ogretmenAdi)))];
  const dersler = ["tumu", ...Array.from(new Set(siparisler.map((s) => s.dersAdi)))];
  const haftalar = ["tumu", ...Array.from(new Set(siparisler.map((s) => s.hafta))).sort()];

  const filtrelenmis = siparisler.filter((s) => {
    const oUygun = filtreOgretmen === "tumu" || s.ogretmenAdi === filtreOgretmen;
    const dUygun = filtreDers === "tumu" || s.dersAdi === filtreDers;
    const hUygun = filtreHafta === "tumu" || s.hafta === filtreHafta;
    return oUygun && dUygun && hUygun;
  });

  const gosterilen = sekme === "hepsi" ? siparisler : filtrelenmis;

  if (yukleniyor || !yetkili) return null;

  return (
    <>
      <DashboardLayout title="Sipariş Yönetimi" subtitle="Tüm siparişleri görüntüleyin ve yönetin">
        <div className="max-w-6xl space-y-5">

          {/* Sekmeler */}
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => setSekme("hepsi")}
              className={`px-5 py-3 rounded-xl text-sm font-semibold transition ${sekme === "hepsi" ? "bg-red-700 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              Tüm Siparişler ({siparisler.length})
            </button>
            <button onClick={() => setSekme("filtre")}
              className={`px-5 py-3 rounded-xl text-sm font-semibold transition ${sekme === "filtre" ? "bg-red-700 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              Filtrele
            </button>
          </div>

          {/* Filtre paneli */}
          {sekme === "filtre" && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Öğretmen</label>
                <select value={filtreOgretmen} onChange={(e) => setFiltreOgretmen(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[200px]">
                  {ogretmenler.map((o) => <option key={o} value={o}>{o === "tumu" ? "Tüm Öğretmenler" : o}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Ders</label>
                <select value={filtreDers} onChange={(e) => setFiltreDers(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[200px]">
                  {dersler.map((d) => <option key={d} value={d}>{d === "tumu" ? "Tüm Dersler" : d}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Hafta</label>
                <select value={filtreHafta} onChange={(e) => setFiltreHafta(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[160px]">
                  {haftalar.map((h) => <option key={h} value={h}>{h === "tumu" ? "Tüm Haftalar" : h}</option>)}
                </select>
              </div>
              {/* Stokla Karşılaştır — hafta seçilince aktif */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Stok Analizi</label>
                {filtreHafta !== "tumu" ? (
                  <button onClick={() => handleStokKiyas(filtreHafta)}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
                    📦 Stokla Karşılaştır
                  </button>
                ) : (
                  <span className="text-xs text-gray-400 italic py-2.5">← Önce hafta seçin</span>
                )}
              </div>
            </div>
          )}

          {/* Liste + Detay */}
          <div className="flex gap-5">
            <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">{sekme === "hepsi" ? "Tüm Siparişler" : "Filtrelenmiş Siparişler"}</h2>
                <span className="text-xs text-gray-400">Toplam {gosterilen.length} sipariş</span>
              </div>
              {gosterilen.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">Sipariş bulunamadı.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {["ÖĞRETMEN", "DERS", "HAFTA", "ÜRÜN SAYISI", "TOPLAM TUTAR", "DURUM", "İŞLEM"].map((h) => (
                        <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {gosterilen.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 font-semibold text-gray-800">{s.ogretmenAdi}</td>
                        <td className="px-5 py-4 text-gray-600 max-w-xs truncate">{s.dersAdi}</td>
                        <td className="px-5 py-4 text-gray-600">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg font-medium">{s.hafta}</span>
                        </td>
                        <td className="px-5 py-4 text-gray-600">{s.urunler.length} ürün</td>
                        <td className="px-5 py-4 font-semibold text-red-700">
                          ₺{s.genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-4">
                          <select value={s.durum} onChange={(e) => handleDurumGuncelle(s.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                            <option value="bekliyor">⏳ Bekliyor</option>
                            <option value="onaylandi">✓ Onaylandı</option>
                            <option value="teslim_alindi">✓ Teslim Alındı</option>
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => setDetaySiparis(detaySiparis?.id === s.id ? null : s)}
                              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-3 py-1.5 rounded-lg transition">
                              Detay
                            </button>
                            <button onClick={() => handleSil(s.id)}
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

            {/* Detay Paneli */}
            {detaySiparis && (
              <div className="w-80 flex-shrink-0 self-start sticky top-4">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800 text-sm">Sipariş Detayı</h3>
                    <button onClick={() => setDetaySiparis(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                  </div>
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between"><span className="text-gray-400">Öğretmen:</span><span className="font-medium text-gray-800">{detaySiparis.ogretmenAdi}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Ders:</span><span className="font-medium text-gray-800 text-right max-w-[160px]">{detaySiparis.dersAdi}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Hafta:</span><span className="font-medium text-gray-800">{detaySiparis.hafta}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Tarih:</span><span className="font-medium text-gray-800">{detaySiparis.tarih}</span></div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Durum:</span>
                      <select value={detaySiparis.durum} onChange={(e) => handleDurumGuncelle(detaySiparis.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="bekliyor">Bekliyor</option>
                        <option value="onaylandi">Onaylandı</option>
                        <option value="teslim_alindi">Teslim Alındı</option>
                      </select>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Ürünler</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {detaySiparis.urunler.map((u, i) => (
                        <div key={i} className="flex justify-between items-start text-xs py-2 border-b border-gray-50">
                          <div><p className="font-medium text-gray-800">{u.urunAdi}</p><p className="text-gray-400">{u.marka} · {u.miktar} {u.olcu}</p></div>
                          <span className="font-semibold text-gray-700 ml-2">₺{u.toplam.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-800">Toplam</span>
                      <span className="text-base font-bold text-red-700">₺{detaySiparis.genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>

      {/* STOK KARŞILAŞTIRMA MODALİ — DashboardLayout DIŞINDA */}
      {stokKiyasModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setStokKiyasModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-700 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-white font-bold text-lg">📦 Stok ↔ Talep Karşılaştırması</h3>
                <p className="text-purple-200 text-sm mt-0.5">{kiyasHafta} — tüm hocaların talepleri toplandı</p>
              </div>
              <button onClick={() => setStokKiyasModal(false)} className="text-white/70 hover:text-white text-2xl font-light">✕</button>
            </div>
            <div className="overflow-auto flex-1">
              {kiyasYukleniyor ? (
                <div className="flex items-center justify-center py-24 text-gray-400">
                  <div className="text-center"><div className="text-5xl mb-4">⏳</div><p>Hesaplanıyor...</p></div>
                </div>
              ) : kiyasVerisi.length === 0 ? (
                <div className="py-20 text-center text-gray-400 text-sm">Bu hafta için sipariş bulunamadı.</div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4 p-5 bg-gray-50 border-b border-gray-100">
                    <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
                      <p className="text-3xl font-bold text-gray-800">{kiyasVerisi.length}</p>
                      <p className="text-xs text-gray-500 mt-1">Toplam Ürün</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-200">
                      <p className="text-3xl font-bold text-emerald-700">{kiyasVerisi.filter(u => u.tamKarsilandi).length}</p>
                      <p className="text-xs text-emerald-600 mt-1">Depoda Var ✓</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-4 text-center border border-red-200">
                      <p className="text-3xl font-bold text-red-700">{kiyasVerisi.filter(u => !u.tamKarsilandi).length}</p>
                      <p className="text-xs text-red-600 mt-1">Satın Alınacak ⚠</p>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b text-left">
                        <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Ürün</th>
                        <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Toplam Talep</th>
                        <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Depoda</th>
                        <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Eksik</th>
                        <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Sipariş Et</th>
                        <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Hocalar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {kiyasVerisi.map((u, i) => (
                        <tr key={i} className={u.tamKarsilandi ? "hover:bg-gray-50" : "bg-red-50/60 hover:bg-red-50"}>
                          <td className="px-5 py-3">
                            <p className="font-medium text-gray-800">{u.urunAdi}</p>
                            <p className="text-xs text-gray-400">{u.olcu}</p>
                          </td>
                          <td className="px-5 py-3 text-center font-semibold text-gray-700">{u.toplamTalep} {u.olcu}</td>
                          <td className={"px-5 py-3 text-center font-semibold " + (u.mevcutStok > 0 ? "text-emerald-700" : "text-red-500")}>
                            {u.mevcutStok > 0 ? `${u.mevcutStok} ${u.olcu}` : "Yok"}
                          </td>
                          <td className={"px-5 py-3 text-center font-bold " + (u.eksikMiktar > 0 ? "text-red-600" : "text-emerald-600")}>
                            {u.eksikMiktar > 0 ? `${u.eksikMiktar} ${u.olcu}` : "✓ Tamam"}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {u.eksikMiktar > 0 ? (
                              <span className="inline-block bg-red-100 border border-red-200 text-red-700 font-bold px-3 py-1.5 rounded-lg text-xs">
                                {u.siparisEdilecekPaket !== null ? `${u.siparisEdilecekPaket} paket` : `${u.eksikMiktar} ${u.olcu}`}
                                {u.paketMiktari && <span className="block text-red-400 font-normal text-xs mt-0.5">1 paket = {u.paketMiktari} {u.olcu}</span>}
                                {!u.paketMiktari && <span className="block text-orange-400 font-normal text-xs mt-0.5">paket bilgisi yok</span>}
                              </span>
                            ) : <span className="text-emerald-600 text-lg">✓</span>}
                          </td>
                          <td className="px-5 py-3 text-xs text-gray-500">{u.hocalar.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center flex-shrink-0 bg-gray-50">
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-red-700">{kiyasVerisi.filter(u => !u.tamKarsilandi).length} ürün</span> satın alınacak
                {kiyasVerisi.some(u => !u.tamKarsilandi && !u.paketMiktari) && <span className="text-orange-500 ml-2">· Bazı ürünlerde paket bilgisi eksik</span>}
              </p>
              <div className="flex gap-3">
                <button onClick={handleKiyasExcel} disabled={kiyasVerisi.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40">
                  Excel İndir
                </button>
                <button onClick={() => setStokKiyasModal(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-xl">
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}