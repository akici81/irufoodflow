"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { HAFTALAR } from "@/lib/constants";
import LoadingSkeleton from "../components/LoadingSkeleton";

type Urun = {
  id: string;
  urun_adi: string;
  marka: string;
  olcu: string;
  fiyat: number;
};

type Malzeme = {
  id?: string;
  urun_id: string;
  urun_adi: string;
  marka: string;
  olcu: string;
  miktar_kisi: number;
  notlar: string;
};

type Recete = {
  id: string;
  ad: string;
  kategori: string;
  aciklama: string;
  hazirlanis: string;
  porsiyon: number;
  sure_dakika: number | null;
  zorluk: string | null;
  aktif: boolean;
  olusturan_id: number | null;
  malzemeler?: Malzeme[];
};

type Ders = {
  id: string;
  kod: string;
  ad: string;
};

const KATEGORILER = ["Tümü", "Ana Yemekler", "Çorbalar", "Salatalar", "Tatlılar", "Kahvaltılık", "Aperatif", "Diğer"];
const ZORLUKLAR = ["Kolay", "Orta", "Zor"];

export default function RecetelerPage() {
  const { yetkili, yukleniyor: authYukleniyor } = useAuth("/receteler");

  const router = useRouter();
  const [kullaniciId, setKullaniciId] = useState<number | null>(null);
  const [kullaniciRole, setKullaniciRole] = useState<string>("");
  const [kullaniciAdi, setKullaniciAdi] = useState<string>("");
  const [dersler, setDersler] = useState<Ders[]>([]);
  const [receteler, setReceteler] = useState<Recete[]>([]);
  const [ortakReceteler, setOrtakReceteler] = useState<Recete[]>([]);
  const [filtreKat, setFiltreKat] = useState("Tümü");
  const [aramaMetni, setAramaMetni] = useState("");
  const [veriYukleniyor, setVeriYukleniyor] = useState(true);
  const [ortakYukleniyor, setOrtakYukleniyor] = useState(false);
  const [bildirim, setBildirim] = useState<{ tip: "basari" | "hata"; metin: string } | null>(null);
  const [aktifSekme, setAktifSekme] = useState<"benim" | "ortak">("benim");

  // Modals
  const [detayRecete, setDetayRecete] = useState<Recete | null>(null);
  const [modalAcik, setModalAcik] = useState(false);
  const [duzenleRecete, setDuzenleRecete] = useState<Recete | null>(null);
  const [listeModalAcik, setListeModalAcik] = useState(false);
  const [listeRecete, setListeRecete] = useState<Recete | null>(null);

  // Form
  const [form, setForm] = useState({ ad: "", kategori: "Ana Yemekler", aciklama: "", hazirlanis: "", porsiyon: 1, sure_dakika: "", zorluk: "" });
  const [malzemeler, setMalzemeler] = useState<Malzeme[]>([]);
  const [yeniMalzeme, setYeniMalzeme] = useState<Malzeme>({ urun_id: "", urun_adi: "", marka: "", olcu: "", miktar_kisi: 1, notlar: "" });
  const [formYukleniyor, setFormYukleniyor] = useState(false);

  // Ürün havuzu autocomplete
  const [urunHavuzu, setUrunHavuzu] = useState<Urun[]>([]);
  const [urunOneri, setUrunOneri] = useState<Urun[]>([]);
  const [oneriAcik, setOneriAcik] = useState(false);

  // Listeye ekle formu
  const [listeForm, setListeForm] = useState({ ders_id: "", hafta: "1. Hafta", porsiyon: 1 });
  const [listeYukleniyor, setListeYukleniyor] = useState(false);

  useEffect(() => {
    if (!yetkili) return;
    const id = localStorage.getItem("aktifKullaniciId");
    const role = localStorage.getItem("role") || "";
    if (!id) { setVeriYukleniyor(false); return; }
    setKullaniciId(Number(id));
    setKullaniciRole(role);
    fetchBaslangic(Number(id), role);
  }, [yetkili]);

  const fetchBaslangic = async (kid: number, role: string) => {
    setVeriYukleniyor(true);
    const [kullanici, urunler] = await Promise.all([
      supabase.from("kullanicilar").select("ad_soyad, dersler").eq("id", kid).single(),
      supabase.from("urunler").select("id, urun_adi, marka, olcu, fiyat").order("urun_adi"),
    ]);
    if (kullanici.data) {
      setKullaniciAdi(kullanici.data.ad_soyad || "");
      if ((kullanici.data.dersler || []).length > 0) {
        const { data: dersData } = await supabase.from("dersler").select("id, kod, ad").in("id", kullanici.data.dersler);
        setDersler(dersData || []);
        if (dersData && dersData.length > 0) setListeForm(p => ({ ...p, ders_id: dersData[0].id }));
      }
    }
    setUrunHavuzu(urunler.data || []);
    await fetchReceteler(kid, role);
    setVeriYukleniyor(false);
  };

  const fetchReceteler = async (kid: number, role: string) => {
    const { data } = role === "admin"
      ? await supabase.from("receteler").select("*").eq("aktif", true).order("ad")
      : await supabase.from("receteler").select("*").eq("aktif", true).eq("olusturan_id", kid).order("ad");
    setReceteler(data || []);
  };

  const fetchMalzemeler = async (receteId: string): Promise<Malzeme[]> => {
    const { data } = await supabase.from("recete_malzemeleri").select("*").eq("recete_id", receteId);
    return data || [];
  };

  const bildir = (tip: "basari" | "hata", metin: string) => {
    setBildirim({ tip, metin });
    setTimeout(() => setBildirim(null), 3500);
  };

  // ── Listeye ekle ──────────────────────────────────────
  const handleListeAc = async (r: Recete) => {
    const malz = await fetchMalzemeler(r.id);
    setListeRecete({ ...r, malzemeler: malz });
    setListeModalAcik(true);
  };

  const handleListeyeEkle = async () => {
    if (!listeRecete?.malzemeler || !kullaniciId) return;
    if (!listeForm.ders_id) { bildir("hata", "Ders seçiniz."); return; }
    if (listeForm.porsiyon < 1) { bildir("hata", "Porsiyon en az 1 olmalı."); return; }

    setListeYukleniyor(true);
    const ders = dersler.find(d => d.id === listeForm.ders_id);

    // Mevcut sipariş var mı?
    const { data: mevcutSiparis } = await supabase
      .from("siparisler")
      .select("*")
      .eq("ogretmen_id", kullaniciId)
      .eq("ders_id", listeForm.ders_id)
      .eq("hafta", listeForm.hafta)
      .single();

    // Reçete malzemelerini porsiyon ile çarp
    const yeniUrunler = listeRecete.malzemeler!.map(m => {
      const urun = urunHavuzu.find(u => u.id === m.urun_id);
      const miktar = parseFloat((m.miktar_kisi * listeForm.porsiyon).toFixed(3));
      const birimFiyat = urun?.fiyat || 0;
      return {
        urunId: m.urun_id,
        urunAdi: m.urun_adi,
        marka: m.marka || "",
        olcu: m.olcu,
        miktar,
        birimFiyat,
        toplam: parseFloat((miktar * birimFiyat).toFixed(2)),
      };
    });

    if (mevcutSiparis) {
      // Mevcut siparişe ekle - aynı ürünleri topla
      const mevcutUrunler: typeof yeniUrunler = mevcutSiparis.urunler || [];
      const birlesik = [...mevcutUrunler];

      for (const yeni of yeniUrunler) {
        const idx = birlesik.findIndex(u => u.urunId === yeni.urunId);
        if (idx >= 0) {
          const yeniMiktar = parseFloat((birlesik[idx].miktar + yeni.miktar).toFixed(3));
          birlesik[idx] = {
            ...birlesik[idx],
            miktar: yeniMiktar,
            toplam: parseFloat((yeniMiktar * birlesik[idx].birimFiyat).toFixed(2)),
          };
        } else {
          birlesik.push(yeni);
        }
      }

      const genelToplam = birlesik.reduce((s, u) => s + u.toplam, 0);
      await supabase.from("siparisler").update({
        urunler: birlesik,
        genel_toplam: parseFloat(genelToplam.toFixed(2)),
      }).eq("id", mevcutSiparis.id);

      bildir("basari", `"${listeRecete.ad}" ${listeForm.hafta} listesine eklendi!`);
      setTimeout(() => router.push("/alisveris-listelerim"), 1000);
    } else {
      // Yeni sipariş oluştur
      const genelToplam = yeniUrunler.reduce((s, u) => s + u.toplam, 0);
      await supabase.from("siparisler").insert({
        ogretmen_id: kullaniciId,
        ogretmen_adi: kullaniciAdi,
        ders_id: listeForm.ders_id,
        ders_adi: ders ? `${ders.kod} - ${ders.ad}` : "",
        hafta: listeForm.hafta,
        urunler: yeniUrunler,
        genel_toplam: parseFloat(genelToplam.toFixed(2)),
        tarih: new Date().toLocaleDateString("tr-TR"),
        durum: "bekliyor",
      });
      bildir("basari", `"${listeRecete.ad}" için ${listeForm.hafta} listesi oluşturuldu!`);
      setTimeout(() => router.push("/alisveris-listelerim"), 1000);
    }

    setListeModalAcik(false);
    setListeYukleniyor(false);
  };

  // ── Ortak sekmesi ─────────────────────────────────────
  const handleOrtakSekme = async () => {
    setAktifSekme("ortak");
    if (ortakReceteler.length === 0) {
      setOrtakYukleniyor(true);
      const { data } = await supabase.from("receteler").select("*").eq("aktif", true).is("olusturan_id", null).order("ad");
      setOrtakReceteler(data || []);
      setOrtakYukleniyor(false);
    }
  };

  const handleKopyala = async (r: Recete) => {
    if (!kullaniciId) return;
    const malz = await fetchMalzemeler(r.id);
    const { data, error } = await supabase.from("receteler").insert({
      ad: r.ad + " (Kopyam)", kategori: r.kategori, aciklama: r.aciklama,
      hazirlanis: r.hazirlanis, porsiyon: r.porsiyon, aktif: true, olusturan_id: kullaniciId,
    }).select().single();
    if (error || !data) { bildir("hata", "Kopyalama başarısız."); return; }
    if (malz.length > 0) {
      await supabase.from("recete_malzemeleri").insert(
        malz.map(m => ({ recete_id: data.id, urun_id: m.urun_id, urun_adi: m.urun_adi, marka: m.marka, olcu: m.olcu, miktar_kisi: m.miktar_kisi, notlar: m.notlar }))
      );
    }
    bildir("basari", `"${r.ad}" tarif defterinize kopyalandı!`);
    setAktifSekme("benim");
    if (kullaniciId) fetchReceteler(kullaniciId, kullaniciRole);
  };

  // ── Detay ─────────────────────────────────────────────
  const handleDetay = async (r: Recete) => {
    const malz = await fetchMalzemeler(r.id);
    setDetayRecete({ ...r, malzemeler: malz });
  };

  // ── Tarif formu ───────────────────────────────────────
  const handleYeniAc = () => {
    setDuzenleRecete(null);
    setForm({ ad: "", kategori: "Ana Yemekler", aciklama: "", hazirlanis: "", porsiyon: 1, sure_dakika: "", zorluk: "" });
    setMalzemeler([]);
    setYeniMalzeme({ urun_id: "", urun_adi: "", marka: "", olcu: "", miktar_kisi: 1, notlar: "" });
    setModalAcik(true);
  };

  const handleDuzenleAc = async (r: Recete) => {
    const malz = await fetchMalzemeler(r.id);
    setDuzenleRecete(r);
    setForm({ ad: r.ad, kategori: r.kategori, aciklama: r.aciklama || "", hazirlanis: r.hazirlanis || "", porsiyon: r.porsiyon, sure_dakika: r.sure_dakika?.toString() || "", zorluk: r.zorluk || "" });
    setMalzemeler(malz);
    setYeniMalzeme({ urun_id: "", urun_adi: "", marka: "", olcu: "", miktar_kisi: 1, notlar: "" });
    setModalAcik(true);
  };

  // ── Autocomplete ──────────────────────────────────────
  const aramaFiltre = (liste: Urun[], val: string) => {
    if (!val.trim()) return liste.slice(0, 8);
    const q = val.toLowerCase();
    const exact = liste.filter(u => (u.urun_adi || "").toLowerCase() === q);
    const starts = liste.filter(u => (u.urun_adi || "").toLowerCase().startsWith(q) && (u.urun_adi || "").toLowerCase() !== q);
    const contains = liste.filter(u => {
      const ad = (u.urun_adi || "").toLowerCase();
      return ad.includes(q) && !ad.startsWith(q);
    });
    const markaContains = liste.filter(u => (u.marka || "").toLowerCase().includes(q) && !(u.urun_adi || "").toLowerCase().includes(q));
    return [...exact, ...starts, ...contains, ...markaContains].slice(0, 8);
  };

  const handleUrunAra = (val: string) => {
    setYeniMalzeme(p => ({ ...p, urun_adi: val, urun_id: "" }));
    const filtre = aramaFiltre(urunHavuzu, val);
    setUrunOneri(filtre);
    setOneriAcik(filtre.length > 0);
  };

  const handleUrunOdak = () => {
    const filtre = aramaFiltre(urunHavuzu, yeniMalzeme.urun_adi);
    setUrunOneri(filtre);
    setOneriAcik(filtre.length > 0);
  };

  const handleUrunSec = (u: Urun) => {
    setYeniMalzeme(p => ({ ...p, urun_id: u.id, urun_adi: u.urun_adi, marka: u.marka || "", olcu: u.olcu }));
    setOneriAcik(false);
  };

  const handleMalzemeEkle = () => {
    if (!yeniMalzeme.urun_id) { bildir("hata", "Listeden bir ürün seçiniz."); return; }
    if (malzemeler.find(m => m.urun_id === yeniMalzeme.urun_id)) { bildir("hata", "Bu ürün zaten ekli."); return; }
    setMalzemeler(prev => [...prev, { ...yeniMalzeme }]);
    setYeniMalzeme({ urun_id: "", urun_adi: "", marka: "", olcu: "", miktar_kisi: 1, notlar: "" });
  };

  const handleMalzemeSil = (idx: number) => setMalzemeler(prev => prev.filter((_, i) => i !== idx));

  const handleKaydet = async () => {
    if (!form.ad.trim()) { bildir("hata", "Tarif adı zorunlu."); return; }
    if (!kullaniciId) return;
    setFormYukleniyor(true);

    const receteData = {
      ad: form.ad, kategori: form.kategori, aciklama: form.aciklama,
      hazirlanis: form.hazirlanis, porsiyon: form.porsiyon,
      sure_dakika: form.sure_dakika ? Number(form.sure_dakika) : null,
      zorluk: form.zorluk || null,
      guncelleme_tarihi: new Date().toISOString(),
    };

    if (duzenleRecete) {
      await supabase.from("receteler").update(receteData).eq("id", duzenleRecete.id);
      await supabase.from("recete_malzemeleri").delete().eq("recete_id", duzenleRecete.id);
      if (malzemeler.length > 0)
        await supabase.from("recete_malzemeleri").insert(malzemeler.map(m => ({ ...m, recete_id: duzenleRecete.id })));
      bildir("basari", "Tarif güncellendi!");
    } else {
      const { data, error } = await supabase.from("receteler").insert({
        ...receteData, aktif: true, olusturan_id: kullaniciId,
      }).select().single();
      if (error || !data) { bildir("hata", "Kayıt hatası: " + error?.message); setFormYukleniyor(false); return; }
      if (malzemeler.length > 0)
        await supabase.from("recete_malzemeleri").insert(malzemeler.map(m => ({ ...m, recete_id: data.id })));
      bildir("basari", "Tarif defterinize eklendi!");
    }
    setModalAcik(false);
    setFormYukleniyor(false);
    fetchReceteler(kullaniciId, kullaniciRole);
  };

  const handleSil = async (id: string) => {
    if (!confirm("Bu tarifi silmek istiyor musunuz?")) return;
    await supabase.from("receteler").update({ aktif: false }).eq("id", id);
    bildir("basari", "Tarif silindi.");
    if (kullaniciId) fetchReceteler(kullaniciId, kullaniciRole);
  };

  const gosterilecek = (aktifSekme === "benim" ? receteler : ortakReceteler).filter(r =>
    (filtreKat === "Tümü" || r.kategori === filtreKat) &&
    (aramaMetni === "" || (r.ad || "").toLowerCase().includes(aramaMetni.toLowerCase()))
  );

  const zorlukRenk: Record<string, string> = { Kolay: "text-emerald-600 bg-emerald-50", Orta: "text-amber-600 bg-amber-50", Zor: "text-red-600 bg-red-50" };

  if (authYukleniyor || !yetkili) return <LoadingSkeleton />;

  return (
    <DashboardLayout title="Tarif Defterim" subtitle="Kişisel reçete havuzunuz">
      <div className="max-w-6xl space-y-5">

        {/* Bildirim */}
        {bildirim && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-xl border text-sm font-semibold flex items-center gap-2 ${
            bildirim.tip === "basari" ? "bg-white border-emerald-200 text-emerald-700" : "bg-white border-red-200 text-red-600"
          }`}>
            <span className={`w-2 h-2 rounded-full ${bildirim.tip === "basari" ? "bg-emerald-500" : "bg-red-500"}`} />
            {bildirim.metin}
          </div>
        )}

        {/* Sekmeler */}
        <div className="flex bg-zinc-100 p-1 rounded-xl w-fit border border-zinc-200 gap-1">
          <button onClick={() => setAktifSekme("benim")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${aktifSekme === "benim" ? "bg-white text-red-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
            Tarif Defterim ({receteler.length})
          </button>
          <button onClick={handleOrtakSekme}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${aktifSekme === "ortak" ? "bg-white text-red-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
            Ortak Reçeteler
          </button>
        </div>

        {/* Filtre */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Kategori</label>
            <select value={filtreKat} onChange={e => setFiltreKat(e.target.value)}
              className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
              {KATEGORILER.map(k => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Arama</label>
            <input value={aramaMetni} onChange={e => setAramaMetni(e.target.value)} placeholder="Tarif ara..."
              className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          {aktifSekme === "benim" && (
            <button onClick={handleYeniAc}
              className="text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm"
              style={{ background: "#B71C1C" }}>
              + Yeni Tarif Ekle
            </button>
          )}
        </div>

        {/* Kartlar */}
        {(veriYukleniyor || ortakYukleniyor) ? (
          <div className="py-20 text-center text-zinc-400 text-sm">Yükleniyor...</div>
        ) : gosterilecek.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <p className="text-4xl">📒</p>
            <p className="text-zinc-500 font-medium text-sm">
              {aktifSekme === "benim" ? "Henüz tarif eklemediniz." : "Ortak reçete bulunamadı."}
            </p>
            {aktifSekme === "benim" && (
              <button onClick={handleYeniAc}
                className="text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition mt-2"
                style={{ background: "#B71C1C" }}>
                + İlk Tarifinizi Ekleyin
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gosterilecek.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-zinc-800 text-sm mb-1.5 truncate">{r.ad}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FEF2F2", color: "#B71C1C" }}>{r.kategori}</span>
                      {r.zorluk && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${zorlukRenk[r.zorluk]}`}>{r.zorluk}</span>}
                      {r.sure_dakika && <span className="text-xs text-zinc-400 font-medium">{r.sure_dakika} dk</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {aktifSekme === "ortak" ? (
                      <button onClick={() => handleKopyala(r)}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition whitespace-nowrap">
                        + Defterime Ekle
                      </button>
                    ) : (
                      <>
                        <button onClick={() => handleDuzenleAc(r)}
                          className="text-xs font-medium text-zinc-400 hover:text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition">Düzenle</button>
                        <button onClick={() => handleSil(r.id)}
                          className="text-xs font-medium text-zinc-400 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition">Sil</button>
                      </>
                    )}
                  </div>
                </div>

                {r.aciklama && <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{r.aciklama}</p>}

                <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-100">
                  <span className="text-xs font-medium text-zinc-400">1 porsiyon baz</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleDetay(r)}
                      className="text-xs font-semibold text-zinc-500 bg-zinc-50 hover:bg-zinc-100 px-3 py-1.5 rounded-lg transition">
                      Malzemeler
                    </button>
                    {kullaniciRole !== "admin" && (
                      <button onClick={() => handleListeAc(r)}
                        className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition"
                        style={{ background: "#B71C1C" }}>
                        Listeye Ekle →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Detay Modal ── */}
      {detayRecete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetayRecete(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-100 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-800">{detayRecete.ad}</h2>
                <div className="flex gap-2 mt-1.5">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#FEF2F2", color: "#B71C1C" }}>{detayRecete.kategori}</span>
                  {detayRecete.zorluk && <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${zorlukRenk[detayRecete.zorluk]}`}>{detayRecete.zorluk}</span>}
                  {detayRecete.sure_dakika && <span className="text-xs text-zinc-400 self-center">{detayRecete.sure_dakika} dk</span>}
                </div>
                {detayRecete.aciklama && <p className="text-sm text-zinc-500 mt-2">{detayRecete.aciklama}</p>}
              </div>
              <button onClick={() => setDetayRecete(null)} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold ml-4">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <h3 className="font-semibold text-zinc-800 mb-3">Malzemeler <span className="text-xs text-zinc-400 font-normal">(1 porsiyon)</span></h3>
                {(detayRecete.malzemeler || []).length === 0 ? (
                  <p className="text-sm text-zinc-400">Malzeme eklenmemiş.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50">
                        <th className="px-3 py-2 text-xs text-zinc-500 font-semibold text-left">Ürün</th>
                        <th className="px-3 py-2 text-xs text-zinc-500 font-semibold text-left">Marka</th>
                        <th className="px-3 py-2 text-xs text-zinc-500 font-semibold text-left">Miktar</th>
                        <th className="px-3 py-2 text-xs text-zinc-500 font-semibold text-left">Not</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {detayRecete.malzemeler!.map((m, i) => (
                        <tr key={i} className="hover:bg-zinc-50">
                          <td className="px-3 py-2 font-medium text-zinc-800">{m.urun_adi}</td>
                          <td className="px-3 py-2 text-zinc-500">{m.marka || "—"}</td>
                          <td className="px-3 py-2 text-zinc-700">{m.miktar_kisi} {m.olcu}</td>
                          <td className="px-3 py-2 text-zinc-400 text-xs">{m.notlar || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {detayRecete.hazirlanis && (
                <div>
                  <h3 className="font-semibold text-zinc-800 mb-2">Hazırlanış</h3>
                  <p className="text-sm text-zinc-600 whitespace-pre-line leading-relaxed">{detayRecete.hazirlanis}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Listeye Ekle Modal ── */}
      {listeModalAcik && listeRecete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-800">Alışveriş Listesine Ekle</h2>
                <p className="text-sm text-zinc-500 mt-0.5">{listeRecete.ad}</p>
              </div>
              <button onClick={() => setListeModalAcik(false)} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-600 block mb-1.5">Ders</label>
                <select value={listeForm.ders_id} onChange={e => setListeForm(p => ({ ...p, ders_id: e.target.value }))}
                  className="w-full border border-zinc-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                  {dersler.map(d => <option key={d.id} value={d.id}>{d.kod} - {d.ad}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 block mb-1.5">Hafta</label>
                <select value={listeForm.hafta} onChange={e => setListeForm(p => ({ ...p, hafta: e.target.value }))}
                  className="w-full border border-zinc-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                  {HAFTALAR.map(h => <option key={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 block mb-1.5">Porsiyon Sayısı</label>
                <input type="number" min={1} value={listeForm.porsiyon}
                  onChange={e => setListeForm(p => ({ ...p, porsiyon: Number(e.target.value) }))}
                  className="w-full border border-zinc-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                <p className="text-xs text-zinc-400 mt-1">Her malzeme bu sayı ile çarpılacak</p>
              </div>

              {/* Önizleme */}
              {listeRecete.malzemeler && listeRecete.malzemeler.length > 0 && (
                <div className="bg-zinc-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Eklenecek Malzemeler</p>
                  <div className="space-y-1">
                    {listeRecete.malzemeler.map((m, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-zinc-700">{m.urun_adi}</span>
                        <span className="text-zinc-500 font-medium">
                          {parseFloat((m.miktar_kisi * listeForm.porsiyon).toFixed(3))} {m.olcu}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setListeModalAcik(false)}
                  className="flex-1 border border-zinc-300 text-zinc-600 text-sm font-medium py-2.5 rounded-xl hover:bg-zinc-50 transition">
                  İptal
                </button>
                <button onClick={handleListeyeEkle} disabled={listeYukleniyor}
                  className="flex-1 text-white text-sm font-bold py-2.5 rounded-xl transition disabled:opacity-50"
                  style={{ background: "#B71C1C" }}>
                  {listeYukleniyor ? "Ekleniyor..." : "Listeye Ekle"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tarif Ekle/Düzenle Modal ── */}
      {modalAcik && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-800">{duzenleRecete ? "Tarifi Düzenle" : "Yeni Tarif Ekle"}</h2>
              <button onClick={() => setModalAcik(false)} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">Tarif Adı *</label>
                  <input value={form.ad} onChange={e => setForm(p => ({ ...p, ad: e.target.value }))}
                    placeholder="örn: Musakka, Mercimek Çorbası..."
                    className="w-full border border-zinc-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">Kategori</label>
                  <select value={form.kategori} onChange={e => setForm(p => ({ ...p, kategori: e.target.value }))}
                    className="w-full border border-zinc-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                    {KATEGORILER.filter(k => k !== "Tümü").map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">Zorluk</label>
                  <select value={form.zorluk} onChange={e => setForm(p => ({ ...p, zorluk: e.target.value }))}
                    className="w-full border border-zinc-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                    <option value="">Seçiniz</option>
                    {ZORLUKLAR.map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">Hazırlık Süresi (dk)</label>
                  <input type="number" min={0} value={form.sure_dakika}
                    onChange={e => setForm(p => ({ ...p, sure_dakika: e.target.value }))}
                    placeholder="örn: 45"
                    className="w-full border border-zinc-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">Kısa Açıklama</label>
                  <input value={form.aciklama} onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))}
                    placeholder="Tarifiniz hakkında kısa bir not..."
                    className="w-full border border-zinc-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">Hazırlanış Adımları</label>
                  <textarea value={form.hazirlanis} onChange={e => setForm(p => ({ ...p, hazirlanis: e.target.value }))} rows={4}
                    placeholder={"1. Soğanları doğrayın...\n2. Yağda kavurun..."}
                    className="w-full border border-zinc-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
                </div>
              </div>

              {/* Malzemeler */}
              <div>
                <h3 className="font-semibold text-zinc-700 mb-1">Malzemeler <span className="text-xs text-zinc-400 font-normal">— 1 porsiyon için</span></h3>
                <p className="text-xs text-zinc-400 mb-3">Sadece ürün havuzundan seçim yapılabilir.</p>

                {malzemeler.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {malzemeler.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 bg-zinc-50 rounded-xl px-3 py-2 text-sm">
                        <span className="flex-1 font-medium text-zinc-800">{m.urun_adi}</span>
                        <span className="text-zinc-400 text-xs">{m.marka || "—"}</span>
                        <span className="text-zinc-700 font-medium">{m.miktar_kisi} {m.olcu}</span>
                        {m.notlar && <span className="text-zinc-400 text-xs italic">({m.notlar})</span>}
                        <button onClick={() => handleMalzemeSil(i)} className="text-red-400 hover:text-red-600 text-base leading-none ml-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-zinc-50 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    {/* Ürün arama */}
                    <div className="col-span-5 relative">
                      <input value={yeniMalzeme.urun_adi}
                        onChange={e => handleUrunAra(e.target.value)}
                        onFocus={handleUrunOdak}
                        onBlur={() => setTimeout(() => setOneriAcik(false), 200)}
                        placeholder="Ürün ara..."
                        autoComplete="off"
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
                      {oneriAcik && urunOneri.length > 0 && (
                        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-zinc-200 rounded-xl shadow-xl w-80 max-h-52 overflow-y-auto">
                          <div className="px-3 py-1.5 border-b border-zinc-100">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Ürün Havuzu</span>
                          </div>
                          {urunOneri.map((u) => (
                            <button key={u.id} type="button" onMouseDown={() => handleUrunSec(u)}
                              className="w-full text-left px-3 py-2.5 hover:bg-red-50 flex justify-between items-center gap-2 text-sm border-b border-zinc-50 last:border-0 transition-colors">
                              <span className="font-medium text-zinc-800 truncate">{u.urun_adi}</span>
                              <span className="text-xs text-zinc-400 shrink-0 bg-zinc-100 px-2 py-0.5 rounded-full">
                                {u.marka ? u.marka + " · " : ""}{u.olcu}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Olcu (readonly) */}
                    <div className="col-span-2">
                      <input value={yeniMalzeme.olcu} readOnly placeholder="Ölçü"
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-zinc-100 text-zinc-500 cursor-not-allowed" />
                    </div>
                    {/* Miktar */}
                    <div className="col-span-3">
                      <input type="number" min={0} step={0.001} value={yeniMalzeme.miktar_kisi || ""}
                        onChange={e => setYeniMalzeme(p => ({ ...p, miktar_kisi: Number(e.target.value) }))}
                        placeholder="Miktar"
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
                    </div>
                    {/* Ekle butonu */}
                    <div className="col-span-2">
                      <button onClick={handleMalzemeEkle}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 text-lg font-bold transition">+</button>
                    </div>
                  </div>
                  <input value={yeniMalzeme.notlar} onChange={e => setYeniMalzeme(p => ({ ...p, notlar: e.target.value }))}
                    placeholder="Not — örn: 'orta boy', 'taze sıkılmış'"
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalAcik(false)}
                  className="flex-1 border border-zinc-300 text-zinc-600 text-sm font-medium py-2.5 rounded-xl hover:bg-zinc-50 transition">
                  İptal
                </button>
                <button onClick={handleKaydet} disabled={formYukleniyor}
                  className="flex-1 text-white text-sm font-bold py-2.5 rounded-xl transition disabled:opacity-50"
                  style={{ background: "#B71C1C" }}>
                  {formYukleniyor ? "Kaydediliyor..." : duzenleRecete ? "Güncelle" : "Tarif Defterime Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}