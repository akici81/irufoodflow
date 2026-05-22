"use client";

import { useEffect, useState } from "react";

/**
 * Girdi değerini belirtilen süre kadar geciktirir.
 * Arama kutularında gereksiz sorgu tetiklenmesini önler.
 */
export function useDebounce<T>(deger: T, gecikmeMs = 300): T {
  const [geciken, setGeciken] = useState<T>(deger);

  useEffect(() => {
    const zamanlayici = setTimeout(() => setGeciken(deger), gecikmeMs);
    return () => clearTimeout(zamanlayici);
  }, [deger, gecikmeMs]);

  return geciken;
}
