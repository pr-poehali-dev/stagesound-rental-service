import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const URLS = func2url as Record<string, string>;

export default function RenterLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Введите email и пароль");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${URLS["renter-auth"]}?action=login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Неверный email или пароль");

      const token: string = data.token || "";
      const status: string = data.status || "pending";

      localStorage.setItem("renter_token", token);
      localStorage.setItem("renter_status", status);

      navigate("/renter/dashboard");
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
      {/* Logo */}
      <div className="mb-8 text-center">
        <span
          className="font-oswald text-2xl font-bold tracking-widest neon-text cursor-pointer"
          onClick={() => navigate("/")}
        >
          GLOBALRENTA
        </span>
        <div className="w-16 h-0.5 bg-amber-500 mx-auto mt-2 opacity-60" />
      </div>

      <div className="w-full max-w-sm">
        <div className="glass-card rounded-sm p-8 animate-fade-in">
          <div className="mb-7">
            <h1 className="font-oswald text-3xl font-bold text-white tracking-wide mb-1">
              Кабинет партнёра
            </h1>
            <p className="text-gray-400 text-sm">Войдите в свой аккаунт прокатчика</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-oswald">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.ru"
                autoComplete="email"
                className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-oswald">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ваш пароль"
                autoComplete="current-password"
                className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-sm px-4 py-2.5">
                <Icon name="AlertCircle" size={14} className="text-red-400 shrink-0" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="neon-btn w-full py-3 rounded-sm text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Icon name="Loader2" size={16} className="animate-spin" />
                  Вход...
                </>
              ) : (
                <>
                  <Icon name="LogIn" size={16} />
                  Войти
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <span className="text-gray-500 text-sm">Ещё нет аккаунта? </span>
            <button
              className="text-amber-500 text-sm hover:text-amber-400 transition-colors font-medium"
              onClick={() => navigate("/renter/register")}
            >
              Стать партнёром
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}