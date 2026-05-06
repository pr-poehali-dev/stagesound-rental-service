import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Equipment } from "@/data/equipment";
import { useSeo } from "@/hooks/useSeo";
import { useCity } from "@/context/CityContext";
import { CITY_CONTENT } from "@/data/cityContent";
import func2url from "../../backend/func2url.json";
import { slugify } from "./EquipmentItem";

const categoryMeta: Record<string, { image: string; desc: string; icon: string }> = {
  Звук: {
    image: "https://cdn.poehali.dev/projects/bbfa4077-327f-4ddf-84d0-e92a698a19e6/files/bc579cd3-b075-4cde-bf10-95d6c5ca5fd7.jpg",
    desc: "Линейные массивы, сабвуферы, мониторы, микшеры",
    icon: "Volume2",
  },
  Свет: {
    image: "https://cdn.poehali.dev/projects/bbfa4077-327f-4ddf-84d0-e92a698a19e6/files/6b27e5a8-dfd1-4749-bf9b-5f9ba48a1b99.jpg",
    desc: "Прожекторы, лазеры, дым-машины, спецэффекты",
    icon: "Zap",
  },
  Видео: {
    image: "https://cdn.poehali.dev/projects/bbfa4077-327f-4ddf-84d0-e92a698a19e6/files/3cfec214-68eb-4b9a-96be-fc25801badb9.jpg",
    desc: "Проекторы, LED-экраны, видеопроцессоры",
    icon: "Monitor",
  },
  Сцена: {
    image: "https://cdn.poehali.dev/projects/bbfa4077-327f-4ddf-84d0-e92a698a19e6/files/f45b6b60-a984-4fbe-b59c-5fa6165732ee.jpg",
    desc: "Сценические конструкции от 3×4 до 14×10 м с крышей и боковыми порталами",
    icon: "LayoutGrid",
  },
  Конференц: {
    image: "https://cdn.poehali.dev/projects/bbfa4077-327f-4ddf-84d0-e92a698a19e6/files/35f2689c-5e11-4824-acb9-52cb8407cdf6.jpg",
    desc: "Системы голосования, синхроперевод, делегатские места",
    icon: "Mic2",
  },
  Генераторы: {
    image: "https://cdn.poehali.dev/projects/bbfa4077-327f-4ddf-84d0-e92a698a19e6/files/d6d65e2b-7b61-48b3-9e82-eff083bbdcac.jpg",
    desc: "Дизельные генераторы для автономного питания",
    icon: "Bolt",
  },
};

const sortOptions = [
  { value: "popular", label: "По популярности" },
  { value: "price-asc", label: "Дешевле" },
  { value: "price-desc", label: "Дороже" },
  { value: "rating", label: "По рейтингу" },
];

