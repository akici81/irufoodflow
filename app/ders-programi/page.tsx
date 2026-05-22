"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";
import LoadingSkeleton from "../components/LoadingSkeleton";

type Satir = {
  id?: string;
  program: string;
  sinif: number;
  donem: string;
  yil: string;
  gun: string;
  saat_baslangic: string;
  saat_bitis: string;
  ders_kodu: string;
  ders_adi: string;
  derslik: string;
  ogretmen_adi: string;
  uzem: boolean;
  sira: number;
  aktif?: boolean;
};


type TopluSatir = {
  saat_baslangic: string;
  kac_saat: number;
  ders_kodu: string;
  ders_adi: string;
  derslik: string;
  ogretmen_adi: string;
  uzem: boolean;
};

const PROGRAMLAR = [
  { value: "ascilik", label: "Aşçılık Programı" },
  { value: "pastacilk", label: "Pastacılık ve Ekmekçilik Programı" },
];
const SINIFLAR = [1, 2];
const DONEMLER = [
  { value: "guz", label: "Güz Dönemi" },
  { value: "bahar", label: "Bahar Dönemi" },
];
const GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const SAATLER = [
  "08:00","09:00","10:00","11:00","12:00","13:00",
  "14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00",
];
const SAAT_BITIS: Record<string, string> = {
  "08:00":"08:50","09:00":"09:50","10:00":"10:50","11:00":"11:50",
  "12:00":"12:50","13:00":"13:50","14:00":"14:50","15:00":"15:50",
  "16:00":"16:50","17:00":"17:50","18:00":"18:50","19:00":"19:50",
  "20:00":"20:50","21:00":"21:50",
};

const BOS_SATIR: Omit<Satir, "id"> = {
  program: "ascilik", sinif: 1, donem: "bahar", yil: "2025-2026",
  gun: "Pazartesi", saat_baslangic: "09:00", saat_bitis: "09:50",
  ders_kodu: "", ders_adi: "", derslik: "", ogretmen_adi: "", uzem: false, sira: 0,
};

