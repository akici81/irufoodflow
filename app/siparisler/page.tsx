"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

type SiparisUrun = { urunId: string; urunAdi: string; marka: string; miktar: number; olcu: string; birimFiyat: number; toplam: number };
type Siparis = { id: string; ogretmenId: number; ogretmenAdi: string; dersId: string; dersAdi: string; hafta: string; urunler: SiparisUrun[]; genelToplam: number; tarih: string; durum: "bekliyor" | "onaylandi" | "teslim_alindi" };
type KiyasItem = { urunId: string; urunAdi: string; olcu: string; toplamTalep: number; hocalar: string[]; mevcutStok: number; paketMiktari: number | null; eksikMiktar: number; siparisEdilecekPaket: number | null; tamKarsilandi: boolean };

const DURUM_STIL: Record<string, string> = {
  bekliyor: "bg-amber-100 text-amber-700 border-amber-200",
  onaylandi: "bg-blue-100 text-blue-700 border-blue-200",
  teslim_alindi: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
const DURUM_LABEL: Record<string, string> = {
  bekliyor: "⏳ Bekliyor", onaylandi: "✓ Onaylandı", teslim_alindi: "✓ Teslim Alındı",
};

export default function SiparislerPage() {
  const { yetkili, yukleniyor } = useAuth("/siparisler");

  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [detay, setDetay] = useState<Siparis | null>(null);
  const [filtreHafta, setFiltreHafta] = useState("tumu");
  const [filtreOgretmen, setFiltreOgretmen] = useState("tumu");
  const [filtreDurum, setFiltreDurum] = useState("tumu");
  const [aramaMetni, setAramaMetni] = useState("");
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

  const handleDurumGuncelle = async (id: string, durum: string) => {
    await supabase.from("siparisler").update({ durum }).eq("id", id);
    setSiparisler((prev) => prev.map((s) => s.id === id ? { ...s, durum: durum as Siparis["durum"] } : s));
    if (detay?.id === id) setDetay((prev) => prev ? { ...prev, durum: durum as Siparis["durum"] } : null);
  };

  const handleSil = async (id: string) => {
    if (!confirm("Bu alışveriş listesini silmek istediğinizden emin misiniz?")) return;
    await supabase.from("siparisler").delete().eq("id", id);
    setSiparisler((prev) => prev.filter((s) => s.id !== id));
    if (detay?.id === id) setDetay(null);
  };

  const handleTumunuOnayla = async () => {
    if (!confirm("Görüntülenen tüm bekleyen listeler onaylanacak. Emin misiniz?")) return;
    const bekleyenIds = filtrelenmis.filter((s) => s.durum === "bekliyor").map((s) => s.id);
    for (const id of bekleyenIds) await supabase.from("siparisler").update({ durum: "onaylandi" }).eq("id", id);
    fetchSiparisler();
  };

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

  const handleExcel = () => {
    if (filtrelenmis.length === 0) return;
    const rows = filtrelenmis.flatMap((s) => s.urunler.map((u) => ({
      "Öğretmen": s.ogretmenAdi, "Ders": s.dersAdi, "Hafta": s.hafta,
      "Ürün": u.urunAdi, "Marka": u.marka, "Miktar": u.miktar, "Ölçü": u.olcu,
      "Birim Fiyat": u.birimFiyat, "Toplam": u.toplam, "Durum": s.durum, "Tarih": s.tarih,
    })));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alışveriş Listeleri");
    XLSX.writeFile(wb, `Alisveris_Listeleri_${new Date().toLocaleDateString("tr-TR").replace(/\./g, "-")}.xlsx`);
  };

  const haftalar = ["tumu", ...Array.from(new Set(siparisler.map((s) => s.hafta))).sort()];
  const ogretmenler = ["tumu", ...Array.from(new Set(siparisler.map((s) => s.ogretmenAdi))).sort()];
  const filtrelenmis = siparisler.filter((s) => {
    return (filtreHafta === "tumu" || s.hafta === filtreHafta)
      && (filtreOgretmen === "tumu" || s.ogretmenAdi === filtreOgretmen)
      && (filtreDurum === "tumu" || s.durum === filtreDurum)
      && (!aramaMetni || (s.ogretmenAdi || "").toLowerCase().includes(aramaMetni.toLowerCase()) || (s.dersAdi || "").toLowerCase().includes(aramaMetni.toLowerCase()));
  });

  const genelToplam = filtrelenmis.reduce((acc, s) => acc + s.genelToplam, 0);
  const bekleyenSayisi = siparisler.filter((s) => s.durum === "bekliyor").length;
  const onaylananSayisi = siparisler.filter((s) => s.durum === "onaylandi").length;
  const teslimSayisi = siparisler.filter((s) => s.durum === "teslim_alindi").length;

  if (yukleniyor || !yetkili) return null;

  return (
    <>
      <DashboardLayout title="Alışveriş Listeleri" subtitle="Tüm öğretmen taleplerini görüntüleyin ve yönetin">
        <div className="max-w-7xl space-y-5">

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Toplam Liste", deger: siparisler.length, renk: "text-gray-800" },
              { label: "Bekliyor", deger: bekleyenSayisi, renk: "text-amber-600" },
              { label: "Onaylandı", deger: onaylananSayisi, renk: "text-blue-600" },
              { label: "Teslim Alındı", deger: teslimSayisi, renk: "text-emerald-600" },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-center">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{k.label}</p>
                <p className={`text-3xl font-bold ${k.renk}`}>{k.deger}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Arama</label>
                <input value={aramaMetni} onChange={(e) => setAramaMetni(e.target.value)} placeholder="Öğretmen veya ders ara..."
                  className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 w-52" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Hafta</label>
                <select value={filtreHafta} onChange={(e) => setFiltreHafta(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                  {haftalar.map((h) => <option key={h} value={h}>{h === "tumu" ? "Tüm Haftalar" : h}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Öğretmen</label>
                <select value={filtreOgretmen} onChange={(e) => setFiltreOgretmen(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[180px]">
                  {ogretmenler.map((o) => <option key={o} value={o}>{o === "tumu" ? "Tüm Öğretmenler" : o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Durum</label>
                <select value={filtreDurum} onChange={(e) => setFiltreDurum(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="tumu">Tüm Durumlar</option>
                  <option value="bekliyor">Bekliyor</option>
                  <option value="onaylandi">Onaylandı</option>
                  <option value="teslim_alindi">Teslim Alındı</option>
                </select>
              </div>
              <div className="ml-auto flex items-center gap-3 flex-wrap">
                {filtreHafta !== "tumu" ? (
                  <button type="button" onClick={() => handleStokKiyas(filtreHafta)}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
                    📦 Stokla Karşılaştır
                  </button>
                ) : (
                  <span className="text-xs text-gray-400 italic">Hafta seçin → Stokla Karşılaştır</span>
                )}
                {bekleyenSayisi > 0 && (
                  <button type="button" onClick={handleTumunuOnayla}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
                    Tümünü Onayla
                  </button>
                )}
                <button type="button" onClick={handleExcel} disabled={filtrelenmis.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-40">
                  Excel'e Aktar
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-5">
            <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {filtrelenmis.length === 0 ? (
                <div className="py-20 text-center text-gray-400 text-sm">Gösterilecek liste bulunamadı.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ÖĞRETMEN</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">DERS</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">HAFTA</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ÜRÜN</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">TOPLAM</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">DURUM</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">İŞLEM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtrelenmis.map((s) => (
                      <tr key={s.id} onClick={() => setDetay(detay?.id === s.id ? null : s)}
                        className={`cursor-pointer transition-colors ${detay?.id === s.id ? "bg-red-50" : "hover:bg-gray-50"}`}>
                        <td className="px-5 py-3 font-medium text-gray-800">{s.ogretmenAdi}</td>
                        <td className="px-5 py-3 text-gray-600 text-xs">{s.dersAdi}</td>
                        <td className="px-5 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg font-medium">{s.hafta}</span></td>
                        <td className="px-5 py-3 text-gray-600">{s.urunler.length} ürün</td>
                        <td className="px-5 py-3 font-semibold text-gray-800">
                          {s.genelToplam > 0 ? `₺${s.genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${DURUM_STIL[s.durum]}`}>{DURUM_LABEL[s.durum]}</span>
                        </td>
                        <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 flex-wrap">
                            {s.durum === "bekliyor" && (
                              <button onClick={() => handleDurumGuncelle(s.id, "onaylandi")}
                                className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium px-2 py-1 rounded-lg transition">Onayla</button>
                            )}
                            {s.durum === "onaylandi" && (
                              <button onClick={() => handleDurumGuncelle(s.id, "teslim_alindi")}
                                className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-medium px-2 py-1 rounded-lg transition">Teslim</button>
                            )}
                            {s.durum !== "bekliyor" && (
                              <button onClick={() => handleDurumGuncelle(s.id, "bekliyor")}
                                className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 font-medium px-2 py-1 rounded-lg transition">Geri Al</button>
                            )}
                            <button onClick={() => handleSil(s.id)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition">Sil</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {filtrelenmis.length > 0 && genelToplam > 0 && (
                <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                  <span className="text-xs text-gray-500">{filtrelenmis.length} liste</span>
                  <span className="text-sm font-bold text-red-700">Toplam: ₺{genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            {detay && (
              <div className="w-80 flex-shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden self-start sticky top-4">
                <div className="bg-red-700 px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-bold">{detay.ogretmenAdi}</p>
                      <p className="text-red-200 text-xs mt-0.5">{detay.dersAdi}</p>
                    </div>
                    <button onClick={() => setDetay(null)} className="text-red-300 hover:text-white text-xl font-light">×</button>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">{detay.hafta}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${DURUM_STIL[detay.durum]}`}>{DURUM_LABEL[detay.durum]}</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex gap-2 mb-4">
                    {detay.durum === "bekliyor" && (
                      <button onClick={() => handleDurumGuncelle(detay.id, "onaylandi")}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg transition">Onayla</button>
                    )}
                    {detay.durum === "onaylandi" && (
                      <button onClick={() => handleDurumGuncelle(detay.id, "teslim_alindi")}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded-lg transition">Teslim Alındı</button>
                    )}
                    {detay.durum !== "bekliyor" && (
                      <button onClick={() => handleDurumGuncelle(detay.id, "bekliyor")}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-2 rounded-lg transition">Geri Al</button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {detay.urunler.map((u, i) => (
                      <div key={i} className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{u.urunAdi}</p>
                          <p className="text-gray-400 text-xs">{u.marka && `${u.marka} · `}{u.miktar} {u.olcu}</p>
                        </div>
                        <span className="font-semibold text-gray-700 text-sm ml-3">{u.toplam > 0 ? `₺${u.toplam.toFixed(2)}` : "—"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-800">Genel Toplam</span>
                    <span className="text-base font-bold text-red-700">
                      {detay.genelToplam > 0 ? `₺${detay.genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>

      {/* MODAL — DashboardLayout DIŞINDA, Fragment içinde */}
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
                  <div className="text-center"><div className="text-5xl mb-4">⏳</div><p className="text-sm">Hesaplanıyor...</p></div>
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
                          <td className={`px-5 py-3 text-center font-semibold ${u.mevcutStok > 0 ? "text-emerald-700" : "text-red-500"}`}>
                            {u.mevcutStok > 0 ? `${u.mevcutStok} ${u.olcu}` : "Yok"}
                          </td>
                          <td className={`px-5 py-3 text-center font-bold ${u.eksikMiktar > 0 ? "text-red-600" : "text-emerald-600"}`}>
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40">Excel İndir</button>
                <button onClick={() => setStokKiyasModal(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-xl">Kapat</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}