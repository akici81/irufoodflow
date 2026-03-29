"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ROL_IZINLERI: Record<string, string[]> = {
  admin: [
    "/admin",
    "/urun-havuzu",
    "/kullanicilar",
    "/dersler",
    "/siparisler",
    "/siparis-yonetimi",
    "/receteler",
    "/ders-programi",
    "/etkinlik-takvimi",
  ],
  ogretmen: [
    "/ogretmen",
    "/alisveris-listelerim",
    "/siparislerim",
    "/talep",
    "/receteler",
    "/etkinlik-takvimi",
    "/ders-programim",
    "/urun-havuzu",
  ],
  satin_alma: [
    "/satin",
    "/urun-havuzu",
  ],
  stok: [
    "/stok",
    "/urun-havuzu",
  ],
  bolum_baskani: [
    "/bolum-baskani",
    "/bolum-baskani/envanter-sayim",
    "/dersler",
    "/ders-programi",
    "/etkinlik-takvimi",
    "/urun-havuzu",
  ],
  "bolum-baskani": [
    "/bolum-baskani",
    "/bolum-baskani/envanter-sayim",
    "/dersler",
    "/ders-programi",
    "/etkinlik-takvimi",
    "/urun-havuzu",
  ],
  ogrenci: [
    "/market",
  ],
};

const ROL_ANA_SAYFA: Record<string, string> = {
  admin: "/admin",
  ogretmen: "/ogretmen",
  satin_alma: "/satin",
  stok: "/stok",
  bolum_baskani: "/bolum-baskani",
  "bolum-baskani": "/bolum-baskani",
  ogrenci: "/market",
};

export function useAuth(gerekenSayfa: string) {
  const router = useRouter();
  const [yetkili, setYetkili] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem("aktifKullaniciId");
    const role = localStorage.getItem("role");

    // Giriş yapılmamış
    if (!id || !role) {
      router.replace("/");
      return;
    }

    const izinliSayfalar = ROL_IZINLERI[role] ?? [];
    const erisimVar = izinliSayfalar.includes(gerekenSayfa);

    if (!erisimVar) {
      // Yetkisi yoksa kendi ana sayfasına at
      const anaSayfa = ROL_ANA_SAYFA[role] ?? "/";
      router.replace(anaSayfa);
      return;
    }

    setYetkili(true);
    setYukleniyor(false);
  }, [gerekenSayfa, router]);

  return { yetkili, yukleniyor };
}
