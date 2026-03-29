"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

type SiparisUrun = { urunId?: string; urunAdi: string; marka: string; miktar: number; olcu: string; birimFiyat: number; toplam: number };
type Siparis = { id: string; ogretmenAdi: string; dersAdi: string; hafta: string; urunler: SiparisUrun[]; genelToplam: number; durum: string; tarih: string; tip: string; };
type OzetSatir = {
  urunAdi: string; marka: string; olcu: string;
  listeMiktar: number; depodaMiktar: number; satinAlinacak: number;
  toplamTutar: number; birimFiyat: number;
  urunId: string | null; dususYapildi: boolean; kategori: string;
  paketMiktari: number | null; paketBirimi: string;
};

// Paket sayısı hesabı: "700g (1 paket)" formatı
const formatDepoda = (miktar: number, olcu: string, paketMiktari: number | null, paketBirimi: string): string => {
  if (miktar <= 0) return "-";
  const birim = paketBirimi || olcu;
  const stokGoster = `${parseFloat(miktar.toFixed(3))} ${birim}`;
  if (!paketMiktari || paketMiktari <= 0) return stokGoster;
  const adet = miktar / paketMiktari;
  const tam = Math.floor(adet);
  const kalan = adet - tam;
  let paketStr: string;
  if (kalan < 0.05) paketStr = `${tam} paket`;
  else if (kalan >= 0.95) paketStr = `${tam + 1} paket`;
  else {
    const kesir = kalan >= 0.6 ? "¾" : kalan >= 0.4 ? "½" : "¼";
    paketStr = tam > 0 ? `${tam} ${kesir} paket` : `${kesir} paket`;
  }
  return `${stokGoster} (${paketStr})`;
};

const DURUM_STIL: Record<string, { bg: string; text: string; label: string }> = {
  bekliyor:      { bg: "#FEF3C7", text: "#92400E", label: "Bekliyor" },
  onaylandi:     { bg: "#D1FAE5", text: "#065F46", label: "Onaylandi" },
  teslim_alindi: { bg: "#DBEAFE", text: "#1E40AF", label: "Teslim Alindi" },
};

