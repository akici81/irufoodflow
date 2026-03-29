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
    const id = localStorage.getItem("aktifKullaniciId");
    const { data: kullanici } = await supabase
      .from("kullanicilar")
      .select("aktif_hafta")
      .eq("id", Number(id))
      .single();

    const hafta = kullanici?.aktif_hafta || null;
    setAktifHafta(hafta);

    if (!hafta) { setVeriYukleniyor(false); return; }

    // Siparişleri çek
    const { data: siparisler } = await supabase
      .from("siparisler")
      .select("*")
      .eq("hafta", hafta);

    const { data: urunler } = await supabase
      .from("urunler")
      .select("id, urun_adi, marka, stok, kategori");

    const stokMap: Record<string, { stok: number; kategori: string }> = {};
    (urunler || []).forEach((u: any) => {
      // ID ile eşleştir — en güvenilir yöntem
      stokMap[u.id] = {
        stok: u.stok ?? 0,
        kategori: u.kategori || "Diğer"
      };
    });

    const ozet: Record<string, OzetSatir> = {};
    (siparisler || []).forEach((s: any) => {
      (s.urunler || []).forEach((u: any) => {
        const key = `${u.urunAdi}__${u.marka || ""}__${u.olcu}`;
        const stokBilgi = u.urunId ? stokMap[u.urunId] : null;
        const stok = stokBilgi?.stok ?? 0;
        const kategori = stokBilgi?.kategori || "Diğer";
        if (!ozet[key]) {
          ozet[key] = {
            urunAdi: u.urunAdi, marka: u.marka, olcu: u.olcu,
            birimFiyat: u.birimFiyat, satinAlinacak: 0, kategori,
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

    // Mevcut alınanları çek
    const { data: alinanData } = await supabase
      .from("market_alinanlar")
      .select("urun_key")
      .eq("hafta", hafta);

    setAlinanlar(new Set((alinanData || []).map((r: any) => r.urun_key)));
    setVeriYukleniyor(false);

    // Realtime subscription
    const channel = supabase
      .channel(`market_${hafta}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "market_alinanlar",
        filter: `hafta=eq.${hafta}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          setAlinanlar(prev => new Set(prev).add((payload.new as any).urun_key));
        } else if (payload.eventType === "DELETE") {
          setAlinanlar(prev => {
            const next = new Set(prev);
            next.delete((payload.old as any).urun_key);
            return next;
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const handleTik = async (key: string) => {
    if (!aktifHafta) return;
    const alindi = alinanlar.has(key);
    if (alindi) {
      await supabase.from("market_alinanlar")
        .delete()
        .eq("hafta", aktifHafta)
        .eq("urun_key", key);
    } else {
      await supabase.from("market_alinanlar")
        .upsert({ hafta: aktifHafta, urun_key: key });
    }
  };

  if (yukleniyor || !yetkili) return null;

  const toplamUrun = satirlar.length;
  const alinanSayisi = alinanlar.size;
  const tamamlandi = toplamUrun > 0 && alinanSayisi === toplamUrun;

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
            <div className="border-b border-gray-100" style={{ background: "#8B0000" }}>
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">{kategori}</span>
                <span className="text-xs font-semibold text-white/70">
                  {urunler.filter(u => alinanlar.has(`${u.urunAdi}__${u.marka}`)).length}/{urunler.length} alındı
                </span>
              </div>
              <div className="flex items-center px-4 py-1 border-t border-white/10">
                <div className="flex-1" />
                <div className="w-20 text-center">
                  <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Alınacak</span>
                </div>
                <div className="w-24 text-right">
                  <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Tutar</span>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {urunler.map((u) => {
                const key = `${u.urunAdi}__${u.marka}`;
                const alindi = alinanlar.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => handleTik(key)}
                    className={`w-full flex items-center gap-4 px-4 py-4 text-left transition-colors ${alindi ? "bg-emerald-50" : "hover:bg-gray-50 active:bg-gray-100"}`}
                  >
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${alindi ? "bg-emerald-500 border-emerald-500" : "border-gray-300"}`}>
                      {alindi && <span className="text-white text-sm font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm leading-tight ${alindi ? "line-through text-gray-400" : "text-gray-800"}`}>
                        {u.urunAdi}
                      </p>
                      {u.marka && (
                        <p className="text-xs text-gray-400 mt-0.5">{u.marka}</p>
                      )}
                    </div>
                    <div className="w-20 text-center shrink-0">
                      <p className={`text-sm font-bold ${alindi ? "text-gray-300" : "text-red-700"}`}>
                        {u.satinAlinacak} {u.olcu}
                      </p>
                    </div>
                    <div className="w-24 text-right shrink-0">
                      {u.birimFiyat > 0 ? (
                        <>
                          <p className={`text-sm font-bold ${alindi ? "text-gray-300" : "text-gray-700"}`}>
                            {(u.birimFiyat * u.satinAlinacak).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                          </p>
                          <p className="text-xs text-gray-400">{u.birimFiyat.toLocaleString("tr-TR")} TL/{u.olcu}</p>
                        </>
                      ) : <span />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Sıfırla */}
        {alinanlar.size > 0 && (
          <button onClick={async () => {
            if (!aktifHafta) return;
            await supabase.from("market_alinanlar").delete().eq("hafta", aktifHafta);
          }}
            className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-2xl bg-white transition">
            Listeyi Sıfırla
          </button>
        )}
      </div>
    </DashboardLayout>
  );
}
