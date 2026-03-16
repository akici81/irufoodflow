"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";

// ─── Tipler ─────────────────────────────────────────────────────────────────
type Etkinlik = {
  id?: string;
  donem: string;
  tarih: string;
  etkinlik: string;
  renk: string;
  saat_bas: string;
  saat_bit: string;
  olusturan_id?: number | null;
  olusturan_adi?: string;
  aktif?: boolean;
};

// ─── Akademik Takvim Verileri (Rumeli Üniversitesi 2025-2026 Bahar) ──────────
const AKADEMIK = [
  { tarih: "2026-02-23", tip: "baslangic", etiket: "Bahar Dönemi Başlangıcı" },
  { tarih: "2026-02-23", tip: "idari",     etiket: "Ders Ekleme-Bırakma Başlangıcı" },
  { tarih: "2026-03-01", tip: "idari",     etiket: "Ders Ekleme-Bırakma Son Günü" },
  { tarih: "2026-03-19", tip: "tatil",     etiket: "Ramazan Bayramı" },
  { tarih: "2026-03-20", tip: "tatil",     etiket: "Ramazan Bayramı" },
  { tarih: "2026-03-21", tip: "tatil",     etiket: "Ramazan Bayramı" },
  { tarih: "2026-03-22", tip: "tatil",     etiket: "Ramazan Bayramı" },
  { tarih: "2026-04-11", tip: "sinav",     etiket: "Ara Sınavlar", sinav_turu: "arasinav" },
  { tarih: "2026-04-12", tip: "sinav",     etiket: "Ara Sınavlar", sinav_turu: "arasinav" },
  { tarih: "2026-04-13", tip: "sinav",     etiket: "Ara Sınavlar", sinav_turu: "arasinav" },
  { tarih: "2026-04-14", tip: "sinav",     etiket: "Ara Sınavlar", sinav_turu: "arasinav" },
  { tarih: "2026-04-15", tip: "sinav",     etiket: "Ara Sınavlar", sinav_turu: "arasinav" },
  { tarih: "2026-04-16", tip: "sinav",     etiket: "Ara Sınavlar", sinav_turu: "arasinav" },
  { tarih: "2026-04-17", tip: "sinav",     etiket: "Ara Sınavlar Son Günü", sinav_turu: "arasinav" },
  { tarih: "2026-04-18", tip: "idari",     etiket: "Ara Sınav Sonuçları İlanı" },
  { tarih: "2026-04-23", tip: "tatil",     etiket: "Ulusal Egemenlik ve Çocuk Bayramı" },
  { tarih: "2026-04-29", tip: "sinav",     etiket: "Mazeret Sınavı", sinav_turu: "mazeret" },
  { tarih: "2026-05-01", tip: "tatil",     etiket: "Emek ve Dayanışma Günü" },
  { tarih: "2026-05-19", tip: "tatil",     etiket: "Gençlik ve Spor Bayramı" },
  { tarih: "2026-05-26", tip: "tatil",     etiket: "Kurban Bayramı" },
  { tarih: "2026-05-27", tip: "tatil",     etiket: "Kurban Bayramı" },
  { tarih: "2026-05-28", tip: "tatil",     etiket: "Kurban Bayramı" },
  { tarih: "2026-05-29", tip: "tatil",     etiket: "Kurban Bayramı" },
  { tarih: "2026-05-30", tip: "tatil",     etiket: "Kurban Bayramı" },
  { tarih: "2026-06-12", tip: "bitis",     etiket: "Bahar Yarıyılı Son Günü" },
  { tarih: "2026-06-15", tip: "sinav",     etiket: "Final Sınavları", sinav_turu: "final" },
  { tarih: "2026-06-16", tip: "sinav",     etiket: "Final Sınavları", sinav_turu: "final" },
  { tarih: "2026-06-17", tip: "sinav",     etiket: "Final Sınavları", sinav_turu: "final" },
  { tarih: "2026-06-18", tip: "sinav",     etiket: "Final Sınavları", sinav_turu: "final" },
  { tarih: "2026-06-19", tip: "sinav",     etiket: "Final Sınavları", sinav_turu: "final" },
  { tarih: "2026-06-20", tip: "sinav",     etiket: "Final Sınavları", sinav_turu: "final" },
  { tarih: "2026-06-22", tip: "sinav",     etiket: "Final Sınavları", sinav_turu: "final" },
  { tarih: "2026-06-23", tip: "sinav",     etiket: "Final Sınavları", sinav_turu: "final" },
  { tarih: "2026-06-24", tip: "sinav",     etiket: "Final Sınavları", sinav_turu: "final" },
  { tarih: "2026-06-25", tip: "sinav",     etiket: "Final Sınavları", sinav_turu: "final" },
  { tarih: "2026-06-26", tip: "sinav",     etiket: "Final Sınavları Son Günü", sinav_turu: "final" },
  { tarih: "2026-07-01", tip: "sinav",     etiket: "Bütünleme Sınavları", sinav_turu: "butunleme" },
  { tarih: "2026-07-02", tip: "sinav",     etiket: "Bütünleme Sınavları", sinav_turu: "butunleme" },
  { tarih: "2026-07-03", tip: "sinav",     etiket: "Bütünleme Sınavları", sinav_turu: "butunleme" },
  { tarih: "2026-07-04", tip: "sinav",     etiket: "Bütünleme Sınavları Son Günü", sinav_turu: "butunleme" },
];

