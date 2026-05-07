import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useCity } from "@/context/CityContext";
import { useHiddenPages } from "@/hooks/useHiddenPages";

const NAV_PAGES = [
  { page: "", label: "Главная" },
  { page: "catalog", label: "Каталог" },
  { page: "services", label: "Услуги" },
  { page: "portfolio", label: "Портфолио" },
  { page: "about", label: "О нас" },
  { page: "contacts", label: "Контакты" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { city } = useCity();
  const { isHidden } = useHiddenPages();

  const currentPage = location.pathname.replace(/^\//, "");
  const visibleNav = NAV_PAGES.filter((link) => !isHidden(link.page));

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--surface)" }}>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "glass-card shadow-lg" : "bg-transparent"
        }`}
      >
        <div className="container mx-auto px-4 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-oswald text-xl font-bold tracking-widest text-white uppercase">
              Global<span className="neon-text">Renta</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {visibleNav.map((link) => {
              const to = link.page ? `/${link.page}` : "/";
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
            {city.telegram && (
              <a href={city.telegram} target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center border border-amber-500/20 rounded-sm text-gray-400 hover:text-amber-500 hover:border-amber-500/50 transition-colors">
                <Icon name="Send" size={14} />
              </a>
            )}
            <a href={`tel:${city.phone}`} className="text-sm text-gray-400 hover:text-white transition-colors font-medium">
              {city.phoneDisplay}
            </a>
            <Link to="/contacts" className="neon-btn px-4 py-2 text-sm rounded-sm">
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
              {visibleNav.map((link) => {
                const to = link.page ? `/${link.page}` : "/";
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
              <div className="pt-2 border-t border-amber-500/10 flex flex-col gap-2 px-4">
                <a href={`tel:${city.phone}`} className="py-2 text-sm text-gray-400 flex items-center gap-2">
                  <Icon name="Phone" size={14} className="text-amber-500" />
                  {city.phoneDisplay}
                </a>
                {city.telegram && (
                  <a href={city.telegram} target="_blank" rel="noopener noreferrer"
                    className="py-2 text-sm text-gray-400 flex items-center gap-2">
                    <Icon name="Send" size={14} className="text-amber-500" />
                    Написать в Telegram
                  </a>
                )}
                <Link to="/contacts" className="neon-btn block text-center px-4 py-2 text-sm rounded-sm mt-1">
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
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Профессиональная аренда звука, света и сцены для мероприятий любого масштаба в Санкт-Петербурге
              </p>
              <div className="flex gap-2">
                {city.telegram && (
                  <a href={city.telegram} target="_blank" rel="noopener noreferrer"
                    className="w-8 h-8 flex items-center justify-center border border-amber-500/20 rounded-sm text-gray-500 hover:text-amber-500 hover:border-amber-500/50 transition-colors">
                    <Icon name="Send" size={14} />
                  </a>
                )}
                {city.vk && (
                  <a href={city.vk} target="_blank" rel="noopener noreferrer"
                    className="w-8 h-8 flex items-center justify-center border border-amber-500/20 rounded-sm text-gray-500 hover:text-amber-500 hover:border-amber-500/50 transition-colors">
                    <Icon name="Users" size={14} />
                  </a>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold uppercase tracking-wider text-sm mb-4">Разделы</h4>
              <ul className="space-y-2">
                {visibleNav.map((link) => (
                  <li key={link.page}>
                    <Link
                      to={link.page ? `/${link.page}` : "/"}
                      className="text-gray-500 hover:text-amber-500 text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold uppercase tracking-wider text-sm mb-4">Мероприятия</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                {["Корпоративы", "Свадьбы", "Дни рождения", "Концерты", "Конференции", "Речные прогулки", "Фестивали"].map((t) => (
                  <li key={t}>
                    <Link to="/services" className="hover:text-amber-500 transition-colors">{t}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold uppercase tracking-wider text-sm mb-4">Контакты</h4>
              <div className="space-y-2 text-sm text-gray-500">
                <a href={`tel:${city.phone}`} className="flex items-center gap-2 hover:text-amber-500 transition-colors">
                  <Icon name="Phone" size={13} className="text-amber-500 shrink-0" />
                  {city.phoneDisplay}
                </a>
                <a href={`mailto:${city.email}`} className="flex items-center gap-2 hover:text-amber-500 transition-colors">
                  <Icon name="Mail" size={13} className="text-amber-500 shrink-0" />
                  {city.email}
                </a>
                <div className="flex items-start gap-2">
                  <Icon name="MapPin" size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <span>{city.address}</span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <Icon name="Clock" size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <span>{city.workdays}<br />{city.weekend}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-amber-500/10 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-600 text-xs">© 2024 Global Renta. Все права защищены.</p>
            <div className="flex items-center gap-4 flex-wrap justify-end">
              <Link
                to="/renter/register"
                className="flex items-center gap-1.5 text-gray-600 hover:text-amber-500 text-xs transition-colors"
              >
                <Icon name="Building2" size={12} />
                Стать партнёром-прокатчиком
              </Link>
              <div className="flex gap-4 flex-wrap">
                {["Аренда звука", "Аренда света", "Аренда микрофонов", "Аренда сцены", "Корпоратив", "Свадьба"].map((tag) => (
                  <span key={tag} className="text-gray-700 text-xs">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}