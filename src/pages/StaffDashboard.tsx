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

// ── Конфиг доставки и доп. услуг (идентично AdminQuote) ─────────────────────
const CITIES: Record<string, { label: string; zones: { name: string; defaultPrice: number }[] }> = {
  moscow: { label: "Москва", zones: [
    { name: "Без доставки", defaultPrice: 0 },
    { name: "Центр Москвы", defaultPrice: 4500 },
    { name: "Москва (в пределах МКАД)", defaultPrice: 6600 },
    { name: "Подмосковье (до 50 км)", defaultPrice: 10500 },
    { name: "Подмосковье (50–100 км)", defaultPrice: 16500 },
  ]},
  spb: { label: "Санкт-Петербург", zones: [
    { name: "Без доставки", defaultPrice: 0 },
    { name: "Центр СПб (внутри КАД)", defaultPrice: 4500 },
    { name: "Санкт-Петербург (за КАД)", defaultPrice: 6600 },
    { name: "Ленобласть (до 50 км)", defaultPrice: 10500 },
    { name: "Ленобласть (50–100 км)", defaultPrice: 16500 },
  ]},
  krasnoyarsk: { label: "Красноярск", zones: [
    { name: "Без доставки", defaultPrice: 0 },
    { name: "Центр Красноярска", defaultPrice: 4500 },
    { name: "Красноярск (все районы)", defaultPrice: 6600 },
    { name: "Пригород (до 50 км)", defaultPrice: 10500 },
    { name: "Красноярский край (50–100 км)", defaultPrice: 16500 },
  ]},
};