const SINAV_BLOKLARI: Record<string, { saat: string; bitis: string; label: string }[]> = {
  arasinav: [
    { saat: "09:00", bitis: "11:00", label: "Sınav Bloğu I" },
    { saat: "11:30", bitis: "13:30", label: "Sınav Bloğu II" },
    { saat: "14:00", bitis: "16:00", label: "Sınav Bloğu III" },
    { saat: "16:30", bitis: "18:30", label: "Sınav Bloğu IV" },
  ],
  final: [
    { saat: "09:00", bitis: "11:00", label: "Final Bloğu I" },
    { saat: "11:30", bitis: "13:30", label: "Final Bloğu II" },
    { saat: "14:00", bitis: "16:00", label: "Final Bloğu III" },
    { saat: "16:30", bitis: "18:30", label: "Final Bloğu IV" },
  ],
};

const RENKLER: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  mavi:    { bg: "#DBEAFE", text: "#1D4ED8", border: "#93C5FD", dot: "#3B82F6", label: "Etkinlik" },
  yesil:   { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7", dot: "#10B981", label: "Akademik" },
  mor:     { bg: "#EDE9FE", text: "#5B21B6", border: "#C4B5FD", dot: "#8B5CF6", label: "Workshop" },
  turuncu: { bg: "#FFEDD5", text: "#9A3412", border: "#FDBA74", dot: "#F97316", label: "Teknik Gezi" },
  pembe:   { bg: "#FCE7F3", text: "#9D174D", border: "#F9A8D4", dot: "#EC4899", label: "Sosyal" },
  cam:     { bg: "#E0F2FE", text: "#0C4A6E", border: "#7DD3FC", dot: "#0EA5E9", label: "Seminer" },
};

