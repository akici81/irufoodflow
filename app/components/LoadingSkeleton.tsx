"use client";

/** Sayfa yüklenirken gösterilen iskelet (skeleton) bileşeni. */
export default function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 animate-pulse">
      {/* Üst başlık */}
      <div className="h-8 w-48 bg-gray-200 rounded mb-6" />

      {/* İstatistik kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
            <div className="h-8 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Tablo iskeleti */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3 border-b border-gray-100">
            <div className="h-4 w-1/4 bg-gray-200 rounded" />
            <div className="h-4 w-1/4 bg-gray-200 rounded" />
            <div className="h-4 w-1/6 bg-gray-200 rounded" />
            <div className="h-4 w-1/6 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
