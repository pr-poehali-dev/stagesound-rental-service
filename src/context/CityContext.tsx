import { createContext, useContext, useState, ReactNode } from "react";

export interface CityData {
  id: string;
  name: string;
  phone: string;
  phoneDisplay: string;
  email: string;
  address: string;
  workdays: string;
  weekend: string;
}

export const CITIES: CityData[] = [
  {
    id: "moscow",
    name: "Москва",
    phone: "+74951234567",
    phoneDisplay: "+7 (495) 123-45-67",
    email: "moscow@globalrenta.ru",
    address: "Москва, ул. Профсоюзная, 65",
    workdays: "Пн–Пт: 9:00 — 20:00",
    weekend: "Сб–Вс: 10:00 — 18:00",
  },
  {
    id: "spb",
    name: "Санкт-Петербург",
    phone: "+78121234567",
    phoneDisplay: "+7 (812) 123-45-67",
    email: "spb@globalrenta.ru",
    address: "Санкт-Петербург, Невский пр., 88",
    workdays: "Пн–Пт: 9:00 — 20:00",
    weekend: "Сб–Вс: 10:00 — 17:00",
  },
  {
    id: "krasnoyarsk",
    name: "Красноярск",
    phone: "+73912345678",
    phoneDisplay: "+7 (391) 234-56-78",
    email: "krsk@globalrenta.ru",
    address: "Красноярск, пр. Мира, 102",
    workdays: "Пн–Пт: 9:00 — 19:00",
    weekend: "Сб: 10:00 — 16:00",
  },
];

interface CityContextType {
  city: CityData;
  setCity: (city: CityData) => void;
}

const CityContext = createContext<CityContextType>({
  city: CITIES[0],
  setCity: () => {},
});

export function CityProvider({ children }: { children: ReactNode }) {
  const savedId = typeof window !== "undefined" ? localStorage.getItem("globalrenta_city") : null;
  const initial = CITIES.find((c) => c.id === savedId) ?? CITIES[0];
  const [city, setCityState] = useState<CityData>(initial);

  const setCity = (c: CityData) => {
    setCityState(c);
    localStorage.setItem("globalrenta_city", c.id);
  };

  return <CityContext.Provider value={{ city, setCity }}>{children}</CityContext.Provider>;
}

export function useCity() {
  return useContext(CityContext);
}