const AK_RENK: Record<string, { bg: string; border: string; text: string; dot: string; icon: string }> = {
  baslangic: { bg: "#DCFCE7", border: "#86EFAC", text: "#166534", dot: "#22C55E", icon: "🎓" },
  bitis:     { bg: "#F3E8FF", border: "#D8B4FE", text: "#6B21A8", dot: "#A855F7", icon: "🏁" },
  sinav:     { bg: "#FEF9C3", border: "#FDE047", text: "#713F12", dot: "#EAB308", icon: "📝" },
  tatil:     { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#EF4444", icon: "🏖️" },
  idari:     { bg: "#F1F5F9", border: "#CBD5E1", text: "#334155", dot: "#64748B", icon: "📋" },
};

const AYLAR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const GUN_KISA = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
const GUN_TAM  = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
const SAATLER  = Array.from({ length: 29 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2,"0")}:${m}`;
});

// ─── Yardımcı fonksiyonlar ───────────────────────────────────────────────────
function tStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function bugun() {
  const d = new Date();
  return tStr(d.getFullYear(), d.getMonth(), d.getDate());
}
function ayGunleri(y: number, m: number) {
  const ilk  = new Date(y, m, 1).getDay();
  const off  = (ilk + 6) % 7;
  const son  = new Date(y, m + 1, 0).getDate();
  const prev = new Date(y, m, 0).getDate();
  const arr: { gun: number; buAy: boolean; tarih: string }[] = [];
  for (let i = off - 1; i >= 0; i--) arr.push({ gun: prev - i, buAy: false, tarih: tStr(y, m - 1, prev - i) });
  for (let d = 1; d <= son; d++)      arr.push({ gun: d,        buAy: true,  tarih: tStr(y, m, d) });
  const kalan = 42 - arr.length;
  for (let d = 1; d <= kalan; d++)    arr.push({ gun: d,        buAy: false, tarih: tStr(y, m + 1, d) });
  return arr;
}
function saatDakika(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
function cakisiyor(b1: string, e1: string, b2: string, e2: string) {
  return saatDakika(b1) < saatDakika(e2) && saatDakika(e1) > saatDakika(b2);
}
function formatTarih(s: string) {
  if (!s) return "";
  const [, m, d] = s.split("-");
  const idx = (new Date(s).getDay() + 6) % 7;
  return `${GUN_TAM[idx]}, ${parseInt(d)} ${AYLAR[parseInt(m) - 1]}`;
}

// ─── Ana Sayfa ───────────────────────────────────────────────────────────────
export default function EtkinlikTakvimiPage() {
  // — Auth (orijinalden korundu) —
  const { yetkili, yukleniyor: authYukleniyor } = useAuth("/etkinlik-takvimi");
  const [kullaniciId,   setKullaniciId]   = useState<number | null>(null);
  const [kullaniciAdi,  setKullaniciAdi]  = useState("");
  const [kullaniciRole, setKullaniciRole] = useState("");

  // — Takvim state —
  const TODAY = bugun();
  const [yil,  setYil]  = useState(2026);
  const [ay,   setAy]   = useState(2); // Mart başlangıç
  const [seciliTarih, setSeciliTarih] = useState<string | null>(null);

  // — Veri —
  const [etkinlikler, setEtkinlikler] = useState<Etkinlik[]>([]);
  const [veriYukleniyor, setVeriYukleniyor] = useState(true);

  // — UI —
  const [bildirim, setBildirim] = useState<{ tip: "basari" | "hata"; metin: string } | null>(null);
  const [uyari,    setUyari]    = useState<{ mesaj: string; onDevam: () => void; onIptal: () => void } | null>(null);
  const [hoverTarih, setHoverTarih] = useState<string | null>(null);

  // — Form —
  const [formAcik,  setFormAcik]  = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<Etkinlik | null>(null);
  const [form, setForm] = useState({ etkinlik: "", renk: "mavi", saat_bas: "09:00", saat_bit: "10:00" });

  // ── Auth + ilk veri yükleme (orijinalden korundu) ─────────────────────────
  useEffect(() => {
    if (!yetkili) return;
    const id   = localStorage.getItem("aktifKullaniciId");
    const role = localStorage.getItem("role") || "";
    const adi  = localStorage.getItem("username") || "";
    if (id) { setKullaniciId(Number(id)); setKullaniciRole(role); }
    supabase.from("kullanicilar").select("ad_soyad").eq("id", Number(id)).single()
      .then(({ data }) => setKullaniciAdi(data?.ad_soyad || adi));
    fetchEtkinlikler();
  }, [yetkili]);

  // ── Supabase fetch ─────────────────────────────────────────────────────────
  async function fetchEtkinlikler() {
    setVeriYukleniyor(true);
    const { data, error } = await supabase
      .from("etkinlik_takvimi")
      .select("*")
      .eq("donem", "2025-2026 Bahar")
      .eq("aktif", true)
      .order("tarih")
      .order("saat_bas");
    if (error) bildir("hata", "Veriler yüklenemedi.");
    else setEtkinlikler(data || []);
    setVeriYukleniyor(false);
  }

  // ── Memo'lar ───────────────────────────────────────────────────────────────
  const gunler = useMemo(() => ayGunleri(yil, ay), [yil, ay]);

  const etkinlikMap = useMemo(() => {
    const m: Record<string, Etkinlik[]> = {};
    for (const e of etkinlikler) {
      if (!m[e.tarih]) m[e.tarih] = [];
      m[e.tarih].push(e);
    }
    return m;
  }, [etkinlikler]);

  const akademikMap = useMemo(() => {
    const m: Record<string, typeof AKADEMIK> = {};
    for (const a of AKADEMIK) {
      if (!m[a.tarih]) m[a.tarih] = [];
      m[a.tarih].push(a);
    }
    return m;
  }, []);

  const yaklasanlar = useMemo(() => {
    const bugunD = new Date(TODAY);
    const seen = new Set<string>();
    return AKADEMIK.filter(a => {
      const fark = (new Date(a.tarih).getTime() - bugunD.getTime()) / 86400000;
      if (fark < 0 || fark > 45) return false;
      const key = a.etiket + a.tarih;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  }, [TODAY]);

  const seciliAkademik = useMemo(() => akademikMap[seciliTarih ?? ""] ?? [], [akademikMap, seciliTarih]);
  const seciliEtkinlikler = useMemo(() =>
    etkinlikler
      .filter(e => e.tarih === seciliTarih)
      .sort((a, b) => saatDakika(a.saat_bas) - saatDakika(b.saat_bas)),
    [etkinlikler, seciliTarih]
  );

  const sinavTuru = seciliAkademik.find(a => (a as any).sinav_turu)?.sinav_turu as string | undefined;
  const isTatil   = seciliAkademik.some(a => a.tip === "tatil");
  const isSinav   = seciliAkademik.some(a => a.tip === "sinav");

  // ── Yardımcılar ────────────────────────────────────────────────────────────
  function bildir(tip: "basari" | "hata", metin: string) {
    setBildirim({ tip, metin });
    setTimeout(() => setBildirim(null), 3500);
  }

  const cakismaKontrol = useCallback((tarih: string, bas: string, bit: string, haricId?: string) => {
    const gunEtk = (etkinlikMap[tarih] ?? []).filter(e => e.id !== haricId);
    const cakisanlar  = gunEtk.filter(e => cakisiyor(bas, bit, e.saat_bas, e.saat_bit));
    const tur         = (akademikMap[tarih] ?? []).find(a => (a as any).sinav_turu)?.sinav_turu as string | undefined;
    const blokCakisan = tur ? (SINAV_BLOKLARI[tur] ?? []).filter(b => cakisiyor(bas, bit, b.saat, b.bitis)) : [];
    return { cakisanlar, blokCakisan };
  }, [etkinlikMap, akademikMap]);

  // ── Kaydet ─────────────────────────────────────────────────────────────────
  function handleKaydet() {
    if (!form.etkinlik.trim()) { bildir("hata", "Etkinlik adı gerekli."); return; }
    if (saatDakika(form.saat_bas) >= saatDakika(form.saat_bit)) { bildir("hata", "Bitiş saati başlangıçtan sonra olmalı."); return; }

    const { cakisanlar, blokCakisan } = cakismaKontrol(seciliTarih!, form.saat_bas, form.saat_bit, duzenlenen?.id);

    if (blokCakisan.length > 0) {
      setUyari({
        mesaj: `⚠️ Seçilen saat (${form.saat_bas}–${form.saat_bit}), ${sinavTuru === "final" ? "Final" : "Ara"} Sınav bloğuyla çakışıyor: ${blokCakisan.map(b => `${b.label} (${b.saat}–${b.bitis})`).join(", ")}`,
        onDevam: () => { doKaydet(); setUyari(null); },
        onIptal: () => setUyari(null),
      });
      return;
    }
    if (cakisanlar.length > 0) {
      setUyari({
        mesaj: `⚠️ Bu saatte ${cakisanlar.length} etkinlik var: ${cakisanlar.map(e => `"${e.etkinlik}" (${e.saat_bas}–${e.saat_bit})`).join(" · ")}`,
        onDevam: () => { doKaydet(); setUyari(null); },
        onIptal: () => setUyari(null),
      });
      return;
    }
    doKaydet();
  }

  async function doKaydet() {
    if (duzenlenen) {
      // — Güncelle —
      const guncellendi: Partial<Etkinlik> = { etkinlik: form.etkinlik, renk: form.renk, saat_bas: form.saat_bas, saat_bit: form.saat_bit };
      // Optimistic
      setEtkinlikler(p => p.map(e => e.id === duzenlenen.id ? { ...e, ...guncellendi } : e));
      setFormAcik(false); setDuzenlenen(null); bildir("basari", "Etkinlik güncellendi.");
      const { error } = await supabase.from("etkinlik_takvimi").update(guncellendi).eq("id", duzenlenen.id!);
      if (error) { bildir("hata", "Güncellenemedi."); fetchEtkinlikler(); }
    } else {
      // — Yeni ekle —
      const yeni: Omit<Etkinlik, "id"> = {
        donem: "2025-2026 Bahar",
        tarih: seciliTarih!,
        etkinlik: form.etkinlik,
        renk: form.renk,
        saat_bas: form.saat_bas,
        saat_bit: form.saat_bit,
        olusturan_id: kullaniciId,
        olusturan_adi: kullaniciAdi,
        aktif: true,
      };
      // Optimistic
      const geciciId = "tmp-" + Date.now();
      setEtkinlikler(p => [...p, { id: geciciId, ...yeni }]);
      setForm({ etkinlik: "", renk: "mavi", saat_bas: "09:00", saat_bit: "10:00" });
      setFormAcik(false); bildir("basari", "Etkinlik eklendi.");

      const { data, error } = await supabase.from("etkinlik_takvimi").insert(yeni).select().single();
      if (error) { setEtkinlikler(p => p.filter(e => e.id !== geciciId)); bildir("hata", "Kaydedilemedi."); }
      else setEtkinlikler(p => p.map(e => e.id === geciciId ? data : e));
    }
  }

  // ── Sil ────────────────────────────────────────────────────────────────────
  async function handleSil(id: string) {
    const silinen = etkinlikler.find(e => e.id === id);
    if (!silinen) return;
    // Optimistic
    setEtkinlikler(p => p.filter(e => e.id !== id));
    bildir("basari", "Etkinlik silindi.");
    const { error } = await supabase.from("etkinlik_takvimi").update({ aktif: false }).eq("id", id);
    if (error) { setEtkinlikler(p => [...p, silinen]); bildir("hata", "Silinemedi."); }
  }

  // ── Düzenle ────────────────────────────────────────────────────────────────
  function handleDuzenle(e: Etkinlik) {
    if (kullaniciRole !== "admin" && e.olusturan_id !== kullaniciId) return;
    setDuzenlenen(e);
    setSeciliTarih(e.tarih);
    setForm({ etkinlik: e.etkinlik, renk: e.renk, saat_bas: e.saat_bas, saat_bit: e.saat_bit });
    setFormAcik(true);
  }

  function oncekiAy() { ay === 0  ? (setYil(y => y - 1), setAy(11)) : setAy(a => a - 1); }
  function sonrakiAy() { ay === 11 ? (setYil(y => y + 1), setAy(0))  : setAy(a => a + 1); }

  // ── Auth guard ─────────────────────────────────────────────────────────────
  if (authYukleniyor || !yetkili) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout title="Etkinlik Takvimi" subtitle="2025-2026 Bahar Dönemi Akademik Planlayıcı">

      {/* Toast bildirimi */}
      {bildirim && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 ${
          bildirim.tip === "basari"
            ? "bg-white border-emerald-200 text-emerald-700"
            : "bg-white border-red-200 text-red-600"
        }`}>
          <span className={`w-2 h-2 rounded-full ${bildirim.tip === "basari" ? "bg-emerald-500" : "bg-red-500"}`} />
          {bildirim.metin}
        </div>
      )}

      {/* Çakışma uyarı modal */}
      {uyari && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-base font-bold text-amber-700 mb-3">Çakışma Uyarısı</div>
            <div className="text-sm text-zinc-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 leading-relaxed">
              {uyari.mesaj}
            </div>
            <p className="text-xs text-zinc-400 mb-4">Yine de eklemek istiyor musunuz?</p>
            <div className="flex gap-3">
              <button onClick={uyari.onIptal}  className="flex-1 py-2.5 rounded-xl border border-zinc-300 text-sm text-zinc-600 hover:bg-zinc-50 transition">İptal — Düzenle</button>
              <button onClick={uyari.onDevam}  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition" style={{ background: "#B71C1C" }}>Yine de Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* ── İçerik: Sol yaklaşanlar + Takvim + Sağ drawer ── */}
      <div className="flex gap-4 items-start">

        {/* Sol: Yaklaşan tarihler */}
        <div className="w-48 flex-shrink-0 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-3 py-2.5 text-[10px] font-bold tracking-widest uppercase text-zinc-400 border-b border-zinc-100">
            Yaklaşan Tarihler
          </div>
          <div className="divide-y divide-zinc-50">
            {yaklasanlar.map((a, i) => {
              const r = AK_RENK[a.tip];
              const [, m, d] = a.tarih.split("-");
              const fark = Math.ceil((new Date(a.tarih).getTime() - new Date(TODAY).getTime()) / 86400000);
              return (
                <div key={i}
                  className="px-3 py-2 cursor-pointer transition-colors hover:bg-zinc-50"
                  style={{ borderLeft: `3px solid ${r.dot}` }}
                  onClick={() => { setAy(parseInt(m) - 1); setSeciliTarih(a.tarih); }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: r.dot }}>
                    {fark === 0 ? "BUGÜN" : `${fark} gün`}
                  </div>
                  <div className="text-[11px] font-semibold text-zinc-800 leading-tight mt-0.5">
                    {r.icon} {a.etiket}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {parseInt(d)} {AYLAR[parseInt(m) - 1]}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Lejand */}
          <div className="px-3 py-2.5 border-t border-zinc-100">
            <div className="text-[9px] font-bold tracking-widest uppercase text-zinc-400 mb-2">Lejand</div>
            {Object.entries(RENKLER).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.dot }} />
                <span className="text-[10px] text-zinc-500">{v.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Orta: Takvim */}
        <div className="flex-1 min-w-0">
          {/* Ay navigasyonu */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={oncekiAy} className="w-8 h-8 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-zinc-500 hover:bg-zinc-50 transition text-lg">‹</button>
            <div className="text-center">
              <span className="text-lg font-bold text-zinc-800">{AYLAR[ay]}</span>
              <span className="text-sm text-zinc-400 ml-2">{yil}</span>
            </div>
            <button onClick={sonrakiAy} className="w-8 h-8 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-zinc-500 hover:bg-zinc-50 transition text-lg">›</button>
          </div>

          {/* Takvim grid */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            {/* Gün başlıkları */}
            <div className="grid grid-cols-7" style={{ background: "#8B0000" }}>
              {GUN_KISA.map((g, i) => (
                <div key={g} className="py-2.5 text-center text-[11px] font-bold tracking-wide"
                  style={{ color: i >= 5 ? "#FCA5A5" : "#fff" }}>
                  {g}
                </div>
              ))}
            </div>

            {/* Yükleniyor */}
            {veriYukleniyor && (
              <div className="py-16 text-center text-sm text-zinc-400">Yükleniyor...</div>
            )}

            {/* Günler */}
            {!veriYukleniyor && (
              <div className="grid grid-cols-7">
                {gunler.map((g, i) => {
                  const isToday    = g.tarih === TODAY;
                  const isSelected = g.tarih === seciliTarih;
                  const gEtk       = g.buAy ? (etkinlikMap[g.tarih] ?? []) : [];
                  const gAk        = g.buAy ? (akademikMap[g.tarih] ?? []) : [];
                  const hafSonu    = i % 7 >= 5;
                  const isTatilGun = gAk.some(a => a.tip === "tatil");
                  const isSinavGun = gAk.some(a => a.tip === "sinav");
                  const tur        = (gAk.find(a => (a as any).sinav_turu) as any)?.sinav_turu as string | undefined;
                  const isHover    = hoverTarih === g.tarih && g.buAy;

                  let bgClass = "bg-white";
                  if (!g.buAy)   bgClass = "bg-zinc-50/50";
                  else if (isTatilGun) bgClass = "bg-red-50/40";
                  else if (isSinavGun) bgClass = tur === "final" ? "bg-amber-50/50" : "bg-yellow-50/30";
                  else if (hafSonu)    bgClass = "bg-zinc-50/30";
                  if (isSelected) bgClass = "bg-red-50";

                  return (
                    <div key={i}
                      className="relative"
                      onMouseEnter={() => g.buAy && setHoverTarih(g.tarih)}
                      onMouseLeave={() => setHoverTarih(null)}
                    >
                      <div
                        onClick={() => g.buAy && setSeciliTarih(g.tarih)}
                        className={`min-h-[72px] p-1.5 border-r border-b border-zinc-100 transition-colors
                          ${bgClass}
                          ${g.buAy ? "cursor-pointer hover:bg-red-50/60" : "cursor-default"}
                          ${isSelected ? "ring-2 ring-inset ring-red-700" : ""}
                        `}
                      >
                        {/* Gün no */}
                        <div className="flex justify-between items-start mb-1">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-sans
                            ${isToday ? "text-white font-bold" : !g.buAy ? "text-zinc-300" : hafSonu ? "text-zinc-400" : "text-zinc-700"}
                          `} style={isToday ? { background: "#8B0000" } : {}}>
                            {g.gun}
                          </div>
                          {isSinavGun && g.buAy && <span className="text-[9px]">{tur === "final" ? "📝" : "✏️"}</span>}
                          {isTatilGun && g.buAy && <span className="text-[9px]">🏖️</span>}
                        </div>
                        {/* Akademik etiket */}
                        {gAk.slice(0, 1).map((a, ai) => {
                          const r = AK_RENK[a.tip];
                          return (
                            <div key={ai} className="text-[8px] font-bold rounded px-1 py-px mb-1 truncate font-sans"
                              style={{ background: r.bg, color: r.text }}>
                              {a.etiket.length > 15 ? a.etiket.slice(0, 13) + "…" : a.etiket}
                            </div>
                          );
                        })}
                        {/* Etkinlik pilleri */}
                        {gEtk.slice(0, 2).map(e => {
                          const r = RENKLER[e.renk] ?? RENKLER.mavi;
                          return (
                            <div key={e.id} className="text-[8px] rounded px-1 py-px mb-px truncate font-sans font-medium"
                              style={{ background: r.bg, color: r.text, borderLeft: `2px solid ${r.dot}` }}>
                              {e.saat_bas} {e.etkinlik.length > 10 ? e.etkinlik.slice(0, 9) + "…" : e.etkinlik}
                            </div>
                          );
                        })}
                        {gEtk.length > 2 && <div className="text-[8px] text-zinc-400 font-sans">+{gEtk.length - 2} daha</div>}
                      </div>

                      {/* Hover tooltip */}
                      {isHover && (isSinavGun || isTatilGun || gEtk.length > 0) && (
                        <div className={`absolute z-30 top-full ${i % 7 >= 4 ? "right-0" : "left-0"} w-48 bg-zinc-900 text-white rounded-xl p-2.5 shadow-2xl pointer-events-none`}
                          style={{ fontSize: 11, fontFamily: "sans-serif", lineHeight: 1.5 }}>
                          {isTatilGun && <div className="text-red-300 font-bold mb-1">🏖️ Resmi Tatil</div>}
                          {isSinavGun && <div className="text-yellow-300 font-bold mb-1">
                            {tur === "final" ? "📝 Final Haftası" : "✏️ Ara Sınav Haftası"}
                          </div>}
                          {gEtk.slice(0, 3).map(e => (
                            <div key={e.id} className="mb-0.5">
                              <span className="text-red-300">{e.saat_bas}–{e.saat_bit}</span> {e.etkinlik}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sağ: Drawer — gün detayı */}
        <div className={`flex-shrink-0 transition-all duration-200 overflow-hidden ${seciliTarih ? "w-72" : "w-0"}`}>
          <div className="w-72 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">

            {/* Drawer header */}
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50 flex items-start justify-between">
              <div>
                <div className="text-sm font-bold text-zinc-800">{seciliTarih ? formatTarih(seciliTarih) : ""}</div>
                {(isTatil || isSinav) && (
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{
                      background: isTatil ? "#FEE2E2" : "#FEF9C3",
                      color:      isTatil ? "#991B1B" : "#713F12",
                      border:     `1px solid ${isTatil ? "#FCA5A5" : "#FDE047"}`,
                    }}>
                    {isTatil ? "🏖️ Resmi Tatil" : sinavTuru === "final" ? "📝 Final Haftası" : "✏️ Ara Sınav Haftası"}
                  </span>
                )}
              </div>
              <button onClick={() => { setSeciliTarih(null); setFormAcik(false); setDuzenlenen(null); }}
                className="w-6 h-6 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-white transition text-sm">✕</button>
            </div>

            <div className="p-3 max-h-[calc(100vh-220px)] overflow-y-auto">

              {/* Sınav blokları */}
              {sinavTuru && SINAV_BLOKLARI[sinavTuru] && (
                <div className="mb-3">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Sınav Saatleri</div>
                  {SINAV_BLOKLARI[sinavTuru].map((b, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-1 text-xs font-sans"
                      style={{ background: "#FFFBEB", border: "1px solid #FDE047" }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="font-bold text-amber-800">{b.saat}–{b.bitis}</span>
                      <span className="text-zinc-400">{b.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Mevcut etkinlikler */}
              <div className="mb-3">
                <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                  Etkinlikler {seciliEtkinlikler.length > 0 ? `(${seciliEtkinlikler.length})` : ""}
                </div>

                {seciliEtkinlikler.length === 0 && !formAcik && (
                  <p className="text-xs text-zinc-300 text-center py-3 font-sans">Bu gün etkinlik yok</p>
                )}

                {seciliEtkinlikler.map(e => {
                  const r = RENKLER[e.renk] ?? RENKLER.mavi;
                  const silinebilir = kullaniciRole === "admin" || e.olusturan_id === kullaniciId;
                  return (
                    <div key={e.id} className="relative rounded-xl px-3 py-2.5 mb-2 border"
                      style={{ background: r.bg, borderColor: r.border, borderLeft: `3px solid ${r.dot}` }}>
                      <div className="text-[10px] font-bold font-sans mb-0.5" style={{ color: r.text }}>
                        {e.saat_bas} – {e.saat_bit}
                      </div>
                      <div className="text-xs font-semibold" style={{ color: r.text }}>{e.etkinlik}</div>
                      {e.olusturan_adi && (
                        <div className="text-[10px] font-sans mt-0.5" style={{ color: r.text, opacity: 0.6 }}>{e.olusturan_adi}</div>
                      )}
                      {silinebilir && (
                        <div className="absolute top-1.5 right-1.5 flex gap-1">
                          <button onClick={() => handleDuzenle(e)}
                            className="w-5 h-5 rounded bg-white/80 hover:bg-white text-zinc-500 hover:text-zinc-700 text-[10px] flex items-center justify-center transition shadow-sm">✎</button>
                          <button onClick={() => handleSil(e.id!)}
                            className="w-5 h-5 rounded bg-white/80 hover:bg-white text-red-400 hover:text-red-600 text-[10px] flex items-center justify-center transition shadow-sm">✕</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Form */}
              {!isTatil && (
                formAcik ? (
                  <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200">
                    <div className="text-xs font-bold text-zinc-700 mb-2.5">
                      {duzenlenen ? "Etkinliği Düzenle" : "Yeni Etkinlik"}
                    </div>

                    <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Etkinlik Adı *</label>
                    <input value={form.etkinlik} onChange={e => setForm(p => ({ ...p, etkinlik: e.target.value }))}
                      placeholder="örn: Gastronomi Workshop"
                      className="w-full border border-zinc-300 rounded-lg px-3 py-1.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-red-500 mb-2.5 bg-white" />

                    <div className="flex gap-2 mb-2.5">
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Başlangıç</label>
                        <select value={form.saat_bas} onChange={e => setForm(p => ({ ...p, saat_bas: e.target.value }))}
                          className="w-full border border-zinc-300 rounded-lg px-2 py-1.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                          {SAATLER.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Bitiş</label>
                        <select value={form.saat_bit} onChange={e => setForm(p => ({ ...p, saat_bit: e.target.value }))}
                          className="w-full border border-zinc-300 rounded-lg px-2 py-1.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                          {SAATLER.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Renk */}
                    <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Kategori</label>
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {Object.entries(RENKLER).map(([k, v]) => (
                        <button key={k} onClick={() => setForm(p => ({ ...p, renk: k }))}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition border-2 ${form.renk === k ? "border-zinc-800 scale-105" : "border-transparent"}`}
                          style={{ background: v.bg, color: v.text }}>
                          {v.label}
                        </button>
                      ))}
                    </div>

                    {/* Canlı çakışma uyarısı */}
                    {(() => {
                      if (saatDakika(form.saat_bas) >= saatDakika(form.saat_bit)) return null;
                      const { cakisanlar, blokCakisan } = cakismaKontrol(seciliTarih!, form.saat_bas, form.saat_bit, duzenlenen?.id);
                      if (!cakisanlar.length && !blokCakisan.length) return null;
                      return (
                        <div className="text-[11px] font-sans bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-amber-800 mb-2.5">
                          ⚠️ {blokCakisan.length ? `Sınav bloğuyla çakışma (${blokCakisan[0].saat}–${blokCakisan[0].bitis})` : `${cakisanlar.length} etkinlikle çakışma`}
                        </div>
                      );
                    })()}

                    {/* Önizleme */}
                    {form.etkinlik && (
                      <div className="rounded-lg px-3 py-2 text-xs font-semibold border mb-2.5"
                        style={{ background: RENKLER[form.renk]?.bg, color: RENKLER[form.renk]?.text, borderColor: RENKLER[form.renk]?.border }}>
                        {form.saat_bas}–{form.saat_bit} {form.etkinlik}
                        <div className="text-[10px] mt-0.5 opacity-60 font-normal">{kullaniciAdi}</div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button onClick={() => { setFormAcik(false); setDuzenlenen(null); }}
                        className="flex-1 py-2 rounded-lg border border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-100 transition">İptal</button>
                      <button onClick={handleKaydet}
                        className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition"
                        style={{ background: "#B71C1C" }}>
                        {duzenlenen ? "Güncelle" : "Ekle"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setFormAcik(true); setDuzenlenen(null); }}
                    className="w-full py-2.5 rounded-xl border-2 border-dashed border-zinc-200 text-xs text-zinc-400 hover:border-red-700 hover:text-red-700 transition font-sans">
                    + Etkinlik Ekle
                  </button>
                )
              )}
              {isTatil && (
                <p className="text-xs text-red-300 text-center py-2 font-sans">Resmi tatil günlerinde etkinlik eklenemez.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}