export default function Catalog() {
  useSeo({ page: "catalog" });
  const { city } = useCity();
  const content = CITY_CONTENT[city.id] ?? CITY_CONTENT.moscow;
  const [searchParams] = useSearchParams();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<string[]>(["Все"]);
  const [subcategories, setSubcategories] = useState<{ name: string; category: string }[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState("Все");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [sort, setSort] = useState("popular");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<null | Equipment>(null);
  const priceMax = 500000;

  useEffect(() => {
    fetch((func2url as Record<string, string>)["get-catalog"])
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const cats: string[] = data.categories || [];
        setCategories(["Все", ...cats]);
        setSubcategories(data.subcategories || []);
        setEquipment(data.equipment || []);
        // применяем категорию из URL после загрузки
        const urlCat = searchParams.get("category");
        if (urlCat) {
          const matched = cats.find((c) => c.toLowerCase() === urlCat.toLowerCase());
          if (matched) setActiveCategory(matched);
        }
        setCatalogLoading(false);
      })
      .catch((err) => {
        console.error("Ошибка загрузки каталога:", err);
        setCatalogLoading(false);
      });
  }, []);

  const catCounts = Object.fromEntries(
    categories.slice(1).map((c) => [c, equipment.filter((e) => e.category === c).length])
  );
  const soundSubcategories = subcategories.filter((s) => s.category === activeCategory).map((s) => s.name);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setActiveSubcategory(null);
  };

  const filtered = useMemo(() => {
    let result = [...equipment];
    if (activeCategory !== "Все") result = result.filter((e) => e.category === activeCategory);
    if (activeSubcategory) result = result.filter((e) => e.subcategory === activeSubcategory);
    if (search) result = result.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()) || (e.tags || []).some((t) => t.includes(search.toLowerCase())));
    result = result.filter((e) => e.price <= priceMax);
    if (sort === "popular") result = result.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
    if (sort === "price-asc") result = result.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") result = result.sort((a, b) => b.price - a.price);
    if (sort === "rating") result = result.sort((a, b) => b.rating - a.rating);
    return result;
  }, [activeCategory, activeSubcategory, search, sort, equipment]);

  return (
    <div className="pb-16">
      {/* Hero Banner */}
      <div className="relative h-48 md:h-64 overflow-hidden mb-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: activeCategory !== "Все" && categoryMeta[activeCategory]
              ? `url(${categoryMeta[activeCategory].image})`
              : "url(https://cdn.poehali.dev/projects/bbfa4077-327f-4ddf-84d0-e92a698a19e6/files/bc579cd3-b075-4cde-bf10-95d6c5ca5fd7.jpg)",
          }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.3))" }} />
        <div className="relative z-10 h-full flex flex-col justify-end px-6 md:px-16 pb-8">
          <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Аренда оборудования</p>
          <h1 className="font-oswald text-4xl md:text-5xl font-bold uppercase text-white">
            {activeCategory === "Все" ? "Каталог оборудования" : activeCategory}
          </h1>
          {activeCategory !== "Все" && categoryMeta[activeCategory] && (
            <p className="text-gray-400 text-sm mt-1">{categoryMeta[activeCategory].desc}</p>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="border-b border-amber-500/10" style={{ background: "var(--surface-1)" }}>
        <div className="container mx-auto px-4">
          <div className="flex overflow-x-auto gap-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeCategory === cat
                    ? "border-amber-500 text-amber-500"
                    : "border-transparent text-gray-500 hover:text-white hover:border-gray-600"
                }`}
              >
                {cat !== "Все" && categoryMeta[cat] && (
                  <Icon name={categoryMeta[cat].icon as "Volume2"} size={14} />
                )}
                {cat}
                {cat !== "Все" && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeCategory === cat ? "bg-amber-500 text-black" : "bg-gray-800 text-gray-500"}`}>
                    {catCounts[cat]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>



      {/* Subcategory bar (dynamic — for any category that has subcategories) */}
      {soundSubcategories.length > 0 && (
        <div className="border-b border-amber-500/10 bg-black/20">
          <div className="container mx-auto px-4">
            <div className="flex overflow-x-auto gap-0 scrollbar-none">
              <button
                onClick={() => setActiveSubcategory(null)}
                className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-all ${activeSubcategory === null ? "border-amber-500/60 text-amber-400" : "border-transparent text-gray-600 hover:text-gray-300"}`}
              >
                Все подразделы
              </button>
              {soundSubcategories.map((sub) => {
                const count = equipment.filter((e) => e.category === activeCategory && e.subcategory === sub).length;
                return (
                  <button
                    key={sub}
                    onClick={() => setActiveSubcategory(sub)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-all ${activeSubcategory === sub ? "border-amber-500/60 text-amber-400" : "border-transparent text-gray-600 hover:text-gray-300"}`}
                  >
                    {sub}
                    {count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeSubcategory === sub ? "bg-amber-500/20 text-amber-400" : "bg-gray-800 text-gray-600"}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="container mx-auto px-4">
        <div className="pt-4">

          {/* Products Grid */}
          <div className="w-full">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-sm">
                  Найдено: <span className="text-white font-medium">{filtered.length}</span> позиций
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск..."
                    className="bg-transparent border border-amber-500/20 rounded-sm pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 w-44"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="bg-transparent border border-amber-500/20 rounded-sm px-3 py-1.5 text-sm text-gray-400 focus:outline-none focus:border-amber-500/50"
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {catalogLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="glass-card rounded-sm overflow-hidden animate-pulse">
                    <div className="h-48 bg-amber-500/5" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-amber-500/10 rounded w-3/4" />
                      <div className="h-3 bg-amber-500/5 rounded w-1/2" />
                      <div className="h-6 bg-amber-500/10 rounded w-1/3 mt-3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="glass-card rounded-sm p-16 text-center">
                <Icon name="PackageSearch" size={48} className="text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">Ничего не найдено. Попробуйте другие фильтры.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    className="glass-card rounded-sm overflow-hidden group cursor-pointer hover:border-amber-500/30 transition-all flex flex-col"
                    onClick={() => setSelectedItem(item)}
                  >

                    {/* Image */}
                    <div className="relative overflow-hidden" style={{ height: "200px", background: "var(--surface-2)" }}>
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <>
                          <div className="absolute inset-0 grid-pattern opacity-30" />
                          <Icon name="Package" size={48} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-500/20" />
                        </>
                      )}
                      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />
                      {item.popular && (
                        <span className="absolute top-3 left-3 text-xs bg-amber-500 text-black font-bold px-2 py-0.5 uppercase tracking-wider z-10">
                          Хит
                        </span>
                      )}
                      <span className="absolute top-3 right-3 text-xs bg-black/60 text-gray-300 px-2 py-0.5 rounded-sm z-10 backdrop-blur-sm">
                        {item.category}
                      </span>
                      {item.usage && (
                        <span className={`absolute bottom-3 right-3 z-10 text-xs font-medium px-2 py-0.5 rounded-sm flex items-center gap-1 backdrop-blur-sm ${
                          item.usage === "outdoor"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            : item.usage === "indoor"
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                            : "bg-green-500/20 text-green-300 border border-green-500/30"
                        }`}>
                          <Icon name={item.usage === "outdoor" ? "Sun" : item.usage === "indoor" ? "Building2" : "Layers"} size={10} />
                          {item.usage === "indoor" ? "Indoor" : item.usage === "outdoor" ? "Outdoor" : "Indoor / Outdoor"}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-semibold text-white text-sm mb-2 leading-snug">{item.name}</h3>
                      <p className="text-gray-500 text-xs mb-3 line-clamp-2 flex-1">{item.description}</p>

                      {/* Specs preview */}
                      <div className="grid grid-cols-2 gap-1 mb-4">
                        {Object.entries(item.specs).slice(0, 2).map(([key, val]) => (
                          <div key={key} className="bg-black/30 rounded-sm px-2 py-1.5">
                            <div className="text-gray-600 text-xs leading-tight">{key}</div>
                            <div className="text-white text-xs font-medium leading-tight mt-0.5 truncate">{val}</div>
                          </div>
                        ))}
                      </div>

                      {/* Rating */}
                      <div className="flex items-center gap-1 mb-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Icon key={i} name="Star" size={10} className={i < item.rating ? "text-amber-500 fill-amber-500" : "text-gray-700"} />
                        ))}
                        <span className="text-gray-600 text-xs ml-1">{item.reviews} отзывов</span>
                      </div>

                      {/* Price + CTA */}
                      <div className="flex items-center justify-between pt-3 border-t border-amber-500/10">
                        <div>
                          <div className="font-oswald text-2xl font-bold neon-text leading-none">{item.price.toLocaleString()} ₽</div>
                          <div className="text-gray-600 text-xs">за {item.unit}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/catalog/${item.id}`}
                            className="text-xs border border-amber-500/30 text-amber-500/70 px-3 py-2 rounded-sm hover:border-amber-500/60 hover:text-amber-500 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Подробнее
                          </Link>
                          <button
                            className="neon-btn text-xs px-4 py-2 rounded-sm flex items-center gap-1.5"
                            onClick={(e) => { e.stopPropagation(); window.location.href = "/calculator"; }}
                          >
                            <Icon name="ShoppingCart" size={12} />
                            Арендовать
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}

      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="glass-card neon-border rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedItem.image && (
              <div className="relative h-56 overflow-hidden">
                <img src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 30%, transparent)" }} />
                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/50 text-gray-300 hover:text-white rounded-sm backdrop-blur-sm transition-colors"
                >
                  <Icon name="X" size={16} />
                </button>
                <div className="absolute bottom-4 left-6">
                  <span className="text-xs text-amber-500 uppercase tracking-wider">{selectedItem.category}</span>
                  <h2 className="font-oswald text-3xl font-bold text-white uppercase">{selectedItem.name}</h2>
                </div>
              </div>
            )}

            <div className="p-6">
              {!selectedItem.image && (
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-xs text-amber-500 uppercase tracking-wider">{selectedItem.category}</span>
                    <h2 className="font-oswald text-3xl font-bold text-white uppercase mt-1">{selectedItem.name}</h2>
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-white transition-colors">
                    <Icon name="X" size={20} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Icon key={i} name="Star" size={12} className={i < selectedItem.rating ? "text-amber-500 fill-amber-500" : "text-gray-700"} />
                  ))}
                  <span className="text-gray-500 text-xs ml-1">{selectedItem.reviews} отзывов</span>
                </div>
                {selectedItem.usage && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-sm flex items-center gap-1.5 ${
                    selectedItem.usage === "outdoor"
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      : selectedItem.usage === "indoor"
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "bg-green-500/20 text-green-300 border border-green-500/30"
                  }`}>
                    <Icon name={selectedItem.usage === "outdoor" ? "Sun" : selectedItem.usage === "indoor" ? "Building2" : "Layers"} size={12} />
                    {selectedItem.usage === "indoor" ? "Только Indoor" : selectedItem.usage === "outdoor" ? "Только Outdoor" : "Indoor / Outdoor"}
                  </span>
                )}
              </div>

              <p className="text-gray-400 mb-5 leading-relaxed text-sm">{selectedItem.description}</p>

              <div className="mb-5">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Технические характеристики</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedItem.specs).map(([key, val]) => (
                    <div key={key} className="border border-amber-500/10 rounded-sm p-3">
                      <div className="text-xs text-gray-600 mb-0.5">{key}</div>
                      <div className="text-white text-sm font-medium">{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-5">
                {selectedItem.tags.map((tag) => (
                  <span key={tag} className="text-xs border border-amber-500/20 text-amber-500/70 px-2 py-1 rounded-sm">#{tag}</span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-amber-500/10">
                <div>
                  <span className="font-oswald text-3xl font-bold neon-text">{selectedItem.price.toLocaleString()} ₽</span>
                  <span className="text-gray-500 text-sm ml-1">/{selectedItem.unit}</span>
                </div>
                <Link to="/calculator" className="neon-btn px-6 py-3 rounded-sm text-sm flex items-center gap-2">
                  <Icon name="Calculator" size={16} />
                  Рассчитать аренду
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEO Text Block */}
      <section className="py-16 border-t border-amber-500/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            <h2 className="font-oswald text-3xl font-bold uppercase text-white mb-6">
              {content.catalogSeoBlock.title}
            </h2>
            <div className="space-y-4">
              {content.catalogSeoBlock.paragraphs.map((p, i) => (
                <p key={i} className="text-gray-500 text-sm leading-relaxed">{p}</p>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}