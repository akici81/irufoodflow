"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";

type OzetSatir = {
  urunAdi: string; marka: string; olcu: string;
  satinAlinacak: number; birimFiyat: number; kategori: string;
};

type TemizlikGorev = {
  id: string; ders_adi: string; ders_kodu: string; ogretmen_adi: string;
  baslangic_tarihi: string; hafta_sayisi: number; grup_sayisi: number;
  grup_isimleri: string[]; temizlik_alanlari: string[];
};

const hesaplaTemizlik = (gorev: TemizlikGorev, dersIndex: number) => {
  const result: { grup: string; alan: string }[] = [];
  for (let g = 0; g < gorev.grup_sayisi; g++) {
    const alanIndex = (g + dersIndex) % gorev.temizlik_alanlari.length;
    result.push({
      grup: gorev.grup_isimleri[g] || `${g + 1}. Grup`,
      alan: gorev.temizlik_alanlari[alanIndex],
    });
  }
  return result;
};

export default function MarketPage() {
  const { yetkili, yukleniyor } = useAuth("/market");
  const [aktifHafta, setAktifHafta] = useState<string | null>(null);
  const [satirlar, setSatirlar] = useState<OzetSatir[]>([]);
  const [alinanlar, setAlinanlar] = useState<Set<string>>(new Set());
  const [veriYukleniyor, setVeriYukleniyor] = useState(true);
  const [aktifSekme, setAktifSekme] = useState<"alisveris" | "temizlik">("alisveris");
  const [temizlikGorevler, setTemizlikGorevler] = useState<TemizlikGorev[]>([]);
  const [bugunDersIndex, setBugunDersIndex] = useState(0);

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
      .select("id, kategori");

    const kategoriMap: Record<string, string> = {};
    (urunler || []).forEach((u: any) => {
      kategoriMap[u.id] = u.kategori || "Diğer";
    });

    const ozet: Record<string, OzetSatir> = {};
    (siparisler || []).forEach((s: any) => {
      (s.urunler || []).forEach((u: any) => {
        const key = `${u.urunAdi}__${u.marka || ""}__${u.olcu}`;
        const kategori = (u.urunId ? kategoriMap[u.urunId] : null) || "Diğer";
        if (!ozet[key]) {
          ozet[key] = {
            urunAdi: u.urunAdi, marka: u.marka, olcu: u.olcu,
            birimFiyat: u.birimFiyat, satinAlinacak: 0, kategori,
          };
        }
        // Otomatik stok düşme YOK — satın alma sayfasıyla aynı mantık
        ozet[key].satinAlinacak += Number(u.miktar);
      });
    });

    // Mevcut alınanları çek (listeden çıkartılanlar dahil)
    const { data: alinanData } = await supabase
      .from("market_alinanlar")
      .select("urun_key, tip")
      .eq("hafta", hafta);

    const alinanlar_data = (alinanData || []);
    // tip='alinan' olanlar → tik atılmış
    const alinanSet = new Set(alinanlar_data.filter((r: any) => r.tip !== 'cikarildi').map((r: any) => r.urun_key));
    // tip='cikarildi' olanlar → satın almadan çıkartılmış, gösterme
    const cikarildiSet = new Set(alinanlar_data.filter((r: any) => r.tip === 'cikarildi').map((r: any) => r.urun_key));
    setAlinanlar(alinanSet);

    // Listeden çıkartılanları gösterme
    setSatirlar(
      Object.values(ozet)
        .filter(u => u.satinAlinacak > 0 && !cikarildiSet.has(`${u.urunAdi}__${u.marka || ""}`))
        .sort((a, b) => a.kategori.localeCompare(b.kategori, "tr") || a.urunAdi.localeCompare(b.urunAdi, "tr"))
    );
    setVeriYukleniyor(false);

    // Temizlik görevlerini çek (tüm öğretmenler)
    const { data: temizlikData } = await supabase
      .from("temizlik_gorevleri")
      .select("*");
    if (temizlikData) {
      setTemizlikGorevler(temizlikData);
      // Bugün kaçıncı ders?
      if (temizlikData.length > 0) {
        const baslangic = new Date(temizlikData[0].baslangic_tarihi);
        const bugun = new Date();
        const fark = Math.floor((bugun.getTime() - baslangic.getTime()) / (7 * 24 * 60 * 60 * 1000));
        setBugunDersIndex(Math.max(0, fark));
      }
    }

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
          const key = (payload.new as any).urun_key;
          const tip = (payload.new as any).tip || 'alinan';
          if (tip === 'cikarildi') {
            // Satın almadan çıkartıldı — listeden kaldır
            setSatirlar(prev => prev.filter(u => `${u.urunAdi}__${u.marka || ""}` !== key));
          } else {
            // Öğrenci tıkladı — üstü çizili yap
            setAlinanlar(prev => new Set(prev).add(key));
          }
        } else if (payload.eventType === "DELETE") {
          const key = (payload.old as any).urun_key;
          setAlinanlar(prev => { const next = new Set(prev); next.delete(key); return next; });
          // Geri alındıysa listeyi yenile
          fetchGorev();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const handleTik = async (key: string) => {
    if (!aktifHafta) return;
    const alindi = alinanlar.has(key);
    // Önce state'i güncelle (anlık tepki için)
    setAlinanlar(prev => {
      const next = new Set(prev);
      if (alindi) next.delete(key); else next.add(key);
      return next;
    });
    // Supabase'e yaz
    if (alindi) {
      await supabase.from("market_alinanlar")
        .delete()
        .eq("hafta", aktifHafta)
        .eq("urun_key", key);
    } else {
      await supabase.from("market_alinanlar")
        .upsert({ hafta: aktifHafta, urun_key: key, tip: 'alinan' });
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

        {/* Sekmeler */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
          <button onClick={() => setAktifSekme("alisveris")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${aktifSekme === "alisveris" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
            style={aktifSekme === "alisveris" ? { background: "#059669" } : {}}>
            🛒 Alışveriş
          </button>
          <button onClick={() => setAktifSekme("temizlik")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${aktifSekme === "temizlik" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
            style={aktifSekme === "temizlik" ? { background: "#2563EB" } : {}}>
            🧹 Temizlik
          </button>
        </div>

        {/* Temizlik Sekmesi */}
        {aktifSekme === "temizlik" && (
          <div className="space-y-4">
            {temizlikGorevler.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                <p className="text-4xl mb-3">🧹</p>
                <p className="font-semibold text-gray-600">Henüz temizlik görevi oluşturulmadı</p>
                <p className="text-sm mt-1">Öğretmeniniz sisteme ekleyecek</p>
              </div>
            ) : temizlikGorevler.map((gorev) => {
              const dagilim = hesaplaTemizlik(gorev, bugunDersIndex);
              return (
                <div key={gorev.id} className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-blue-100 flex items-center justify-between" style={{ background: "#EFF6FF" }}>
                    <div>
                      <p className="font-bold text-blue-900 text-sm">{gorev.ders_adi}</p>
                      <p className="text-xs text-blue-600">{gorev.ogretmen_adi} • {bugunDersIndex + 1}. Ders</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setBugunDersIndex(Math.max(0, bugunDersIndex - 1))}
                        className="text-xs px-2 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50">←</button>
                      <button onClick={() => setBugunDersIndex(bugunDersIndex + 1)}
                        className="text-xs px-2 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50">→</button>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-1 gap-2">
                    {dagilim.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-bold">{i + 1}</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-blue-700">{item.grup}</p>
                          <p className="text-sm font-semibold text-gray-800">{item.alan}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Alışveriş Sekmesi */}
        {aktifSekme === "alisveris" && <>

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
        </>}
      </div>
    </DashboardLayout>
  );
}
