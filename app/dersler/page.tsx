"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";
import LoadingSkeleton from "../components/LoadingSkeleton";

type Ders = { id: string; kod: string; ad: string; donem: string; aktif: boolean };
type Kullanici = { id: number; username: string; ad_soyad: string; role: string; dersler: string[] };

export default function DerslerPage() {
  const { yetkili, yukleniyor } = useAuth("/dersler");

  const [dersler, setDersler] = useState<Ders[]>([]);
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [yeniKod, setYeniKod] = useState("");
  const [yeniAd, setYeniAd] = useState("");
  const [yeniDonem, setYeniDonem] = useState("guz");
  const [hata, setHata] = useState("");
  const [basari, setBasari] = useState("");
  const [duzenleGrup, setDuzenleGrup] = useState<string | null>(null);
  const [duzenleData, setDuzenleData] = useState<Record<string, { kod: string; ad: string; donem: string }>>({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [{ data: d }, { data: k }] = await Promise.all([
      supabase.from("dersler").select("*").order("kod"),
      supabase.from("kullanicilar").select("id, username, ad_soyad, role, dersler").eq("role", "ogretmen"),
    ]);
    setDersler(d || []);
    setKullanicilar(k || []);
  };

  const mesaj = (tip: "basari" | "hata", m: string) => {
    if (tip === "basari") { setBasari(m); setTimeout(() => setBasari(""), 3000); }
    else { setHata(m); setTimeout(() => setHata(""), 3000); }
  };

  const handleDersEkle = async () => {
    if (!yeniKod.trim() || !yeniAd.trim()) { mesaj("hata", "Kod ve ad bos olamaz."); return; }
    if (dersler.some((d) => d.kod === yeniKod.trim().toUpperCase())) { mesaj("hata", "Bu ders kodu zaten mevcut."); return; }
    const { error } = await supabase.from("dersler").insert({
      kod: yeniKod.trim().toUpperCase(), ad: yeniAd.trim(), donem: yeniDonem,
    });
    if (error) { mesaj("hata", "Hata: " + error.message); return; }
    setYeniKod(""); setYeniAd("");
    mesaj("basari", `"${yeniKod.toUpperCase()} - ${yeniAd}" eklendi.`);
    fetchData();
  };

  const handleTopluAktif = async (donem: string, aktif: boolean) => {
    const hedefler = dersler.filter((d) => (d.donem || "guz") === donem);
    for (const d of hedefler) {
      await supabase.from("dersler").update({ aktif }).eq("id", d.id);
    }
    mesaj("basari", `${donem === "guz" ? "Guz" : "Bahar"} dersleri ${aktif ? "aktif" : "pasif"} yapildi.`);
    fetchData();
  };

  const handleDuzenleAc = (donem: string, grup: Ders[]) => {
    const data: Record<string, { kod: string; ad: string; donem: string }> = {};
    grup.forEach((d) => { data[d.id] = { kod: d.kod, ad: d.ad, donem: d.donem || "guz" }; });
    setDuzenleData(data);
    setDuzenleGrup(donem);
  };

  const handleDuzenleKaydet = async () => {
    for (const [id, val] of Object.entries(duzenleData)) {
      await supabase.from("dersler").update({ kod: val.kod.toUpperCase(), ad: val.ad, donem: val.donem }).eq("id", id);
    }
    setDuzenleGrup(null);
    mesaj("basari", "Dersler guncellendi.");
    fetchData();
  };

  const handleAktifToggle = async (dersId: string, mevcutAktif: boolean) => {
    await supabase.from("dersler").update({ aktif: !mevcutAktif }).eq("id", dersId);
    fetchData();
  };

  const handleDersSil = async (dersId: string) => {
    if (!confirm("Bu dersi silmek istediginizden emin misiniz?")) return;
    const etkilenenler = kullanicilar.filter((k) => (k.dersler || []).includes(dersId));
    for (const k of etkilenenler) {
      await supabase.from("kullanicilar").update({ dersler: k.dersler.filter((d) => d !== dersId) }).eq("id", k.id);
    }
    const { error } = await supabase.from("dersler").delete().eq("id", dersId);
    if (error) { mesaj("hata", "Hata: " + error.message); return; }
    mesaj("basari", "Ders silindi.");
    fetchData();
  };

  const handleDersAta = async (ogretmenId: number, dersId: string, ekle: boolean) => {
    const ogretmen = kullanicilar.find((k) => k.id === ogretmenId);
    if (!ogretmen) return;
    if (ekle) {
      const mevcutSahibi = kullanicilar.find((k) => k.id !== ogretmenId && (k.dersler || []).includes(dersId));
      if (mevcutSahibi) {
        await supabase.from("kullanicilar").update({ dersler: mevcutSahibi.dersler.filter((d) => d !== dersId) }).eq("id", mevcutSahibi.id);
      }
      await supabase.from("kullanicilar").update({ dersler: [...(ogretmen.dersler || []), dersId] }).eq("id", ogretmenId);
    } else {
      await supabase.from("kullanicilar").update({ dersler: (ogretmen.dersler || []).filter((d) => d !== dersId) }).eq("id", ogretmenId);
    }
    fetchData();
  };

  const dersinOgretmenleri = (dersId: string) => kullanicilar.filter((o) => (o.dersler || []).includes(dersId));

  const guzDersler = dersler.filter((d) => (d.donem || "guz") === "guz");
  const baharDersler = dersler.filter((d) => d.donem === "bahar");
  const secmeliDersler = dersler.filter((d) => d.donem === "secmeli");

  const DersGrubu = ({ baslik, donem, grup }: { baslik: string; donem: string; grup: Ders[] }) => {
    const topluKontrol = donem !== "secmeli";
    const duzenleniyor = duzenleGrup === donem;

    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <h2 className="font-semibold text-gray-800">{baslik}</h2>
          <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-medium">{grup.length} ders</span>
          <div className="ml-auto flex items-center gap-2">
            {topluKontrol && (
              <>
                <button type="button" onClick={() => handleTopluAktif(donem, true)}
                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium px-3 py-1.5 rounded-lg transition">
                  Tumunu Aktif
                </button>
                <button type="button" onClick={() => handleTopluAktif(donem, false)}
                  className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-500 border border-gray-200 font-medium px-3 py-1.5 rounded-lg transition">
                  Tumunu Pasif
                </button>
              </>
            )}
            {duzenleniyor ? (
              <>
                <button type="button" onClick={handleDuzenleKaydet}
                  className="text-xs bg-red-700 hover:bg-red-800 text-white font-semibold px-3 py-1.5 rounded-lg transition">
                  Kaydet
                </button>
                <button type="button" onClick={() => setDuzenleGrup(null)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium px-3 py-1.5 rounded-lg transition">
                  Iptal
                </button>
              </>
            ) : (
              <button type="button" onClick={() => handleDuzenleAc(donem, grup)}
                className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-medium px-3 py-1.5 rounded-lg transition">
                Duzenle
              </button>
            )}
          </div>
        </div>

        {grup.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">{baslik} icin ders eklenmemis.</div>
        ) : duzenleniyor ? (
          // Toplu düzenleme modu
          <div className="divide-y divide-gray-50">
            {grup.map((d) => (
              <div key={d.id} className="px-6 py-3 flex gap-3 items-center">
                <input
                  value={duzenleData[d.id]?.kod || ""}
                  onChange={(e) => setDuzenleData((prev) => ({ ...prev, [d.id]: { ...prev[d.id], kod: e.target.value } }))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <input
                  value={duzenleData[d.id]?.ad || ""}
                  onChange={(e) => setDuzenleData((prev) => ({ ...prev, [d.id]: { ...prev[d.id], ad: e.target.value } }))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <div className="flex gap-1">
                  {["guz", "bahar", "secmeli"].map((don) => (
                    <button key={don} type="button"
                      onClick={() => setDuzenleData((prev) => ({ ...prev, [d.id]: { ...prev[d.id], donem: don } }))}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${duzenleData[d.id]?.donem === don ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"}`}>
                      {don === "guz" ? "Guz" : don === "bahar" ? "Bahar" : "Secmeli"}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => handleDersSil(d.id)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium transition">
                  Sil
                </button>
              </div>
            ))}
          </div>
        ) : (
          // Normal görünüm
          <div className="divide-y divide-gray-50">
            {grup.map((d) => {
              const atananlar = dersinOgretmenleri(d.id);
              return (
                <div key={d.id} className={`p-6 ${d.aktif === false ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-lg">{d.kod}</span>
                        <span className="font-semibold text-gray-800">{d.ad}</span>
                        {d.aktif === false && (
                          <span className="text-xs bg-gray-100 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">Pasif</span>
                        )}
                        {atananlar.length > 0 && (
                          <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full">
                            {atananlar[0].ad_soyad || atananlar[0].username}
                          </span>
                        )}
                      </div>
                      {d.aktif === false ? (
                        <p className="text-xs text-gray-400 italic">Bu ders bu donem acik degil — atama yapilamaz.</p>
                      ) : kullanicilar.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {kullanicilar.map((o) => {
                            const atanmis = (o.dersler || []).includes(d.id);
                            const baskasindaAtanmis = !atanmis && atananlar.length > 0;
                            return (
                              <button type="button" key={o.id}
                                onClick={() => handleDersAta(o.id, d.id, !atanmis)}
                                title={baskasindaAtanmis ? `Bu ders su an ${atananlar[0].ad_soyad || atananlar[0].username} uzerinde.` : ""}
                                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                                  atanmis ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                                  : baskasindaAtanmis ? "bg-gray-50 text-gray-300 border-gray-100 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200"
                                  : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                                }`}>
                                {atanmis ? "- " : "+ "}{o.ad_soyad || o.username}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Ogretmen atamak icin once ogretmen ekleyin.</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button type="button" onClick={() => handleAktifToggle(d.id, d.aktif !== false)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${d.aktif !== false ? "bg-emerald-500" : "bg-gray-300"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${d.aktif !== false ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (yukleniyor || !yetkili) return <LoadingSkeleton />;

  return (
    <DashboardLayout title="Ders Yonetimi" subtitle="Dersleri ekleyin ve ogretmenlere atayin">
      <div className="max-w-5xl space-y-6">

        {basari && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">{basari}</div>}
        {hata && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{hata}</div>}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Yeni Ders Ekle</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Ders Kodu *</label>
              <input value={yeniKod} onChange={(e) => setYeniKod(e.target.value)}
                placeholder="ASC112" className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
              <label className="text-xs font-medium text-gray-700">Ders Adi *</label>
              <input value={yeniAd} onChange={(e) => setYeniAd(e.target.value)}
                placeholder="Yoresel Mutfaklar" className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Donem *</label>
              <div className="flex gap-2">
                {["guz", "bahar", "secmeli"].map((d) => (
                  <button key={d} type="button" onClick={() => setYeniDonem(d)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition ${yeniDonem === d ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
                    {d === "guz" ? "Guz" : d === "bahar" ? "Bahar" : "Secmeli"}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={handleDersEkle}
              className="bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition">
              Ders Ekle
            </button>
          </div>
        </div>

        <DersGrubu baslik="Guz Donemi" donem="guz" grup={guzDersler} />
        <DersGrubu baslik="Bahar Donemi" donem="bahar" grup={baharDersler} />
        <DersGrubu baslik="Secmeli Havuzu" donem="secmeli" grup={secmeliDersler} />

      </div>
    </DashboardLayout>
  );
}