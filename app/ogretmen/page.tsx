"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { DURUM_PANEL, RENK_MAP, selamlama as selamla } from "@/lib/constants";
import LoadingSkeleton from "../components/LoadingSkeleton";

type Siparis = { id: string; dersAdi: string; hafta: string; tarih: string; durum: string; genelToplam: number; };
type Ders = { id: string; kod: string; ad: string; };
type Etkinlik = { id: string; hafta: number; gun: string; tarih: string; etkinlik: string; renk: string; };

export default function OgretmenAnaSayfa() {
  const { yetkili, yukleniyor } = useAuth("/ogretmen");
  const [adSoyad, setAdSoyad] = useState("");
  const [dersler, setDersler] = useState<Ders[]>([]);
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [etkinlikler, setEtkinlikler] = useState<Etkinlik[]>([]);
  const [stats, setStats] = useState({ bekleyen: 0, onaylanan: 0, teslim: 0 });

  const selamlama = selamla();

  useEffect(() => {
    if (!yetkili) return;
    const id = localStorage.getItem("aktifKullaniciId");
    if (!id) return;

    supabase.from("kullanicilar").select("ad_soyad, dersler").eq("id", Number(id)).single()
      .then(async ({ data }) => {
        if (!data) return;
        setAdSoyad(data.ad_soyad || "Ogretmen");
        if ((data.dersler || []).length > 0) {
          const { data: dersData } = await supabase.from("dersler").select("*").in("id", data.dersler);
          setDersler(dersData || []);
        }
      });

    supabase.from("siparisler").select("*").eq("ogretmen_id", Number(id)).order("tarih", { ascending: false }).limit(5)
      .then(({ data }) => {
        const list = data || [];
        setSiparisler(list.map((s: any) => ({
          id: s.id, dersAdi: s.ders_adi, hafta: s.hafta,
          tarih: s.tarih, durum: s.durum, genelToplam: s.genel_toplam,
        })));
        setStats({
          bekleyen: list.filter((s: any) => s.durum === "bekliyor").length,
          onaylanan: list.filter((s: any) => s.durum === "onaylandi").length,
          teslim: list.filter((s: any) => s.durum === "teslim_alindi").length,
        });
      });

    supabase.from("etkinlik_takvimi").select("*").eq("aktif", true).order("hafta").limit(5)
      .then(({ data }) => setEtkinlikler(data || []));
  }, [yetkili]);

  if (yukleniyor || !yetkili) return <LoadingSkeleton />;

  return (
    <DashboardLayout title="Ogretmen Paneli" subtitle="Hosgeldiniz">
      <div className="space-y-6 max-w-5xl">

        {/* Karsilama */}
        <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #7F1212 0%, #B71C1C 100%)" }}>
          <div className="absolute right-6 top-0 bottom-0 flex items-center opacity-10 text-9xl font-black select-none">IRU</div>
          <p className="text-white/60 text-sm">{selamlama},</p>
          <h2 className="text-2xl font-black mt-0.5">{adSoyad}</h2>
          <p className="text-white/50 text-xs mt-2">
            {new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Siparis ozeti */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Bekleyen",      val: stats.bekleyen,  renk: "#D97706", bg: "#FFFBEB", icon: "⏳" },
            { label: "Onaylanan",     val: stats.onaylanan, renk: "#059669", bg: "#ECFDF5", icon: "✅" },
            { label: "Teslim Alindi", val: stats.teslim,    renk: "#2563EB", bg: "#EFF6FF", icon: "📦" },
          ].map((k) => (
            <Link href="/alisveris-listelerim" key={k.label}>
              <div className="rounded-2xl border border-zinc-100 p-4 text-center hover:shadow-md transition" style={{ background: k.bg }}>
                <div className="text-xl mb-1">{k.icon}</div>
                <p className="text-2xl font-black" style={{ color: k.renk }}>{k.val}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{k.label}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Atanan Dersler */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800">Derslerim</h3>
              <Link href="/receteler" className="text-xs font-semibold text-red-700 hover:underline">Tarif Defteri</Link>
            </div>
            <div className="divide-y divide-zinc-50">
              {dersler.length === 0 ? (
                <p className="px-5 py-8 text-center text-zinc-400 text-sm">Henuz ders atanmamis</p>
              ) : dersler.map((d) => (
                <div key={d.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{ background: "#B71C1C" }}>
                    {d.kod?.slice(0, 3) || "DR"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{d.ad}</p>
                    <p className="text-xs text-zinc-400">{d.kod}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Etkinlikler */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800">Etkinlik Takvimi</h3>
              <Link href="/etkinlik-takvimi" className="text-xs font-semibold text-red-700 hover:underline">Takvime Git</Link>
            </div>
            <div className="divide-y divide-zinc-50">
              {etkinlikler.length === 0 ? (
                <p className="px-5 py-8 text-center text-zinc-400 text-sm">Etkinlik bulunmuyor</p>
              ) : etkinlikler.map((e) => {
                const r = RENK_MAP[e.renk] || RENK_MAP.mavi;
                return (
                  <div key={e.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 text-xs font-bold" style={{ background: r.bg, color: r.text }}>
                      <span>{e.hafta}.</span>
                      <span>Hft</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 truncate">{e.etkinlik}</p>
                      <p className="text-xs text-zinc-400">{e.gun} &bull; {e.tarih}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Son siparisler */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-bold text-zinc-800">Son Alisveris Listelerim</h3>
            <Link href="/alisveris-listelerim" className="text-xs font-semibold text-red-700 hover:underline">Tumunu Gor</Link>
          </div>
          <div className="divide-y divide-zinc-50">
            {siparisler.length === 0 ? (
              <p className="px-5 py-8 text-center text-zinc-400 text-sm">Henuz liste olusturulmamis</p>
            ) : siparisler.map((s) => {
              const d = DURUM_PANEL[s.durum] || DURUM_PANEL.bekliyor;
              return (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 truncate">{s.dersAdi}</p>
                    <p className="text-xs text-zinc-400">{s.hafta} &bull; {s.tarih}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-zinc-600">{Number(s.genelToplam || 0).toFixed(2)} TL</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: d.bg, color: d.text }}>{d.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hizli Erisim */}
        <div>
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Hizli Erisim</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Tarif Defteri",    icon: "📖", link: "/receteler",            renk: "#EA580C", bg: "#FFF7ED" },
              { label: "Alisveris Listesi", icon: "🛒", link: "/alisveris-listelerim", renk: "#059669", bg: "#ECFDF5" },
              { label: "Urun Havuzu",       icon: "📦", link: "/urun-havuzu",          renk: "#0284C7", bg: "#F0F9FF" },
              { label: "Ders Programi",    icon: "📋", link: "/ders-programi",         renk: "#2563EB", bg: "#EFF6FF" },
              { label: "Etkinlik Takvimi", icon: "📅", link: "/etkinlik-takvimi",      renk: "#7C3AED", bg: "#F5F3FF" },
            ].map((h) => (
              <Link key={h.link} href={h.link}>
                <div className="rounded-2xl border border-zinc-100 p-4 text-center hover:shadow-md transition" style={{ background: h.bg }}>
                  <div className="text-2xl mb-2">{h.icon}</div>
                  <p className="text-sm font-bold" style={{ color: h.renk }}>{h.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
