"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout"
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import LoadingSkeleton from "../../components/LoadingSkeleton";

/* ─── TIPLER ─────────────────────────────── */
type Demirbas = {
  id: string;
  ad: string;
  kategori: string;
  marka: string | null;
  model: string | null;
  seri_no: string | null;
  beklenen_adet: number;
  durum: string;
  alis_tarihi: string | null;
  garanti_bitis: string | null;
  notlar: string | null;
  created_at: string;
};

type Sayim = {
  id: string;
  sayan_id: number;
  tarih: string;
  notlar: string | null;
  durum: string;
  sayan_adi?: string;
};

type SayimDetay = {
  id: string;
  sayim_id: string;
  demirbas_id: string;
  sayilan_adet: number;
  durum: string;
  notlar: string | null;
  demirbas_adi?: string;
  beklenen_adet?: number;
};

type SayimSatiri = {
  demirbas_id: string;
  ad: string;
  kategori: string;
  beklenen_adet: number;
  sayilan_adet: number;
  durum: string;
  notlar: string;
};

/* ─── KATEGORiLER ─────────────────────────── */
const KATEGORILER = [
  "Tumu",
  "Pisirme Ekipmanlari",
  "Sogutma ve Muhafaza Ekipmanlari",
  "Hazirlik Ekipmanlari",
  "Kucuk El Aletleri",
  "Pastacilik ve Ekmekcilik Ekipmanlari",
  "Servis Ekipmanlari",
  "Olcum ve Kontrol Ekipmanlari",
  "Hijyen ve Is Guvenligi Ekipmanlari",
  "Mobilya ve Sabit Donanim",
  "Elektrikli Kucuk Cihazlar",
];

const DURUM_SECENEKLERI = ["saglam", "arizali", "hurda"];

const DURUM_STIL: Record<string, { bg: string; text: string; label: string }> = {
  saglam:  { bg: "#D1FAE5", text: "#065F46", label: "Saglam" },
  arizali: { bg: "#FEF3C7", text: "#92400E", label: "Arizali" },
  hurda:   { bg: "#FEE2E2", text: "#991B1B", label: "Hurda" },
  taslak:  { bg: "#E0E7FF", text: "#3730A3", label: "Taslak" },
  tamamlandi: { bg: "#D1FAE5", text: "#065F46", label: "Tamamlandi" },
};

