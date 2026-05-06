import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Equipment } from "@/data/equipment";
import { useCity } from "@/context/CityContext";
import func2url from "../../backend/func2url.json";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, "e")
    .replace(/а/g, "a").replace(/б/g, "b").replace(/в/g, "v").replace(/г/g, "g")
    .replace(/д/g, "d").replace(/е/g, "e").replace(/ж/g, "zh").replace(/з/g, "z")
    .replace(/и/g, "i").replace(/й/g, "y").replace(/к/g, "k").replace(/л/g, "l")
    .replace(/м/g, "m").replace(/н/g, "n").replace(/о/g, "o").replace(/п/g, "p")
    .replace(/р/g, "r").replace(/с/g, "s").replace(/т/g, "t").replace(/у/g, "u")
    .replace(/ф/g, "f").replace(/х/g, "kh").replace(/ц/g, "ts").replace(/ч/g, "ch")
    .replace(/ш/g, "sh").replace(/щ/g, "shch").replace(/ъ/g, "").replace(/ы/g, "y")
    .replace(/ь/g, "").replace(/э/g, "e").replace(/ю/g, "yu").replace(/я/g, "ya")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export { slugify };

export default function EquipmentItem() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { city } = useCity();
  const [item, setItem] = useState<Equipment | null>(null);
  const [related, setRelated] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  const cityName = city.id === "spb" ? "Санкт-Петербурге" : city.id === "krasnoyarsk" ? "Красноярске" : "Москве";
  const cityNameFrom = city.id === "spb" ? "по Санкт-Петербургу" : city.id === "krasnoyarsk" ? "по Красноярску" : "по Москве и МО";

  useEffect(() => {
    fetch((func2url as Record<string, string>)["get-catalog"])
      .then((r) => r.json())
      .then((data) => {
        const all: Equipment[] = data.equipment || [];
        const numericId = parseInt(id || "", 10);
        let found: Equipment | null = null;

        if (!isNaN(numericId)) {
          found = all.find((e) => e.id === numericId) || null;
        }
        if (!found) {
          found = all.find((e) => slugify(e.name) === id) || null;
        }

        if (!found) {
          navigate("/catalog", { replace: true });
          return;
        }

        setItem(found);
        setRelated(all.filter((e) => e.category === found!.category && e.id !== found!.id).slice(0, 4));
        setLoading(false);

        const title = `Аренда ${found.name} в ${cityName} — от ${found.price.toLocaleString()} ₽/${found.unit} | Global Renta`;
        const description = `${found.description} Аренда ${found.name} в ${cityName}: цена от ${found.price.toLocaleString()} ₽ за ${found.unit}. Доставка ${cityNameFrom}, монтаж, технический специалист. Заявка онлайн.`;
        const keywords = `аренда ${found.name} ${cityName}, ${found.tags.join(", ")}, прокат ${found.category.toLowerCase()} оборудования ${cityName}`;
        const url = `https://globalrenta.ru/catalog/${found.id}`;

        document.title = title;
        const setMeta = (sel: string, attr: string, val: string) => {
          let el = document.querySelector(sel) as HTMLMetaElement | null;
          if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
          el.setAttribute(attr, val);
        };
        setMeta('meta[name="description"]', "content", description);
        setMeta('meta[name="keywords"]', "content", keywords);
        setMeta('meta[property="og:title"]', "content", title);
        setMeta('meta[property="og:description"]', "content", description);
        setMeta('meta[property="og:url"]', "content", url);
        if (found.image) setMeta('meta[property="og:image"]', "content", found.image);

        let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
        if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
        canonical.href = url;

        const jsonLd: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "Product",
          name: found.name,
          description: found.description,
          brand: { "@type": "Brand", name: "Global Renta" },
          category: found.category,
          offers: {
            "@type": "Offer",
            price: found.price,
            priceCurrency: "RUB",
            priceSpecification: { "@type": "UnitPriceSpecification", price: found.price, priceCurrency: "RUB", unitText: found.unit },
            availability: "https://schema.org/InStock",
            seller: { "@type": "Organization", name: "Global Renta", url: "https://globalrenta.ru" },
          },
          aggregateRating: { "@type": "AggregateRating", ratingValue: found.rating, bestRating: 5, reviewCount: found.reviews },
        };
        if (found.image) jsonLd.image = found.image;

        let ldScript = document.getElementById("product-jsonld");
        if (!ldScript) { ldScript = document.createElement("script"); ldScript.id = "product-jsonld"; ldScript.setAttribute("type", "application/ld+json"); document.head.appendChild(ldScript); }
        ldScript.textContent = JSON.stringify(jsonLd);
      })
      .catch(() => navigate("/catalog", { replace: true }));
  }, [id, city.id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 animate-pulse">
        <div className="h-8 bg-amber-500/10 rounded w-1/3 mb-4" />
        <div className="h-64 bg-amber-500/5 rounded mb-6" />
        <div className="h-4 bg-amber-500/10 rounded w-2/3 mb-2" />
        <div className="h-4 bg-amber-500/10 rounded w-1/2" />
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="pb-16">
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-4">
        <nav className="flex items-center gap-2 text-xs text-gray-500">
          <Link to="/" className="hover:text-amber-500 transition-colors">Главная</Link>
          <Icon name="ChevronRight" size={12} />
          <Link to="/catalog" className="hover:text-amber-500 transition-colors">Каталог</Link>
          <Icon name="ChevronRight" size={12} />
          <Link to={`/catalog?category=${encodeURIComponent(item.category)}`} className="hover:text-amber-500 transition-colors">{item.category}</Link>
          <Icon name="ChevronRight" size={12} />
          <span className="text-gray-400 truncate max-w-xs">{item.name}</span>
        </nav>
      </div>

      {/* Hero */}
      {item.image && (
        <div className="relative h-64 md:h-80 overflow-hidden mb-0">
          <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.9) 40%, rgba(0,0,0,0.3))" }} />
          <div className="relative z-10 h-full flex flex-col justify-end container mx-auto px-4 pb-8">
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">{item.category}{item.subcategory ? ` / ${item.subcategory}` : ""}</p>
            <h1 className="font-oswald text-4xl md:text-5xl font-bold uppercase text-white max-w-2xl">{item.name}</h1>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 mt-8">
        {!item.image && (
          <div className="mb-6">
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">{item.category}</p>
            <h1 className="font-oswald text-4xl md:text-5xl font-bold uppercase text-white">{item.name}</h1>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <div className="glass-card rounded-sm p-6">
              <h2 className="font-oswald text-xl font-bold uppercase text-white mb-4">Описание</h2>
              <p className="text-gray-400 leading-relaxed">{item.description}</p>

              <div className="flex flex-wrap gap-2 mt-4">
                {item.tags.map((tag) => (
                  <span key={tag} className="text-xs border border-amber-500/20 text-amber-500/70 px-2 py-1 rounded-sm">#{tag}</span>
                ))}
              </div>
            </div>

            {/* Specs */}
            <div className="glass-card rounded-sm p-6">
              <h2 className="font-oswald text-xl font-bold uppercase text-white mb-4">Технические характеристики</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(item.specs).map(([key, val]) => (
                  <div key={key} className="border border-amber-500/10 rounded-sm p-3">
                    <div className="text-xs text-gray-600 mb-0.5">{key}</div>
                    <div className="text-white text-sm font-medium">{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Usage conditions */}
            {item.usage && (
              <div className="glass-card rounded-sm p-6">
                <h2 className="font-oswald text-xl font-bold uppercase text-white mb-4">Условия использования</h2>
                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-medium ${
                  item.usage === "outdoor" ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  : item.usage === "indoor" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "bg-green-500/20 text-green-300 border border-green-500/30"
                }`}>
                  <Icon name={item.usage === "outdoor" ? "Sun" : item.usage === "indoor" ? "Building2" : "Layers"} size={16} />
                  {item.usage === "indoor" ? "Только для помещений (Indoor)" : item.usage === "outdoor" ? "Только для улицы (Outdoor)" : "Подходит для улицы и помещений (Indoor / Outdoor)"}
                </div>
              </div>
            )}

            {/* SEO text block */}
            <div className="glass-card rounded-sm p-6">
              <h2 className="font-oswald text-xl font-bold uppercase text-white mb-4">
                Аренда {item.name} в {cityName}
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-3">
                {item.description} Наша компания Global Renta предлагает аренду {item.name} в {cityName} с доставкой и монтажом {cityNameFrom}. Весь парк оборудования регулярно проходит технический осмотр и обслуживается каждые 90 дней.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed">
                Стоимость аренды {item.name} — от {item.price.toLocaleString()} ₽ за {item.unit}. В стоимость входит доставка, установка и настройка оборудования. По запросу — технический специалист на всё время мероприятия. Оставьте заявку онлайн или позвоните нам — ответим в течение 15 минут.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Price card */}
            <div className="glass-card neon-border rounded-sm p-6 sticky top-4">
              <div className="flex items-center gap-2 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon key={i} name="Star" size={14} className={i < item.rating ? "text-amber-500 fill-amber-500" : "text-gray-700"} />
                ))}
                <span className="text-gray-500 text-sm">{item.reviews} отзывов</span>
              </div>

              <div className="mb-4">
                <div className="font-oswald text-4xl font-bold neon-text leading-none">{item.price.toLocaleString()} ₽</div>
                <div className="text-gray-500 text-sm mt-1">за {item.unit}</div>
              </div>

              <Link to="/calculator" className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 mb-3">
                <Icon name="Calculator" size={16} />
                Рассчитать стоимость
              </Link>
              <Link to="/contacts" className="w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 border border-amber-500/30 text-white hover:border-amber-500/60 transition-colors">
                <Icon name="Phone" size={16} />
                Оставить заявку
              </Link>

              <div className="mt-4 space-y-2 pt-4 border-t border-amber-500/10">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Icon name="Truck" size={14} className="text-amber-500" />
                  Доставка {cityNameFrom}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Icon name="Wrench" size={14} className="text-amber-500" />
                  Монтаж и настройка включены
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Icon name="ShieldCheck" size={14} className="text-amber-500" />
                  Резервное оборудование
                </div>
              </div>
            </div>

            {/* Back to catalog */}
            <Link to="/catalog" className="glass-card rounded-sm p-4 flex items-center gap-3 text-gray-400 hover:text-white transition-colors group">
              <Icon name="ArrowLeft" size={16} className="group-hover:text-amber-500 transition-colors" />
              <span className="text-sm">Вернуться в каталог</span>
            </Link>
          </div>
        </div>

        {/* Related items */}
        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="font-oswald text-3xl font-bold uppercase text-white mb-6">Похожее оборудование</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((rel) => (
                <Link
                  key={rel.id}
                  to={`/catalog/${rel.id}`}
                  className="glass-card rounded-sm overflow-hidden group hover:border-amber-500/30 transition-all flex flex-col"
                >
                  <div className="relative overflow-hidden" style={{ height: "160px", background: "var(--surface-2)" }}>
                    {rel.image ? (
                      <img src={rel.image} alt={rel.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <Icon name="Package" size={40} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-500/20" />
                    )}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-semibold text-white text-sm mb-1 leading-snug">{rel.name}</h3>
                    <p className="text-gray-500 text-xs mb-3 line-clamp-2 flex-1">{rel.description}</p>
                    <div className="font-oswald text-xl font-bold neon-text">{rel.price.toLocaleString()} ₽<span className="text-gray-500 text-xs font-normal ml-1">/{rel.unit}</span></div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
