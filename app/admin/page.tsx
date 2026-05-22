"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { DURUM_PANEL, RENK_MAP, selamlama as selamla } from "@/lib/constants";
import LoadingSkeleton from "../components/LoadingSkeleton";

type Siparis = { id: string; ogretmenAdi: string; dersAdi: string; hafta: string; tarih: string; durum: string; genelToplam: number; };
type Etkinlik = { id: string; hafta: number; gun: string; tarih: string; etkinlik: string; renk: string; };

export default function AdminAnaSayfa() {
  const { yetkili, yukleniyor } = useAuth("/admin");
  const [adSoyad, setAdSoyad] = useState("");
  const [stats, setStats] = useState({ kullanici: 0, urun: 0, ders: 0, bekleyen: 0, onaylanan: 0, toplam: 0 });
  const [sonSiparisler, setSonSiparisler] = useState<Siparis[]>([]);
  const [etkinlikler, setEtkinlikler] = useState<Etkinlik[]>([]);

  const selamlama = selamla();

  useEffect(() => {
    if (!yetkili) return;
    const id = localStorage.getItem("aktifKullaniciId");
    supabase.from("kullanicilar").select("ad_soyad").eq("id", Number(id)).single()
      .then(({ data }) => setAdSoyad(data?.ad_soyad || "Admin"));

    Promise.all([
      supabase.from("kullanicilar").select("id", { count: "exact", head: true }),
      supabase.from("urunler").select("id", { count: "exact", head: true }),
      supabase.from("dersler").select("id", { count: "exact", head: true }),
      supabase.from("siparisler").select("id", { count: "exact", head: true }).eq("durum", "bekliyor"),
      supabase.from("siparisler").select("id", { count: "exact", head: true }).eq("durum", "onaylandi"),
      supabase.from("siparisler").select("id", { count: "exact", head: true }),
    ]).then(([k, u, d, b, o, t]) => {
      setStats({ kullanici: k.count ?? 0, urun: u.count ?? 0, ders: d.count ?? 0, bekleyen: b.count ?? 0, onaylanan: o.count ?? 0, toplam: t.count ?? 0 });
    });

    supabase.from("siparisler").select("*").order("tarih", { ascending: false }).limit(5)
      .then(({ data }) => setSonSiparisler(data || []));

    supabase.from("etkinlik_takvimi").select("*").eq("aktif", true).order("hafta").limit(5)
      .then(({ data }) => setEtkinlikler(data || []));
  }, [yetkili]);

  if (yukleniyor || !yetkili) return <LoadingSkeleton />;

  return (
    <DashboardLayout title="Yönetim Paneli" subtitle="İRÜ FoodFlow Sistem Kontrolü">
      <div className="space-y-6 max-w-6xl">

        {/* Karsilama */}
        <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #7F1212 0%, #B71C1C 100%)" }}>
          <div className="absolute right-6 top-0 bottom-0 flex items-center opacity-10 text-9xl font-black select-none">IRU</div>
          <p className="text-white/60 text-sm">{selamlama}</p>
          <h2 className="text-2xl font-black mt-0.5">{adSoyad}</h2>
          <p className="text-white/50 text-xs mt-2">Sistem Yöneticisi &bull; {new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Kullanıcı",  val: stats.kullanici,  icon: "👤", renk: "#2563EB", bg: "#EFF6FF", link: "/kullanicilar" },
            { label: "Ürün",       val: stats.urun,       icon: "📦", renk: "#EA580C", bg: "#FFF7ED", link: "/urun-havuzu" },
            { label: "Ders",       val: stats.ders,       icon: "📚", renk: "#16A34A", bg: "#F0FDF4", link: "/dersler" },
            { label: "Bekleyen",   val: stats.bekleyen,   icon: "⏳", renk: "#D97706", bg: "#FFFBEB", link: "/siparis-yonetimi" },
            { label: "Onaylanan",  val: stats.onaylanan,  icon: "✅", renk: "#059669", bg: "#ECFDF5", link: "/siparis-yonetimi" },
            { label: "Toplam",     val: stats.toplam,     icon: "🛒", renk: "#7C3AED", bg: "#F5F3FF", link: "/siparis-yonetimi" },
          ].map((k) => (
            <Link href={k.link} key={k.label}>
              <div className="rounded-2xl border border-zinc-100 p-4 text-center hover:shadow-md transition" style={{ background: k.bg }}>
                <div className="text-xl mb-1">{k.icon}</div>
                <p className="text-2xl font-black" style={{ color: k.renk }}>{k.val}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{k.label}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Son Siparişler */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800">Son Siparişler</h3>
              <Link href="/siparis-yonetimi" className="text-xs font-semibold text-red-700 hover:underline">Tümünü Gör</Link>
            </div>
            <div className="divide-y divide-zinc-50">
              {sonSiparisler.length === 0 ? (
                <p className="px-5 py-8 text-center text-zinc-400 text-sm">Henüz sipariş yok</p>
              ) : sonSiparisler.map((s) => {
                const d = DURUM_PANEL[s.durum] || DURUM_PANEL.bekliyor;
                return (
                  <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 truncate">{s.ogretmenAdi}</p>
                      <p className="text-xs text-zinc-400 truncate">{s.dersAdi} &bull; {s.hafta}</p>
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

        {/* Hızlı Erişim */}
        <div>
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Hızlı Erişim</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Kullanıcılar",    icon: "👥", link: "/kullanicilar",    renk: "#2563EB", bg: "#EFF6FF" },
              { label: "Ürün Havuzu",     icon: "📦", link: "/urun-havuzu",     renk: "#EA580C", bg: "#FFF7ED" },
              { label: "Ders Programı",   icon: "📋", link: "/ders-programi",   renk: "#059669", bg: "#ECFDF5" },
              { label: "Etkinlik Takvimi",icon: "📅", link: "/etkinlik-takvimi",renk: "#7C3AED", bg: "#F5F3FF" },
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