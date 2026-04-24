import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useCity, CITIES, CityData } from "@/context/CityContext";

const NAV_PAGES = [
  { page: "", label: "Главная" },
  { page: "catalog", label: "Каталог" },
  { page: "services", label: "Услуги" },
  { page: "portfolio", label: "Портфолио" },
  { page: "about", label: "О нас" },
  { page: "contacts", label: "Контакты" },
];

function buildPath(citySlug: string | undefined, page: string): string {
  if (!citySlug) return page ? `/${page}` : "/";
  return page ? `/${citySlug}/${page}` : `/${citySlug}`;
}

function getCurrentPage(pathname: string, citySlug: string | undefined): string {
  if (!citySlug) return pathname.replace(/^\//, "");
  return pathname.replace(`/${citySlug}`, "").replace(/^\//, "");
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { citySlug } = useParams<{ citySlug?: string }>();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cityDropdown, setCityDropdown] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);
  const { city, setCity } = useCity();

  const currentPage = getCurrentPage(location.pathname, citySlug);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setCityDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCityChange = (c: CityData) => {
    setCity(c);
    setCityDropdown(false);
    // Переключаем URL на новый город, сохраняя текущую страницу
    navigate(buildPath(c.id, currentPage), { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--surface)" }}>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "glass-card shadow-lg" : "bg-transparent"
        }`}
      >
        <div className="container mx-auto px-4 flex items-center justify-between h-16">
          <Link to={buildPath(citySlug, "")} className="flex items-center gap-2">
            <span className="font-oswald text-xl font-bold tracking-widest text-white uppercase">
              Global<span className="neon-text">Renta</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_PAGES.map((link) => {
              const to = buildPath(citySlug, link.page);
              const isActive = currentPage === link.page;
              return (
                <Link
                  key={link.page}
                  to={to}
                  className={`px-4 py-2 text-sm font-medium uppercase tracking-wider transition-all duration-200 relative group ${
                    isActive ? "neon-text" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {/* City selector */}
            <div className="relative" ref={cityRef}>
              <button
                onClick={() => setCityDropdown(!cityDropdown)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors border border-amber-500/20 rounded-sm px-3 py-1.5 hover:border-amber-500/40"
              >
                <Icon name="MapPin" size={13} className="text-amber-500" />
                {city.name}
                <Icon name="ChevronDown" size={13} className={`transition-transform ${cityDropdown ? "rotate-180" : ""}`} />
              </button>
              {cityDropdown && (
                <div className="absolute right-0 top-full mt-1 glass-card border border-amber-500/20 rounded-sm overflow-hidden z-50 min-w-[180px]">
                  {CITIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleCityChange(c)}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                        c.id === city.id ? "text-amber-500 bg-amber-500/10" : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {c.id === city.id && <Icon name="Check" size={12} className="text-amber-500" />}
                      {c.id !== city.id && <span className="w-3" />}
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <a href={`tel:${city.phone}`} className="text-sm text-gray-400 hover:text-white transition-colors">
              {city.phoneDisplay}
            </a>
            <Link to={buildPath(citySlug, "contacts")} className="neon-btn px-4 py-2 text-sm rounded-sm">
              Оставить заявку
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? "X" : "Menu"} size={24} />
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden glass-card border-t border-amber-500/10 py-4">
            <div className="container mx-auto px-4 flex flex-col gap-2">
              {NAV_PAGES.map((link) => {
                const to = buildPath(citySlug, link.page);
                const isActive = currentPage === link.page;
                return (
                  <Link
                    key={link.page}
                    to={to}
                    className={`px-4 py-3 text-sm font-medium uppercase tracking-wider border-l-2 transition-all ${
                      isActive
                        ? "neon-text border-amber-500"
                        : "text-gray-400 border-transparent hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <div className="pt-2 border-t border-amber-500/10">
                <div className="px-4 py-2 flex flex-col gap-1">
                  <span className="text-xs text-gray-600 uppercase tracking-wider">Ваш город</span>
                  <div className="flex gap-2 flex-wrap">
                    {CITIES.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleCityChange(c)}
                        className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                          c.id === city.id
                            ? "border-amber-500 text-amber-500 bg-amber-500/10"
                            : "border-amber-500/20 text-gray-400 hover:border-amber-500/40 hover:text-white"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <a href={`tel:${city.phone}`} className="block px-4 py-2 text-sm text-gray-400">
                  {city.phoneDisplay}
                </a>
                <Link to={buildPath(citySlug, "contacts")} className="neon-btn block text-center px-4 py-2 text-sm rounded-sm mt-2 mx-4">
                  Оставить заявку
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 pt-16">
        {children}
      </main>

      <footer className="border-t border-amber-500/10 mt-16">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-oswald text-xl font-bold tracking-widest text-white uppercase">
                  Global<span className="neon-text">Renta</span>
                </span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">
                Профессиональная аренда оборудования для мероприятий любого масштаба
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold uppercase tracking-wider text-sm mb-4">Разделы</h4>
              <ul className="space-y-2">
                {NAV_PAGES.map((link) => (
                  <li key={link.page}>
                    <Link
                      to={buildPath(citySlug, link.page)}
                      className="text-gray-500 hover:text-amber-500 text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold uppercase tracking-wider text-sm mb-4">Города</h4>
              <ul className="space-y-2">
                {CITIES.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/${c.id}`}
                      className="text-gray-500 hover:text-amber-500 text-sm transition-colors"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold uppercase tracking-wider text-sm mb-4">Контакты</h4>
              <div className="space-y-2 text-sm text-gray-500">
                <div>{city.phoneDisplay}</div>
                <div>{city.email}</div>
                <div className="text-xs">{city.address}</div>
                <div className="text-xs">{city.workdays}</div>
              </div>
            </div>
          </div>
          <div className="border-t border-amber-500/10 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-600 text-xs">© 2024 Global Renta. Все права защищены.</p>
            <div className="flex gap-4">
              {["Аренда звука", "Аренда света", "Аренда микрофонов", "Аренда сцены"].map((tag) => (
                <span key={tag} className="text-gray-700 text-xs">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
