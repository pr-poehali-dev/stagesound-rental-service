import { useState, useEffect } from "react";

const STORAGE_KEY = "catalog_discount_pct";

export function useDiscount() {
  const [discount, setDiscountState] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : 0;
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setDiscountState(Number(e.newValue) || 0);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setDiscount = (pct: number) => {
    localStorage.setItem(STORAGE_KEY, String(pct));
    setDiscountState(pct);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: String(pct) }));
  };

  const applyDiscount = (price: number) => {
    if (!discount) return price;
    return Math.round(price * (1 - discount / 100));
  };

  return { discount, setDiscount, applyDiscount };
}
