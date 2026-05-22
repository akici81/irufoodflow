"use client";

import { useEffect, useRef, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";
import LoadingSkeleton from "../components/LoadingSkeleton";

type Satir = {
  id: string;
  gun: string;
  saat_baslangic: string;
  saat_bitis: string;
  ders_kodu: string;
  ders_adi: string;
  derslik: string;
  ogretmen_adi: string;
  uzem: boolean;
  program: string;
  sinif: number;
};

const GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const SAAT_BITIS: Record<string, string> = {
  "08:00": "08:50", "09:00": "09:50", "10:00": "10:50", "11:00": "11:50",
  "12:00": "12:50", "13:00": "13:50", "14:00": "14:50", "15:00": "15:50",
  "16:00": "16:50", "17:00": "17:50", "18:00": "18:50", "19:00": "19:50",
  "20:00": "20:50", "21:00": "21:50",
};
const PROG_LABEL: Record<string, string> = {
  ascilik: "Ascilk",
  pastacilk: "Pastacilk",
};

export default function DersProgramimPage() {
  const { yetkili, yukleniyor } = useAuth("/ders-programim");
  const [adSoyad, setAdSoyad] = useState("");
  const [derslerim, setDerslerim] = useState<Satir[]>([]);
  const [veriYukleniyor, setVeriYukleniyor] = useState(false);
  const [indiriliyor, setIndiriliyor] = useState(false);
  const tabloRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!yetkili) return;
    const id = localStorage.getItem("aktifKullaniciId");
    supabase.from("kullanicilar").select("ad_soyad").eq("id", Number(id)).single()
      .then(({ data }) => {
        const ad = data?.ad_soyad || "";
        setAdSoyad(ad);
        if (ad) fetchDerslerim(ad);
      });
  }, [yetkili]);

  const fetchDerslerim = async (ad: string) => {
    setVeriYukleniyor(true);
    const kombinasyonlar = [
      { program: "ascilik",   sinif: 1 },
      { program: "ascilik",   sinif: 2 },
      { program: "pastacilk", sinif: 1 },
      { program: "pastacilk", sinif: 2 },
    ];
    const sonuc: Satir[] = [];
    for (const k of kombinasyonlar) {
      const { data } = await supabase
        .from("ders_programi")
        .select("*")
        .eq("program", k.program)
        .eq("sinif", k.sinif)
        .eq("donem", "bahar")
        .eq("yil", "2025-2026")
        .eq("aktif", true);
      const benimkiler = (data || []).filter((s: Satir) => {
        if (!s.ogretmen_adi) return false;
        const parcalar = ad.toLowerCase().split(" ");
        const ogr = s.ogretmen_adi.toLowerCase();
        return parcalar.some((p: string) => p.length > 2 && ogr.includes(p));
      });
      sonuc.push(...benimkiler.map((s: Satir) => ({ ...s, program: k.program, sinif: k.sinif })));
    }
    setDerslerim(sonuc);
    setVeriYukleniyor(false);
  };

  const tumSaatler = Array.from(new Set(derslerim.map(d => d.saat_baslangic))).sort();

  // Ayni ders+saat+gun kombinasyonlarini birlestir, subeleri tek etikette topla
  type GrupluDers = Satir & { subeler: string[] };
  const grid: Record<string, Record<string, GrupluDers[]>> = {};
  for (const saat of tumSaatler) {
    grid[saat] = {};
    for (const gun of GUNLER) {
      const hucre = derslerim.filter(d => d.saat_baslangic === saat && d.gun === gun);
      // Ders koduna gore grupla
      const grupMap: Record<string, GrupluDers> = {};
      for (const d of hucre) {
        const key = d.ders_kodu || d.ders_adi;
        if (!grupMap[key]) {
          grupMap[key] = { ...d, subeler: [] };
        }
        const sube = `${PROG_LABEL[d.program] || d.program} ${d.sinif}. Sinif`;
        if (!grupMap[key].subeler.includes(sube)) {
          grupMap[key].subeler.push(sube);
        }
      }
      grid[saat][gun] = Object.values(grupMap);
    }
  }

  const grupluToplamSaat = tumSaatler.reduce((acc, saat) =>
    acc + GUNLER.reduce((a, gun) => a + (grid[saat]?.[gun]?.length || 0), 0), 0
  );

  const handleIndir = async (format: "jpeg" | "pdf") => {
    setIndiriliyor(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const el = tabloRef.current;
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#f5f0eb", useCORS: true });
      if (format === "jpeg") {
        const link = document.createElement("a");
        link.download = "ders-programim.jpeg";
        link.href = canvas.toDataURL("image/jpeg", 0.95);
        link.click();
      } else {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pdfW / canvas.width, pdfH / canvas.height);
        const x = (pdfW - canvas.width * ratio) / 2;
        const y = (pdfH - canvas.height * ratio) / 2;
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, y, canvas.width * ratio, canvas.height * ratio);
        pdf.save("ders-programim.pdf");
      }
    } catch { alert("Indirme hatasi."); }
    setIndiriliyor(false);
  };

  if (yukleniyor || !yetkili) return <LoadingSkeleton />;

  return (
    <DashboardLayout title="Ders Programim" subtitle="2025-2026 Bahar Donemi">
      <div className="space-y-5 max-w-7xl">

        {/* Baslik + indir */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-zinc-800">{adSoyad}</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {veriYukleniyor ? "Taranıyor..." : `Haftalik toplam ${grupluToplamSaat} ders saati`}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleIndir("jpeg")} disabled={indiriliyor || derslerim.length === 0}
              className="text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-40"
              style={{ background: "#B71C1C" }}>
              JPEG Indir
            </button>
            <button onClick={() => handleIndir("pdf")} disabled={indiriliyor || derslerim.length === 0}
              className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-40">
              PDF Indir
            </button>
          </div>
        </div>

        {/* Tablo */}
        {veriYukleniyor ? (
          <div className="py-20 text-center text-zinc-400 text-sm">Programlar taranıyor...</div>
        ) : derslerim.length === 0 && !veriYukleniyor ? (
          <div className="py-20 text-center text-zinc-400 text-sm">Hicbir programda adınız gecmiyor</div>
        ) : (
          <div ref={tabloRef} style={{ background: "#f5f0eb", padding: "20px", borderRadius: "16px" }}>
            <div style={{ background: "#8B0000", borderRadius: "12px 12px 0 0", padding: "16px 20px", textAlign: "center" }}>
              <div style={{ color: "white", fontSize: "12px", fontWeight: 600, opacity: 0.7 }}>MESLEK YUKSEKOKULU</div>
              <div style={{ color: "white", fontSize: "16px", fontWeight: 900, textTransform: "uppercase", marginTop: "4px" }}>
                {adSoyad.toUpperCase()} - DERS PROGRAMI
              </div>
              <div style={{ color: "white", fontSize: "11px", opacity: 0.6, marginTop: "2px" }}>2025-2026 Bahar Donemi</div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", background: "white", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "80px" }} />
                {GUNLER.map(g => <col key={g} style={{ width: "18%" }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ background: "#6d0000", color: "white", padding: "10px 6px", fontSize: "11px", fontWeight: 700, textAlign: "center", border: "1px solid #7a0000" }}>Saat</th>
                  {GUNLER.map(g => (
                    <th key={g} style={{ background: "#8B0000", color: "white", padding: "10px 6px", fontSize: "12px", fontWeight: 700, textAlign: "center", border: "1px solid #7a0000" }}>{g}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tumSaatler.map((saat, idx) => (
                  <tr key={saat} style={{ background: idx % 2 === 0 ? "#fff" : "#fdf8f5" }}>
                    <td style={{ background: "#8B0000", color: "white", fontWeight: 700, fontSize: "11px", textAlign: "center", padding: "8px 4px", border: "1px solid #e8ddd5", whiteSpace: "nowrap" }}>
                      {saat}<br />{SAAT_BITIS[saat] || ""}
                    </td>
                    {GUNLER.map(gun => {
                      const hucre = grid[saat]?.[gun] || [];
                      return (
                        <td key={gun} style={{ border: "1px solid #e8ddd5", verticalAlign: "middle", textAlign: "center", padding: "5px 4px" }}>
                          {hucre.map((d, i) => (
                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "5px 4px", borderRadius: "8px", margin: "1px", background: "#FEF9C3", border: "1.5px solid #F59E0B" }}>
                              {d.ders_kodu && <span style={{ fontSize: "9px", fontWeight: 700, color: "#92400E", textTransform: "uppercase" }}>{d.ders_kodu}</span>}
                              <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3 }}>{d.ders_adi}</span>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "2px", justifyContent: "center" }}>
                                {d.subeler.map((s: string, j: number) => (
                                  <span key={j} style={{ fontSize: "9px", color: "#92400E", background: "#FDE68A", padding: "1px 6px", borderRadius: "8px", fontWeight: 600 }}>{s}</span>
                                ))}
                              </div>
                              {d.derslik && !d.uzem && <span style={{ fontSize: "9px", color: "#6b7280", background: "#f3f4f6", padding: "1px 5px", borderRadius: "8px" }}>{d.derslik}</span>}
                              {d.uzem && <span style={{ fontSize: "9px", fontWeight: 700, color: "#856404", background: "#fff3cd", padding: "1px 5px", borderRadius: "8px" }}>UZEM</span>}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}