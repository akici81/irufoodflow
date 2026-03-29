"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setYukleniyor(true);

    const { data, error: dbError } = await supabase
      .from("kullanicilar")
      .select("*")
      .eq("username", username)
      .eq("password_hash", password)
      .single();

    if (dbError || !data) {
      setError("Kullanıcı adı veya şifre hatalı.");
      setYukleniyor(false);
      return;
    }

    localStorage.setItem("aktifKullaniciId", String(data.id));
    localStorage.setItem("role", data.role);
    localStorage.setItem("username", data.username);

    const rota: Record<string, string> = {
      admin: "/admin",
      ogretmen: "/ogretmen",
      satin_alma: "/satin",
      stok: "/stok",
      bolum_baskani: "/bolum-baskani",
      "bolum-baskani": "/bolum-baskani",
      ogrenci: "/market",
    };
    router.push(rota[data.role] ?? "/");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #B71C1C 0%, #7F1212 100%)" }}
    >
      {/* Arka plan doku */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="w-full max-w-sm relative">
        {/* Kart */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Üst kırmızı şerit */}
          <div className="h-1.5 w-full" style={{ background: "#B71C1C" }} />

          <div className="px-8 pt-8 pb-8">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                style={{ background: "#B71C1C" }}
              >
                <span className="text-white font-black text-base tracking-tight">İRÜ</span>
              </div>
              <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">İRÜFoodFlow</h1>
              <p className="text-sm text-zinc-400 mt-1 font-medium">Alışveriş Yönetim Platformu</p>
            </div>

            {/* Hata */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5 text-center font-medium">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">
                  Kullanıcı Adı
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Kullanıcı adınızı giriniz"
                  className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-zinc-50 transition-all"
                  style={{ "--tw-ring-color": "#B71C1C" } as React.CSSProperties}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">
                  Şifre
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi giriniz"
                  className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-zinc-50 transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={yukleniyor}
                className="w-full text-white font-semibold py-3.5 rounded-xl transition-all text-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: yukleniyor ? "#9CA3AF" : "#B71C1C" }}
              >
                {yukleniyor ? (
                  <>
                    <span
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block"
                      style={{ animation: "spin 0.7s linear infinite" }}
                    />
                    Giriş yapılıyor...
                  </>
                ) : (
                  "Giriş Yap"
                )}
              </button>
            </form>

            {/* Alt bilgi */}
            <p className="text-center text-xs text-zinc-400 mt-7 leading-relaxed">
              Hesap sorunları için Sistem Yöneticisi ile iletişime geçiniz.
              <br />
              <span className="font-medium text-zinc-500">İRÜFoodFlow v2.0</span>
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
