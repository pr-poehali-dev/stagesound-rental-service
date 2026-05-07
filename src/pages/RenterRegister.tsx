import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const URLS = func2url as Record<string, string>;

type FormData = {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  city: string;
  telegram: string;
  password: string;
  confirm_password: string;
};

const emptyForm: FormData = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  city: "Санкт-Петербург",
  telegram: "",
  password: "",
  confirm_password: "",
};

export default function RenterRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = (): string => {
    if (!form.company_name.trim()) return "Укажите название компании";
    if (!form.contact_name.trim()) return "Укажите контактное лицо";
    if (!form.email.trim() || !form.email.includes("@")) return "Укажите корректный email";
    if (!form.phone.trim()) return "Укажите телефон";
    if (form.password.length < 6) return "Пароль должен содержать минимум 6 символов";
    if (form.password !== form.confirm_password) return "Пароли не совпадают";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError("");
    setLoading(true);
    try {
      const payload: Record<string, string> = {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        city: form.city.trim() || "Санкт-Петербург",
        password: form.password,
      };
      if (form.telegram.trim()) payload.telegram = form.telegram.trim();

      const res = await fetch(`${URLS["renter-auth"]}?action=register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Ошибка регистрации");
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen grid-pattern flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: "var(--surface)" }}
    >
      {/* Header */}
      <div className="mb-8 text-center">
        <span
          className="font-oswald text-2xl font-bold tracking-widest neon-text cursor-pointer"
          onClick={() => navigate("/")}
        >
          GLOBALRENTA
        </span>
        <div className="w-16 h-0.5 bg-amber-500 mx-auto mt-2 opacity-60" />
      </div>

      <div className="w-full max-w-lg">
        {success ? (
          <div className="glass-card rounded-sm p-10 text-center animate-fade-in">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Icon name="CheckCircle" className="text-amber-500" size={32} />
              </div>
            </div>
            <h2 className="font-oswald text-2xl font-bold text-white mb-3 tracking-wide">
              Заявка отправлена!
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              Ожидайте одобрения администратором.
              <br />
              Мы свяжемся с вами по указанному email или телефону.
            </p>
            <button
              className="neon-btn px-8 py-3 rounded-sm text-sm w-full"
              onClick={() => navigate("/renter/login")}
            >
              Войти в кабинет
            </button>
          </div>
        ) : (
          <div className="glass-card rounded-sm p-8 animate-fade-in">
            <div className="mb-7">
              <h1 className="font-oswald text-3xl font-bold text-white tracking-wide mb-1">
                Стать партнёром
              </h1>
              <p className="text-gray-400 text-sm">
                Разместите своё оборудование на нашей платформе
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Company name */}
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-oswald">
                  Название компании <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={form.company_name}
                  onChange={handleChange}
                  placeholder="ООО «Название»"
                  className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                  disabled={loading}
                />
              </div>

              {/* Contact name */}
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-oswald">
                  Контактное лицо <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  name="contact_name"
                  value={form.contact_name}
                  onChange={handleChange}
                  placeholder="Иванов Иван"
                  className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                  disabled={loading}
                />
              </div>

              {/* Email + Phone row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-oswald">
                    Email <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@company.ru"
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-oswald">
                    Телефон <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+7 (999) 000-00-00"
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* City + Telegram row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-oswald">
                    Город
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Санкт-Петербург"
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-oswald">
                    Telegram
                  </label>
                  <input
                    type="text"
                    name="telegram"
                    value={form.telegram}
                    onChange={handleChange}
                    placeholder="@username"
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-oswald">
                    Пароль <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Минимум 6 символов"
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-oswald">
                    Повтор пароля <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="confirm_password"
                    value={form.confirm_password}
                    onChange={handleChange}
                    placeholder="Повторите пароль"
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-sm px-4 py-2.5">
                  <Icon name="AlertCircle" size={14} className="text-red-400 shrink-0" />
                  <span className="text-red-400 text-sm">{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="neon-btn w-full py-3 rounded-sm text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Icon name="Loader2" size={16} className="animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Icon name="Send" size={16} />
                    Отправить заявку
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/5 text-center">
              <span className="text-gray-500 text-sm">Уже есть аккаунт? </span>
              <button
                className="text-amber-500 text-sm hover:text-amber-400 transition-colors font-medium"
                onClick={() => navigate("/renter/login")}
              >
                Войти
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
