import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export interface CityData {
  id: string;
  name: string;
  phone: string;
  phoneDisplay: string;
  email: string;
  address: string;
  workdays: string;
  weekend: string;
  telegram?: string;
  whatsapp?: string;
  vk?: string;
}

// Единственный город — Санкт-Петербург
// Данные загружаются из настроек (settings) через API
export const DEFAULT_CITY: CityData = {
  id: "spb",
  name: "Санкт-Петербург",
  phone: "+78121234567",
  phoneDisplay: "+7 (812) 123-45-67",
  email: "info@stagesound.ru",
  address: "Санкт-Петербург, Невский пр., 88",
  workdays: "Пн–Пт: 9:00 — 20:00",
  weekend: "Сб–Вс: 10:00 — 17:00",
  telegram: "https://t.me/stagesound",
  whatsapp: "",
  vk: "",
};

// Оставляем CITIES для совместимости с кодом, который его использует
export const CITIES: CityData[] = [DEFAULT_CITY];

interface CityContextType {
  city: CityData;
  setCity: (city: CityData) => void;
}

const CityContext = createContext<CityContextType>({
  city: DEFAULT_CITY,
  setCity: () => {},
});

export function CityProvider({ children }: { children: ReactNode }) {
  const [city, setCityState] = useState<CityData>(DEFAULT_CITY);

  useEffect(() => {
    // Сначала берём из localStorage (быстро)
    try {
      const saved = localStorage.getItem("site_contacts");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCityState((prev) => ({ ...prev, ...parsed }));
      }
    } catch (_e) { /* ignore */ }

    // Потом загружаем свежие данные из API
    fetch("https://functions.poehali.dev/94183657-f771-4225-adc4-ca8bb6c3c9b9")
      .then((r) => r.json())
      .then((data: Record<string, { value: string }>) => {
        const patch: Partial<CityData> = {};
        if (data.phone_raw?.value) patch.phone = data.phone_raw.value;
        if (data.phone?.value) patch.phoneDisplay = data.phone.value;
        if (data.email?.value) patch.email = data.email.value;
        if (data.address?.value) patch.address = data.address.value;
        if (data.workdays?.value) patch.workdays = data.workdays.value;
        if (data.weekend?.value) patch.weekend = data.weekend.value;
        if (data.telegram?.value !== undefined) patch.telegram = data.telegram.value;
        if (data.whatsapp?.value !== undefined) patch.whatsapp = data.whatsapp.value;
        if (data.vk?.value !== undefined) patch.vk = data.vk.value;
        setCityState((prev) => ({ ...prev, ...patch }));
        localStorage.setItem("site_contacts", JSON.stringify(patch));
      })
      .catch(() => { /* fallback на дефолт */ });
  }, []);

  const setCity = (c: CityData) => {
    setCityState(c);
  };

  return <CityContext.Provider value={{ city, setCity }}>{children}</CityContext.Provider>;
}

export function useCity() {
  return useContext(CityContext);
}