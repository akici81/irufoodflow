"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";
import LoadingSkeleton from "../components/LoadingSkeleton";

type Urun = { id: string; urunAdi: string; marka: string; fiyat: number; olcu: string; kategori: string };
type Ders = { id: string; kod: string; ad: string };

const olcuBilgisi = (olcu: string) => {
  const tip = olcu.toLowerCase();
  if (tip === "kg" || tip === "l")  return { serbest: true,  baslangic: 0,  adim: 0  };
  if (tip === "g"  || tip === "ml") return { serbest: false, baslangic: 50, adim: 50 };
  return                                   { serbest: false, baslangic: 1,  adim: 1  };
};

export default function TalepPage() {
  const { yetkili, yukleniyor } = useAuth("/talep");

  const [kullaniciId, setKullaniciId] = useState<number | null>(null);
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [dersler, setDersler] = useState<Ders[]>([]);
  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [secilenDers, setSecilenDers] = useState("");
  const [etkinlikAdi, setEtkinlikAdi] = useState("");
  const [aramaMetni, setAramaMetni] = useState("");
  const [basari, setBasari] = useState(false);
  const [hata, setHata] = useState("");
  const [seciliUrunler, setSeciliUrunler] = useState<Record<string, number>>({});
  const [kgInputler, setKgInputler] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      const id = localStorage.getItem("aktifKullaniciId");
      const role = localStorage.getItem("role");
      if (!id) return;
      setKullaniciId(Number(id));
      const { data: k } = await supabase.from("kullanicilar").select("ad_soyad, username, dersler").eq("id", id).single();
      if (!k) return;
      setKullaniciAdi(k.ad_soyad || k.username);
      const { data: tumDersler } = await supabase.from("dersler").select("*").order("kod");
      if (role === "ogretmen" && (k.dersler || []).length > 0) {
        setDersler((tumDersler || []).filter((d: Ders) => k.dersler.includes(d.id)));
      } else {
        setDersler(tumDersler || []);
      }
      const { data: urunData } = await supabase.from("urunler").select("*").order("urun_adi");
      setUrunler((urunData || []).map((u: any) => ({
        id: u.id, urunAdi: u.urun_adi, marka: u.marka, fiyat: u.fiyat, olcu: u.olcu, kategori: u.kategori,
      })));
    };
    fetchData();
  }, []);

  const filtreliUrunler = urunler.filter((u) =>
    !aramaMetni ||
    (u.urunAdi || "").toLowerCase().includes(aramaMetni.toLowerCase()) ||
    (u.marka || "").toLowerCase().includes(aramaMetni.toLowerCase())
  );

  const handleCheckbox = (urun: Urun, isaretli: boolean) => {
    if (isaretli) {
      const { baslangic } = olcuBilgisi(urun.olcu);
      setSeciliUrunler((prev) => ({ ...prev, [urun.id]: baslangic }));
      if (olcuBilgisi(urun.olcu).serbest) setKgInputler((prev) => ({ ...prev, [urun.id]: "" }));
    } else {
      setSeciliUrunler((prev) => { const y = { ...prev }; delete y[urun.id]; return y; });
      setKgInputler((prev) => { const y = { ...prev }; delete y[urun.id]; return y; });
    }
  };

  const handleKgInput = (urunId: string, metin: string) => {
    setKgInputler((prev) => ({ ...prev, [urunId]: metin }));
    const num = parseFloat(metin.replace(",", "."));
    setSeciliUrunler((prev) => ({ ...prev, [urunId]: (!isNaN(num) && num > 0) ? Math.round(num * 1000) / 1000 : 0 }));
  };

  const handleArttir = (urun: Urun) => {
    const { adim, baslangic } = olcuBilgisi(urun.olcu);
    const mevcut = seciliUrunler[urun.id] || baslangic;
    setSeciliUrunler((prev) => ({ ...prev, [urun.id]: Math.round((mevcut + adim) * 1000) / 1000 }));
  };

  const handleAzalt = (urun: Urun) => {
    const { adim, baslangic } = olcuBilgisi(urun.olcu);
    const mevcut = seciliUrunler[urun.id] || baslangic;
    const yeni = Math.round((mevcut - adim) * 1000) / 1000;
    if (yeni <= 0) setSeciliUrunler((prev) => { const y = { ...prev }; delete y[urun.id]; return y; });
    else setSeciliUrunler((prev) => ({ ...prev, [urun.id]: yeni }));
  };

  const handleDirektMiktar = (urun: Urun, miktar: number) => {
    if (miktar <= 0) setSeciliUrunler((prev) => { const y = { ...prev }; delete y[urun.id]; return y; });
    else setSeciliUrunler((prev) => ({ ...prev, [urun.id]: Math.round(miktar * 1000) / 1000 }));
  };

  const handleGonder = async () => {
    setHata("");
    if (!secilenDers) { setHata("Lütfen bir ders seçin."); return; }
    if (!etkinlikAdi.trim()) { setHata("Lütfen etkinlik adını girin."); return; }
    if (Object.keys(seciliUrunler).length === 0) { setHata("En az bir ürün seçin."); return; }

    const eksik = Object.entries(seciliUrunler).find(([id, m]) => {
      const u = urunler.find((x) => x.id === id);
      return u && olcuBilgisi(u.olcu).serbest && (!m || m === 0);
    });
    if (eksik) {
      const ad = urunler.find((x) => x.id === eksik[0])?.urunAdi || "Ürün";
      setHata(`"${ad}" için miktar giriniz.`); return;
    }

    if (!kullaniciId) return;
    const ders = dersler.find((d) => d.id === secilenDers);
    const urunListesi = Object.entries(seciliUrunler).map(([urunId, miktar]) => {
      const u = urunler.find((x) => x.id === urunId)!;
      return { urunId, urunAdi: u.urunAdi, marka: u.marka, miktar, olcu: u.olcu, birimFiyat: u.fiyat, toplam: u.fiyat * miktar };
    });
    const genelToplam = urunListesi.reduce((acc, u) => acc + u.toplam, 0);

    const { error } = await supabase.from("siparisler").insert({
      ogretmen_id: kullaniciId,
      ogretmen_adi: kullaniciAdi,
      ders_id: secilenDers,
      ders_adi: ders ? `${ders.kod} - ${ders.ad}` : "",
      hafta: etkinlikAdi.trim(),
      urunler: urunListesi,
      genel_toplam: genelToplam,
      tarih: new Date().toLocaleDateString("tr-TR"),
      durum: "bekliyor",
      tip: "etkinlik",
    });

    if (error) { setHata("Hata: " + error.message); return; }
    setSeciliUrunler({});
    setKgInputler({});
    setEtkinlikAdi("");
    setSecilenDers("");
    setBasari(true);
    setTimeout(() => setBasari(false), 4000);
  };

  const secilenUrunListesi = Object.entries(seciliUrunler).map(([urunId, miktar]) => {
    const u = urunler.find((x) => x.id === urunId)!;
    return { ...u, miktar };
  });

  if (yukleniyor || !yetkili) return <LoadingSkeleton />;

  return (
    <DashboardLayout title="Etkinlik Talebi Oluştur" subtitle="Etkinlik için malzeme talebinizi oluşturun">
      <div className="max-w-6xl space-y-5">
        {basari && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 font-medium">
            ✅ Etkinlik talebiniz başarıyla gönderildi!
          </div>
        )}
        {hata && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 font-medium">
            {hata}
          </div>
        )}

        {/* Üst bilgiler */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hoca adı - otomatik */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">Hoca Adı</label>
              <div className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-600 font-medium">
                {kullaniciAdi || "—"}
              </div>
            </div>

            {/* Ders seçimi */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">Ders *</label>
              <select
                value={secilenDers}
                onChange={(e) => setSecilenDers(e.target.value)}
                className={`w-full border rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 ${!secilenDers ? "border-red-300" : "border-gray-200"}`}
              >
                <option value="">DERS SEÇİNİZ...</option>
                {dersler.map((d) => <option key={d.id} value={d.id}>{d.kod} - {d.ad}</option>)}
              </select>
            </div>

            {/* Etkinlik adı */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">Etkinlik Adı *</label>
              <input
                type="text"
                value={etkinlikAdi}
                onChange={(e) => setEtkinlikAdi(e.target.value)}
                placeholder="örn: Bahar Şenliği, Mezuniyet Yemeği..."
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${!etkinlikAdi.trim() ? "border-red-300" : "border-gray-200"}`}
              />
            </div>
          </div>
        </div>

        {/* Ürün havuzu + özet */}
        <div className="flex gap-5">
          <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">Ürün Havuzu</h2>
              <input
                value={aramaMetni}
                onChange={(e) => setAramaMetni(e.target.value)}
                placeholder="Ürün ara..."
                className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 w-48"
              />
            </div>

            <div className="mx-4 mt-4 mb-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 mb-2">Miktar Giriş Rehberi</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-white border border-blue-200 px-1.5 py-0.5 rounded text-blue-800">Kg / L</span>
                  <span className="text-gray-500">Elle yazın: <b>0,100</b> · <b>1,500</b></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-white border border-blue-200 px-1.5 py-0.5 rounded text-blue-800">G / Ml</span>
                  <span className="text-gray-500">+ / − ile 50'şer artır/azalt</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-white border border-blue-200 px-1.5 py-0.5 rounded text-blue-800">Adet / Paket / Kutu</span>
                  <span className="text-gray-500">+ / − ile 1'er artır/azalt</span>
                </div>
              </div>
            </div>

            {urunler.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-sm">Ürün havuzu boş.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      <th className="px-4 py-3 w-10"></th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ÜRÜN</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">MARKA</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">FİYAT</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">MİKTAR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtreliUrunler.map((u) => {
                      const secili = u.id in seciliUrunler;
                      const miktar = seciliUrunler[u.id] ?? 0;
                      const bilgi = olcuBilgisi(u.olcu);
                      return (
                        <tr key={u.id} className={`transition-colors ${secili ? "bg-red-50" : "hover:bg-gray-50"}`}>
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={secili}
                              onChange={(e) => handleCheckbox(u, e.target.checked)}
                              className="w-4 h-4 accent-red-600 cursor-pointer" />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{u.urunAdi}</p>
                            {u.kategori && <p className="text-xs text-gray-400">{u.kategori}</p>}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{u.marka || "—"}</td>
                          <td className="px-4 py-3 text-gray-700 font-medium">
                            {u.fiyat > 0 ? `₺${u.fiyat.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} / ${u.olcu}` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {secili ? (
                              bilgi.serbest ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text" inputMode="decimal"
                                    value={kgInputler[u.id] !== undefined ? kgInputler[u.id] : (miktar > 0 ? String(miktar).replace(".", ",") : "")}
                                    placeholder="örn: 1,500"
                                    onChange={(e) => handleKgInput(u.id, e.target.value)}
                                    className={`w-24 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500 ${miktar > 0 ? "border-gray-300" : "border-red-300 bg-red-50 placeholder-red-300"}`}
                                  />
                                  <span className="text-xs font-medium text-gray-500">{u.olcu}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => handleAzalt(u)}
                                    className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-bold text-sm transition">-</button>
                                  <input
                                    type="number" value={miktar || ""} step={bilgi.adim} min={bilgi.baslangic}
                                    onChange={(e) => handleDirektMiktar(u, Number(e.target.value))}
                                    className="w-14 border border-gray-200 rounded-lg px-1 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                                  />
                                  <span className="text-xs text-gray-400">{u.olcu}</span>
                                  <button type="button" onClick={() => handleArttir(u)}
                                    className="w-7 h-7 flex items-center justify-center bg-red-100 hover:bg-red-200 rounded-lg text-red-700 font-bold text-sm transition">+</button>
                                </div>
                              )
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Özet paneli */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sticky top-4 space-y-4">
              <h3 className="font-semibold text-gray-800 text-sm">Talep Özeti</h3>

              {(kullaniciAdi || secilenDers || etkinlikAdi) && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 space-y-1">
                  {kullaniciAdi && <p className="text-xs text-gray-600"><span className="font-medium">Hoca:</span> {kullaniciAdi}</p>}
                  {secilenDers && <p className="text-xs text-gray-600"><span className="font-medium">Ders:</span> {dersler.find(d => d.id === secilenDers)?.kod} - {dersler.find(d => d.id === secilenDers)?.ad}</p>}
                  {etkinlikAdi && <p className="text-xs text-gray-600"><span className="font-medium">Etkinlik:</span> {etkinlikAdi}</p>}
                </div>
              )}

              {secilenUrunListesi.length === 0 ? (
                <p className="text-gray-400 text-xs text-center py-4">Henüz ürün seçilmedi.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {secilenUrunListesi.map((u) => (
                    <div key={u.id} className="flex justify-between items-start text-xs py-1.5 border-b border-gray-50">
                      <div>
                        <p className="font-medium text-gray-800">{u.urunAdi}</p>
                        {u.miktar > 0
                          ? <p className="text-gray-400">{String(u.miktar).replace(".", ",")} {u.olcu}</p>
                          : <p className="text-red-400 font-medium">Miktar giriniz</p>}
                      </div>
                      <span className="text-gray-600 font-medium ml-2">
                        {u.miktar > 0 && u.fiyat > 0 ? `₺${(u.fiyat * u.miktar).toFixed(2)}` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" onClick={handleGonder}
                className="w-full bg-red-700 hover:bg-red-800 text-white text-sm font-semibold py-3 rounded-xl transition">
                Talebi Gönder
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
