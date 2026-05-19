import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const URLS = func2url as Record<string, string>;

// ── Types ─────────────────────────────────────────────────────────────────────

type StaffProfile = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type QuoteItem = {
  name: string;
  price: number;
  qty: number;
  unit: string;
};

type Quote = {
  id: number;
  token: string;
  title: string;
  days: number;
  total: number;
  status: string;
  created_at: string;
  sent_at: string | null;
  staff_id?: number;
  event_date?: string;
  delivery_address?: string;
};

type Contract = {
  id: number;
  quote_id: number;
  quote_title: string;
  client_type: "individual" | "company";
  full_name: string;
  company_name: string;
  phone: string;
  email: string;
  status: string;
  created_at: string;
  total: number;
  signed_at?: string | null;
  contract_pdf_url?: string | null;
  paid?: boolean;
  paid_at?: string | null;
  event_date?: string;
  delivery_address?: string;
  staff_id?: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const quoteBadge = (status: string) => {
  const map: Record<string, { label: string; color: string }> = {
    draft:      { label: "Черновик",    color: "text-gray-500 border-gray-700" },
    sent:       { label: "Отправлено",  color: "text-blue-400 border-blue-500/40" },
    approved:   { label: "Согласовано", color: "text-green-400 border-green-500/40" },
    contracted: { label: "Договор",     color: "text-amber-500 border-amber-500/40" },
  };
  const s = map[status] ?? { label: status, color: "text-gray-400 border-gray-600" };
  return (
    <span className={`text-xs border rounded-sm px-2 py-0.5 ${s.color}`}>{s.label}</span>
  );
};

const contractBadge = (status: string) => {
  const map: Record<string, { label: string; color: string }> = {
    pending:  { label: "Ожидает",      color: "text-yellow-400 border-yellow-500/40" },
    reviewed: { label: "Просмотрено",  color: "text-green-400 border-green-500/40" },
    signed:   { label: "ПЭП подписан", color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/5" },
  };
  const s = map[status] ?? { label: status, color: "text-gray-400 border-gray-600" };
  return (
    <span className={`text-xs border rounded-sm px-2 py-0.5 ${s.color}`}>{s.label}</span>
  );
};

const iCls =
  "w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors";

const EMPTY_ITEM: QuoteItem = { name: "", price: 0, qty: 1, unit: "шт" };

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffDashboard() {
  const navigate = useNavigate();

  // ── Auth state ──
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminPwd, setAdminPwd] = useState(() => sessionStorage.getItem("staff_admin_pwd") ?? "");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [profile, setProfile] = useState<StaffProfile | null>(null);

  // ── Dashboard tab ──
  const [tab, setTab] = useState<"quotes" | "contracts">("quotes");

  // ── Quotes ──
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState("");

  // ── New quote form ──
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [qTitle, setQTitle] = useState("");
  const [qEventDate, setQEventDate] = useState("");
  const [qAddress, setQAddress] = useState("");
  const [qDays, setQDays] = useState(1);
  const [qItems, setQItems] = useState<QuoteItem[]>([{ ...EMPTY_ITEM }]);
  const [qSaving, setQSaving] = useState(false);
  const [qSaveError, setQSaveError] = useState("");
  const [qSaveOk, setQSaveOk] = useState(false);

  // ── Contracts ──
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractsError, setContractsError] = useState("");
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // ── Restore session ──
  useEffect(() => {
    const token = localStorage.getItem("staff_token");
    const storedProfile = localStorage.getItem("staff_profile");
    if (token && storedProfile) {
      try {
        setProfile(JSON.parse(storedProfile) as StaffProfile);
      } catch {
        localStorage.removeItem("staff_token");
        localStorage.removeItem("staff_profile");
      }
    }
  }, []);

  // ── Load initial data when profile is ready ──
  useEffect(() => {
    if (!profile) return;
    loadQuotes();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── computed quote total ──
  const qTotal = qItems.reduce((sum, it) => sum + it.price * it.qty, 0);

  // ── Login ──
  const handleLogin = async () => {
    if (!email || !password || !adminPwd) {
      setAuthError("Заполните все поля");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${URLS["staff-auth"]}?action=login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAuthError(data.error ?? "Неверный логин или пароль");
        return;
      }
      // Verify admin pwd works against manage-quotes
      const checkRes = await fetch(
        `${URLS["manage-quotes"]}?pwd=${encodeURIComponent(adminPwd)}`
      );
      if (!checkRes.ok) {
        setAuthError("Неверный системный пароль");
        return;
      }
      const prof: StaffProfile = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role ?? "manager",
      };
      localStorage.setItem("staff_token", data.token);
      localStorage.setItem("staff_profile", JSON.stringify(prof));
      sessionStorage.setItem("staff_admin_pwd", adminPwd);
      setProfile(prof);
    } catch {
      setAuthError("Ошибка подключения к серверу");
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Logout ──
  const handleLogout = () => {
    localStorage.removeItem("staff_token");
    localStorage.removeItem("staff_profile");
    sessionStorage.removeItem("staff_admin_pwd");
    setProfile(null);
    setQuotes([]);
    setContracts([]);
  };

  // ── Load quotes ──
  const loadQuotes = useCallback(async () => {
    if (!profile) return;
    const pwd = sessionStorage.getItem("staff_admin_pwd") ?? adminPwd;
    setQuotesLoading(true);
    setQuotesError("");
    try {
      const res = await fetch(
        `${URLS["manage-quotes"]}?pwd=${encodeURIComponent(pwd)}&staff_id=${profile.id}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      setQuotes(Array.isArray(data) ? data : data.quotes ?? []);
    } catch (e) {
      setQuotesError(e instanceof Error ? e.message : "Ошибка загрузки КП");
    } finally {
      setQuotesLoading(false);
    }
  }, [profile, adminPwd]);

  // ── Load contracts ──
  const loadContracts = useCallback(async () => {
    if (!profile) return;
    const pwd = sessionStorage.getItem("staff_admin_pwd") ?? adminPwd;
    setContractsLoading(true);
    setContractsError("");
    try {
      const res = await fetch(
        `${URLS["get-contracts"]}?pwd=${encodeURIComponent(pwd)}&staff_id=${profile.id}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      setContracts(Array.isArray(data) ? data : data.contracts ?? []);
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : "Ошибка загрузки договоров");
    } finally {
      setContractsLoading(false);
    }
  }, [profile, adminPwd]);

  // ── Switch tab → load data ──
  useEffect(() => {
    if (!profile) return;
    if (tab === "quotes") loadQuotes();
    if (tab === "contracts") loadContracts();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Quote items helpers ──
  const addItem = () => setQItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) =>
    setQItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof QuoteItem, val: string | number) =>
    setQItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: val } : it))
    );

  const resetQuoteForm = () => {
    setQTitle("");
    setQEventDate("");
    setQAddress("");
    setQDays(1);
    setQItems([{ ...EMPTY_ITEM }]);
    setQSaveError("");
    setQSaveOk(false);
  };

  // ── Save new quote ──
  const saveQuote = async () => {
    if (!profile) return;
    if (!qTitle.trim()) { setQSaveError("Укажите название КП"); return; }
    if (qItems.some((it) => !it.name.trim())) { setQSaveError("Заполните названия всех позиций"); return; }
    const pwd = sessionStorage.getItem("staff_admin_pwd") ?? adminPwd;
    setQSaving(true);
    setQSaveError("");
    setQSaveOk(false);
    try {
      const body = {
        title: qTitle.trim(),
        event_date: qEventDate || null,
        delivery_address: qAddress || null,
        days: qDays,
        items: qItems.map((it) => ({
          name: it.name,
          price: it.price,
          qty: it.qty,
          unit: it.unit,
          subtotal: it.price * it.qty,
        })),
        total: qTotal,
        staff_id: profile.id,
      };
      const res = await fetch(`${URLS["manage-quotes"]}?pwd=${encodeURIComponent(pwd)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Staff-Token": localStorage.getItem("staff_token") ?? "",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      setQSaveOk(true);
      resetQuoteForm();
      setShowQuoteForm(false);
      await loadQuotes();
    } catch (e) {
      setQSaveError(e instanceof Error ? e.message : "Ошибка сохранения КП");
    } finally {
      setQSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // LOGIN SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (!profile) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "var(--surface)" }}
      >
        <div className="glass-card neon-border rounded-sm p-10 max-w-sm w-full">
          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 mb-8 group"
          >
            <div className="w-8 h-8 border border-amber-500/40 rounded-sm flex items-center justify-center group-hover:border-amber-500 transition-colors">
              <Icon name="Zap" size={16} className="text-amber-500" />
            </div>
            <span className="font-oswald text-white text-lg uppercase tracking-widest">
              Global<span className="text-amber-500">Renta</span>
            </span>
          </button>

          <div className="mb-6">
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Кабинет сотрудника</p>
            <h1 className="font-oswald text-2xl font-bold text-white uppercase">Вход</h1>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="manager@company.ru"
                className={iCls}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                Пароль сотрудника
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                className={iCls}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                Системный пароль
              </label>
              <input
                type="password"
                value={adminPwd}
                onChange={(e) => setAdminPwd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                className={iCls}
                autoComplete="off"
              />
              <p className="text-gray-600 text-xs mt-1.5">
                Системный пароль — уточните у руководителя
              </p>
            </div>
          </div>

          {authError && (
            <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
              <Icon name="AlertCircle" size={14} />
              {authError}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={authLoading || !email || !password || !adminPwd}
            className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-40 mt-5"
          >
            {authLoading ? (
              <Icon name="Loader2" size={16} className="animate-spin" />
            ) : (
              <Icon name="LogIn" size={16} />
            )}
            Войти
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "var(--surface)" }}>
      {/* ── Header ── */}
      <header className="border-b border-amber-500/10 bg-[#0d1117]/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 group"
          >
            <div className="w-7 h-7 border border-amber-500/40 rounded-sm flex items-center justify-center group-hover:border-amber-500 transition-colors">
              <Icon name="Zap" size={14} className="text-amber-500" />
            </div>
            <span className="font-oswald text-white uppercase tracking-widest text-base">
              Global<span className="text-amber-500">Renta</span>
            </span>
          </button>

          {/* Profile + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 rounded-sm bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Icon name="User" size={14} className="text-amber-500" />
              </div>
              <div className="text-right">
                <p className="text-white text-sm font-medium leading-none">{profile.name}</p>
                <p className="text-gray-500 text-xs mt-0.5 capitalize">{profile.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 border border-gray-700 hover:border-red-500/50 text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-sm text-xs transition-colors"
            >
              <Icon name="LogOut" size={13} />
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page title */}
        <div className="mb-6">
          <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Кабинет</p>
          <h1 className="font-oswald text-3xl font-bold text-white uppercase">
            Менеджер
          </h1>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-6 border-b border-amber-500/10">
          {(
            [
              { key: "quotes", label: "Коммерческие предложения", icon: "FileText" },
              { key: "contracts", label: "Договоры", icon: "FileCheck" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm transition-all border-b-2 -mb-px ${
                tab === t.key
                  ? "border-amber-500 text-amber-500"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* QUOTES TAB                                                          */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === "quotes" && (
          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <button
                onClick={() => {
                  resetQuoteForm();
                  setShowQuoteForm(true);
                }}
                className="neon-btn flex items-center gap-2 px-4 py-2 rounded-sm text-sm"
              >
                <Icon name="FilePlus" size={14} />
                Создать КП
              </button>
              <button
                onClick={loadQuotes}
                disabled={quotesLoading}
                className="flex items-center gap-2 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-4 py-2 rounded-sm text-sm transition-colors"
              >
                <Icon name="RefreshCw" size={14} className={quotesLoading ? "animate-spin" : ""} />
                Обновить
              </button>
            </div>

            {/* ── New quote form ── */}
            {showQuoteForm && (
              <div className="glass-card rounded-sm p-6 mb-6 border border-amber-500/20">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-oswald text-xl font-bold text-white uppercase">
                    Новое коммерческое предложение
                  </h2>
                  <button
                    onClick={() => {
                      setShowQuoteForm(false);
                      resetQuoteForm();
                    }}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    <Icon name="X" size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                      Название КП *
                    </label>
                    <input
                      type="text"
                      value={qTitle}
                      onChange={(e) => setQTitle(e.target.value)}
                      placeholder="Например: Аренда оборудования для конференции"
                      className={iCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                      Дата мероприятия
                    </label>
                    <input
                      type="date"
                      value={qEventDate}
                      onChange={(e) => setQEventDate(e.target.value)}
                      className={iCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                      Дней аренды
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={qDays}
                      onChange={(e) => setQDays(Math.max(1, Number(e.target.value)))}
                      className={iCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                      Адрес доставки
                    </label>
                    <input
                      type="text"
                      value={qAddress}
                      onChange={(e) => setQAddress(e.target.value)}
                      placeholder="г. Москва, ул. Примерная, 1"
                      className={iCls}
                    />
                  </div>
                </div>

                {/* Items */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-500 uppercase tracking-wider">
                      Позиции
                    </label>
                    <button
                      onClick={addItem}
                      className="flex items-center gap-1 text-amber-500 hover:text-amber-400 text-xs transition-colors"
                    >
                      <Icon name="Plus" size={12} />
                      Добавить позицию
                    </button>
                  </div>

                  <div className="space-y-2">
                    {/* Header row */}
                    <div className="grid grid-cols-12 gap-2 text-xs text-gray-600 uppercase tracking-wider px-1 hidden sm:grid">
                      <div className="col-span-5">Наименование</div>
                      <div className="col-span-2 text-right">Цена, ₽</div>
                      <div className="col-span-2 text-center">Кол-во</div>
                      <div className="col-span-2">Ед.</div>
                      <div className="col-span-1" />
                    </div>

                    {qItems.map((it, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center"
                      >
                        <div className="col-span-12 sm:col-span-5">
                          <input
                            type="text"
                            value={it.name}
                            onChange={(e) => updateItem(idx, "name", e.target.value)}
                            placeholder="Название позиции"
                            className={iCls}
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <input
                            type="number"
                            min={0}
                            value={it.price || ""}
                            onChange={(e) => updateItem(idx, "price", Number(e.target.value))}
                            placeholder="0"
                            className={iCls + " text-right"}
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <input
                            type="number"
                            min={1}
                            value={it.qty}
                            onChange={(e) =>
                              updateItem(idx, "qty", Math.max(1, Number(e.target.value)))
                            }
                            className={iCls + " text-center"}
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <input
                            type="text"
                            value={it.unit}
                            onChange={(e) => updateItem(idx, "unit", e.target.value)}
                            placeholder="шт"
                            className={iCls}
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button
                            onClick={() => removeItem(idx)}
                            disabled={qItems.length === 1}
                            className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30"
                          >
                            <Icon name="Trash2" size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-end mb-5">
                  <div className="glass-card rounded-sm px-5 py-3 border border-amber-500/10">
                    <span className="text-gray-500 text-sm mr-3">Итого:</span>
                    <span className="font-oswald text-xl font-bold neon-text">
                      {qTotal.toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                </div>

                {qSaveError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
                    <Icon name="AlertCircle" size={14} />
                    {qSaveError}
                  </div>
                )}
                {qSaveOk && (
                  <div className="flex items-center gap-2 text-green-400 text-sm mb-3">
                    <Icon name="CheckCircle" size={14} />
                    КП успешно создано
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={saveQuote}
                    disabled={qSaving}
                    className="neon-btn flex items-center gap-2 px-6 py-2.5 rounded-sm text-sm disabled:opacity-40"
                  >
                    {qSaving ? (
                      <Icon name="Loader2" size={14} className="animate-spin" />
                    ) : (
                      <Icon name="Save" size={14} />
                    )}
                    Сохранить КП
                  </button>
                  <button
                    onClick={() => {
                      setShowQuoteForm(false);
                      resetQuoteForm();
                    }}
                    className="flex items-center gap-2 border border-gray-700 text-gray-400 hover:text-white px-5 py-2.5 rounded-sm text-sm transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {/* ── Quotes list ── */}
            {quotesError && (
              <div className="glass-card rounded-sm p-4 mb-4 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm">
                <Icon name="AlertCircle" size={14} />
                {quotesError}
              </div>
            )}

            {quotesLoading ? (
              <div className="glass-card rounded-sm p-16 flex items-center justify-center gap-3 text-gray-500">
                <Icon name="Loader2" size={20} className="animate-spin" />
                Загрузка...
              </div>
            ) : quotes.length === 0 ? (
              <div className="glass-card rounded-sm p-16 text-center">
                <Icon name="FileText" size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500">КП пока нет</p>
                <p className="text-gray-600 text-sm mt-1">
                  Нажмите «Создать КП» чтобы добавить первое
                </p>
              </div>
            ) : (
              <div className="glass-card rounded-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-amber-500/10 text-left">
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
                          Название
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
                          Статус
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right">
                          Сумма
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
                          Создано
                        </th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((q, i) => (
                        <tr
                          key={q.id}
                          className={`border-b border-amber-500/5 transition-colors ${
                            i % 2 === 0 ? "" : "bg-white/[0.01]"
                          }`}
                        >
                          <td className="px-4 py-3 text-white font-medium max-w-[220px] truncate">
                            {q.title}
                          </td>
                          <td className="px-4 py-3">{quoteBadge(q.status)}</td>
                          <td className="px-4 py-3 text-right font-oswald font-bold neon-text">
                            {(q.total ?? 0).toLocaleString("ru-RU")} ₽
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {fmt(q.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            {q.token && (
                              <a
                                href={`/quote/${q.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-amber-500 hover:text-amber-400 text-xs transition-colors whitespace-nowrap"
                              >
                                <Icon name="ExternalLink" size={12} />
                                Открыть ссылку
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* CONTRACTS TAB                                                       */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === "contracts" && (
          <div>
            {/* Toolbar */}
            <div className="flex justify-end mb-4">
              <button
                onClick={loadContracts}
                disabled={contractsLoading}
                className="flex items-center gap-2 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-4 py-2 rounded-sm text-sm transition-colors"
              >
                <Icon
                  name="RefreshCw"
                  size={14}
                  className={contractsLoading ? "animate-spin" : ""}
                />
                Обновить
              </button>
            </div>

            {contractsError && (
              <div className="glass-card rounded-sm p-4 mb-4 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm">
                <Icon name="AlertCircle" size={14} />
                {contractsError}
              </div>
            )}

            {contractsLoading ? (
              <div className="glass-card rounded-sm p-16 flex items-center justify-center gap-3 text-gray-500">
                <Icon name="Loader2" size={20} className="animate-spin" />
                Загрузка...
              </div>
            ) : contracts.length === 0 ? (
              <div className="glass-card rounded-sm p-16 text-center">
                <Icon name="FileCheck" size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500">Договоров пока нет</p>
              </div>
            ) : (
              <div className="glass-card rounded-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-amber-500/10 text-left">
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
                          Клиент
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
                          КП
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
                          Дата
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right">
                          Сумма
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
                          Статус
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
                          Оплата
                        </th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((c, i) => (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedContract(c)}
                          className={`border-b border-amber-500/5 hover:bg-amber-500/5 cursor-pointer transition-colors ${
                            c.status === "pending"
                              ? "bg-amber-500/5"
                              : i % 2 === 0
                              ? ""
                              : "bg-white/[0.01]"
                          }`}
                        >
                          <td className="px-4 py-3 text-white font-medium">
                            {c.client_type === "individual"
                              ? c.full_name
                              : c.company_name}
                          </td>
                          <td className="px-4 py-3 text-gray-300 max-w-[140px] truncate">
                            {c.quote_title}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {fmtDate(c.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right font-oswald font-bold neon-text">
                            {(c.total ?? 0).toLocaleString("ru-RU")} ₽
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {contractBadge(c.status)}
                              {c.signed_at && (
                                <Icon
                                  name="ShieldCheck"
                                  size={13}
                                  className="text-emerald-400"
                                  title="ПЭП подписан"
                                />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {c.signed_at &&
                              (c.paid ? (
                                <span className="text-xs text-green-400 border border-green-500/30 px-2 py-0.5 rounded-sm">
                                  Оплачен
                                </span>
                              ) : (
                                <span className="text-xs text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-sm">
                                  Ожидает
                                </span>
                              ))}
                          </td>
                          <td className="px-4 py-3">
                            <Icon name="ChevronRight" size={16} className="text-gray-600" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* CONTRACT SIDE PANEL                                                    */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {selectedContract && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setSelectedContract(null)}
          />

          {/* Panel */}
          <aside className="fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col bg-[#0d1117] border-l border-amber-500/15 shadow-2xl overflow-y-auto">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/10">
              <h2 className="font-oswald text-lg font-bold text-white uppercase">
                Договор #{selectedContract.id}
              </h2>
              <button
                onClick={() => setSelectedContract(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <Icon name="X" size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 flex-1">
              {/* Client info */}
              <section>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                  Клиент
                </p>
                <div className="glass-card rounded-sm p-4 space-y-3">
                  <Row
                    label="Имя"
                    value={
                      selectedContract.client_type === "individual"
                        ? selectedContract.full_name
                        : selectedContract.company_name
                    }
                  />
                  <Row label="Телефон" value={selectedContract.phone || "—"} />
                  <Row label="Email" value={selectedContract.email || "—"} />
                </div>
              </section>

              {/* Quote / event */}
              <section>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                  Мероприятие
                </p>
                <div className="glass-card rounded-sm p-4 space-y-3">
                  <Row label="КП" value={selectedContract.quote_title} />
                  <Row
                    label="Дата мероприятия"
                    value={fmtDate(selectedContract.event_date)}
                  />
                  <Row
                    label="Адрес"
                    value={selectedContract.delivery_address || "—"}
                  />
                  <Row
                    label="Сумма"
                    value={`${(selectedContract.total ?? 0).toLocaleString("ru-RU")} ₽`}
                    accent
                  />
                </div>
              </section>

              {/* Status */}
              <section>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                  Статус
                </p>
                <div className="glass-card rounded-sm p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">Статус</span>
                    {contractBadge(selectedContract.status)}
                  </div>
                  <Row
                    label="Дата подписания"
                    value={fmt(selectedContract.signed_at)}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">Оплата</span>
                    {selectedContract.paid ? (
                      <span className="text-xs text-green-400 border border-green-500/30 px-2 py-0.5 rounded-sm">
                        Оплачен {fmtDate(selectedContract.paid_at)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </div>
                </div>
              </section>

              {/* PDF */}
              {selectedContract.contract_pdf_url && (
                <section>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                    Документ
                  </p>
                  <a
                    href={selectedContract.contract_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-card rounded-sm p-4 flex items-center gap-3 hover:border-amber-500/30 transition-colors group"
                  >
                    <Icon
                      name="FileText"
                      size={20}
                      className="text-amber-500 shrink-0"
                    />
                    <span className="text-gray-300 group-hover:text-white transition-colors text-sm">
                      Скачать PDF договора
                    </span>
                    <Icon
                      name="ExternalLink"
                      size={14}
                      className="text-gray-600 ml-auto"
                    />
                  </a>
                </section>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

// ── Small helper component ────────────────────────────────────────────────────
function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 text-sm shrink-0">{label}</span>
      <span
        className={`text-sm text-right ${
          accent ? "font-oswald font-bold neon-text" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