/* ═══════════════════════════════════════════ */
export default function EnvanterSayimSayfasi() {
  const { yetkili, yukleniyor } = useAuth("/bolum-baskani/envanter-sayim");

  /* --- ORTAK STATE --- */
  const [aktifSekme, setAktifSekme] = useState<"demirbaslar" | "sayim">("demirbaslar");

  /* --- DEMiRBAS STATE --- */
  const [demirbaslar, setDemirbaslar] = useState<Demirbas[]>([]);
  const [demirbasYukleniyor, setDemirbasYukleniyor] = useState(true);
  const [arama, setArama] = useState("");
  const [kategoriFiltre, setKategoriFiltre] = useState("Tumu");
  const [formAcik, setFormAcik] = useState(false);
  const [duzenleId, setDuzenleId] = useState<string | null>(null);
  const [silOnay, setSilOnay] = useState<string | null>(null);
  const [form, setForm] = useState({
    ad: "", kategori: "Pisirme Ekipmanlari", marka: "", model: "", seri_no: "",
    beklenen_adet: "0", durum: "saglam", alis_tarihi: "", garanti_bitis: "", notlar: "",
  });

  /* --- SAYIM STATE --- */
  const [sayimlar, setSayimlar] = useState<Sayim[]>([]);
  const [sayimModu, setSayimModu] = useState(false);
  const [sayimSatirlari, setSayimSatirlari] = useState<SayimSatiri[]>([]);
  const [sayimNot, setSayimNot] = useState("");
  const [kayitEdiliyor, setKayitEdiliyor] = useState(false);
  const [detayGoster, setDetayGoster] = useState<string | null>(null);
  const [detaySatirlari, setDetaySatirlari] = useState<SayimDetay[]>([]);
  const [detayYukleniyor, setDetayYukleniyor] = useState(false);

  /* ─── VERi CEKME ───────────────────────── */
  const fetchDemirbaslar = useCallback(async () => {
    setDemirbasYukleniyor(true);
    const { data } = await supabase
      .from("demirbaslar")
      .select("*")
      .order("kategori")
      .order("ad");
    setDemirbaslar(data || []);
    setDemirbasYukleniyor(false);
  }, []);

  const fetchSayimlar = useCallback(async () => {
    const { data } = await supabase
      .from("envanter_sayimlar")
      .select("*")
      .order("tarih", { ascending: false });

    if (data) {
      const ids = Array.from(new Set(data.map((s) => s.sayan_id)));
      const { data: kullanicilar } = await supabase
        .from("kullanicilar")
        .select("id, ad_soyad")
        .in("id", ids);

      const map: Record<number, string> = {};
      kullanicilar?.forEach((k) => (map[k.id] = k.ad_soyad));
      setSayimlar(data.map((s) => ({ ...s, sayan_adi: map[s.sayan_id] || "Bilinmiyor" })));
    }
  }, []);

  useEffect(() => {
    if (!yetkili) return;
    fetchDemirbaslar();
    fetchSayimlar();
  }, [yetkili, fetchDemirbaslar, fetchSayimlar]);

  /* ─── DEMiRBAS CRUD ────────────────────── */
  const resetForm = () => {
    setForm({ ad: "", kategori: "Pisirme Ekipmanlari", marka: "", model: "", seri_no: "", beklenen_adet: "0", durum: "saglam", alis_tarihi: "", garanti_bitis: "", notlar: "" });
    setDuzenleId(null);
    setFormAcik(false);
  };

  const handleDuzenle = (d: Demirbas) => {
    setForm({
      ad: d.ad,
      kategori: d.kategori,
      marka: d.marka || "",
      model: d.model || "",
      seri_no: d.seri_no || "",
      beklenen_adet: String(d.beklenen_adet),
      durum: d.durum,
      alis_tarihi: d.alis_tarihi || "",
      garanti_bitis: d.garanti_bitis || "",
      notlar: d.notlar || "",
    });
    setDuzenleId(d.id);
    setFormAcik(true);
  };

  const handleKaydet = async () => {
    const kayit = {
      ad: form.ad.trim(),
      kategori: form.kategori,
      marka: form.marka.trim() || null,
      model: form.model.trim() || null,
      seri_no: form.seri_no.trim() || null,
      beklenen_adet: parseInt(form.beklenen_adet) || 0,
      durum: form.durum,
      alis_tarihi: form.alis_tarihi || null,
      garanti_bitis: form.garanti_bitis || null,
      notlar: form.notlar.trim() || null,
    };

    if (!kayit.ad) return alert("Demirbas adi zorunludur!");

    if (duzenleId) {
      await supabase.from("demirbaslar").update(kayit).eq("id", duzenleId);
    } else {
      await supabase.from("demirbaslar").insert([kayit]);
    }
    resetForm();
    fetchDemirbaslar();
  };

  const handleSil = async (id: string) => {
    await supabase.from("demirbaslar").delete().eq("id", id);
    setSilOnay(null);
    fetchDemirbaslar();
  };

  /* ─── DEMiRBAS EXCEL SABLON iNDiR ────── */
  const demirbasSablonIndir = () => {
    const satirlar = KATEGORILER.filter((k) => k !== "Tumu").flatMap((kategori) => [
      {
        "Demirbas Adi": "",
        "Kategori": kategori,
        "Marka": "",
        "Model": "",
        "Seri No": "",
        "Adet": "",
        "Durum (saglam/arizali/hurda)": "saglam",
        "Alis Tarihi (YYYY-MM-DD)": "",
        "Garanti Bitis (YYYY-MM-DD)": "",
        "Notlar": "",
      },
    ]);

    const ws = XLSX.utils.json_to_sheet(satirlar);

    ws["!cols"] = [
      { wch: 28 }, { wch: 36 }, { wch: 14 }, { wch: 14 },
      { wch: 16 }, { wch: 8 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 24 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Demirbaslar");

    /* Ikinci sayfa: Kategori listesi referansi */
    const refSatirlari = KATEGORILER.filter((k) => k !== "Tumu").map((k) => ({ "Gecerli Kategoriler": k }));
    const wsRef = XLSX.utils.json_to_sheet(refSatirlari);
    wsRef["!cols"] = [{ wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsRef, "Kategori Listesi");

    XLSX.writeFile(wb, `demirbas_sablon_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  /* ─── DEMiRBAS EXCEL YUKLE ─────────── */
  const [demirbasExcelYukleniyor, setDemirbasExcelYukleniyor] = useState(false);

  const demirbasExcelYukle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDemirbasExcelYukleniyor(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string | number>[] = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          alert("Excel dosyasi bos veya hatali format!");
          setDemirbasExcelYukleniyor(false);
          return;
        }

        const gecerliKategoriler = KATEGORILER.filter((k) => k !== "Tumu");

        const yeniDemirbaslar = rows
          .filter((r) => String(r["Demirbas Adi"] || "").trim() !== "")
          .map((r) => {
            const kategori = String(r["Kategori"] || "").trim();
            return {
              ad: String(r["Demirbas Adi"] || "").trim(),
              kategori: gecerliKategoriler.includes(kategori) ? kategori : "Pisirme Ekipmanlari",
              marka: String(r["Marka"] || "").trim() || null,
              model: String(r["Model"] || "").trim() || null,
              seri_no: String(r["Seri No"] || "").trim() || null,
              beklenen_adet: parseInt(String(r["Adet"] || "0")) || 0,
              durum: ["saglam", "arizali", "hurda"].includes(String(r["Durum (saglam/arizali/hurda)"] || "").trim().toLowerCase())
                ? String(r["Durum (saglam/arizali/hurda)"] || "").trim().toLowerCase()
                : "saglam",
              alis_tarihi: String(r["Alis Tarihi (YYYY-MM-DD)"] || "").trim() || null,
              garanti_bitis: String(r["Garanti Bitis (YYYY-MM-DD)"] || "").trim() || null,
              notlar: String(r["Notlar"] || "").trim() || null,
            };
          });

        if (yeniDemirbaslar.length === 0) {
          alert("Gecerli demirbas satiri bulunamadi! Lutfen 'Demirbas Adi' sutununu doldurun.");
          setDemirbasExcelYukleniyor(false);
          return;
        }

        const { error } = await supabase.from("demirbaslar").insert(yeniDemirbaslar);

        if (error) {
          alert("Veritabanina kaydedilemedi: " + error.message);
        } else {
          alert(`${yeniDemirbaslar.length} demirbas basariyla eklendi!`);
          fetchDemirbaslar();
        }
      } catch {
        alert("Excel dosyasi okunamadi. Lutfen sablon formatina uygun bir dosya yukleyin.");
      }
      setDemirbasExcelYukleniyor(false);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  /* ─── SAYIM iSLEMLERi ─────────────────── */
  const yeniSayimBaslat = () => {
    const satirlar: SayimSatiri[] = demirbaslar.map((d) => ({
      demirbas_id: d.id,
      ad: d.ad,
      kategori: d.kategori,
      beklenen_adet: d.beklenen_adet,
      sayilan_adet: 0,
      durum: "saglam",
      notlar: "",
    }));
    setSayimSatirlari(satirlar);
    setSayimNot("");
    setSayimModu(true);
  };

  const sayimAdetGuncelle = (idx: number, delta: number) => {
    setSayimSatirlari((prev) => {
      const yeni = [...prev];
      yeni[idx] = { ...yeni[idx], sayilan_adet: Math.max(0, yeni[idx].sayilan_adet + delta) };
      return yeni;
    });
  };

  const sayimDurumGuncelle = (idx: number, durum: string) => {
    setSayimSatirlari((prev) => {
      const yeni = [...prev];
      yeni[idx] = { ...yeni[idx], durum };
      return yeni;
    });
  };

  const sayimNotGuncelle = (idx: number, notlar: string) => {
    setSayimSatirlari((prev) => {
      const yeni = [...prev];
      yeni[idx] = { ...yeni[idx], notlar };
      return yeni;
    });
  };

  const sayimiKaydet = async (durum: "taslak" | "tamamlandi") => {
    setKayitEdiliyor(true);
    const sayanId = localStorage.getItem("aktifKullaniciId");

    const { data: sayim, error } = await supabase
      .from("envanter_sayimlar")
      .insert([{ sayan_id: Number(sayanId), notlar: sayimNot.trim() || null, durum }])
      .select()
      .single();

    if (error || !sayim) {
      alert("Sayim kaydedilemedi!");
      setKayitEdiliyor(false);
      return;
    }

    const detaylar = sayimSatirlari.map((s) => ({
      sayim_id: sayim.id,
      demirbas_id: s.demirbas_id,
      sayilan_adet: s.sayilan_adet,
      durum: s.durum,
      notlar: s.notlar.trim() || null,
    }));

    await supabase.from("envanter_sayim_detay").insert(detaylar);

    setSayimModu(false);
    setKayitEdiliyor(false);
    fetchSayimlar();
  };

  /* ─── EXCEL SABLON iNDiR ────────────── */
  const excelSablonIndir = () => {
    const satirlar = demirbaslar.map((d) => ({
      "Demirbas Adi": d.ad,
      "Kategori": d.kategori,
      "Marka": d.marka || "",
      "Model": d.model || "",
      "Seri No": d.seri_no || "",
      "Beklenen Adet": d.beklenen_adet,
      "Sayilan Adet": "",
      "Durum (saglam/arizali/hurda)": "saglam",
      "Not": "",
    }));

    const ws = XLSX.utils.json_to_sheet(satirlar);

    /* Kolon genislikleri */
    ws["!cols"] = [
      { wch: 28 }, { wch: 32 }, { wch: 14 }, { wch: 14 },
      { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Envanter Sayim");
    XLSX.writeFile(wb, `envanter_sayim_sablon_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  /* ─── EXCEL YUKLE ──────────────────── */
  const [excelYukleniyor, setExcelYukleniyor] = useState(false);

  const excelYukle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelYukleniyor(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string | number>[] = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          alert("Excel dosyasi bos veya hatali format!");
          setExcelYukleniyor(false);
          return;
        }

        /* Eslestirme: Excel satirlarini mevcut demirbaslarla eslestir */
        const yeniSatirlar: SayimSatiri[] = demirbaslar.map((d) => {
          const eslesme = rows.find(
            (r) =>
              String(r["Demirbas Adi"] || "").trim().toLowerCase() === d.ad.trim().toLowerCase() &&
              String(r["Kategori"] || "").trim().toLowerCase() === d.kategori.trim().toLowerCase()
          );

          return {
            demirbas_id: d.id,
            ad: d.ad,
            kategori: d.kategori,
            beklenen_adet: d.beklenen_adet,
            sayilan_adet: eslesme ? (parseInt(String(eslesme["Sayilan Adet"])) || 0) : 0,
            durum: eslesme
              ? (["saglam", "arizali", "hurda"].includes(String(eslesme["Durum (saglam/arizali/hurda)"] || "").trim().toLowerCase())
                  ? String(eslesme["Durum (saglam/arizali/hurda)"] || "").trim().toLowerCase()
                  : "saglam")
              : "saglam",
            notlar: eslesme ? String(eslesme["Not"] || "") : "",
          };
        });

        setSayimSatirlari(yeniSatirlar);
        setSayimNot("Excel ile yuklenen sayim");
        setSayimModu(true);
        alert(`${rows.length} satirdan ${yeniSatirlar.filter((s) => s.sayilan_adet > 0).length} demirbas basariyla eslesti.`);
      } catch {
        alert("Excel dosyasi okunamadi. Lutfen sablon formatina uygun bir dosya yukleyin.");
      }
      setExcelYukleniyor(false);
    };
    reader.readAsBinaryString(file);

    /* Input'u sifirla (ayni dosyayi tekrar yukleyebilmek icin) */
    e.target.value = "";
  };

  const sayimDetayGoster = async (sayimId: string) => {
    setDetayGoster(sayimId);
    setDetayYukleniyor(true);

    const { data } = await supabase
      .from("envanter_sayim_detay")
      .select("*")
      .eq("sayim_id", sayimId);

    if (data) {
      const demirbasIds = data.map((d) => d.demirbas_id);
      const { data: demirbasData } = await supabase
        .from("demirbaslar")
        .select("id, ad, beklenen_adet")
        .in("id", demirbasIds);

      const map: Record<string, { ad: string; beklenen: number }> = {};
      demirbasData?.forEach((d) => (map[d.id] = { ad: d.ad, beklenen: d.beklenen_adet }));

      setDetaySatirlari(
        data.map((d) => ({
          ...d,
          demirbas_adi: map[d.demirbas_id]?.ad || "Silinmis",
          beklenen_adet: map[d.demirbas_id]?.beklenen ?? 0,
        }))
      );
    }
    setDetayYukleniyor(false);
  };

  /* ─── FiLTRELENMiS LiSTE ──────────────── */
  const filtrelenmis = demirbaslar.filter((d) => {
    const aramaUygun = d.ad.toLowerCase().includes(arama.toLowerCase()) ||
      (d.marka || "").toLowerCase().includes(arama.toLowerCase());
    const kategoriUygun = kategoriFiltre === "Tumu" || d.kategori === kategoriFiltre;
    return aramaUygun && kategoriUygun;
  });

  /* ─── iSTATiSTiKLER ────────────────────── */
  const istatistik = {
    toplam: demirbaslar.length,
    saglam: demirbaslar.filter((d) => d.durum === "saglam").length,
    arizali: demirbaslar.filter((d) => d.durum === "arizali").length,
    hurda: demirbaslar.filter((d) => d.durum === "hurda").length,
  };

  if (yukleniyor || !yetkili) return <LoadingSkeleton />;

  return (
    <DashboardLayout title="Envanter Sayim" subtitle="Mutfak Demirbas Yonetimi">
      <div className="space-y-6 max-w-6xl">

        {/* ═══ SEKME BASLIKLARI ═══ */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-zinc-200 shadow-sm w-fit">
          {[
            { key: "demirbaslar" as const, label: "Demirbaslar" },
            { key: "sayim" as const, label: "Sayim Yap / Gecmis" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => { setAktifSekme(s.key); setSayimModu(false); setDetayGoster(null); }}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                aktifSekme === s.key
                  ? "text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50"
              }`}
              style={aktifSekme === s.key ? { background: "#B71C1C" } : {}}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* ═══ DEMiRBASLAR SEKMESi ═══════════════ */}
        {/* ═══════════════════════════════════════ */}
        {aktifSekme === "demirbaslar" && (
          <>
            {/* istatistik Kartlari */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Toplam Demirbas", val: istatistik.toplam, renk: "#2563EB", bg: "#EFF6FF" },
                { label: "Saglam", val: istatistik.saglam, renk: "#059669", bg: "#ECFDF5" },
                { label: "Arizali", val: istatistik.arizali, renk: "#D97706", bg: "#FFFBEB" },
                { label: "Hurda", val: istatistik.hurda, renk: "#DC2626", bg: "#FEF2F2" },
              ].map((k) => (
                <div key={k.label} className="rounded-2xl border border-zinc-100 p-4 text-center" style={{ background: k.bg }}>
                  <p className="text-2xl font-black" style={{ color: k.renk }}>{k.val}</p>
                  <p className="text-xs text-zinc-500 mt-1">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Arama + Filtre */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Demirbas ara (ad veya marka)..."
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white"
              />
              <select
                value={kategoriFiltre}
                onChange={(e) => setKategoriFiltre(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                {KATEGORILER.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            {/* Ekle + Excel Butonlari */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Excel Sablon Indir */}
              <button
                onClick={demirbasSablonIndir}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Sablon Indir
              </button>

              {/* Excel Toplu Yukle */}
              <label
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-blue-300 text-blue-700 hover:bg-blue-50 transition cursor-pointer ${demirbasExcelYukleniyor ? "opacity-50 pointer-events-none" : ""}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {demirbasExcelYukleniyor ? "Yukleniyor..." : "Toplu Yukle (Excel)"}
                <input type="file" accept=".xlsx,.xls" onChange={demirbasExcelYukle} className="hidden" />
              </label>

              {/* Tek Tek Ekle */}
              <button
                onClick={() => { resetForm(); setFormAcik(true); }}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition shrink-0"
                style={{ background: "#B71C1C" }}
              >
                + Yeni Demirbas
              </button>
            </div>

            {/* Demirbas Tablosu */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100" style={{ background: "#FAFAFA" }}>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-600">Ad</th>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-600">Kategori</th>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-600">Marka / Model</th>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-600">Seri No</th>
                      <th className="text-center px-4 py-3 font-semibold text-zinc-600">Adet</th>
                      <th className="text-center px-4 py-3 font-semibold text-zinc-600">Durum</th>
                      <th className="text-center px-4 py-3 font-semibold text-zinc-600">Garanti</th>
                      <th className="text-center px-4 py-3 font-semibold text-zinc-600">Islem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demirbasYukleniyor ? (
                      <tr><td colSpan={8} className="text-center py-12 text-zinc-400">Yukleniyor...</td></tr>
                    ) : filtrelenmis.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-zinc-400">Demirbas bulunamadi</td></tr>
                    ) : filtrelenmis.map((d) => {
                      const ds = DURUM_STIL[d.durum] || DURUM_STIL.saglam;
                      const garantiGecmis = d.garanti_bitis && new Date(d.garanti_bitis) < new Date();
                      return (
                        <tr key={d.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition">
                          <td className="px-4 py-3 font-semibold text-zinc-800">{d.ad}</td>
                          <td className="px-4 py-3 text-zinc-500">{d.kategori}</td>
                          <td className="px-4 py-3 text-zinc-500">{[d.marka, d.model].filter(Boolean).join(" / ") || "-"}</td>
                          <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{d.seri_no || "-"}</td>
                          <td className="px-4 py-3 text-center font-bold text-zinc-700">{d.beklenen_adet}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: ds.bg, color: ds.text }}>{ds.label}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {d.garanti_bitis ? (
                              <span className={`text-xs font-medium ${garantiGecmis ? "text-red-600" : "text-green-600"}`}>
                                {new Date(d.garanti_bitis).toLocaleDateString("tr-TR")}
                              </span>
                            ) : <span className="text-zinc-300">-</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleDuzenle(d)} className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition">Duzenle</button>
                              <button onClick={() => setSilOnay(d.id)} className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition">Sil</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─── DEMiRBAS FORM MODAL ─── */}
            {formAcik && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => resetForm()}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-zinc-900">{duzenleId ? "Demirbas Duzenle" : "Yeni Demirbas Ekle"}</h3>
                    <button onClick={resetForm} className="text-zinc-400 hover:text-zinc-600 text-xl">&times;</button>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1">Demirbas Adi *</label>
                      <input type="text" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" placeholder="Orn: Endustriyel Ocak" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1">Kategori *</label>
                        <select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200">
                          {KATEGORILER.filter((k) => k !== "Tumu").map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1">Durum</label>
                        <select value={form.durum} onChange={(e) => setForm({ ...form, durum: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200">
                          {DURUM_SECENEKLERI.map((d) => <option key={d} value={d}>{DURUM_STIL[d]?.label || d}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1">Marka</label>
                        <input type="text" value={form.marka} onChange={(e) => setForm({ ...form, marka: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" placeholder="Orn: Bosch" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1">Model</label>
                        <input type="text" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" placeholder="Orn: XK-200" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1">Seri No</label>
                        <input type="text" value={form.seri_no} onChange={(e) => setForm({ ...form, seri_no: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" placeholder="Orn: SN-123456" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1">Beklenen Adet</label>
                        <input type="number" min="0" value={form.beklenen_adet} onChange={(e) => setForm({ ...form, beklenen_adet: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1">Alis Tarihi</label>
                        <input type="date" value={form.alis_tarihi} onChange={(e) => setForm({ ...form, alis_tarihi: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1">Garanti Bitis</label>
                        <input type="date" value={form.garanti_bitis} onChange={(e) => setForm({ ...form, garanti_bitis: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1">Notlar</label>
                      <textarea value={form.notlar} onChange={(e) => setForm({ ...form, notlar: e.target.value })} rows={2}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none" placeholder="Ek notlar..." />
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-2">
                    <button onClick={resetForm} className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 border border-zinc-200 hover:bg-zinc-50 transition">Iptal</button>
                    <button onClick={handleKaydet} className="px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition" style={{ background: "#B71C1C" }}>
                      {duzenleId ? "Guncelle" : "Kaydet"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── SiL ONAY MODAL ─── */}
            {silOnay && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSilOnay(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-zinc-900 mb-2">Demirbas Sil</h3>
                  <p className="text-sm text-zinc-500 mb-5">Bu demirbasi silmek istediginizden emin misiniz? Bu islem geri alinamaz.</p>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setSilOnay(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 border border-zinc-200 hover:bg-zinc-50 transition">Iptal</button>
                    <button onClick={() => handleSil(silOnay)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition">Evet, Sil</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* ═══ SAYIM SEKMESi ═════════════════════ */}
        {/* ═══════════════════════════════════════ */}
        {aktifSekme === "sayim" && !sayimModu && !detayGoster && (
          <>
            {/* Yeni sayim butonu + Excel butonlari */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-sm text-zinc-500">Gecmis sayimlarinizi goruntuleyebilir veya yeni bir sayim baslabilirsiniz.</p>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {/* Excel Sablon Indir */}
                <button
                  onClick={excelSablonIndir}
                  disabled={demirbaslar.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Sablon Indir
                </button>

                {/* Excel Yukle */}
                <label
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-blue-300 text-blue-700 hover:bg-blue-50 transition cursor-pointer ${demirbaslar.length === 0 || excelYukleniyor ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {excelYukleniyor ? "Yukleniyor..." : "Excel Yukle"}
                  <input type="file" accept=".xlsx,.xls" onChange={excelYukle} className="hidden" />
                </label>

                {/* Yeni Sayim Baslat */}
                <button
                  onClick={yeniSayimBaslat}
                  disabled={demirbaslar.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition disabled:opacity-50"
                  style={{ background: "#B71C1C" }}
                >
                  + Yeni Sayim Baslat
                </button>
              </div>
            </div>

            {/* Gecmis Sayimlar Tablosu */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100">
                <h3 className="font-bold text-zinc-800">Gecmis Sayimlar</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100" style={{ background: "#FAFAFA" }}>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-600">Tarih</th>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-600">Sayan</th>
                      <th className="text-center px-4 py-3 font-semibold text-zinc-600">Durum</th>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-600">Not</th>
                      <th className="text-center px-4 py-3 font-semibold text-zinc-600">Islem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sayimlar.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-zinc-400">Henuz sayim yapilmamis</td></tr>
                    ) : sayimlar.map((s) => {
                      const ds = DURUM_STIL[s.durum] || DURUM_STIL.taslak;
                      return (
                        <tr key={s.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition">
                          <td className="px-4 py-3 font-medium text-zinc-700">{new Date(s.tarih).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="px-4 py-3 text-zinc-500">{s.sayan_adi}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: ds.bg, color: ds.text }}>{ds.label}</span>
                          </td>
                          <td className="px-4 py-3 text-zinc-400 text-xs max-w-[200px] truncate">{s.notlar || "-"}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => sayimDetayGoster(s.id)} className="px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg transition">Detay</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══ SAYIM DETAY GORUNUMU ═══ */}
        {aktifSekme === "sayim" && detayGoster && (
          <>
            <button onClick={() => { setDetayGoster(null); setDetaySatirlari([]); }} className="text-sm font-semibold hover:underline" style={{ color: "#B71C1C" }}>
              &larr; Gecmis Sayimlara Don
            </button>

            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100">
                <h3 className="font-bold text-zinc-800">Sayim Detayi</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Beklenen ve sayilan adetlerin karsilastirmasi</p>
              </div>
              {detayYukleniyor ? (
                <p className="text-center py-12 text-zinc-400 text-sm">Yukleniyor...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100" style={{ background: "#FAFAFA" }}>
                        <th className="text-left px-4 py-3 font-semibold text-zinc-600">Demirbas</th>
                        <th className="text-center px-4 py-3 font-semibold text-zinc-600">Beklenen</th>
                        <th className="text-center px-4 py-3 font-semibold text-zinc-600">Sayilan</th>
                        <th className="text-center px-4 py-3 font-semibold text-zinc-600">Fark</th>
                        <th className="text-center px-4 py-3 font-semibold text-zinc-600">Durum</th>
                        <th className="text-left px-4 py-3 font-semibold text-zinc-600">Not</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detaySatirlari.map((d) => {
                        const fark = d.sayilan_adet - (d.beklenen_adet ?? 0);
                        const ds = DURUM_STIL[d.durum] || DURUM_STIL.saglam;
                        return (
                          <tr key={d.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition">
                            <td className="px-4 py-3 font-semibold text-zinc-800">{d.demirbas_adi}</td>
                            <td className="px-4 py-3 text-center text-zinc-500">{d.beklenen_adet}</td>
                            <td className="px-4 py-3 text-center font-bold text-zinc-700">{d.sayilan_adet}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-bold ${fark === 0 ? "text-green-600" : fark < 0 ? "text-red-600" : "text-blue-600"}`}>
                                {fark > 0 ? `+${fark}` : fark}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: ds.bg, color: ds.text }}>{ds.label}</span>
                            </td>
                            <td className="px-4 py-3 text-zinc-400 text-xs">{d.notlar || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ YENi SAYIM MODU ═══ */}
        {aktifSekme === "sayim" && sayimModu && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Yeni Envanter Sayimi</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Tum demirbas kalemlerini sayarak asagiya girin</p>
              </div>
              <button onClick={() => setSayimModu(false)} className="px-4 py-2 text-sm font-medium text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition">Iptal</button>
            </div>

            {/* Sayim Genel Notu */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Sayim Notu (opsiyonel)</label>
              <input
                type="text"
                value={sayimNot}
                onChange={(e) => setSayimNot(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white"
                placeholder="Orn: Donem sonu genel sayim..."
              />
            </div>

            {/* Sayim Tablosu */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100" style={{ background: "#FAFAFA" }}>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-600">Demirbas</th>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-600">Kategori</th>
                      <th className="text-center px-4 py-3 font-semibold text-zinc-600">Beklenen</th>
                      <th className="text-center px-4 py-3 font-semibold text-zinc-600">Sayilan Adet</th>
                      <th className="text-center px-4 py-3 font-semibold text-zinc-600">Durum</th>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-600">Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sayimSatirlari.map((s, idx) => (
                      <tr key={s.demirbas_id} className="border-b border-zinc-50">
                        <td className="px-4 py-3 font-semibold text-zinc-800">{s.ad}</td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">{s.kategori}</td>
                        <td className="px-4 py-3 text-center text-zinc-400">{s.beklenen_adet}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => sayimAdetGuncelle(idx, -1)} className="w-8 h-8 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition font-bold text-lg flex items-center justify-center">-</button>
                            <input
                              type="number"
                              min="0"
                              value={s.sayilan_adet}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setSayimSatirlari((prev) => { const yeni = [...prev]; yeni[idx] = { ...yeni[idx], sayilan_adet: val }; return yeni; });
                              }}
                              className="w-16 text-center py-1.5 rounded-lg border border-zinc-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-200"
                            />
                            <button onClick={() => sayimAdetGuncelle(idx, 1)} className="w-8 h-8 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition font-bold text-lg flex items-center justify-center">+</button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select value={s.durum} onChange={(e) => sayimDurumGuncelle(idx, e.target.value)} className="px-2 py-1.5 rounded-lg border border-zinc-200 text-xs bg-white focus:outline-none">
                            {DURUM_SECENEKLERI.map((d) => <option key={d} value={d}>{DURUM_STIL[d]?.label || d}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={s.notlar} onChange={(e) => sayimNotGuncelle(idx, e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-red-200" placeholder="Not..." />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Kaydet Butonlari */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => sayimiKaydet("taslak")}
                disabled={kayitEdiliyor}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-50"
              >
                {kayitEdiliyor ? "Kaydediliyor..." : "Taslak Olarak Kaydet"}
              </button>
              <button
                onClick={() => sayimiKaydet("tamamlandi")}
                disabled={kayitEdiliyor}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition disabled:opacity-50"
                style={{ background: "#059669" }}
              >
                {kayitEdiliyor ? "Kaydediliyor..." : "Sayimi Tamamla"}
              </button>
            </div>
          </>
        )}

      </div>
    </DashboardLayout>
  );
}