type ExtraService = { id: string; label: string; price: number };
const DEFAULT_EXTRAS: ExtraService[] = [
  { id: "install", label: "Монтаж и демонтаж", price: 15000 },
  { id: "tech",    label: "Техник на месте (1 день)", price: 12000 },
  { id: "sound",   label: "Звукорежиссёр (1 день)", price: 21000 },
  { id: "light",   label: "Световой оператор (1 день)", price: 19500 },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffDashboard() {
  const navigate = useNavigate();

  // ── Auth state ──
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [profile, setProfile] = useState<StaffProfile | null>(null);

  // ── Dashboard tab ──
  const [tab, setTab] = useState<"quotes" | "contracts">("quotes");

  // ── Quotes ──
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

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
  const [qShareLink, setQShareLink] = useState("");
  const [qCopied, setQCopied] = useState(false);

  // Скидка
  const [qDiscount, setQDiscount] = useState(0);
  const [qDiscountInput, setQDiscountInput] = useState("");

  // Коэффициент
  const [qUseCoeff, setQUseCoeff] = useState(false);
  const [qCoeffs, setQCoeffs] = useState<number[]>([1]);

  // Доставка
  const [qCityKey, setQCityKey] = useState("moscow");
  const [qZoneIdx, setQZoneIdx] = useState(0);
  const [qDeliveryPrices, setQDeliveryPrices] = useState<Record<string, number[]>>(
    Object.fromEntries(Object.entries(CITIES).map(([k, c]) => [k, c.zones.map(z => z.defaultPrice)]))
  );
  const [qDeliveryDate, setQDeliveryDate] = useState("");
  const [qDeliveryTime, setQDeliveryTime] = useState("");
  const [qPickupDate, setQPickupDate] = useState("");
  const [qPickupTime, setQPickupTime] = useState("");

  // Доп. услуги
  const [qExtras, setQExtras] = useState<ExtraService[]>(DEFAULT_EXTRAS.map(e => ({ ...e })));
  const [qSelectedExtras, setQSelectedExtras] = useState<string[]>([]);

  // Монтаж
  const [qNoInstall, setQNoInstall] = useState(false);
  const [qInstallDate, setQInstallDate] = useState("");
  const [qInstallTime, setQInstallTime] = useState("");
  const [qInstallPrice, setQInstallPrice] = useState(0);
  const [qDismantleDate, setQDismantleDate] = useState("");
  const [qDismantleTime, setQDismantleTime] = useState("");
  const [qDismantlePrice, setQDismantlePrice] = useState(0);

  // Пин
  const [qAccessPin, setQAccessPin] = useState("");

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

  // ── computed values ──
  const qCurrentCity = CITIES[qCityKey];
  const qCurrentPrices = qDeliveryPrices[qCityKey] ?? [];
  const qDeliveryTotal = qCurrentPrices[qZoneIdx] ?? 0;
  const qExtrasTotal = qSelectedExtras.reduce((s, id) => {
    const ex = qExtras.find(e => e.id === id);
    return s + (ex?.price ?? 0);
  }, 0);
  const qInstallTotal = qNoInstall ? 0 : (qInstallTime ? qInstallPrice : 0) + (qDismantleTime ? qDismantlePrice : 0);
  const qEqRaw = qItems.reduce((sum, it, idx) => {
    const mult = qUseCoeff ? (qCoeffs[idx] ?? 1) : qDays;
    return sum + it.price * it.qty * mult;
  }, 0);
  const qDiscountAmt = qDiscount > 0 ? Math.round(qEqRaw * qDiscount / 100) : 0;
  const qEqTotal = qEqRaw - qDiscountAmt;
  const qTotal = qEqTotal + qExtrasTotal + qDeliveryTotal + qInstallTotal;

  const fmtDT = (date: string, time: string) => {
    const parts = [date ? new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "", time].filter(Boolean);
    return parts.join(", ") || null;
  };

  // ── Login ──
  const handleLogin = async () => {
    if (!email || !password) {
      setAuthError("Введите email и пароль");
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
      const prof: StaffProfile = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role ?? "manager",
      };
      localStorage.setItem("staff_token", data.token);
      localStorage.setItem("staff_profile", JSON.stringify(prof));
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
    setProfile(null);
    setQuotes([]);
    setContracts([]);
  };

  // ── Load quotes ──
  const loadQuotes = useCallback(async () => {
    if (!profile) return;
    const token = localStorage.getItem("staff_token") ?? "";
    setQuotesLoading(true);
    setQuotesError("");
    try {
      const res = await fetch(
        `${URLS["manage-quotes"]}`,
        { headers: { "X-Staff-Token": token } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      setQuotes(Array.isArray(data) ? data : data.quotes ?? []);
    } catch (e) {
      setQuotesError(e instanceof Error ? e.message : "Ошибка загрузки КП");
    } finally {
      setQuotesLoading(false);
    }
  }, [profile]);

  // ── Load contracts ──
  const loadContracts = useCallback(async () => {
    if (!profile) return;
    const token = localStorage.getItem("staff_token") ?? "";
    setContractsLoading(true);
    setContractsError("");
    try {
      const res = await fetch(
        `${URLS["get-contracts"]}?staff_id=${profile.id}`,
        { headers: { "X-Staff-Token": token } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      setContracts(Array.isArray(data) ? data : data.contracts ?? []);
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : "Ошибка загрузки договоров");
    } finally {
      setContractsLoading(false);
    }
  }, [profile]);

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
    setQTitle(""); setQEventDate(""); setQAddress(""); setQDays(1);
    setQItems([{ ...EMPTY_ITEM }]); setQCoeffs([1]);
    setQDiscount(0); setQDiscountInput("");
    setQUseCoeff(false);
    setQCityKey("moscow"); setQZoneIdx(0);
    setQDeliveryDate(""); setQDeliveryTime(""); setQPickupDate(""); setQPickupTime("");
    setQExtras(DEFAULT_EXTRAS.map(e => ({ ...e }))); setQSelectedExtras([]);
    setQNoInstall(false); setQInstallDate(""); setQInstallTime(""); setQInstallPrice(0);
    setQDismantleDate(""); setQDismantleTime(""); setQDismantlePrice(0);
    setQAccessPin("");
    setQSaveError(""); setQSaveOk(false); setQShareLink(""); setQCopied(false);
  };

  // ── Save new quote ──
  const saveQuote = async () => {
    if (!profile) return;
    if (!qTitle.trim()) { setQSaveError("Укажите название КП"); return; }
    if (qItems.some((it) => !it.name.trim())) { setQSaveError("Заполните названия всех позиций"); return; }
    const staffToken = localStorage.getItem("staff_token") ?? "";
    setQSaving(true); setQSaveError(""); setQSaveOk(false);
    try {
      const deliveryName = qZoneIdx === 0 ? "Без доставки" : `${qCurrentCity.label} — ${qCurrentCity.zones[qZoneIdx].name}`;
      const extrasData = qSelectedExtras.map(id => {
        const ex = qExtras.find(e => e.id === id)!;
        return { id, name: ex.label, price: ex.price };
      });
      const body = {
        title: qTitle.trim(),
        event_date: qEventDate || null,
        delivery_address: qAddress || null,
        days: qUseCoeff ? 1 : qDays,
        use_coeff: qUseCoeff,
        items: qItems.map((it, idx) => ({
          name: it.name, price: it.price, qty: it.qty, unit: it.unit,
          coeff: qUseCoeff ? (qCoeffs[idx] ?? 1) : undefined,
        })),
        delivery: deliveryName,
        delivery_price: qDeliveryTotal,
        delivery_time: fmtDT(qDeliveryDate, qDeliveryTime) || null,
        pickup_time: fmtDT(qPickupDate, qPickupTime) || null,
        extras: extrasData,
        no_installation: qNoInstall,
        installation_time: qNoInstall ? null : (fmtDT(qInstallDate, qInstallTime) || null),
        installation_price: qNoInstall ? 0 : (qInstallTime ? qInstallPrice : 0),
        dismantling_time: qNoInstall ? null : (fmtDT(qDismantleDate, qDismantleTime) || null),
        dismantling_price: qNoInstall ? 0 : (qDismantleTime ? qDismantlePrice : 0),
        discount: qDiscount,
        access_pin: qAccessPin.trim() || null,
        total: qTotal,
        staff_id: profile.id,
      };
      const res = await fetch(`${URLS["manage-quotes"]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Staff-Token": staffToken },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      // Помечаем как отправленное и получаем ссылку
      await fetch(`${URLS["manage-quotes"]}?action=send&id=${data.id}`, {
        method: "POST",
        headers: { "X-Staff-Token": staffToken },
      });
      setQShareLink(`${window.location.origin}/quote/${data.token}`);
      setQSaveOk(true);
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
          </div>

          {authError && (
            <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
              <Icon name="AlertCircle" size={14} />
              {authError}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={authLoading || !email || !password}
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
              <div className="mb-6 border border-amber-500/20 rounded-sm">

                {/* Шапка */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/10">
                  <h2 className="font-oswald text-xl font-bold text-white uppercase">Новое коммерческое предложение</h2>
                  <button onClick={() => { setShowQuoteForm(false); resetQuoteForm(); }} className="text-gray-500 hover:text-white transition-colors">
                    <Icon name="X" size={18} />
                  </button>
                </div>

                {/* Если КП создано — показываем ссылку */}
                {qShareLink ? (
                  <div className="p-6 text-center">
                    <Icon name="CheckCircle" size={40} className="text-amber-500 mx-auto mb-3" />
                    <h3 className="font-oswald text-xl font-bold text-white uppercase mb-1">КП готово!</h3>
                    <p className="text-gray-400 text-sm mb-4">Отправьте эту ссылку клиенту</p>
                    <div className="bg-black/40 border border-amber-500/30 rounded-sm px-4 py-3 text-amber-400 text-sm break-all mb-4 text-left">{qShareLink}</div>
                    <div className="flex gap-3 justify-center flex-wrap">
                      <button onClick={() => { navigator.clipboard.writeText(qShareLink); setQCopied(true); setTimeout(() => setQCopied(false), 2000); }}
                        className="neon-btn flex items-center gap-2 px-5 py-2 rounded-sm text-sm">
                        <Icon name={qCopied ? "Check" : "Copy"} size={14} />
                        {qCopied ? "Скопировано!" : "Скопировать ссылку"}
                      </button>
                      <button onClick={() => { resetQuoteForm(); }} className="border border-gray-700 text-gray-400 px-5 py-2 rounded-sm text-sm hover:border-gray-500 transition-colors">
                        Создать ещё КП
                      </button>
                      <button onClick={() => { setShowQuoteForm(false); resetQuoteForm(); }} className="border border-gray-700 text-gray-400 px-5 py-2 rounded-sm text-sm hover:border-gray-500 transition-colors">
                        Закрыть
                      </button>
                    </div>
                  </div>
                ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-0">

                  {/* ── Левая часть: позиции ── */}
                  <div className="xl:col-span-2 p-6 border-r border-amber-500/10 space-y-4">

                    {/* Позиции */}
                    <div className="glass-card rounded-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs text-gray-500 uppercase tracking-wider">Позиции</h3>
                        <button onClick={() => { addItem(); setQCoeffs(prev => [...prev, 1]); }}
                          className="flex items-center gap-1 text-amber-500 hover:text-amber-400 text-xs transition-colors">
                          <Icon name="Plus" size={12} /> Добавить позицию
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 text-xs text-gray-600 uppercase tracking-wider px-1 hidden sm:grid">
                          <div className="col-span-5">Наименование</div>
                          <div className="col-span-2 text-right">Цена, ₽</div>
                          <div className="col-span-2 text-center">Кол-во</div>
                          <div className="col-span-2">Ед.</div>
                          {qUseCoeff && <div className="col-span-1 text-center">К</div>}
                          <div className="col-span-1" />
                        </div>
                        {qItems.map((it, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-12 sm:col-span-5">
                              <input type="text" value={it.name} onChange={e => updateItem(idx, "name", e.target.value)} placeholder="Название позиции" className={iCls} />
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                              <input type="number" min={0} value={it.price || ""} onChange={e => updateItem(idx, "price", Number(e.target.value))} placeholder="0" className={iCls + " text-right"} />
                            </div>
                            <div className="col-span-3 sm:col-span-2">
                              <input type="number" min={1} value={it.qty} onChange={e => updateItem(idx, "qty", Math.max(1, Number(e.target.value)))} className={iCls + " text-center"} />
                            </div>
                            <div className={qUseCoeff ? "col-span-2 sm:col-span-1" : "col-span-4 sm:col-span-2"}>
                              <input type="text" value={it.unit} onChange={e => updateItem(idx, "unit", e.target.value)} placeholder="шт" className={iCls} />
                            </div>
                            {qUseCoeff && (
                              <div className="col-span-2 sm:col-span-1">
                                <input type="number" step="0.1" min="0.1" value={qCoeffs[idx] ?? 1}
                                  onChange={e => setQCoeffs(prev => prev.map((c, i) => i === idx ? Math.max(0.1, Number(e.target.value) || 1) : c))}
                                  className={iCls + " text-center"} />
                              </div>
                            )}
                            <div className="col-span-1 flex justify-center">
                              <button onClick={() => { removeItem(idx); setQCoeffs(prev => prev.filter((_, i) => i !== idx)); }}
                                disabled={qItems.length === 1} className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30">
                                <Icon name="Trash2" size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Город и доставка */}
                    <div className="glass-card rounded-sm p-4">
                      <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Город и доставка</h3>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Город</label>
                          <select value={qCityKey} onChange={e => { setQCityKey(e.target.value); setQZoneIdx(0); }}
                            className="w-full border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none" style={{ background: "#111" }}>
                            {Object.entries(CITIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Зона</label>
                          <select value={qZoneIdx} onChange={e => setQZoneIdx(Number(e.target.value))}
                            className="w-full border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none" style={{ background: "#111" }}>
                            {qCurrentCity.zones.map((z, i) => <option key={i} value={i}>{z.name}{i > 0 ? ` — ${qCurrentPrices[i]?.toLocaleString()} ₽` : ""}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Привоз</label>
                          <div className="flex gap-1">
                            <input type="date" value={qDeliveryDate} onChange={e => setQDeliveryDate(e.target.value)} className="w-28 bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-white focus:outline-none" />
                            <input value={qDeliveryTime} onChange={e => setQDeliveryTime(e.target.value)} placeholder="08:00–10:00" className={iCls} />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Увоз</label>
                          <div className="flex gap-1">
                            <input type="date" value={qPickupDate} onChange={e => setQPickupDate(e.target.value)} className="w-28 bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-white focus:outline-none" />
                            <input value={qPickupTime} onChange={e => setQPickupTime(e.target.value)} placeholder="23:00–01:00" className={iCls} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Монтаж */}
                    <div className="glass-card rounded-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs text-gray-500 uppercase tracking-wider">Монтаж и демонтаж</h3>
                        <button onClick={() => setQNoInstall(v => !v)}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border transition-colors ${qNoInstall ? "border-green-500/50 text-green-400 bg-green-500/10" : "border-amber-500/20 text-gray-500 hover:text-white"}`}>
                          <Icon name={qNoInstall ? "CheckCircle" : "Circle"} size={12} /> Монтаж не нужен
                        </button>
                      </div>
                      {qNoInstall ? (
                        <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-sm px-3 py-2.5">
                          <Icon name="CheckCircle" size={14} className="text-green-400" />
                          <p className="text-green-400 text-sm">Монтаж и демонтаж не требуются</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-gray-600 block mb-1">Монтаж</label>
                            <div className="flex gap-2">
                              <input type="date" value={qInstallDate} onChange={e => setQInstallDate(e.target.value)} className="w-32 bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-white focus:outline-none" />
                              <input value={qInstallTime} onChange={e => setQInstallTime(e.target.value)} placeholder="10:00–14:00" className={iCls} />
                              <input type="number" value={qInstallPrice || ""} onChange={e => setQInstallPrice(Number(e.target.value))} placeholder="₽" className="w-20 bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-white text-right focus:outline-none" />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 block mb-1">Демонтаж</label>
                            <div className="flex gap-2">
                              <input type="date" value={qDismantleDate} onChange={e => setQDismantleDate(e.target.value)} className="w-32 bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-white focus:outline-none" />
                              <input value={qDismantleTime} onChange={e => setQDismantleTime(e.target.value)} placeholder="23:00–02:00" className={iCls} />
                              <input type="number" value={qDismantlePrice || ""} onChange={e => setQDismantlePrice(Number(e.target.value))} placeholder="₽" className="w-20 bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-white text-right focus:outline-none" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Доп. услуги */}
                    <div className="glass-card rounded-sm p-4">
                      <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Доп. услуги</h3>
                      <div className="space-y-2">
                        {qExtras.map(ex => (
                          <div key={ex.id} className="flex items-center gap-2">
                            <input type="checkbox" checked={qSelectedExtras.includes(ex.id)}
                              onChange={() => setQSelectedExtras(prev => prev.includes(ex.id) ? prev.filter(id => id !== ex.id) : [...prev, ex.id])}
                              className="w-4 h-4 accent-amber-500 shrink-0" />
                            <span className="text-gray-400 text-sm flex-1">{ex.label}</span>
                            <input type="number" value={ex.price}
                              onChange={e => setQExtras(prev => prev.map(e2 => e2.id === ex.id ? { ...e2, price: Number(e.target.value) } : e2))}
                              className="w-24 bg-transparent border border-amber-500/20 rounded-sm px-2 py-1 text-sm text-white text-right focus:outline-none" />
                            <span className="text-gray-600 text-xs">₽</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Правая часть: настройки и итого ── */}
                  <div className="xl:col-span-1 p-6 space-y-4">

                    {/* Инфо о мероприятии */}
                    <div className="glass-card rounded-sm p-4 space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Название КП *</label>
                        <input value={qTitle} onChange={e => setQTitle(e.target.value)} placeholder="Мероприятие, событие..." className={iCls} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Дата мероприятия</label>
                        <input type="date" value={qEventDate} onChange={e => setQEventDate(e.target.value)} className={iCls} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Адрес</label>
                        <input value={qAddress} onChange={e => setQAddress(e.target.value)} placeholder="г. Москва, ул. Примерная, 1" className={iCls} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                          <Icon name="Lock" size={11} className="inline mr-1 text-amber-500" /> Пин-код доступа
                        </label>
                        <p className="text-gray-600 text-xs mb-2">Если не задан — ссылка открыта для всех</p>
                        <input value={qAccessPin} onChange={e => setQAccessPin(e.target.value)} placeholder="Например: 1234" className={iCls} />
                      </div>
                    </div>

                    {/* Режим расчёта + дни */}
                    <div className="glass-card rounded-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Расчёт</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${!qUseCoeff ? "text-amber-500" : "text-gray-600"}`}>Дни</span>
                          <button onClick={() => setQUseCoeff(v => !v)}
                            className={`relative w-10 h-5 rounded-full border transition-colors ${qUseCoeff ? "border-amber-500 bg-amber-500/20" : "border-gray-600 bg-gray-800"}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${qUseCoeff ? "left-5 bg-amber-500" : "left-0.5 bg-gray-500"}`} />
                          </button>
                          <span className={`text-xs ${qUseCoeff ? "text-amber-500" : "text-gray-600"}`}>Коэфф.</span>
                        </div>
                      </div>
                      {!qUseCoeff && (
                        <div className="flex items-center gap-3">
                          <button onClick={() => setQDays(d => Math.max(1, d - 1))} className="w-8 h-8 border border-amber-500/30 rounded-sm text-amber-500 hover:bg-amber-500/10 flex items-center justify-center">−</button>
                          <span className="text-white font-bold text-lg w-8 text-center">{qDays}</span>
                          <button onClick={() => setQDays(d => d + 1)} className="w-8 h-8 border border-amber-500/30 rounded-sm text-amber-500 hover:bg-amber-500/10 flex items-center justify-center">+</button>
                          <span className="text-gray-600 text-xs ml-1">{qDays === 1 ? "день" : qDays < 5 ? "дня" : "дней"}</span>
                        </div>
                      )}
                    </div>

                    {/* Скидка */}
                    <div className="glass-card rounded-sm p-4">
                      <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Скидка</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {[0, 5, 10, 15, 20].map(p => (
                          <button key={p} onClick={() => { setQDiscount(p); setQDiscountInput(p > 0 ? String(p) : ""); }}
                            className={`px-2.5 py-1 rounded-sm text-xs transition-colors ${qDiscount === p ? "neon-btn" : "border border-amber-500/20 text-gray-500 hover:text-white"}`}>
                            {p === 0 ? "Нет" : `${p}%`}
                          </button>
                        ))}
                        <div className="flex items-center gap-1">
                          <input type="number" min={0} max={90} value={qDiscountInput} onChange={e => setQDiscountInput(e.target.value)}
                            onBlur={() => { const v = Math.min(90, Math.max(0, Number(qDiscountInput) || 0)); setQDiscount(v); setQDiscountInput(v > 0 ? String(v) : ""); }}
                            placeholder="0" className="w-14 bg-transparent border border-amber-500/20 rounded-sm px-2 py-1 text-xs text-white text-center focus:outline-none" />
                          <span className="text-gray-600 text-xs">%</span>
                        </div>
                      </div>
                    </div>

                    {/* Итого */}
                    <div className="glass-card rounded-sm p-4 space-y-1.5">
                      {qDiscount > 0 && qEqRaw > 0 && (
                        <div className="flex justify-between text-sm text-gray-500 line-through">
                          <span>Оборудование</span><span>{qEqRaw.toLocaleString()} ₽</span>
                        </div>
                      )}
                      {qDiscount > 0 && (
                        <div className="flex justify-between text-sm text-green-400">
                          <span>Скидка {qDiscount}%</span><span>−{qDiscountAmt.toLocaleString()} ₽</span>
                        </div>
                      )}
                      {qEqTotal > 0 && (
                        <div className="flex justify-between text-sm text-gray-400">
                          <span>Оборудование{qDiscount > 0 ? " (со скидкой)" : ""}</span><span>{qEqTotal.toLocaleString()} ₽</span>
                        </div>
                      )}
                      {qExtrasTotal > 0 && (
                        <div className="flex justify-between text-sm text-gray-400">
                          <span>Доп. услуги</span><span>{qExtrasTotal.toLocaleString()} ₽</span>
                        </div>
                      )}
                      {qDeliveryTotal > 0 && (
                        <div className="flex justify-between text-sm text-gray-400">
                          <span>Доставка</span><span>{qDeliveryTotal.toLocaleString()} ₽</span>
                        </div>
                      )}
                      {!qNoInstall && qInstallTotal > 0 && (
                        <div className="flex justify-between text-sm text-gray-400">
                          <span>Монтаж + демонтаж</span><span>{qInstallTotal.toLocaleString()} ₽</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-amber-500/20">
                        <span>ИТОГО</span>
                        <span className="font-oswald neon-text">{qTotal.toLocaleString()} ₽</span>
                      </div>
                    </div>

                    {qSaveError && (
                      <div className="flex items-center gap-2 text-red-400 text-sm">
                        <Icon name="AlertCircle" size={14} />{qSaveError}
                      </div>
                    )}

                    <button onClick={saveQuote} disabled={qSaving || !qTitle.trim()}
                      className="neon-btn w-full flex items-center justify-center gap-2 py-3 rounded-sm text-sm disabled:opacity-40">
                      {qSaving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Send" size={16} />}
                      {qSaving ? "Создаём КП..." : "Создать и получить ссылку"}
                    </button>
                  </div>

                </div>
                )}
              </div>
            )}

            {/* ── Заработок ── */}
            {quotes.length > 0 && (() => {
              const totalSum = quotes.reduce((s, q) => s + (q.total ?? 0), 0);
              const earning = Math.round(totalSum * 0.05);
              const sentSum = quotes.filter(q => ["sent","approved","contracted"].includes(q.status)).reduce((s, q) => s + (q.total ?? 0), 0);
              const sentEarning = Math.round(sentSum * 0.05);
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  <div className="glass-card rounded-sm p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">КП всего</p>
                    <p className="font-oswald text-2xl font-bold text-white">{totalSum.toLocaleString("ru-RU")} ₽</p>
                    <p className="text-gray-600 text-xs mt-0.5">{quotes.length} предложений</p>
                  </div>
                  <div className="glass-card rounded-sm p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Отправлено клиентам</p>
                    <p className="font-oswald text-2xl font-bold text-white">{sentSum.toLocaleString("ru-RU")} ₽</p>
                    <p className="text-gray-600 text-xs mt-0.5">{quotes.filter(q => ["sent","approved","contracted"].includes(q.status)).length} КП</p>
                  </div>
                  <div className="glass-card rounded-sm p-4 border border-green-500/20">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Мой заработок (5%)</p>
                    <p className="font-oswald text-2xl font-bold text-green-400">+{sentEarning.toLocaleString("ru-RU")} ₽</p>
                    <p className="text-gray-600 text-xs mt-0.5">от отправленных КП · всего {earning.toLocaleString("ru-RU")} ₽</p>
                  </div>
                </div>
              );
            })()}

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
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Название</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Статус</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right">Сумма</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right">Заработок</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Создано</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((q, i) => {
                        const earning = Math.round((q.total ?? 0) * 0.05);
                        const link = q.token ? `${window.location.origin}/quote/${q.token}` : null;
                        const isCopied = copiedToken === q.token;
                        return (
                        <tr key={q.id} className={`border-b border-amber-500/5 transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                          <td className="px-4 py-3 text-white font-medium max-w-[180px] truncate">{q.title}</td>
                          <td className="px-4 py-3">{quoteBadge(q.status)}</td>
                          <td className="px-4 py-3 text-right font-oswald font-bold neon-text whitespace-nowrap">
                            {(q.total ?? 0).toLocaleString("ru-RU")} ₽
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className="text-green-400 font-bold text-sm">+{earning.toLocaleString("ru-RU")} ₽</span>
                            <span className="text-gray-600 text-xs ml-1">5%</span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{fmt(q.created_at)}</td>
                          <td className="px-4 py-3">
                            {link && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => { navigator.clipboard.writeText(link); setCopiedToken(q.token); setTimeout(() => setCopiedToken(null), 2000); }}
                                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-sm border transition-colors whitespace-nowrap ${isCopied ? "border-green-500/40 text-green-400" : "border-amber-500/30 text-amber-500 hover:bg-amber-500/10"}`}
                                >
                                  <Icon name={isCopied ? "Check" : "Copy"} size={11} />
                                  {isCopied ? "Скопировано" : "Скопировать ссылку"}
                                </button>
                                <a href={link} target="_blank" rel="noopener noreferrer"
                                  className="text-gray-500 hover:text-amber-500 transition-colors">
                                  <Icon name="ExternalLink" size={13} />
                                </a>
                              </div>
                            )}
                          </td>
                        </tr>
                        );
                      })}
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