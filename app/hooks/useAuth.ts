"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Bölüm başkanı rol adı DB'de iki biçimde gelebilir ("bolum_baskani" veya "bolum-baskani").
// Tek bir sabit tanımlanıp her ikisi de aynı diziye referans verir; böylece tutarsızlık ortadan kalkar.
const BOLUM_BASKANI_SAYFALAR = [
  "/bolum-baskani",
  "/bolum-baskani/envanter-sayim",
  "/dersler",
  "/ders-programi",
  "/etkinlik-takvimi",
  "/urun-havuzu",
];

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
  bolum_baskani:  BOLUM_BASKANI_SAYFALAR,
  "bolum-baskani": BOLUM_BASKANI_SAYFALAR,
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
