import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";

const navLinks = [
  { path: "/", label: "Главная" },
  { path: "/catalog", label: "Каталог" },
  { path: "/services", label: "Услуги" },
  { path: "/portfolio", label: "Портфолио" },
  { path: "/about", label: "О нас" },
  { path: "/contacts", label: "Контакты" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
            <div className="w-8 h-8 neon-btn flex items-center justify-center text-sm font-bold" style={{ clipPath: "polygon(0 0, 100% 0, 85% 100%, 0 100%)" }}>
              R
            </div>
            <span className="font-oswald text-xl font-bold tracking-widest text-white uppercase">
              Rent<span className="neon-text">Pro</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 text-sm font-medium uppercase tracking-wider transition-all duration-200 relative group ${
                  location.pathname === link.path
                    ? "neon-text"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {link.label}
                {location.pathname === link.path && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                )}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a href="tel:+78001234567" className="text-sm text-gray-400 hover:text-white transition-colors">
              8 800 123-45-67
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
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-4 py-3 text-sm font-medium uppercase tracking-wider border-l-2 transition-all ${
                    location.pathname === link.path
                      ? "neon-text border-amber-500"
                      : "text-gray-400 border-transparent hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-amber-500/10">
                <a href="tel:+78001234567" className="block px-4 py-2 text-sm text-gray-400">
                  8 800 123-45-67
                </a>
                <Link to="/contacts" className="neon-btn block text-center px-4 py-2 text-sm rounded-sm mt-2 mx-4">
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
              <div className="font-oswald text-xl font-bold tracking-widest text-white uppercase mb-3">
                Rent<span className="neon-text">Pro</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">
                Профессиональная аренда оборудования для мероприятий любого масштаба
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold uppercase tracking-wider text-sm mb-4">Разделы</h4>
              <ul className="space-y-2">
                {navLinks.map((link) => (
                  <li key={link.path}>
                    <Link to={link.path} className="text-gray-500 hover:text-amber-500 text-sm transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold uppercase tracking-wider text-sm mb-4">Контакты</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2"><Icon name="Phone" size={14} className="text-amber-500" /> 8 800 123-45-67</li>
                <li className="flex items-center gap-2"><Icon name="Mail" size={14} className="text-amber-500" /> info@rentpro.ru</li>
                <li className="flex items-center gap-2"><Icon name="MapPin" size={14} className="text-amber-500" /> Москва, ул. Профсоюзная, 65</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold uppercase tracking-wider text-sm mb-4">Режим работы</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>Пн–Пт: 9:00 — 20:00</li>
                <li>Сб–Вс: 10:00 — 18:00</li>
                <li className="text-amber-500">Доставка 24/7</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-amber-500/10 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
            <span>© 2024 RentPro. Все права защищены.</span>
            <span>Аренда профессионального оборудования</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
