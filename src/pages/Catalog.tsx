import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { equipment, categories } from "@/data/equipment";

const sortOptions = [
  { value: "popular", label: "По популярности" },
  { value: "price-asc", label: "Цена: по возрастанию" },
  { value: "price-desc", label: "Цена: по убыванию" },
  { value: "rating", label: "По рейтингу" },
];

export default function Catalog() {
  const [searchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState(
    categories.find((c) => c.toLowerCase() === searchParams.get("category")) || "Все"
  );
  const [sort, setSort] = useState("popular");
  const [search, setSearch] = useState("");
  const [priceMax, setPriceMax] = useState(10000);
  const [selectedItem, setSelectedItem] = useState<null | (typeof equipment)[0]>(null);

  const filtered = useMemo(() => {
    let result = [...equipment];
    if (activeCategory !== "Все") result = result.filter((e) => e.category === activeCategory);
    if (search) result = result.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()) || e.tags.some((t) => t.includes(search.toLowerCase())));
    result = result.filter((e) => e.price <= priceMax);
    if (sort === "popular") result = result.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
    if (sort === "price-asc") result = result.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") result = result.sort((a, b) => b.price - a.price);
    if (sort === "rating") result = result.sort((a, b) => b.rating - a.rating);
    return result;
  }, [activeCategory, search, priceMax, sort]);

  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="relative mb-12">
          <div className="section-number">02</div>
          <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Наш арсенал</p>
          <h1 className="font-oswald text-5xl md:text-6xl font-bold uppercase text-white">Каталог оборудования</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="glass-card p-5 rounded-sm space-y-6 sticky top-20">
              <div>
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Поиск</h3>
                <div className="relative">
                  <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Название, тег..."
                    className="w-full bg-transparent border border-amber-500/20 rounded-sm pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Категория</h3>
                <ul className="space-y-1">
                  {categories.map((cat) => (
                    <li key={cat}>
                      <button
                        onClick={() => setActiveCategory(cat)}
                        className={`w-full text-left px-3 py-2 text-sm rounded-sm transition-all ${
                          activeCategory === cat
                            ? "neon-text border-l-2 border-amber-500 pl-2"
                            : "text-gray-500 hover:text-white"
                        }`}
                      >
                        {cat}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                  Макс. цена: <span className="text-amber-500">{priceMax.toLocaleString()} ₽/день</span>
                </h3>
                <input
                  type="range"
                  min={500}
                  max={10000}
                  step={100}
                  value={priceMax}
                  onChange={(e) => setPriceMax(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>500 ₽</span>
                  <span>10 000 ₽</span>
                </div>
              </div>

              <div>
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Сортировка</h3>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => { setActiveCategory("Все"); setSearch(""); setPriceMax(10000); setSort("popular"); }}
                className="w-full text-xs text-gray-600 hover:text-amber-500 transition-colors uppercase tracking-wider text-left"
              >
                Сбросить фильтры
              </button>
            </div>
          </aside>

          {/* Grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <span className="text-gray-500 text-sm">Найдено: <span className="text-white">{filtered.length}</span> единиц</span>
            </div>

            {filtered.length === 0 ? (
              <div className="glass-card rounded-sm p-16 text-center">
                <Icon name="PackageSearch" size={48} className="text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">Ничего не найдено. Попробуйте другие фильтры.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    className="glass-card rounded-sm overflow-hidden group cursor-pointer hover:border-amber-500/30 transition-all"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="h-36 flex items-center justify-center relative" style={{ background: "var(--surface-2)" }}>
                      <div className="absolute inset-0 grid-pattern opacity-50" />
                      {item.popular && (
                        <span className="absolute top-3 left-3 text-xs bg-amber-500 text-black font-bold px-2 py-0.5 uppercase tracking-wider">
                          Хит
                        </span>
                      )}
                      <div className="font-oswald text-5xl font-bold text-amber-500/10 group-hover:text-amber-500/20 transition-colors select-none">
                        {item.category.charAt(0)}
                      </div>
                      <Icon name="Package" size={36} className="absolute text-amber-500/20 group-hover:text-amber-500/40 transition-colors" />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: item.rating }).map((_, i) => (
                          <Icon key={i} name="Star" size={10} className="text-amber-500 fill-amber-500" />
                        ))}
                        <span className="text-gray-600 text-xs ml-1">({item.reviews})</span>
                      </div>
                      <h3 className="font-semibold text-white text-sm mb-1 leading-tight">{item.name}</h3>
                      <p className="text-gray-600 text-xs mb-3 line-clamp-1">{item.category}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-oswald text-xl font-bold neon-text">{item.price.toLocaleString()} ₽</span>
                          <span className="text-gray-600 text-xs">/{item.unit}</span>
                        </div>
                        <button
                          className="neon-btn text-xs px-3 py-1.5 rounded-sm"
                          onClick={(e) => { e.stopPropagation(); window.location.href = "/calculator"; }}
                        >
                          Арендовать
                        </button>
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
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="glass-card neon-border rounded-sm p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="text-xs text-amber-500 uppercase tracking-wider">{selectedItem.category}</span>
                <h2 className="font-oswald text-3xl font-bold text-white uppercase mt-1">{selectedItem.name}</h2>
                <div className="flex items-center gap-1 mt-2">
                  {Array.from({ length: selectedItem.rating }).map((_, i) => (
                    <Icon key={i} name="Star" size={12} className="text-amber-500 fill-amber-500" />
                  ))}
                  <span className="text-gray-500 text-xs ml-1">{selectedItem.reviews} отзывов</span>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-white transition-colors">
                <Icon name="X" size={20} />
              </button>
            </div>

            <p className="text-gray-400 mb-6 leading-relaxed">{selectedItem.description}</p>

            <div className="mb-6">
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

            <div className="flex flex-wrap gap-2 mb-6">
              {selectedItem.tags.map((tag) => (
                <span key={tag} className="text-xs border border-amber-500/20 text-amber-500/70 px-2 py-1 rounded-sm">#{tag}</span>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-amber-500/10">
              <div>
                <span className="font-oswald text-3xl font-bold neon-text">{selectedItem.price.toLocaleString()} ₽</span>
                <span className="text-gray-500 text-sm">/{selectedItem.unit}</span>
              </div>
              <Link to="/calculator" className="neon-btn px-6 py-3 rounded-sm text-sm flex items-center gap-2">
                <Icon name="Calculator" size={16} />
                Рассчитать аренду
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
