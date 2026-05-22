// ─── Merkezi Sabitler ─────────────────────────────────────────────────────────
// Tüm sayfalarda tekrar eden DURUM_STIL, RENK_MAP, HAFTALAR, selamlama vb.
// buradan import edilir. Tek yerden güncellenir.

// ─── Sipariş durumu: inline style (panel/dashboard kartları) ──────────────────
export const DURUM_PANEL: Record<string, { bg: string; text: string; label: string }> = {
  bekliyor:      { bg: "#FEF3C7", text: "#92400E", label: "Bekliyor" },
  onaylandi:     { bg: "#D1FAE5", text: "#065F46", label: "Onaylandı" },
  teslim_alindi: { bg: "#DBEAFE", text: "#1E40AF", label: "Teslim Alındı" },
  reddedildi:    { bg: "#FEE2E2", text: "#991B1B", label: "Reddedildi" },
  tatil:         { bg: "#FEE2E2", text: "#991B1B", label: "Tatil" },
};

// ─── Sipariş durumu: Tailwind class string (tablo satırları) ──────────────────
export const DURUM_CLASS: Record<string, string> = {
  bekliyor:      "bg-amber-100 text-amber-700 border-amber-200",
  onaylandi:     "bg-blue-100 text-blue-700 border-blue-200",
  teslim_alindi: "bg-emerald-100 text-emerald-700 border-emerald-200",
  reddedildi:    "bg-red-100 text-red-700 border-red-200",
};

// ─── Sipariş durumu: label (emoji + metin) ────────────────────────────────────
export const DURUM_LABEL: Record<string, string> = {
  bekliyor:      "⏳ Bekliyor",
  onaylandi:     "✅ Onaylandı",
  teslim_alindi: "📦 Teslim Alındı",
  reddedildi:    "❌ Reddedildi",
};

// ─── Etkinlik takvimi renk haritası ───────────────────────────────────────────
export const RENK_MAP: Record<string, { bg: string; text: string }> = {
  kirmizi: { bg: "#FEE2E2", text: "#991B1B" },
  sari:    { bg: "#FEF3C7", text: "#92400E" },
  mavi:    { bg: "#DBEAFE", text: "#1D4ED8" },
  yesil:   { bg: "#D1FAE5", text: "#065F46" },
  mor:     { bg: "#EDE9FE", text: "#5B21B6" },
  turuncu: { bg: "#FFEDD5", text: "#9A3412" },
};

// ─── 10 hafta dizisi ──────────────────────────────────────────────────────────
export const HAFTALAR = Array.from({ length: 10 }, (_, i) => `${i + 1}. Hafta`);

// ─── Selamlama (Türkçe karakterli) ───────────────────────────────────────────
export function selamlama(): string {
  const saat = new Date().getHours();
  return saat < 12 ? "Günaydın" : saat < 18 ? "İyi günler" : "İyi akşamlar";
}

// ─── Ölçü seçenekleri ─────────────────────────────────────────────────────────
export const OLCU_SEC = ["Kg", "L", "Paket", "Adet", "G", "Ml", "Kutu"];