export default function SatinAlmaPage() {
  const { yetkili, yukleniyor } = useAuth("/satin");
  const [adSoyad, setAdSoyad] = useState("");
  const [aktifSekme, setAktifSekme] = useState<"dashboard" | "liste" | "market">("dashboard");
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [stokMap, setStokMap] = useState<Record<string, { id: string; stok: number; kategori: string; paketMiktari: number | null; paketBirimi: string }>>({});
  const [satirlar, setSatirlar] = useState<OzetSatir[]>([]);
  const [secilenHafta, setSecilenHafta] = useState("tumu");
  const [secilenDers, setSecilenDers] = useState("tumu");
  const [secilenTip, setSecilenTip] = useState("haftalik");
  const [bildirim, setBildirim] = useState<{ tip: "basari" | "hata"; metin: string } | null>(null);
  const [alinanlar, setAlinanlar] = useState<Set<string>>(new Set());
  const [marketHafta, setMarketHafta] = useState<string>("");
  const [ogrenciHafta, setOgrenciHafta] = useState<string>("");
  const [ogrenciId, setOgrenciId] = useState<number | null>(null);
  const [haftaKaydediliyor, setHaftaKaydediliyor] = useState(false);

  const saat = new Date().getHours();
  const selamlama = saat < 12 ? "Gunaydin" : saat < 18 ? "Iyi gunler" : "Iyi aksamlar";

  useEffect(() => {
    if (!yetkili) return;
    const id = localStorage.getItem("aktifKullaniciId");
    supabase.from("kullanicilar").select("ad_soyad").eq("id", Number(id)).single()
      .then(({ data }) => setAdSoyad(data?.ad_soyad || "Satin Alma"));
    fetchData();
  }, [yetkili]);

  const fetchData = async () => {
    const [{ data: sipData }, { data: urunData }] = await Promise.all([
      supabase.from("siparisler").select("*").order("tarih", { ascending: false }),
      supabase.from("urunler").select("id, urun_adi, marka, stok, kategori, paket_miktari, paket_birimi"),
    ]);
    setSiparisler((sipData || []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      ogretmenAdi: s.ogretmen_adi as string,
      dersAdi: s.ders_adi as string,
      hafta: s.hafta as string,
      urunler: (s.urunler as SiparisUrun[]) || [],
      genelToplam: s.genel_toplam as number,
      durum: (s.durum as string) || "bekliyor",
      tarih: s.tarih as string,
      tip: (s.tip as string) || "haftalik",
    })));
    const map: Record<string, { id: string; stok: number; kategori: string; paketMiktari: number | null; paketBirimi: string }> = {};
    (urunData || []).forEach((u: Record<string, unknown>) => {
      // Hem ID hem ad__marka ile eşleştir
      const byId = u.id as string;
      const byKey = `${u.urun_adi}__${u.marka || ""}`;
      const val = { 
        id: u.id as string, 
        stok: (u.stok as number) ?? 0, 
        kategori: (u.kategori as string) || "Diger",
        paketMiktari: (u.paket_miktari as number) ?? null,
        paketBirimi: (u.paket_birimi as string) ?? "",
      };
      map[byId] = val;
      map[byKey] = val;
    });
    setStokMap(map);

    // Öğrenci hesabının aktif haftasını çek
    const { data: ogrenci } = await supabase
      .from("kullanicilar")
      .select("id, aktif_hafta")
      .eq("role", "ogrenci")
      .single();
    if (ogrenci) {
      setOgrenciId(ogrenci.id);
      setOgrenciHafta(ogrenci.aktif_hafta || "");
    }
  };

  const fetchMarketAlinanlar = async (hafta: string) => {
    if (!hafta || hafta === "tumu") { setAlinanlar(new Set()); return; }
    const { data } = await supabase.from("market_alinanlar").select("urun_key").eq("hafta", hafta);
    setAlinanlar(new Set((data || []).map((r: any) => r.urun_key)));
  };

  useEffect(() => {
    if (aktifSekme !== "market") return;
    const hafta = marketHafta || secilenHafta;
    fetchMarketAlinanlar(hafta);
    if (!hafta || hafta === "tumu") return;
    const channel = supabase
      .channel(`satin_market_${hafta}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_alinanlar", filter: `hafta=eq.${hafta}` },
        (payload) => {
          if (payload.eventType === "INSERT") setAlinanlar(prev => new Set(prev).add((payload.new as any).urun_key));
          else if (payload.eventType === "DELETE") setAlinanlar(prev => { const next = new Set(prev); next.delete((payload.old as any).urun_key); return next; });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [aktifSekme, marketHafta, secilenHafta]);

  const handleMarketTik = async (key: string) => {
    const hafta = marketHafta || secilenHafta;
    if (!hafta || hafta === "tumu") return;
    const alindi = alinanlar.has(key);
    if (alindi) {
      await supabase.from("market_alinanlar").delete().eq("hafta", hafta).eq("urun_key", key);
    } else {
      await supabase.from("market_alinanlar").upsert({ hafta, urun_key: key });
    }
  };

  const handleHaftaAta = async (hafta: string) => {
    if (!ogrenciId) return;
    setHaftaKaydediliyor(true);
    // Eski haftanın alınanlarını temizle
    if (ogrenciHafta && ogrenciHafta !== hafta) {
      await supabase.from("market_alinanlar").delete().eq("hafta", ogrenciHafta);
    }
    await supabase.from("kullanicilar").update({ aktif_hafta: hafta || null }).eq("id", ogrenciId);
    setOgrenciHafta(hafta);
    setHaftaKaydediliyor(false);
    bildir("basari", hafta ? `Öğrenciye "${hafta}" atandı! Eski liste temizlendi.` : "Öğrenci görevi kaldırıldı.");
  };

  const bildir = (tip: "basari" | "hata", metin: string) => {
    setBildirim({ tip, metin });
    setTimeout(() => setBildirim(null), 3500);
  };

  const haftalar = ["tumu", ...Array.from(new Set(siparisler.map((s) => s.hafta))).sort()];
  const dersler = ["tumu", ...Array.from(new Set(siparisler.map((s) => s.dersAdi))).sort()];

  const filtrelenmis = siparisler.filter((s) =>
    (secilenTip === "tumu" || (s.tip || "haftalik") === secilenTip) &&
    (secilenHafta === "tumu" || s.hafta === secilenHafta) &&
    (secilenDers === "tumu" || s.dersAdi === secilenDers)
  );

  useEffect(() => {
    const ozet: Record<string, OzetSatir> = {};
    filtrelenmis.forEach((s) => {
      s.urunler.forEach((u) => {
        const key = `${u.urunAdi}__${u.marka || ""}__${u.olcu}`;
        const stokKey = u.urunId || `${u.urunAdi}__${u.marka || ""}`;
        const stokBilgi = stokMap[stokKey];
        if (!ozet[key]) {
          ozet[key] = {
            urunAdi: u.urunAdi, marka: u.marka, olcu: u.olcu,
            birimFiyat: u.birimFiyat, listeMiktar: 0, toplamTutar: 0,
            depodaMiktar: stokBilgi?.stok ?? 0,
            satinAlinacak: 0,
            urunId: stokBilgi?.id || null,
            dususYapildi: false,
            kategori: stokBilgi?.kategori || "Diger",
            paketMiktari: stokBilgi?.paketMiktari ?? null,
            paketBirimi: stokBilgi?.paketBirimi ?? "",
          };
        }
        ozet[key].listeMiktar += Number(u.miktar);
        ozet[key].toplamTutar += Number(u.toplam);
      });
    });
    Object.values(ozet).forEach((s) => {
      // Otomatik düşme YOK — kullanıcı "Listeden Çıkart" basarsa düşer
      s.satinAlinacak = s.listeMiktar;
    });
    setSatirlar(Object.values(ozet).sort((a, b) => {
      const kCmp = (a.kategori || "").localeCompare(b.kategori || "", "tr");
      return kCmp !== 0 ? kCmp : a.urunAdi.localeCompare(b.urunAdi, "tr");
    }));
  }, [siparisler, stokMap, secilenHafta, secilenDers]);

  const handleStokDus = async (satir: OzetSatir, idx: number) => {
    if (!satir.urunId) { bildir("hata", `"${satir.urunAdi}" urun veritabaninda bulunamadi.`); return; }
    // Veritabanına DOKUNMUYORUZ — sadece bu haftanın listesinden düşüyoruz
    bildir("basari", `"${satir.urunAdi}" listeden düşüldü. Stok değişmedi.`);
    setStokMap((prev) => {
  const key = `${satir.urunAdi}__${satir.marka || ""}`;
  return { ...prev, [key]: { id: satir.urunId!, stok: 0, kategori: satir.kategori, paketMiktari: satir.paketMiktari, paketBirimi: satir.paketBirimi } };
});
    setSatirlar((prev) => prev.map((s, i) =>
      i === idx ? { ...s, dususYapildi: true, depodaMiktar: 0, satinAlinacak: s.listeMiktar } : s
    ));
  };

  const handleDurumGuncelle = async (sipId: string, yeniDurum: string) => {
    const { error } = await supabase.from("siparisler").update({ durum: yeniDurum }).eq("id", sipId);
    if (error) { bildir("hata", "Durum guncellenemedi."); return; }
    setSiparisler(prev => prev.map(s => s.id === sipId ? { ...s, durum: yeniDurum } : s));
    bildir("basari", "Siparis durumu guncellendi.");
  };

  const genelToplam = satirlar.reduce((acc, u) => acc + u.toplamTutar, 0);
  const satinAlinacakToplam = satirlar.reduce((acc, u) => acc + (u.birimFiyat * u.satinAlinacak), 0);

  // Dashboard istatistikleri
  const bekleyenler = siparisler.filter(s => s.durum === "bekliyor" && (s.tip || "haftalik") === "haftalik");
  const onaylananlar = siparisler.filter(s => s.durum === "onaylandi");
  const teslimler = siparisler.filter(s => s.durum === "teslim_alindi");
  const bekleyenTutar = bekleyenler.reduce((acc, s) => acc + (s.genelToplam || 0), 0);
  const haftaBazli = Array.from(new Set(siparisler.map(s => s.hafta))).sort().slice(-3);

  const handlePdfOgrenci = () => {
    if (satirlar.length === 0) return;
    const gruplar: Record<string, OzetSatir[]> = {};
    satirlar.forEach((u) => {
      const kat = u.kategori || "Diger";
      if (!gruplar[kat]) gruplar[kat] = [];
      gruplar[kat].push(u);
    });
    const baslik = secilenHafta === "tumu" ? "Tum Haftalar" : secilenHafta;
    const ders = secilenDers === "tumu" ? "Tum Dersler" : secilenDers;
    const tarih = new Date().toLocaleDateString("tr-TR");
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#222}
h1{font-size:14px;color:#8B0000;border-bottom:2px solid #8B0000;padding-bottom:6px;margin-bottom:4px}
.meta{font-size:10px;color:#666;margin-bottom:16px}
.kat{background:#f3f4f6;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;color:#555;padding:6px 8px;margin-top:14px;border-left:3px solid #8B0000}
table{width:100%;border-collapse:collapse;margin-top:4px;table-layout:fixed}
th,td{padding:6px 10px;border-bottom:1px solid #eee;font-size:10px;vertical-align:middle}
th{background:#8B0000;color:white}
th.col-urun{width:45%;text-align:left}
th.col-marka{width:25%;text-align:left}
th.col-miktar{width:30%;text-align:center}
td.col-urun{text-align:left}
td.col-marka{text-align:left}
td.col-miktar{text-align:center}
tr:nth-child(even) td{background:#fafafa}
.s{color:#059669;font-weight:bold}
.y{color:#aaa}
.footer{margin-top:20px;font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:6px}
@media print{body{margin:10px}}
</style></head><body>`;
    html += `<h1>Alisveris Listesi - ${baslik}</h1><div class="meta">${ders} | ${tarih}</div>`;
    Object.entries(gruplar).forEach(([kategori, urunler]) => {
      html += `<div class="kat">${kategori} (${urunler.length} urun)</div><table><thead><tr><th class="col-urun">Urun</th><th class="col-marka">Marka</th><th class="col-miktar">Miktar</th></tr></thead><tbody>`;
      urunler.forEach((u) => {
        const satin = u.satinAlinacak > 0 ? `<span class="s">${u.satinAlinacak} ${u.olcu}</span>` : `<span class="y">—</span>`;
        html += `<tr><td class="col-urun">${u.urunAdi}</td><td class="col-marka">${u.marka || "-"}</td><td class="col-miktar">${satin}</td></tr>`;
      });
      html += `</tbody></table>`;
    });
    html += `<div class="footer">IRUFoodFlow | ${tarih}</div></body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const handlePdf = () => {
    if (satirlar.length === 0) return;
    const gruplar: Record<string, OzetSatir[]> = {};
    satirlar.forEach((u) => {
      const kat = u.kategori || "Diger";
      if (!gruplar[kat]) gruplar[kat] = [];
      gruplar[kat].push(u);
    });
    const baslik = secilenHafta === "tumu" ? "Tum Haftalar" : secilenHafta;
    const ders = secilenDers === "tumu" ? "Tum Dersler" : secilenDers;
    const tarih = new Date().toLocaleDateString("tr-TR");
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#222}
h1{font-size:14px;color:#8B0000;border-bottom:2px solid #8B0000;padding-bottom:6px;margin-bottom:4px}
.meta{font-size:10px;color:#666;margin-bottom:16px}
.kat{background:#f3f4f6;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;color:#555;padding:6px 8px;margin-top:14px;border-left:3px solid #8B0000}
table{width:100%;border-collapse:collapse;margin-top:4px;table-layout:fixed}
th,td{padding:6px 10px;border-bottom:1px solid #eee;font-size:10px;vertical-align:middle}
th{background:#8B0000;color:white}
th.col-urun{width:40%;text-align:left}
th.col-marka{width:20%;text-align:left}
th.col-miktar{width:22%;text-align:center}
th.col-fiyat{width:18%;text-align:center}
td.col-urun{text-align:left}
td.col-marka{text-align:left}
td.col-miktar{text-align:center}
td.col-fiyat{text-align:center}
tr:nth-child(even) td{background:#fafafa}
.s{color:#059669;font-weight:bold}
.y{color:#aaa}
.footer{margin-top:20px;font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:6px}
@media print{body{margin:10px}}
</style></head><body>`;
    html += `<h1>Satin Alma Listesi - ${baslik}</h1><div class="meta">${ders} | ${tarih}</div>`;
    Object.entries(gruplar).forEach(([kategori, urunler]) => {
      html += `<div class="kat">${kategori} (${urunler.length} urun)</div><table><thead><tr><th class="col-urun">Urun</th><th class="col-marka">Marka</th><th class="col-miktar">Satin Alinacak</th><th class="col-fiyat">B.Fiyat</th></tr></thead><tbody>`;
      urunler.forEach((u) => {
        const satin = u.satinAlinacak > 0 ? `<span class="s">${u.satinAlinacak} ${u.olcu}</span>` : `<span class="y">—</span>`;
        html += `<tr><td class="col-urun">${u.urunAdi}</td><td class="col-marka">${u.marka || "-"}</td><td class="col-miktar">${satin}</td><td class="col-fiyat">${u.birimFiyat > 0 ? u.birimFiyat.toFixed(2) + " TL" : "-"}</td></tr>`;
      });
      html += `</tbody></table>`;
    });
    const toplamTutar = satirlar.reduce((acc, u) => acc + (u.birimFiyat * u.satinAlinacak), 0);
    html += `<div style="margin-top:16px;text-align:right;font-size:12px;font-weight:bold;border-top:2px solid #8B0000;padding-top:8px;color:#8B0000;">TOPLAM: ${toplamTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</div>`;
    html += `<div class="footer">IRUFoodFlow | ${tarih}</div></body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const handleExcel = () => {
    if (satirlar.length === 0) return;
    const rows = satirlar.map((u) => ({
      "Urun Adi": u.urunAdi, "Marka": u.marka || "-", "Olcu": u.olcu,
      "Liste Miktari": u.listeMiktar, "Depoda": u.depodaMiktar,
      "Satin Alinacak": u.satinAlinacak,
      "Birim Fiyat": u.birimFiyat || 0,
      "Satin Alma Tutari": (u.birimFiyat || 0) * u.satinAlinacak,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Satin Alma");
    const ad = secilenHafta === "tumu" ? "Satinalma_Tum" : `Satinalma_${secilenHafta.replace(/\s/g, "_")}`;
    XLSX.writeFile(wb, `${ad}.xlsx`);
  };

  if (yukleniyor || !yetkili) return null;

  return (
    <DashboardLayout title="Satin Alma Paneli" subtitle="Haftalik urun ozetleri ve stok karsilastirmasi">
      <div className="max-w-6xl space-y-5">

        {bildirim && (
          <div className={`text-sm rounded-xl px-4 py-3 border font-medium ${bildirim.tip === "basari" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
            {bildirim.metin}
          </div>
        )}

        {/* Sekmeler */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-zinc-200 shadow-sm w-fit">
          {[
            { key: "dashboard", label: "Dashboard" },
            { key: "liste", label: "Satin Alma Listesi" },
            { key: "market", label: "🛒 Market Modu" },
          ].map((s) => (
            <button key={s.key} onClick={() => setAktifSekme(s.key as "dashboard" | "liste" | "market")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${aktifSekme === s.key ? "text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50"}`}
              style={aktifSekme === s.key ? { background: s.key === "market" ? "#059669" : "#B71C1C" } : {}}>
              {s.label}
            </button>
          ))}
        </div>

        {/* ═══ DASHBOARD ═══ */}
        {aktifSekme === "dashboard" && (
          <div className="space-y-5">

            {/* Karsilama */}
            <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #7F1212 0%, #B71C1C 100%)" }}>
              <div className="absolute right-6 top-0 bottom-0 flex items-center opacity-10 text-9xl font-black select-none">IRU</div>
              <p className="text-white/60 text-sm">{selamlama},</p>
              <h2 className="text-2xl font-black mt-0.5">{adSoyad}</h2>
              <p className="text-white/50 text-xs mt-2">
                Satin Alma &bull; {new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>

            {/* Istatistik kartlari */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Bekleyen", val: bekleyenler.length, icon: "⏳", renk: "#D97706", bg: "#FFFBEB", alt: "onay bekliyor" },
                { label: "Onaylanan", val: onaylananlar.length, icon: "✅", renk: "#059669", bg: "#ECFDF5", alt: "siparis" },
                { label: "Teslim Alindi", val: teslimler.length, icon: "📦", renk: "#2563EB", bg: "#EFF6FF", alt: "tamamlandi" },
                { label: "Bekleyen Tutar", val: `${bekleyenTutar.toLocaleString("tr-TR", { minimumFractionDigits: 0 })} TL`, icon: "💰", renk: "#7C3AED", bg: "#F5F3FF", alt: "odeme bekliyor" },
              ].map((k) => (
                <div key={k.label} className="rounded-2xl border border-zinc-100 p-4 text-center shadow-sm" style={{ background: k.bg }}>
                  <div className="text-xl mb-1">{k.icon}</div>
                  <p className="text-xl font-black" style={{ color: k.renk }}>{k.val}</p>
                  <p className="text-xs font-semibold text-zinc-600 mt-0.5">{k.label}</p>
                  <p className="text-xs text-zinc-400">{k.alt}</p>
                </div>
              ))}
            </div>

            {/* Öğrenci Görev Atama Kartı */}
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl">🛒</div>
                <div>
                  <h3 className="font-bold text-gray-800">Öğrenci Market Görevi</h3>
                  <p className="text-xs text-gray-400">Öğrencilere hangi haftayı alacaklarını atayın</p>
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <select
                  value={ogrenciHafta}
                  onChange={(e) => setOgrenciHafta(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">— Görev yok —</option>
                  {haftalar.filter(h => h !== "tumu").map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleHaftaAta(ogrenciHafta)}
                  disabled={haftaKaydediliyor}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                  style={{ background: "#059669" }}
                >
                  {haftaKaydediliyor ? "..." : "Ata"}
                </button>
              </div>
              {ogrenciHafta && (
                <p className="text-xs text-emerald-600 font-medium mt-2">
                  ✅ Öğrenciler şu an <strong>{ogrenciHafta}</strong> listesini görüyor
                </p>
              )}
              {!ogrenciHafta && (
                <p className="text-xs text-gray-400 mt-2">⏸ Öğrencilere henüz görev atanmadı</p>
              )}
            </div>

            {/* Bekleyen siparisler - hafta hafta kutular */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-zinc-800">Bekleyen Siparisler <span className="text-zinc-400 font-normal text-sm">({bekleyenler.length} siparis)</span></h3>
                <button onClick={() => setAktifSekme("liste")} className="text-xs font-semibold hover:underline" style={{ color: "#B71C1C" }}>
                  Satin Alma Listesi
                </button>
              </div>
              {bekleyenler.length === 0 ? (
                <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-400 text-sm">Bekleyen siparis yok</div>
              ) : (
                <div className="space-y-3">
                  {Array.from(new Set(bekleyenler.map(s => s.hafta))).sort().map(hafta => {
                    const haftaBekleyenler = bekleyenler.filter(s => s.hafta === hafta);
                    const haftaToplam = haftaBekleyenler.reduce((acc, s) => acc + (s.genelToplam || 0), 0);
                    return (
                      <div key={hafta} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between" style={{ background: "#FFFBEB" }}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-amber-700 uppercase tracking-wider">{hafta}</span>
                            <span className="text-xs text-amber-600 font-medium">{haftaBekleyenler.length} siparis</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-amber-700">{haftaToplam.toFixed(2)} TL</span>
                            <button
                              onClick={() => haftaBekleyenler.forEach(s => handleDurumGuncelle(s.id, "onaylandi"))}
                              className="text-xs font-semibold px-3 py-1 rounded-lg text-white transition"
                              style={{ background: "#D97706" }}>
                              Tumunu Onayla
                            </button>
                          </div>
                        </div>
                        <div className="divide-y divide-zinc-50">
                          {haftaBekleyenler.map((s) => (
                            <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-zinc-800 truncate">{s.ogretmenAdi}</p>
                                <p className="text-xs text-zinc-400 truncate">{s.dersAdi}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-bold text-zinc-600">{Number(s.genelToplam || 0).toFixed(2)} TL</span>
                                <button onClick={() => handleDurumGuncelle(s.id, "onaylandi")}
                                  className="text-xs font-semibold px-3 py-1 rounded-lg text-white transition"
                                  style={{ background: "#059669" }}>
                                  Onayla
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Onaylanan siparisler - Satin Alindi bekliyor */}
            {onaylananlar.length > 0 && (
              <div>
                <h3 className="font-bold text-zinc-800 mb-3">
                  Onaylandi — Satin Alinacak <span className="text-zinc-400 font-normal text-sm">({onaylananlar.length} siparis)</span>
                </h3>
                <div className="space-y-3">
                  {Array.from(new Set(onaylananlar.map(s => s.hafta))).sort().map(hafta => {
                    const haftaOnaylanan = onaylananlar.filter(s => s.hafta === hafta);
                    const haftaToplam = haftaOnaylanan.reduce((acc, s) => acc + (s.genelToplam || 0), 0);
                    return (
                      <div key={hafta} className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-emerald-100 flex items-center justify-between" style={{ background: "#ECFDF5" }}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">{hafta}</span>
                            <span className="text-xs text-emerald-600 font-medium">{haftaOnaylanan.length} siparis</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-emerald-700">{haftaToplam.toFixed(2)} TL</span>
                            <button
                              onClick={() => haftaOnaylanan.forEach(s => handleDurumGuncelle(s.id, "teslim_alindi"))}
                              className="text-xs font-semibold px-3 py-1 rounded-lg text-white transition"
                              style={{ background: "#059669" }}>
                              Tumunu Teslim Et
                            </button>
                          </div>
                        </div>
                        <div className="divide-y divide-zinc-50">
                          {haftaOnaylanan.map((s) => (
                            <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-zinc-800 truncate">{s.ogretmenAdi}</p>
                                <p className="text-xs text-zinc-400 truncate">{s.dersAdi}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-bold text-zinc-600">{Number(s.genelToplam || 0).toFixed(2)} TL</span>
                                <button onClick={() => handleDurumGuncelle(s.id, "bekliyor")}
                                  className="text-xs font-medium px-3 py-1 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition">
                                  Geri Al
                                </button>
                                <button onClick={() => handleDurumGuncelle(s.id, "teslim_alindi")}
                                  className="text-xs font-semibold px-3 py-1 rounded-lg text-white transition"
                                  style={{ background: "#059669" }}>
                                  Satin Alindi
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Son siparisler - tum gecmis */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100">
                <h3 className="font-bold text-zinc-800">Tum Siparisler</h3>
              </div>
              <div className="divide-y divide-zinc-50">
                {siparisler.slice(0, 10).map((s) => {
                  const d = DURUM_STIL[s.durum] || DURUM_STIL.bekliyor;
                  return (
                    <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-800 truncate">{s.ogretmenAdi}</p>
                        <p className="text-xs text-zinc-400 truncate">{s.dersAdi} &bull; {s.hafta}</p>
                      </div>
                      <span className="text-xs font-bold text-zinc-600 shrink-0">{Number(s.genelToplam || 0).toFixed(2)} TL</span>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: d.bg, color: d.text }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hafta bazli ozet */}
            {haftaBazli.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {haftaBazli.map(hafta => {
                  const hSiparisler = siparisler.filter(s => s.hafta === hafta);
                  const hTutar = hSiparisler.reduce((acc, s) => acc + (s.genelToplam || 0), 0);
                  return (
                    <div key={hafta} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{hafta}</p>
                      <p className="text-xl font-black text-zinc-800 mt-1">{hSiparisler.length} siparis</p>
                      <p className="text-sm font-semibold text-zinc-500">{hTutar.toFixed(2)} TL</p>
                      <div className="flex gap-1 mt-2">
                        {["bekliyor","onaylandi","teslim_alindi"].map(d => {
                          const count = hSiparisler.filter(s => s.durum === d).length;
                          if (!count) return null;
                          const ds = DURUM_STIL[d];
                          return <span key={d} className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: ds.bg, color: ds.text }}>{count} {ds.label}</span>;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ SATIN ALMA LiSTESi ═══ */}
        {aktifSekme === "liste" && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Hafta</label>
                {/* Tip filtresi */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-medium">
              {[
                { val: "haftalik", label: "Haftalık" },
                { val: "etkinlik", label: "Etkinlik" },
                { val: "tumu", label: "Tümü" },
              ].map((t) => (
                <button key={t.val} type="button"
                  onClick={() => { setSecilenTip(t.val); setSecilenHafta("tumu"); setSecilenDers("tumu"); }}
                  className={`px-4 py-2 transition ${secilenTip === t.val ? "bg-red-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <select value={secilenHafta} onChange={(e) => setSecilenHafta(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                  {haftalar.map((h) => <option key={h} value={h}>{h === "tumu" ? "Tum Haftalar" : h}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Ders</label>
                <select value={secilenDers} onChange={(e) => setSecilenDers(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[220px]">
                  {dersler.map((d) => <option key={d} value={d}>{d === "tumu" ? "Tum Dersler" : d}</option>)}
                </select>
              </div>
              <div className="ml-auto flex items-end gap-3">
                <button onClick={handlePdfOgrenci} disabled={satirlar.length === 0}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-40">Alisveris Listesi</button>
                <button onClick={handlePdf} disabled={satirlar.length === 0}
                  className="bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-40">PDF</button>
                <button onClick={handleExcel} disabled={satirlar.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-40">Excel</button>
              </div>
            </div>

            {satirlar.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-center">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Liste Toplami</p>
                  <p className="text-2xl font-bold text-gray-800">{genelToplam > 0 ? `${genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL` : "-"}</p>
                </div>
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 text-center">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Satin Alinacak Tutar</p>
                  <p className="text-2xl font-bold text-emerald-700">{satinAlinacakToplam > 0 ? `${satinAlinacakToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL` : "-"}</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {satirlar.length === 0 ? (
                <div className="py-20 text-center text-gray-400 text-sm">
                  {siparisler.length === 0 ? "Henuz siparis bulunmuyor." : "Bu filtreye uygun veri yok."}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">URUN</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">MARKA</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">LISTE MIKT.</th>
                      <th className="px-4 py-3 text-xs font-semibold text-amber-600 uppercase tracking-wider">DEPODA</th>
                      <th className="px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wider">SATIN ALINACAK</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">B.FIYAT</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ISLEM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(() => {
                      const gruplar: Record<string, { satir: OzetSatir; idx: number }[]> = {};
                      satirlar.forEach((u, i) => {
                        const kat = u.kategori || "Diger";
                        if (!gruplar[kat]) gruplar[kat] = [];
                        gruplar[kat].push({ satir: u, idx: i });
                      });
                      return Object.entries(gruplar).flatMap(([kategori, satirGrubu]) => [
                        <tr key={`kat-${kategori}`} className="bg-gray-100 border-t-2 border-gray-200">
                          <td colSpan={7} className="px-4 py-2">
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{kategori}</span>
                            <span className="ml-2 text-xs text-gray-400">({satirGrubu.length} urun)</span>
                          </td>
                        </tr>,
                        ...satirGrubu.map(({ satir: u, idx: i }) => (
                          <tr key={i} className={`transition-colors ${u.dususYapildi ? "bg-gray-50 opacity-60" : "hover:bg-gray-50"}`}>
                            <td className="px-4 py-3.5 font-medium text-gray-800">
                              <span className={u.dususYapildi ? "line-through text-gray-400" : ""}>{u.urunAdi}</span>
                            </td>
                            <td className="px-4 py-3.5 text-gray-500">{u.marka || "-"}</td>
                            <td className="px-4 py-3.5 text-gray-700 font-medium">{parseFloat(u.listeMiktar.toFixed(3))} {u.olcu}</td>
                            <td className="px-4 py-3.5">
                              <span className={`font-semibold ${u.depodaMiktar > 0 ? "text-amber-600" : "text-gray-400"}`}>
                                {formatDepoda(u.depodaMiktar, u.olcu, u.paketMiktari, u.paketBirimi)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`font-bold text-base ${u.satinAlinacak > 0 ? "text-emerald-700" : "text-gray-400"}`}>
                                {u.satinAlinacak > 0 ? `${parseFloat(u.satinAlinacak.toFixed(3))} ${u.olcu}` : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-gray-500">
                              {u.birimFiyat > 0 ? `${u.birimFiyat.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL` : "-"}
                            </td>
                            <td className="px-4 py-3.5">
                              {u.dususYapildi ? (
                                <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg">✓ Çıkartıldı</span>
                              ) : u.listeMiktar > 0 ? (
                                <button onClick={() => handleStokDus(u, i)}
                                  className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium px-3 py-1.5 rounded-lg transition whitespace-nowrap">
                                  Listeden Çıkart
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        )),
                      ]);
                    })()}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}


        {/* ═══ MARKET MODU ═══ */}
        {aktifSekme === "market" && (
          <div className="space-y-4">
            {/* Filtreler - kompakt */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
              <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-medium">
                {[{ val: "haftalik", label: "Haftalık" }, { val: "etkinlik", label: "Etkinlik" }, { val: "tumu", label: "Tümü" }].map((t) => (
                  <button key={t.val} type="button"
                    onClick={() => { setSecilenTip(t.val); setSecilenHafta("tumu"); }}
                    className={`px-3 py-2 transition ${secilenTip === t.val ? "bg-emerald-600 text-white" : "bg-white text-gray-600"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <select value={secilenHafta} onChange={(e) => setSecilenHafta(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 flex-1 min-w-[140px]">
                {haftalar.map((h) => <option key={h} value={h}>{h === "tumu" ? "Tüm Haftalar" : h}</option>)}
              </select>
              {alinanlar.size > 0 && (
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-sm font-bold text-emerald-600">✅ {alinanlar.size} / {satirlar.filter(u => u.satinAlinacak > 0).length} alındı</span>
                  <button onClick={async () => {
                    const hafta = marketHafta || secilenHafta;
                    if (hafta && hafta !== "tumu") await supabase.from("market_alinanlar").delete().eq("hafta", hafta);
                    setAlinanlar(new Set());
                  }}
                    className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5">
                    Sıfırla
                  </button>
                </div>
              )}
            </div>

            {/* İlerleme çubuğu */}
            {satirlar.filter(u => u.satinAlinacak > 0).length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Alışveriş İlerlemesi</span>
                  <span className="text-sm font-bold text-emerald-600">
                    {alinanlar.size} / {satirlar.filter(u => u.satinAlinacak > 0).length}
                  </span>
                </div>
                <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${satirlar.filter(u => u.satinAlinacak > 0).length > 0 ? (alinanlar.size / satirlar.filter(u => u.satinAlinacak > 0).length) * 100 : 0}%` }} />
                </div>
                {alinanlar.size === satirlar.filter(u => u.satinAlinacak > 0).length && alinanlar.size > 0 && (
                  <p className="text-center text-emerald-600 font-bold mt-2">🎉 Alışveriş tamamlandı!</p>
                )}
              </div>
            )}

            {/* Ürün listesi - telefon optimized */}
            {satirlar.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                Bu filtreye uygun ürün yok.
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const gruplar: Record<string, OzetSatir[]> = {};
                  satirlar.filter(u => u.satinAlinacak > 0).forEach((u) => {
                    const kat = u.kategori || "Diger";
                    if (!gruplar[kat]) gruplar[kat] = [];
                    gruplar[kat].push(u);
                  });
                  return Object.entries(gruplar).map(([kategori, urunListesi]) => (
                    <div key={kategori} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{kategori}</span>
                        <span className="text-xs text-gray-400">
                          {urunListesi.filter(u => alinanlar.has(`${u.urunAdi}__${u.marka}`)).length}/{urunListesi.length}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {urunListesi.map((u) => {
                          const key = `${u.urunAdi}__${u.marka}`;
                          const alindi = alinanlar.has(key);
                          return (
                            <button
                              key={key}
                              onClick={() => handleMarketTik(key)}
                              className={`w-full flex items-center gap-4 px-4 py-4 text-left transition-colors active:scale-[0.99] ${alindi ? "bg-emerald-50" : "hover:bg-gray-50"}`}
                            >
                              {/* Tik butonu */}
                              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${alindi ? "bg-emerald-500 border-emerald-500" : "border-gray-300"}`}>
                                {alindi && <span className="text-white text-sm font-bold">✓</span>}
                              </div>
                              {/* Ürün bilgisi */}
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-base leading-tight ${alindi ? "line-through text-gray-400" : "text-gray-800"}`}>
                                  {u.urunAdi}
                                </p>
                                <p className="text-sm text-gray-500 mt-0.5">
                                  {u.marka && <span className="mr-2">{u.marka}</span>}
                                  <span className="font-medium text-emerald-700">{parseFloat(u.satinAlinacak.toFixed(3))} {u.olcu}</span>
                                </p>
                              </div>
                              {/* Fiyat */}
                              {u.birimFiyat > 0 && (
                                <div className="text-right shrink-0">
                                  <p className={`text-sm font-bold ${alindi ? "text-gray-300" : "text-gray-700"}`}>
                                    {(u.birimFiyat * u.satinAlinacak).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                                  </p>
                                  <p className="text-xs text-gray-400">{u.birimFiyat.toLocaleString("tr-TR")} TL/{u.olcu}</p>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}