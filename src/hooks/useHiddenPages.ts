import { useState, useEffect } from "react";

const HIDDEN_KEY = "site_hidden_pages";
const PORTFOLIO_KEY = "site_portfolio_items";

export const ALL_PAGES = [
  { page: "catalog", label: "Каталог" },
  { page: "services", label: "Услуги" },
  { page: "portfolio", label: "Портфолио" },
  { page: "about", label: "О нас" },
  { page: "contacts", label: "Контакты" },
  { page: "calculator", label: "Калькулятор" },
];

export interface PortfolioItem {
  id: number;
  title: string;
  category: string;
  date: string;
  guests: number;
  equipment: string[];
  description: string;
  tags: string[];
  highlight: boolean;
}

const DEFAULT_PORTFOLIO: PortfolioItem[] = [
  {
    id: 1,
    title: "TechForum 2024",
    category: "Конференции",
    date: "Март 2024",
    guests: 1200,
    equipment: ["LED-экран 200 м²", "Конференц-система Bosch", "Лазерный проектор 30000 лм"],
    description: "Крупнейшая IT-конференция года. Обеспечили полное техническое оснащение трёх залов и центральной сцены.",
    tags: ["LED-экран", "конференц-система", "проектор"],
    highlight: true,
  },
  {
    id: 2,
    title: "Фестиваль Aurora 2024",
    category: "Фестивали",
    date: "Июль 2024",
    guests: 5000,
    equipment: ["Line Array JBL VTX", "Лазерное шоу 10 кВт", "Сцена 20×12 м"],
    description: "Трёхдневный музыкальный фестиваль под открытым небом. Полный звуко-световой комплекс.",
    tags: ["line array", "лазер", "сцена"],
    highlight: true,
  },
  {
    id: 3,
    title: "Гала-вечер X5 Group",
    category: "Корпоративы",
    date: "Декабрь 2023",
    guests: 800,
    equipment: ["Звуковая система d&b", "Световой rig 60 приборов", "Дым и спецэффекты"],
    description: "Новогодний корпоратив с тематическим световым шоу и живой музыкой.",
    tags: ["корпоратив", "свет", "спецэффекты"],
    highlight: false,
  },
  {
    id: 4,
    title: "Концерт Иванова",
    category: "Концерты",
    date: "Октябрь 2023",
    guests: 3000,
    equipment: ["Line Array 32 блока", "Диммерная ферма 24 прибора", "LED-экран сцены"],
    description: "Сольный концерт в СК Лужники. Полный технический райдер исполнителя.",
    tags: ["концерт", "line array", "свет"],
    highlight: true,
  },
  {
    id: 5,
    title: "Brand Forum 2024",
    category: "Конференции",
    date: "Апрель 2024",
    guests: 400,
    equipment: ["Конференц-система 400 мест", "Синхронный перевод 4 языка", "Потоковое вещание"],
    description: "Международный форум брендов. Синхронный перевод, потоковая трансляция на 15 000 онлайн-зрителей.",
    tags: ["форум", "перевод", "стриминг"],
    highlight: false,
  },
  {
    id: 6,
    title: "Cirque du Lumière",
    category: "Шоу",
    date: "Февраль 2024",
    guests: 650,
    equipment: ["Световые роботы 48 ед.", "Лазеры RGB 5 кВт", "Пиротехника сцены"],
    description: "Цирковое шоу с элементами световой инсталляции и лазерного перформанса.",
    tags: ["шоу", "лазер", "роботы"],
    highlight: true,
  },
];

function broadcast(key: string) {
  window.dispatchEvent(new StorageEvent("storage", { key, newValue: localStorage.getItem(key) }));
}

export function useHiddenPages() {
  const [hidden, setHiddenState] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]"); } catch { return []; }
  });

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === HIDDEN_KEY) {
        try { setHiddenState(JSON.parse(e.newValue || "[]")); } catch { setHiddenState([]); }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const togglePage = (page: string) => {
    const next = hidden.includes(page) ? hidden.filter((p) => p !== page) : [...hidden, page];
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    setHiddenState(next);
    broadcast(HIDDEN_KEY);
  };

  const isHidden = (page: string) => hidden.includes(page);

  return { hidden, togglePage, isHidden };
}

export function usePortfolioItems() {
  const [items, setItemsState] = useState<PortfolioItem[]>(() => {
    try {
      const saved = localStorage.getItem(PORTFOLIO_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_PORTFOLIO;
    } catch { return DEFAULT_PORTFOLIO; }
  });

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === PORTFOLIO_KEY) {
        try { setItemsState(JSON.parse(e.newValue || "[]")); } catch { setItemsState(DEFAULT_PORTFOLIO); }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const save = (next: PortfolioItem[]) => {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(next));
    setItemsState(next);
    broadcast(PORTFOLIO_KEY);
  };

  const addItem = (item: Omit<PortfolioItem, "id">) => {
    const id = Date.now();
    save([...items, { ...item, id }]);
  };

  const updateItem = (updated: PortfolioItem) => {
    save(items.map((i) => (i.id === updated.id ? updated : i)));
  };

  const deleteItem = (id: number) => {
    save(items.filter((i) => i.id !== id));
  };

  return { items, addItem, updateItem, deleteItem };
}