export default function DesProgramiPage() {
  const { yetkili, yukleniyor: authYukleniyor } = useAuth("/ders-programi");

  const [filtre, setFiltre] = useState({ program: "ascilik", sinif: 1, donem: "bahar", yil: "2025-2026" });
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [bildirim, setBildirim] = useState<{ tip: "basari" | "hata"; metin: string } | null>(null);
  const [form, setForm] = useState<Omit<Satir, "id">>(BOS_SATIR);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [kacSaat, setKacSaat] = useState(1);
  const [modalAcik, setModalAcik] = useState(false);
  const [indiriliyor, setIndiriliyor] = useState(false);
  const [aktariliyor, setAktariliyor] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [ogretmenler, setOgretmenler] = useState<{id: number, ad_soyad: string}[]>([]);
  const [seciliUnvan, setSeciliUnvan] = useState("Öğr.Gör.");
  const [seciliIsim, setSeciliIsim] = useState("");
  const [topluModalAcik, setTopluModalAcik] = useState(false);
  const [topluGun, setTopluGun] = useState("Pazartesi");
  const [topluSatirlar, setTopluSatirlar] = useState<TopluSatir[]>([]);
  const [topluUnvan, setTopluUnvan] = useState<string[]>([]);
  const [topluIsim, setTopluIsim] = useState<string[]>([]);
  const tabloRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (yetkili) {
      fetchSatirlar();
      supabase.from("kullanicilar").select("id, ad_soyad").eq("role", "ogretmen").order("ad_soyad")
        .then(({ data }) => setOgretmenler(data || []));
    }
  }, [yetkili, filtre]);

  const fetchSatirlar = async () => {
    setYukleniyor(true);
    const { data } = await supabase
      .from("ders_programi")
      .select("*")
      .eq("program", filtre.program)
      .eq("sinif", filtre.sinif)
      .eq("donem", filtre.donem)
      .eq("yil", filtre.yil)
      .eq("aktif", true)
      .order("gun")
      .order("saat_baslangic");
    setSatirlar(data || []);
    setYukleniyor(false);
  };

  const bildir = (tip: "basari" | "hata", metin: string) => {
    setBildirim({ tip, metin });
    setTimeout(() => setBildirim(null), 3000);
  };

  const handleYeniAc = () => {
    setForm({ ...BOS_SATIR, program: filtre.program, sinif: filtre.sinif, donem: filtre.donem, yil: filtre.yil });
    setDuzenlenen(null);
    setKacSaat(1);
    setSeciliUnvan("Öğr.Gör.");
    setSeciliIsim("");
    setModalAcik(true);
  };

  const BOS_TOPLU: TopluSatir = { saat_baslangic: "09:00", kac_saat: 1, ders_kodu: "", ders_adi: "", derslik: "", ogretmen_adi: "", uzem: false };

  const handleTopluKapat = () => {
    setTopluModalAcik(false);
    setTopluGun("Pazartesi");
    setTopluSatirlar([{ ...BOS_TOPLU }]);
    setTopluUnvan(["Öğr.Gör."]);
    setTopluIsim([""]);
  };

  const handleTopluAc = () => {
    setTopluGun("Pazartesi");
    setTopluSatirlar([{ ...BOS_TOPLU }]);
    setTopluUnvan(["Öğr.Gör."]);
    setTopluIsim([""]);
    setTopluModalAcik(true);
  };

  const handleTopluSatirEkle = () => {
    setTopluSatirlar(p => [...p, { ...BOS_TOPLU }]);
    setTopluUnvan(p => [...p, "Öğr.Gör."]);
    setTopluIsim(p => [...p, ""]);
  };

  const handleTopluSatirSil = (idx: number) => {
    setTopluSatirlar(p => p.filter((_, i) => i !== idx));
    setTopluUnvan(p => p.filter((_, i) => i !== idx));
    setTopluIsim(p => p.filter((_, i) => i !== idx));
  };

  const handleTopluKaydet = async () => {
    const gecerli = topluSatirlar.filter(s => s.ders_adi.trim());
    if (gecerli.length === 0) { bildir("hata", "En az bir ders adı giriniz."); return; }
    const eklenecekler: Omit<Satir, "id">[] = [];
    gecerli.forEach((s, idx) => {
      const saatSirasi = Object.keys(SAAT_BITIS);
      const baslangicIdx = saatSirasi.indexOf(s.saat_baslangic);
      const ogretmenAdi = `${topluUnvan[idx] || ""} ${topluIsim[idx] || ""}`.trim();
      for (let i = 0; i < s.kac_saat; i++) {
        const si = baslangicIdx + i;
        if (si >= saatSirasi.length) break;
        const saat = saatSirasi[si];
        eklenecekler.push({
          ...filtre,
          gun: topluGun,
          saat_baslangic: saat,
          saat_bitis: SAAT_BITIS[saat],
          ders_kodu: s.ders_kodu,
          ders_adi: s.ders_adi,
          derslik: s.derslik,
          ogretmen_adi: ogretmenAdi,
          uzem: s.uzem,
          sira: 0,
          aktif: true,
        });
      }
    });
    await supabase.from("ders_programi").insert(eklenecekler);
    bildir("basari", `${eklenecekler.length} saat eklendi.`);
    handleTopluKapat();
    fetchSatirlar();
  };

  const handleDuzenle = (s: Satir) => {
    setForm({ ...s });
    setDuzenlenen(s.id ?? null);
    // ogretmen_adi'nden ünvan ve isim ayır
    const unvanlar = ["Dr. Öğr. Üyesi", "Doç. Dr.", "Prof. Dr.", "Arş. Gör.", "Öğr.Gör."];
    const bulunan = unvanlar.find(u => s.ogretmen_adi?.startsWith(u));
    if (bulunan) {
      setSeciliUnvan(bulunan);
      setSeciliIsim(s.ogretmen_adi.replace(bulunan, "").trim());
    } else {
      setSeciliUnvan("Öğr.Gör.");
      setSeciliIsim(s.ogretmen_adi || "");
    }
    setModalAcik(true);
  };

  const handleSil = async (id: string) => {
    if (!confirm("Bu satırı silmek istiyor musunuz?")) return;
    await supabase.from("ders_programi").update({ aktif: false }).eq("id", id);
    bildir("basari", "Silindi.");
    fetchSatirlar();
  };

  const handleKaydet = async () => {
    if (!form.ders_adi.trim()) { bildir("hata", "Ders adı zorunlu."); return; }
    if (!form.gun) { bildir("hata", "Gün seçiniz."); return; }
    if (duzenlenen) {
      await supabase.from("ders_programi").update({ ...form, aktif: true }).eq("id", duzenlenen);
      bildir("basari", "Güncellendi.");
    } else {
      const saatSirasi = Object.keys(SAAT_BITIS);
      const baslangicIdx = saatSirasi.indexOf(form.saat_baslangic);
      const eklenecekler = [];
      for (let i = 0; i < kacSaat; i++) {
        const idx = baslangicIdx + i;
        if (idx >= saatSirasi.length) break;
        const s = saatSirasi[idx];
        eklenecekler.push({ ...form, saat_baslangic: s, saat_bitis: SAAT_BITIS[s], aktif: true });
      }
      await supabase.from("ders_programi").insert(eklenecekler);
      bildir("basari", `${eklenecekler.length} saat eklendi.`);
    }
    setModalAcik(false);
    fetchSatirlar();
  };

  // Tablo verisi: saat x gün grid
  const tumSaatler = Array.from(new Set(satirlar.map(s => s.saat_baslangic))).sort();
  const grid: Record<string, Record<string, Satir[]>> = {};
  for (const saat of tumSaatler) {
    grid[saat] = {};
    for (const gun of GUNLER) {
      grid[saat][gun] = satirlar.filter(s => s.saat_baslangic === saat && s.gun === gun);
    }
  }

  const programLabel = PROGRAMLAR.find(p => p.value === filtre.program)?.label || "";
  const donemLabel = DONEMLER.find(d => d.value === filtre.donem)?.label || "";
  const baslik = `MESLEK YÜKSEKOKULU\nOTEL, LOKANTA VE İKRAM HİZMETLERİ BÖLÜMÜ / ${programLabel.toUpperCase()}\n${filtre.yil} EĞİTİM-ÖĞRETİM YILI ${donemLabel.toUpperCase()} ${filtre.sinif}. SINIF DERS PROGRAMI`;


  const handleExcelAktar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAktariliyor(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];

      const GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
      const SAAT_BITIS_MAP: Record<string, string> = {
        "08:00":"08:50","09:00":"09:50","10:00":"10:50","11:00":"11:50",
        "12:00":"12:50","13:00":"13:50","14:00":"14:50","15:00":"15:50",
        "16:00":"16:50","17:00":"17:50","18:00":"18:50","19:00":"19:50",
        "20:00":"20:50","21:00":"21:50",
      };

      // Gün sütunlarını bul
      const gunCols: Record<string, number> = {};
      for (const row of rows.slice(0, 10)) {
        row.forEach((cell, i) => { if (GUNLER.includes(String(cell))) gunCols[String(cell)] = i; });
        if (Object.keys(gunCols).length > 0) break;
      }

      const parseHucre = (metin: string) => {
        if (!metin?.trim()) return null;
        const satirlar = metin.split("\n").map(s => s.trim()).filter(Boolean);
        let ders_kodu = "", ders_adi = "", derslik = "", ogretmen_adi = "";
        for (const s of satirlar) {
          if (/^[A-Z]{2,4}\d{3}/.test(s)) {
            const m = s.match(/^([A-Z]{2,4}\d{3})[\s-]*(.*)/);
            if (m) { ders_kodu = m[1]; ders_adi = m[2].replace(/^[-\s]+/, ""); }
          } else if (/^[BC]\d|derslik/i.test(s)) {
            derslik = s.replace(/derslik\s*:?\s*/i, "").trim();
          } else if (/öğr|dr\.|doç|prof/i.test(s)) {
            ogretmen_adi = s.trim();
          } else if (!ders_adi) {
            ders_adi = s;
          }
        }
        if (!ders_adi && !ders_kodu) return null;
        return { ders_kodu, ders_adi: ders_adi.replace(/^[-\s"]+|[-\s"]+$/g, ""), derslik, ogretmen_adi, uzem: /uzem/i.test(metin) };
      };

      const eklenecekler: Omit<Satir, "id">[] = [];
      for (const row of rows.slice(3)) {
        const saat = String(row[0] || "").trim();
        const m = saat.match(/^(\d{1,2})[:.](\d{2})/);
        if (!m) continue;
        const saat_baslangic = `${m[1].padStart(2, "0")}:00`;
        const saat_bitis = SAAT_BITIS_MAP[saat_baslangic] || "";
        for (const [gun, colIdx] of Object.entries(gunCols)) {
          const hucre = parseHucre(String(row[colIdx] || ""));
          if (!hucre) continue;
          eklenecekler.push({
            ...filtre,
            gun,
            saat_baslangic,
            saat_bitis,
            ...hucre,
            sira: 0,
            aktif: true,
          });
        }
      }

      if (eklenecekler.length === 0) { bildir("hata", "Ders bulunamadı. Şablonu kontrol edin."); setAktariliyor(false); return; }

      // Önce mevcut kayıtları sil
      await supabase.from("ders_programi")
        .update({ aktif: false })
        .eq("program", filtre.program)
        .eq("sinif", filtre.sinif)
        .eq("donem", filtre.donem)
        .eq("yil", filtre.yil);

      await supabase.from("ders_programi").insert(eklenecekler);
      bildir("basari", `${eklenecekler.length} ders aktarıldı!`);
      fetchSatirlar();
    } catch (err) {
      bildir("hata", "Dosya okunamadı. Excel formatını kontrol edin.");
    }
    setAktariliyor(false);
    if (excelInputRef.current) excelInputRef.current.value = "";
  };

  const handleIndir = async () => {
    setIndiriliyor(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const el = tabloRef.current;
      if (!el) return;
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#f5f0eb",
        useCORS: true,
        allowTaint: true,
      });
      const link = document.createElement("a");
      link.download = `ders-programi-${filtre.program}-${filtre.sinif}sinif-${filtre.donem}-${filtre.yil}.jpeg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
      bildir("basari", "JPEG indirildi!");
    } catch (e) {
      bildir("hata", "İndirme hatası.");
    }
    setIndiriliyor(false);
  };

  if (authYukleniyor || !yetkili) return <LoadingSkeleton />;

  return (
    <DashboardLayout title="Ders Programı" subtitle="Program oluştur ve JPEG olarak indir">
      <div className="max-w-7xl space-y-5">

        {/* Bildirim */}
        {bildirim && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-xl border text-sm font-semibold flex items-center gap-2 ${
            bildirim.tip === "basari" ? "bg-white border-emerald-200 text-emerald-700" : "bg-white border-red-200 text-red-600"
          }`}>
            <span className={`w-2 h-2 rounded-full ${bildirim.tip === "basari" ? "bg-emerald-500" : "bg-red-500"}`} />
            {bildirim.metin}
          </div>
        )}

        {/* Filtre */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Program</label>
              <select value={filtre.program} onChange={e => setFiltre(p => ({ ...p, program: e.target.value }))}
                className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[220px]">
                {PROGRAMLAR.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Sınıf</label>
              <select value={filtre.sinif} onChange={e => setFiltre(p => ({ ...p, sinif: Number(e.target.value) }))}
                className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                {SINIFLAR.map(s => <option key={s} value={s}>{s}. Sınıf</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Dönem</label>
              <select value={filtre.donem} onChange={e => setFiltre(p => ({ ...p, donem: e.target.value }))}
                className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                {DONEMLER.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Yıl</label>
              <input value={filtre.yil} onChange={e => setFiltre(p => ({ ...p, yil: e.target.value }))}
                placeholder="2025-2026"
                className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 w-32" />
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={handleTopluAc}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm">
                📋 Toplu Giriş
              </button>
              <button onClick={handleYeniAc}
                className="text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm"
                style={{ background: "#B71C1C" }}>
                + Tekli Ekle
              </button>
              <label className={`cursor-pointer bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm ${aktariliyor ? "opacity-50 pointer-events-none" : ""}`}>
                {aktariliyor ? "Aktarılıyor..." : "📂 Excel'den Aktar"}
                <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelAktar} />
              </label>
              <button onClick={handleIndir} disabled={indiriliyor || satirlar.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm disabled:opacity-40">
                {indiriliyor ? "Hazırlanıyor..." : "⬇ JPEG İndir"}
              </button>
            </div>
          </div>
        </div>

        {/* Önizleme tablosu */}
        <div ref={tabloRef} style={{ background: "#f5f0eb", padding: "24px", borderRadius: "16px" }}>

          {/* Başlık */}
          <div style={{ background: "#8B0000", borderRadius: "12px 12px 0 0", padding: "20px 24px", textAlign: "center", color: "white" }}>
            {baslik.split("\n").map((line, i) => (
              <div key={i} style={{
                fontSize: i === 2 ? "16px" : i === 1 ? "13px" : "12px",
                fontWeight: i === 2 ? 900 : 700,
                letterSpacing: "0.5px",
                marginBottom: i < 2 ? "4px" : 0,
                opacity: i === 0 ? 0.85 : 1,
                textTransform: "uppercase",
              }}>{line}</div>
            ))}
          </div>

          {/* Tablo */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
              <thead>
                <tr>
                  <th style={{ background: "#6d0000", color: "white", padding: "10px 8px", fontSize: "12px", fontWeight: 700, textAlign: "center", border: "1px solid #7a0000", width: "95px" }}>Saat</th>
                  {GUNLER.map(g => (
                    <th key={g} style={{ background: "#8B0000", color: "white", padding: "10px 8px", fontSize: "13px", fontWeight: 700, textAlign: "center", border: "1px solid #7a0000" }}>{g}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yukleniyor ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#9ca3af", fontSize: "13px" }}>Yükleniyor...</td></tr>
                ) : tumSaatler.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "60px", color: "#9ca3af", fontSize: "13px" }}>
                    Henüz ders eklenmemiş. "+ Ders Ekle" butonuna tıklayın.
                  </td></tr>
                ) : (
                  tumSaatler.map((saat, idx) => (
                    <tr key={saat} style={{ background: idx % 2 === 0 ? "#ffffff" : "#fdf8f5" }}>
                      <td style={{ background: "#8B0000", color: "white", fontWeight: 700, fontSize: "11px", textAlign: "center", padding: "8px 4px", border: "1px solid #e8ddd5", whiteSpace: "nowrap" }}>
                        {saat}<br />{SAAT_BITIS[saat] || ""}
                      </td>
                      {GUNLER.map(gun => {
                        const dersler = grid[saat]?.[gun] || [];
                        return (
                          <td key={gun} style={{ border: "1px solid #e8ddd5", verticalAlign: "middle", textAlign: "center", padding: "6px 4px", minHeight: "52px", minWidth: "150px" }}>
                            {dersler.map((d, i) => (
                              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "2px" }}>
                                {d.ders_kodu && <span style={{ fontSize: "9px", fontWeight: 700, color: "#8B0000", letterSpacing: "0.5px", textTransform: "uppercase" }}>{d.ders_kodu}</span>}
                                <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#1a1a1a", lineHeight: 1.3 }}>{d.ders_adi}</span>
                                {d.derslik && !d.uzem && <span style={{ fontSize: "9.5px", color: "#6b7280", background: "#f3f4f6", padding: "1px 6px", borderRadius: "10px" }}>{d.derslik}</span>}
                                {d.uzem && <span style={{ fontSize: "9px", fontWeight: 700, color: "#856404", background: "#fff3cd", padding: "1px 6px", borderRadius: "8px" }}>UZEM</span>}
                                {d.ogretmen_adi && <span style={{ fontSize: "9px", color: "#9ca3af", fontStyle: "italic" }}>{d.ogretmen_adi}</span>}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Satır listesi - düzenle/sil */}
        {satirlar.length > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800 text-sm">Dersler <span className="text-zinc-400 font-normal">({satirlar.length} satır)</span></h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-2.5 text-xs text-zinc-500 font-semibold text-left">Gün</th>
                    <th className="px-4 py-2.5 text-xs text-zinc-500 font-semibold text-left">Saat</th>
                    <th className="px-4 py-2.5 text-xs text-zinc-500 font-semibold text-left">Kod</th>
                    <th className="px-4 py-2.5 text-xs text-zinc-500 font-semibold text-left">Ders Adı</th>
                    <th className="px-4 py-2.5 text-xs text-zinc-500 font-semibold text-left">Derslik</th>
                    <th className="px-4 py-2.5 text-xs text-zinc-500 font-semibold text-left">Öğretmen</th>
                    <th className="px-4 py-2.5 text-xs text-zinc-500 font-semibold text-center">UZEM</th>
                    <th className="px-4 py-2.5 text-xs text-zinc-500 font-semibold text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {satirlar.map(s => (
                    <tr key={s.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-medium text-zinc-700">{s.gun}</td>
                      <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap">{s.saat_baslangic} – {s.saat_bitis}</td>
                      <td className="px-4 py-2.5 text-red-700 font-semibold text-xs">{s.ders_kodu || "—"}</td>
                      <td className="px-4 py-2.5 text-zinc-800 font-medium">{s.ders_adi}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{s.derslik || "—"}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{s.ogretmen_adi || "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        {s.uzem ? <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">UZEM</span> : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleDuzenle(s)}
                            className="text-xs font-medium text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition">Düzenle</button>
                          <button onClick={() => handleSil(s.id ?? "")}
                            className="text-xs font-medium text-red-500 hover:bg-red-50 px-2.5 py-1 rounded-lg transition">Sil</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalAcik && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-800">{duzenlenen ? "Dersi Düzenle" : "Ders Ekle"}</h2>
              <button onClick={() => setModalAcik(false)} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">Gün *</label>
                  <select value={form.gun} onChange={e => setForm(p => ({ ...p, gun: e.target.value }))}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                    {GUNLER.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">Başlangıç Saati *</label>
                  <select value={form.saat_baslangic} onChange={e => setForm(p => ({ ...p, saat_baslangic: e.target.value, saat_bitis: SAAT_BITIS[e.target.value] || "" }))}
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                    {SAATLER.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {!duzenlenen && (
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 block mb-1">Kaç Saat?</label>
                    <select value={kacSaat} onChange={e => setKacSaat(Number(e.target.value))}
                      className="w-full border border-zinc-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                      {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} saat ({form.saat_baslangic} – {Object.keys(SAAT_BITIS)[Object.keys(SAAT_BITIS).indexOf(form.saat_baslangic) + n - 1] ? SAAT_BITIS[Object.keys(SAAT_BITIS)[Object.keys(SAAT_BITIS).indexOf(form.saat_baslangic) + n - 1]] : ""})</option>)}
                    </select>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">Ders Adı *</label>
                  <input value={form.ders_adi} onChange={e => setForm(p => ({ ...p, ders_adi: e.target.value }))}
                    placeholder="örn: Mutfak Uygulama II"
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">Ders Kodu</label>
                  <input value={form.ders_kodu} onChange={e => setForm(p => ({ ...p, ders_kodu: e.target.value }))}
                    placeholder="örn: ASC110"
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">Derslik</label>
                  <input value={form.derslik} onChange={e => setForm(p => ({ ...p, derslik: e.target.value }))}
                    placeholder="örn: B131 veya C107-108"
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">Öğretmen</label>
                  <div className="flex gap-2">
                    <select value={seciliUnvan}
                      onChange={e => { setSeciliUnvan(e.target.value); setForm(p => ({ ...p, ogretmen_adi: `${e.target.value} ${seciliIsim}`.trim() })); }}
                      className="border border-zinc-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 shrink-0">
                      {["Öğr.Gör.", "Arş. Gör.", "Dr. Öğr. Üyesi", "Doç. Dr.", "Prof. Dr."].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <select value={seciliIsim}
                      onChange={e => { setSeciliIsim(e.target.value); setForm(p => ({ ...p, ogretmen_adi: `${seciliUnvan} ${e.target.value}`.trim() })); }}
                      className="flex-1 border border-zinc-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                      <option value="">— İsim Seçiniz —</option>
                      {ogretmenler.map(o => <option key={o.id} value={o.ad_soyad}>{o.ad_soyad}</option>)}
                    </select>
                  </div>
                  {form.ogretmen_adi && <p className="text-xs text-zinc-400 mt-1">Görünecek: <span className="font-medium text-zinc-600">{form.ogretmen_adi}</span></p>}
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${form.uzem ? "bg-amber-400" : "bg-zinc-200"}`}
                      onClick={() => setForm(p => ({ ...p, uzem: !p.uzem }))}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.uzem ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-sm font-medium text-zinc-700">UZEM (Uzaktan Eğitim)</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalAcik(false)}
                  className="flex-1 border border-zinc-300 text-zinc-600 text-sm font-medium py-2.5 rounded-xl hover:bg-zinc-50 transition">
                  İptal
                </button>
                <button onClick={handleKaydet}
                  className="flex-1 text-white text-sm font-bold py-2.5 rounded-xl transition"
                  style={{ background: "#B71C1C" }}>
                  {duzenlenen ? "Güncelle" : "Ekle"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Toplu Giriş Modal ── */}
      {topluModalAcik && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-800">Toplu Ders Girişi</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Bir günün tüm derslerini tek seferde girin</p>
              </div>
              <button onClick={handleTopluKapat} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Gün seç */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-zinc-700 shrink-0">Gün:</label>
                <div className="flex gap-2 flex-wrap">
                  {GUNLER.map(g => (
                    <button key={g} onClick={() => setTopluGun(g)}
                      className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition ${topluGun === g ? "text-white shadow-sm" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
                      style={topluGun === g ? { background: "#B71C1C" } : {}}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Satırlar */}
              <div className="space-y-3">
                {topluSatirlar.map((s, idx) => (
                  <div key={idx} className="bg-zinc-50 rounded-xl p-4 space-y-3 relative border border-zinc-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Ders {idx + 1}</span>
                      {topluSatirlar.length > 1 && (
                        <button onClick={() => handleTopluSatirSil(idx)} className="text-red-400 hover:text-red-600 text-xs font-medium">✕ Kaldır</button>
                      )}
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      {/* Saat */}
                      <div className="col-span-2">
                        <label className="text-xs text-zinc-500 block mb-1">Başlangıç</label>
                        <select value={s.saat_baslangic}
                          onChange={e => setTopluSatirlar(p => p.map((r, i) => i === idx ? { ...r, saat_baslangic: e.target.value } : r))}
                          className="w-full border border-zinc-200 rounded-lg px-2 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                          {SAATLER.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      {/* Kaç saat */}
                      <div className="col-span-1">
                        <label className="text-xs text-zinc-500 block mb-1">Saat</label>
                        <select value={s.kac_saat}
                          onChange={e => setTopluSatirlar(p => p.map((r, i) => i === idx ? { ...r, kac_saat: Number(e.target.value) } : r))}
                          className="w-full border border-zinc-200 rounded-lg px-2 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                          {[1,2,3,4,5,6].map(n => <option key={n}>{n}</option>)}
                        </select>
                      </div>
                      {/* Ders kodu */}
                      <div className="col-span-2">
                        <label className="text-xs text-zinc-500 block mb-1">Kod</label>
                        <input value={s.ders_kodu} placeholder="ASC110"
                          onChange={e => setTopluSatirlar(p => p.map((r, i) => i === idx ? { ...r, ders_kodu: e.target.value } : r))}
                          className="w-full border border-zinc-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
                      </div>
                      {/* Ders adı */}
                      <div className="col-span-3">
                        <label className="text-xs text-zinc-500 block mb-1">Ders Adı *</label>
                        <input value={s.ders_adi} placeholder="Mutfak Uygulama II"
                          onChange={e => setTopluSatirlar(p => p.map((r, i) => i === idx ? { ...r, ders_adi: e.target.value } : r))}
                          className="w-full border border-zinc-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
                      </div>
                      {/* Derslik */}
                      <div className="col-span-2">
                        <label className="text-xs text-zinc-500 block mb-1">Derslik</label>
                        <input value={s.derslik} placeholder="B131"
                          onChange={e => setTopluSatirlar(p => p.map((r, i) => i === idx ? { ...r, derslik: e.target.value } : r))}
                          className="w-full border border-zinc-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
                      </div>
                      {/* UZEM */}
                      <div className="col-span-2 flex items-end pb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <div className={`w-8 h-4 rounded-full transition-colors relative ${s.uzem ? "bg-amber-400" : "bg-zinc-200"}`}
                            onClick={() => setTopluSatirlar(p => p.map((r, i) => i === idx ? { ...r, uzem: !r.uzem } : r))}>
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${s.uzem ? "translate-x-4" : "translate-x-0.5"}`} />
                          </div>
                          <span className="text-xs text-zinc-600">UZEM</span>
                        </label>
                      </div>
                    </div>
                    {/* Öğretmen */}
                    <div className="flex gap-2">
                      <select value={topluUnvan[idx] || "Öğr.Gör."}
                        onChange={e => setTopluUnvan(p => p.map((v, i) => i === idx ? e.target.value : v))}
                        className="border border-zinc-200 rounded-lg px-2 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 shrink-0">
                        {["Öğr.Gör.", "Arş. Gör.", "Dr. Öğr. Üyesi", "Doç. Dr.", "Prof. Dr."].map(u => <option key={u}>{u}</option>)}
                      </select>
                      <select value={topluIsim[idx] || ""}
                        onChange={e => setTopluIsim(p => p.map((v, i) => i === idx ? e.target.value : v))}
                        className="flex-1 border border-zinc-200 rounded-lg px-2 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="">— Öğretmen Seçiniz —</option>
                        {ogretmenler.map(o => <option key={o.id} value={o.ad_soyad}>{o.ad_soyad}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={handleTopluSatirEkle}
                className="w-full border-2 border-dashed border-zinc-200 text-zinc-500 hover:border-red-300 hover:text-red-600 text-sm font-medium py-2.5 rounded-xl transition">
                + Ders Ekle
              </button>

              <div className="flex gap-3 pt-2">
                <button onClick={handleTopluKapat}
                  className="flex-1 border border-zinc-300 text-zinc-600 text-sm font-medium py-2.5 rounded-xl hover:bg-zinc-50 transition">
                  İptal
                </button>
                <button onClick={handleTopluKaydet}
                  className="flex-1 text-white text-sm font-bold py-2.5 rounded-xl transition"
                  style={{ background: "#B71C1C" }}>
                  Tümünü Kaydet ({topluSatirlar.filter(s => s.ders_adi.trim()).length} ders)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}