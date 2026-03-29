"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";

type OzetSatir = {
  urunAdi: string; marka: string; olcu: string;
  satinAlinacak: number; birimFiyat: number; kategori: string;
};

export default function MarketPage() {
  const { yetkili, yukleniyor } = useAuth("/market");
  const [aktifHafta, setAktifHafta] = useState<string | null>(null);
  const [satirlar, setSatirlar] = useState<OzetSatir[]>([]);
  const [alinanlar, setAlinanlar] = useState<Set<string>>(new Set());
  const [veriYukleniyor, setVeriYukleniyor] = useState(true);

  useEffect(() => {
    if (!yetkili) return;
    fetchGorev();
  }, [yetkili]);

  const fetchGorev = async () => {
    setVeriYukleniyor(true);
    // Öğrenci kullanıcısının aktif haftasını çek
    const id = localStorage.getItem("aktifKullaniciId");
    const { data: kullanici } = await supabase
      .from("kullanicilar")
      .select("aktif_hafta")
      .eq("id", Number(id))
      .single();

    const hafta = kullanici?.aktif_hafta || null;
    setAktifHafta(hafta);

    if (!hafta) { setVeriYukleniyor(false); return; }

    // O haftanın siparişlerini çek
    const { data: siparisler } = await supabase
      .from("siparisler")
      .select("*")
      .eq("hafta", hafta);

    const { data: urunler } = await supabase
      .from("urunler")
      .select("id, urun_adi, marka, stok, kategori");

    const stokMap: Record<string, { stok: number; kategori: string }> = {};
    (urunler || []).forEach((u: any) => {
      stokMap[`${u.urun_adi}__${u.marka || ""}`] = { 
        stok: u.stok ?? 0, 
        kategori: u.kategori || "Diğer" 
      };
    });

    const ozet: Record<string, OzetSatir> = {};
    (siparisler || []).forEach((s: any) => {
      (s.urunler || []).forEach((u: any) => {
        const key = `${u.urunAdi}__${u.marka || ""}__${u.olcu}`;
        const stokBilgi = stokMap[`${u.urunAdi}__${u.marka || ""}`];
        const stok = stokBilgi?.stok ?? 0;
        const kategori = stokBilgi?.kategori || u.kategori || "Diğer";
        if (!ozet[key]) {
          ozet[key] = {
            urunAdi: u.urunAdi, marka: u.marka, olcu: u.olcu,
            birimFiyat: u.birimFiyat, satinAlinacak: 0,
            kategori,
          };
        }
        ozet[key].satinAlinacak += Number(u.miktar);
        ozet[key].satinAlinacak = parseFloat(Math.max(0, ozet[key].satinAlinacak - stok).toFixed(3));
      });
    });

    setSatirlar(
      Object.values(ozet)
        .filter(u => u.satinAlinacak > 0)
        .sort((a, b) => a.kategori.localeCompare(b.kategori, "tr") || a.urunAdi.localeCompare(b.urunAdi, "tr"))
    );
    setVeriYukleniyor(false);
  };

  if (yukleniyor || !yetkili) return null;

  const toplamUrun = satirlar.length;
  const alinanSayisi = alinanlar.size;
  const tamamlandi = toplamUrun > 0 && alinanSayisi === toplamUrun;

  // Hafta atanmamış
  if (!veriYukleniyor && !aktifHafta) {
    return (
      <DashboardLayout title="Market Görevi">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="text-6xl mb-4">🛒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Henüz görev atanmadı</h2>
          <p className="text-gray-500 text-sm">Satın alma görevlisi size bir hafta atadığında liste burada görünecek.</p>
        </div>
      </DashboardLayout>
    );
  }

  const gruplar: Record<string, OzetSatir[]> = {};
  satirlar.forEach(u => {
    if (!gruplar[u.kategori]) gruplar[u.kategori] = [];
    gruplar[u.kategori].push(u);
  });

  return (
    <DashboardLayout title={`🛒 ${aktifHafta} Alışveriş`}>
      <div className="max-w-2xl mx-auto space-y-4">

        {/* İlerleme */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              {tamamlandi ? "🎉 Tamamlandı!" : "Alışveriş İlerlemesi"}
            </span>
            <span className="text-sm font-bold text-emerald-600">{alinanSayisi} / {toplamUrun}</span>
          </div>
          <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
              style={{ width: toplamUrun > 0 ? `${(alinanSayisi / toplamUrun) * 100}%` : "0%" }}
            />
          </div>
          {tamamlandi && (
            <p className="text-center text-emerald-600 font-bold text-sm mt-2">Tüm ürünler alındı! 🎉</p>
          )}
        </div>

        {/* Yükleniyor */}
        {veriYukleniyor && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
            Yükleniyor...
          </div>
        )}

        {/* Liste */}
        {!veriYukleniyor && Object.entries(gruplar).map(([kategori, urunler]) => (
          <div key={kategori} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between" style={{ background: "#8B0000" }}>
              <span className="text-xs font-bold text-white uppercase tracking-wider">{kategori}</span>
              <span className="text-xs font-semibold text-white/70">
                {urunler.filter(u => alinanlar.has(`${u.urunAdi}__${u.marka}`)).length}/{urunler.length} alındı
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {urunler.map((u) => {
                const key = `${u.urunAdi}__${u.marka}`;
                const alindi = alinanlar.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => setAlinanlar(prev => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key); else next.add(key);
                      return next;
                    })}
                    className={`w-full flex items-center gap-4 px-4 py-4 text-left transition-colors ${alindi ? "bg-emerald-50" : "hover:bg-gray-50 active:bg-gray-100"}`}
                  >
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${alindi ? "bg-emerald-500 border-emerald-500" : "border-gray-300"}`}>
                      {alindi && <span className="text-white text-sm font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-base leading-tight ${alindi ? "line-through text-gray-400" : "text-gray-800"}`}>
                        {u.urunAdi}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {u.marka && <span className="mr-2">{u.marka}</span>}
                        <span className="font-medium text-emerald-700">{u.satinAlinacak} {u.olcu}</span>
                      </p>
                    </div>
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
        ))}

        {/* Sıfırla */}
        {alinanlar.size > 0 && (
          <button onClick={() => setAlinanlar(new Set())}
            className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-2xl bg-white transition">
            Listeyi Sıfırla
          </button>
        )}
      </div>
    </DashboardLayout>
  );
}
