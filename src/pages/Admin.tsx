import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";
import { useRef } from "react";
import { useHiddenPages, usePortfolioItems, ALL_PAGES, type PortfolioItem } from "@/hooks/useHiddenPages";

const URLS = func2url as Record<string, string>;

type OrderItem = { name: string; qty: number; subtotal: number };
type Order = {
  id: number; order_number: string; name: string; phone: string;
  date: string; place: string; comment: string; items: OrderItem[];
  days: number; delivery: string; extras: string[]; total: number; created_at: string;
};
type Quote = {
  id: number; token: string; title: string; days: number;
  total: number; status: string; created_at: string; sent_at: string | null;
};
type Contract = {
  id: number; quote_id: number; client_type: "individual" | "company";
  full_name: string; company_name: string; phone: string; email: string;
  status: string; created_at: string; quote_title: string; total: number;
  passport_file_url: string | null;
  event_date?: string; delivery_address?: string;
  signed_at?: string | null; contract_pdf_url?: string | null;
  payment_method?: "cash" | "invoice";
  invoice_pdf_url?: string | null; invoice_total?: number | null;
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; color: string }> = {
    draft:      { label: "Черновик",    color: "text-gray-500 border-gray-700" },
    sent:       { label: "Отправлено",  color: "text-blue-400 border-blue-500/40" },
    approved:   { label: "Согласовано", color: "text-green-400 border-green-500/40" },
    contracted: { label: "Договор",     color: "text-amber-500 border-amber-500/40" },
    pending:    { label: "Ожидает",     color: "text-yellow-400 border-yellow-500/40" },
    reviewed:   { label: "Просмотрено", color: "text-green-400 border-green-500/40" },
    signed:     { label: "✓ ПЭП подписан", color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/5" },
  };
  const s = map[status] || { label: status, color: "text-gray-400 border-gray-600" };
  return (
    <span className={`text-xs border rounded-sm px-2 py-0.5 ${s.color}`}>{s.label}</span>
  );
};

export default function Admin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState(() => sessionStorage.getItem("admin_pwd") || "");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"orders" | "quotes" | "contracts" | "settings" | "pages" | "portfolio" | "ai" | "renters">("orders");

  // Renters moderation
  type RenterMod = { id: number; email: string; company_name: string; contact_name: string; phone: string; city: string; telegram?: string; status: string; created_at: string; };
  type RenterEqMod = { id: number; renter_id: number; name: string; category: string; price: number; unit: string; description: string; status: string; is_active: boolean; created_at: string; renter_company?: string; renter_email?: string; image?: string; };
  type RenterCatMod = { id: number; renter_id: number; name: string; status: string; created_at: string; renter_company?: string; };
  type RenterSubMod = { id: number; renter_id: number; name: string; category: string; status: string; created_at: string; renter_company?: string; };
  const [renters, setRenters] = useState<RenterMod[]>([]);
  const [renterEq, setRenterEq] = useState<RenterEqMod[]>([]);
  const [renterCats, setRenterCats] = useState<RenterCatMod[]>([]);
  const [renterSubs, setRenterSubs] = useState<RenterSubMod[]>([]);
  const [rentersLoading, setRentersLoading] = useState(false);
  const [renterSubTab, setRenterSubTab] = useState<"equipment" | "categories" | "subcategories" | "renters">("equipment");

  const loadRenters = async () => {
    setRentersLoading(true);
    const res = await fetch(`${URLS["renter-equipment"]}?admin=1&pwd=${encodeURIComponent(password)}`);
    if (res.ok) {
      const data = await res.json();
      setRenterEq(data.equipment || []);
      setRenters(data.renters || []);
      setRenterCats(data.categories || []);
      setRenterSubs(data.subcategories || []);
    }
    setRentersLoading(false);
  };

  const approveEq = async (id: number) => {
    await fetch(`${URLS["renter-equipment"]}?admin=1&pwd=${encodeURIComponent(password)}&action=approve&id=${id}`, { method: "POST" });
    loadRenters();
  };
  const rejectEq = async (id: number) => {
    await fetch(`${URLS["renter-equipment"]}?admin=1&pwd=${encodeURIComponent(password)}&action=reject&id=${id}`, { method: "POST" });
    loadRenters();
  };
  const approveCat = async (id: number) => {
    await fetch(`${URLS["renter-equipment"]}?admin=1&pwd=${encodeURIComponent(password)}&action=approve_cat&id=${id}`, { method: "POST" });
    loadRenters();
  };
  const rejectCat = async (id: number) => {
    await fetch(`${URLS["renter-equipment"]}?admin=1&pwd=${encodeURIComponent(password)}&action=reject_cat&id=${id}`, { method: "POST" });
    loadRenters();
  };
  const approveSub = async (id: number) => {
    await fetch(`${URLS["renter-equipment"]}?admin=1&pwd=${encodeURIComponent(password)}&action=approve_sub&id=${id}`, { method: "POST" });
    loadRenters();
  };
  const rejectSub = async (id: number) => {
    await fetch(`${URLS["renter-equipment"]}?admin=1&pwd=${encodeURIComponent(password)}&action=reject_sub&id=${id}`, { method: "POST" });
    loadRenters();
  };
  const toggleRenterStatus = async (id: number, action: "approve_renter" | "block_renter") => {
    await fetch(`${URLS["renter-equipment"]}?admin=1&pwd=${encodeURIComponent(password)}&action=${action}&renter_id=${id}`, { method: "POST" });
    loadRenters();
  };

  // Pages visibility
  const { hidden, togglePage } = useHiddenPages();

  // Portfolio management
  const { items: portfolioItems, addItem, updateItem, deleteItem } = usePortfolioItems();
  const [editingProject, setEditingProject] = useState<PortfolioItem | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const PORTFOLIO_CATEGORIES = ["Концерты", "Конференции", "Корпоративы", "Фестивали", "Шоу"];
  const emptyProject: Omit<PortfolioItem, "id"> = {
    title: "", category: "Концерты", date: "", guests: 0,
    equipment: [], description: "", tags: [], highlight: false,
  };
  const [newProject, setNewProject] = useState<Omit<PortfolioItem, "id">>(emptyProject);

  // AI Assistant
  const [aiForm, setAiForm] = useState({ title: "", description: "", price: "", category: "Звук", city: "Санкт-Петербург", photo_count: 0 });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<null | {
    score: number; title: string; description: string;
    price_recommendation: string; photo_tips: string[];
    strengths: string[]; weaknesses: string[]; why: string;
  }>(null);
  const [aiError, setAiError] = useState("");

  const runAiAnalysis = async () => {
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    try {
      const res = await fetch(URLS["analyze-listing"], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...aiForm, has_photo: aiForm.photo_count > 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка AI");
      setAiResult(data);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "Ошибка запроса");
    } finally {
      setAiLoading(false);
    }
  };

  // Settings
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsSubTab, setSettingsSubTab] = useState<"contacts" | "requisites" | "contract_template">("contacts");

  // Contract template
  const [contractTpl, setContractTpl] = useState<Record<string, string>>({});
  const [tplLoading, setTplLoading]   = useState(false);
  const [tplSaving, setTplSaving]     = useState(false);
  const [tplSaved, setTplSaved]       = useState(false);

  // Manager sign
  const [managerSigningId, setManagerSigningId] = useState<number | null>(null);
  const [managerName, setManagerName]           = useState(() => sessionStorage.getItem("manager_name") || "");
  const [managerSignDone, setManagerSignDone]   = useState<number | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState("");

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const login = async () => {
    setLoading(true);
    setAuthError(false);
    const res = await fetch(URLS["get-orders"], { headers: { "X-Admin-Password": password } });
    if (res.status === 401) { setAuthError(true); setLoading(false); return; }
    const data = await res.json();
    setOrders(data.orders || []);
    sessionStorage.setItem("admin_pwd", password);
    setAuthed(true);
    setLoading(false);
  };

  const loadOrders = async () => {
    setLoading(true);
    const res = await fetch(URLS["get-orders"], { headers: { "X-Admin-Password": password } });
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  };

  const loadQuotes = async () => {
    setQuotesLoading(true);
    const res = await fetch(`${URLS["manage-quotes"]}?pwd=${encodeURIComponent(password)}`);
    if (res.ok) setQuotes(await res.json());
    setQuotesLoading(false);
  };

  const loadContracts = async () => {
    setContractsLoading(true);
    const res = await fetch(`${URLS["get-contracts"]}?pwd=${encodeURIComponent(password)}`);
    if (res.ok) setContracts(await res.json());
    setContractsLoading(false);
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    const res = await fetch(URLS["manage-settings"]);
    if (res.ok) {
      const data: Record<string, { value: string; label: string }> = await res.json();
      const flat: Record<string, string> = {};
      Object.entries(data).forEach(([k, v]) => { flat[k] = v.value; });
      setSettings(flat);
    }
    setSettingsLoading(false);
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    await fetch(`${URLS["manage-settings"]}?pwd=${encodeURIComponent(password)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    // Обновляем localStorage чтобы Layout подхватил
    const patch = {
      phone: settings.phone_raw || settings.phone,
      phoneDisplay: settings.phone,
      email: settings.email,
      address: settings.address,
      workdays: settings.workdays,
      weekend: settings.weekend,
      telegram: settings.telegram,
      whatsapp: settings.whatsapp,
      vk: settings.vk,
    };
    localStorage.setItem("site_contacts", JSON.stringify(patch));
    setSettingsSaving(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const loadContractTemplate = async () => {
    setTplLoading(true);
    const res = await fetch(URLS["manage-contract-template"]);
    if (res.ok) setContractTpl(await res.json());
    setTplLoading(false);
  };

  const saveContractTemplate = async () => {
    setTplSaving(true);
    await fetch(`${URLS["manage-contract-template"]}?pwd=${encodeURIComponent(password)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contractTpl),
    });
    setTplSaving(false); setTplSaved(true);
    setTimeout(() => setTplSaved(false), 3000);
  };

  const managerSign = async (contractId: number) => {
    if (!managerName.trim()) return;
    setManagerSigningId(contractId);
    sessionStorage.setItem("manager_name", managerName);
    const res = await fetch(`${URLS["sign-contract"]}?action=manager_sign&pwd=${encodeURIComponent(password)}&token=_`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract_id: contractId, manager_name: managerName }),
    });
    const data = await res.json();
    if (data.invoice_pdf_url) {
      setSelectedContract(prev => prev ? { ...prev, invoice_pdf_url: data.invoice_pdf_url } : prev);
    }
    if (data.contract_pdf_url) {
      setSelectedContract(prev => prev ? { ...prev, contract_pdf_url: data.contract_pdf_url } : prev);
    }
    setManagerSigningId(null); setManagerSignDone(contractId);
    setTimeout(() => setManagerSignDone(null), 4000);
    loadContracts();
  };

  useEffect(() => {
    if (!authed) return;
    if (tab === "orders") loadOrders();
    if (tab === "quotes") loadQuotes();
    if (tab === "contracts") loadContracts();
    if (tab === "settings") { loadSettings(); loadContractTemplate(); }
    if (tab === "renters") loadRenters();
  }, [tab, authed]);

  const copyQuoteLink = (token: string) => {
    const link = `${window.location.origin}/quote/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(""), 2000);
  };

  const deleteQuote = async (id: number) => {
    if (!confirm("Удалить КП?")) return;
    await fetch(`${URLS["manage-quotes"]}?pwd=${encodeURIComponent(password)}&id=${id}`, { method: "DELETE" });
    loadQuotes();
  };

  const markContractReviewed = async (id: number) => {
    await fetch(`${URLS["get-contracts"]}?pwd=${encodeURIComponent(password)}&id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "reviewed" }),
    });
    loadContracts();
    setSelectedContract(null);
  };

  const exportCatalogXlsx = async (mode: "basic" | "full") => {
    setExportMenuOpen(false);
    setExportingXlsx(true);
    try {
      const res = await fetch(`${URLS["export-catalog"]}?pwd=${encodeURIComponent(password)}&mode=${mode}`);
      const data = await res.json();
      if (data.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = `catalog_${mode}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
      }
    } finally {
      setExportingXlsx(false);
    }
  };

  const generatePdf = async (contractId: number) => {
    setGeneratingPdf(true);
    setPdfUrl("");
    try {
      const res = await fetch(
        `${URLS["generate-contract"]}?pwd=${encodeURIComponent(password)}&contract_id=${contractId}`
      );
      const data = await res.json();
      if (data.pdf_url) {
        setPdfUrl(data.pdf_url);
        window.open(data.pdf_url, "_blank");
      }
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-primary)" }}>
        <div className="glass-card neon-border rounded-sm p-10 max-w-sm w-full text-center">
          <div className="w-16 h-16 flex items-center justify-center border border-amber-500/30 rounded-sm mx-auto mb-6">
            <Icon name="ShieldCheck" size={32} className="text-amber-500" />
          </div>
          <h1 className="font-oswald text-2xl font-bold text-white uppercase mb-1">Admin Panel</h1>
          <p className="text-gray-500 text-sm mb-8">Введите пароль для доступа</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()} placeholder="Пароль"
            className="w-full bg-transparent border border-amber-500/30 rounded-sm px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/70 text-sm mb-3" />
          {authError && <p className="text-red-400 text-xs mb-3">Неверный пароль</p>}
          <button onClick={login} disabled={loading || !password}
            className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-40">
            {loading ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="LogIn" size={16} />}
            Войти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Администратор</p>
            <h1 className="font-oswald text-4xl font-bold text-white uppercase">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => navigate("/admin/quote")}
              className="neon-btn flex items-center gap-2 px-4 py-2 rounded-sm text-sm">
              <Icon name="FilePlus" size={14} /> Новое КП
            </button>
            <div className="relative">
              <button
                onClick={() => !exportingXlsx && setExportMenuOpen(o => !o)}
                disabled={exportingXlsx}
                className="flex items-center gap-2 border border-green-500/30 text-green-400 hover:text-green-300 hover:border-green-400/50 px-4 py-2 rounded-sm text-sm transition-colors disabled:opacity-40"
              >
                {exportingXlsx
                  ? <Icon name="Loader2" size={14} className="animate-spin" />
                  : <Icon name="FileSpreadsheet" size={14} />}
                {exportingXlsx ? "Генерация..." : "Excel каталог"}
                {!exportingXlsx && <Icon name="ChevronDown" size={12} />}
              </button>
              {exportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-sm border border-green-500/20 bg-[#0f1117] shadow-xl overflow-hidden">
                    <button
                      onClick={() => exportCatalogXlsx("basic")}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-green-500/10 transition-colors"
                    >
                      <Icon name="Table" size={14} className="text-green-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-green-300 text-sm font-medium">Базовый</div>
                        <div className="text-gray-500 text-xs">Название, категория, цена</div>
                      </div>
                    </button>
                    <div className="border-t border-green-500/10" />
                    <button
                      onClick={() => exportCatalogXlsx("full")}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-green-500/10 transition-colors"
                    >
                      <Icon name="TableProperties" size={14} className="text-green-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-green-300 text-sm font-medium">Расширенный</div>
                        <div className="text-gray-500 text-xs">+ характеристики, теги, описание, рейтинг</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
            <a href="/admin/catalog"
              className="flex items-center gap-2 border border-amber-500/20 text-gray-400 hover:text-amber-500 px-4 py-2 rounded-sm text-sm transition-colors">
              <Icon name="LayoutDashboard" size={14} /> Каталог
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-amber-500/10">
          {[
            { key: "orders", label: "Заявки", icon: "Inbox", count: orders.length },
            { key: "quotes", label: "КП", icon: "FileText", count: quotes.length },
            { key: "contracts", label: "Договоры", icon: "FileCheck", count: contracts.filter(c => c.status === "pending").length },
            { key: "settings", label: "Настройки", icon: "Settings", count: 0 },
            { key: "pages", label: "Разделы", icon: "EyeOff", count: hidden.length },
            { key: "portfolio", label: "Портфолио", icon: "Images", count: portfolioItems.length },
            { key: "ai", label: "AI Авито", icon: "Sparkles", count: 0 },
            { key: "renters", label: "Прокатчики", icon: "Users", count: renterEq.filter(e => e.status === "pending").length + renterCats.filter(c => c.status === "pending").length + renterSubs.filter(s => s.status === "pending").length },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`flex items-center gap-2 px-5 py-3 text-sm transition-all border-b-2 -mb-px ${tab === t.key ? "border-amber-500 text-amber-500" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
              <Icon name={t.icon} size={14} />
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${tab === t.key ? "bg-amber-500/20 text-amber-500" : "bg-gray-800 text-gray-500"}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── ЗАЯВКИ ── */}
        {tab === "orders" && (
          <div>
            <div className="flex justify-end mb-3">
              <button onClick={loadOrders} disabled={loading}
                className="flex items-center gap-2 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-4 py-2 rounded-sm text-sm transition-colors">
                <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} /> Обновить
              </button>
            </div>
            {orders.length === 0 ? (
              <div className="glass-card rounded-sm p-16 text-center">
                <Icon name="Inbox" size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500">Заявок пока нет</p>
              </div>
            ) : (
              <div className="glass-card rounded-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-amber-500/10 text-left">
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">№</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Дата</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Клиент</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Телефон</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Дней</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right">Сумма</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order, i) => (
                        <tr key={order.id}
                          className={`border-b border-amber-500/5 hover:bg-amber-500/5 cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                          onClick={() => setSelectedOrder(order)}>
                          <td className="px-4 py-3"><span className="font-oswald text-amber-500 font-bold">{order.order_number}</span></td>
                          <td className="px-4 py-3 text-gray-400">{formatDate(order.created_at)}</td>
                          <td className="px-4 py-3 text-white font-medium">{order.name || "—"}</td>
                          <td className="px-4 py-3 text-gray-300">{order.phone || "—"}</td>
                          <td className="px-4 py-3 text-gray-400">{order.days}</td>
                          <td className="px-4 py-3 text-right font-oswald font-bold neon-text">{(order.total || 0).toLocaleString()} ₽</td>
                          <td className="px-4 py-3"><Icon name="ChevronRight" size={16} className="text-gray-600" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── КП ── */}
        {tab === "quotes" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <button onClick={() => navigate("/admin/quote")} className="neon-btn flex items-center gap-2 px-5 py-2 rounded-sm text-sm">
                <Icon name="Plus" size={14} /> Новое КП
              </button>
              <button onClick={loadQuotes} disabled={quotesLoading}
                className="flex items-center gap-2 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-4 py-2 rounded-sm text-sm transition-colors">
                <Icon name="RefreshCw" size={14} className={quotesLoading ? "animate-spin" : ""} /> Обновить
              </button>
            </div>
            {quotes.length === 0 ? (
              <div className="glass-card rounded-sm p-16 text-center">
                <Icon name="FileText" size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500">КП пока нет. Создайте первое!</p>
              </div>
            ) : (
              <div className="glass-card rounded-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-amber-500/10 text-left">
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Название</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Дата</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Дней</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right">Сумма</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Статус</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((q, i) => (
                        <tr key={q.id} className={`border-b border-amber-500/5 ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                          <td className="px-4 py-3 text-white font-medium">
                            <div className="flex items-center gap-1.5">
                              {q.title || "—"}
                              {q.access_pin && <Icon name="Lock" size={11} className="text-amber-500/60 shrink-0" title={`Пароль: ${q.access_pin}`} />}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{formatDate(q.created_at)}</td>
                          <td className="px-4 py-3 text-gray-400">{q.days}</td>
                          <td className="px-4 py-3 text-right font-oswald font-bold neon-text">{(q.total || 0).toLocaleString()} ₽</td>
                          <td className="px-4 py-3">{statusBadge(q.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => copyQuoteLink(q.token)}
                                className="flex items-center gap-1 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 py-1 rounded-sm text-xs transition-colors"
                                title="Скопировать ссылку клиенту">
                                <Icon name={copiedToken === q.token ? "Check" : "Copy"} size={12} />
                                {copiedToken === q.token ? "Скопировано" : "Ссылка"}
                              </button>
                              <button onClick={() => deleteQuote(q.id)}
                                className="border border-red-500/20 text-red-500/50 hover:text-red-400 hover:border-red-500/40 px-3 py-1 rounded-sm text-xs transition-colors">
                                <Icon name="Trash2" size={12} />
                              </button>
                            </div>
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

        {/* ── ДОГОВОРЫ ── */}
        {tab === "contracts" && (
          <div>
            <div className="flex justify-end mb-3">
              <button onClick={loadContracts} disabled={contractsLoading}
                className="flex items-center gap-2 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-4 py-2 rounded-sm text-sm transition-colors">
                <Icon name="RefreshCw" size={14} className={contractsLoading ? "animate-spin" : ""} /> Обновить
              </button>
            </div>
            {contracts.length === 0 ? (
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
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">КП</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Клиент</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Тип</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Телефон</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Дата</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right">Сумма</th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Статус</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((c, i) => (
                        <tr key={c.id}
                          className={`border-b border-amber-500/5 hover:bg-amber-500/5 cursor-pointer transition-colors ${c.status === "pending" ? "bg-amber-500/5" : i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                          onClick={() => setSelectedContract(c)}>
                          <td className="px-4 py-3 text-gray-300 max-w-[160px] truncate">{c.quote_title}</td>
                          <td className="px-4 py-3 text-white font-medium">
                            {c.client_type === "individual" ? c.full_name : c.company_name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-500">
                              {c.client_type === "individual" ? "Физ. лицо" : "Юр. лицо"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300">{c.phone || "—"}</td>
                          <td className="px-4 py-3 text-gray-400">{formatDate(c.created_at)}</td>
                          <td className="px-4 py-3 text-right font-oswald font-bold neon-text">{(c.total || 0).toLocaleString()} ₽</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {statusBadge(c.status)}
                              {c.signed_at && <Icon name="ShieldCheck" size={13} className="text-emerald-400" title="ПЭП подписан" />}
                            </div>
                          </td>
                          <td className="px-4 py-3"><Icon name="ChevronRight" size={16} className="text-gray-600" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── НАСТРОЙКИ ── */}
      {tab === "settings" && (
        <div className="max-w-2xl">
          <h2 className="font-oswald text-2xl font-bold text-white uppercase mb-4">Настройки</h2>

          {/* Подвкладки */}
          <div className="flex gap-2 mb-6 border-b border-amber-500/10 pb-2">
            {([
              { id: "contacts", label: "Контакты сайта", icon: "Phone" },
              { id: "requisites", label: "Реквизиты компании", icon: "Building2" },
              { id: "contract_template", label: "Шаблон договора", icon: "FileText" },
            ] as const).map(sub => (
              <button key={sub.id} onClick={() => setSettingsSubTab(sub.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-sm text-sm transition-colors ${settingsSubTab === sub.id ? "neon-btn" : "border border-gray-700 text-gray-400 hover:text-white"}`}>
                <Icon name={sub.icon} size={13} /> {sub.label}
              </button>
            ))}
          </div>

          {/* ── Контакты сайта ── */}
          {settingsSubTab === "contacts" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-gray-500 text-sm">Отображаются на сайте в хедере и футере</p>
                {settingsSaved && <span className="text-green-400 text-sm flex items-center gap-1"><Icon name="CheckCircle" size={14}/>Сохранено</span>}
              </div>
              {settingsLoading ? <div className="flex items-center gap-3 text-gray-500 py-8"><Icon name="Loader2" size={18} className="animate-spin"/>Загрузка...</div> : (
                <div className="space-y-3">
                  {[
                    { key: "phone", label: "Телефон (для отображения)", placeholder: "+7 (812) 123-45-67" },
                    { key: "phone_raw", label: "Телефон (для ссылки tel:, только цифры)", placeholder: "+78121234567" },
                    { key: "email", label: "Email", placeholder: "info@stagesound.ru" },
                    { key: "address", label: "Адрес", placeholder: "Санкт-Петербург, ул. Примерная, 1" },
                    { key: "workdays", label: "Режим работы (будни)", placeholder: "Пн–Пт: 9:00 — 20:00" },
                    { key: "weekend", label: "Режим работы (выходные)", placeholder: "Сб–Вс: 10:00 — 17:00" },
                    { key: "telegram", label: "Ссылка Telegram", placeholder: "https://t.me/username" },
                    { key: "whatsapp", label: "WhatsApp (номер со знаком +)", placeholder: "+79001234567" },
                    { key: "vk", label: "ВКонтакте (ссылка)", placeholder: "https://vk.com/stagesound" },
                  ].map(f => (
                    <div key={f.key} className="glass-card rounded-sm p-3">
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">{f.label}</label>
                      <input type="text" value={settings[f.key] ?? ""} onChange={e => setSettings(p => ({...p, [f.key]: e.target.value}))}
                        placeholder={f.placeholder} className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors" />
                    </div>
                  ))}
                  <button onClick={saveSettings} disabled={settingsSaving} className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2">
                    {settingsSaving ? <><Icon name="Loader2" size={16} className="animate-spin"/>Сохраняю...</> : <><Icon name="Save" size={16}/>Сохранить</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Реквизиты компании ── */}
          {settingsSubTab === "requisites" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-gray-500 text-sm">Реквизиты подставляются в PDF договора</p>
                {settingsSaved && <span className="text-green-400 text-sm flex items-center gap-1"><Icon name="CheckCircle" size={14}/>Сохранено</span>}
              </div>
              {settingsLoading ? <div className="flex items-center gap-3 text-gray-500 py-8"><Icon name="Loader2" size={18} className="animate-spin"/>Загрузка...</div> : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { key: "company_name",    label: "Название компании",    placeholder: "ООО «Global Renta»" },
                      { key: "company_inn",     label: "ИНН",                  placeholder: "7712345678" },
                      { key: "company_kpp",     label: "КПП",                  placeholder: "771201001" },
                      { key: "company_ogrn",    label: "ОГРН",                 placeholder: "1027700000000" },
                      { key: "company_address", label: "Юридический адрес",    placeholder: "г. Санкт-Петербург, ..." },
                      { key: "company_director",label: "Директор (ФИО)",       placeholder: "Иванов Иван Иванович" },
                      { key: "company_email",   label: "Email компании",       placeholder: "info@global.promo" },
                      { key: "company_phone",   label: "Телефон компании",     placeholder: "+7 (800) 000-00-00" },
                    ].map(f => (
                      <div key={f.key} className="glass-card rounded-sm p-3">
                        <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">{f.label}</label>
                        <input type="text" value={settings[f.key] ?? ""} onChange={e => setSettings(p => ({...p, [f.key]: e.target.value}))}
                          placeholder={f.placeholder} className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors" />
                      </div>
                    ))}
                  </div>
                  <div className="glass-card rounded-sm p-4 border border-amber-500/10">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Банковские реквизиты</p>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { key: "company_bank", label: "Банк",            placeholder: "ПАО Сбербанк" },
                        { key: "company_bik",  label: "БИК",             placeholder: "044525225" },
                        { key: "company_rs",   label: "Расчётный счёт",  placeholder: "40702810000000000000" },
                        { key: "company_ks",   label: "Корр. счёт",      placeholder: "30101810400000000225" },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                          <input type="text" value={settings[f.key] ?? ""} onChange={e => setSettings(p => ({...p, [f.key]: e.target.value}))}
                            placeholder={f.placeholder} className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={saveSettings} disabled={settingsSaving} className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2">
                    {settingsSaving ? <><Icon name="Loader2" size={16} className="animate-spin"/>Сохраняю...</> : <><Icon name="Save" size={16}/>Сохранить реквизиты</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Шаблон договора ── */}
          {settingsSubTab === "contract_template" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-gray-500 text-sm">Дополнительные пункты добавляются в каждый раздел договора</p>
                {tplSaved && <span className="text-green-400 text-sm flex items-center gap-1"><Icon name="CheckCircle" size={14}/>Сохранено</span>}
              </div>
              {tplLoading ? <div className="flex items-center gap-3 text-gray-500 py-8"><Icon name="Loader2" size={18} className="animate-spin"/>Загрузка...</div> : (
                <div className="space-y-3">
                  {[
                    { key: "section_2_extra", label: "Раздел 2 — Стоимость и расчёты (доп. пункт)", placeholder: "2.3. Например: ..." },
                    { key: "section_3_extra", label: "Раздел 3 — Права и обязанности (доп. пункт)", placeholder: "3.4. Например: ..." },
                    { key: "section_4_extra", label: "Раздел 4 — Ответственность (доп. пункт)",     placeholder: "4.4. Например: ..." },
                    { key: "section_5_extra", label: "Раздел 5 — Прочие условия (доп. пункт)",      placeholder: "5.4. Например: ..." },
                  ].map(f => (
                    <div key={f.key} className="glass-card rounded-sm p-3">
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">{f.label}</label>
                      <textarea value={contractTpl[f.key] ?? ""} onChange={e => setContractTpl(p => ({...p, [f.key]: e.target.value}))}
                        placeholder={f.placeholder} rows={3}
                        className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/60 transition-colors resize-none" />
                    </div>
                  ))}
                  <div className="glass-card rounded-sm p-4 border border-amber-500/10">
                    <p className="text-xs text-gray-500 mb-2">Если поле пустое — доп. пункт не добавляется в договор.</p>
                    <p className="text-xs text-gray-600">HTML-теги {'<b>'}, {'<i>'} поддерживаются для форматирования.</p>
                  </div>
                  <button onClick={saveContractTemplate} disabled={tplSaving} className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {tplSaving ? <><Icon name="Loader2" size={16} className="animate-spin"/>Сохраняю...</> : <><Icon name="Save" size={16}/>Сохранить шаблон</>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: детали заявки ── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelectedOrder(null)}>
          <div className="glass-card neon-border rounded-sm max-w-lg w-full max-h-[90vh] overflow-y-auto p-8"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="text-xs text-amber-500 uppercase tracking-widest">Заявка</span>
                <h2 className="font-oswald text-3xl font-bold text-white">{selectedOrder.order_number}</h2>
                <p className="text-gray-500 text-xs mt-1">{formatDate(selectedOrder.created_at)}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-600 hover:text-gray-300">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="space-y-3 mb-6 text-sm">
              <div className="flex gap-3"><span className="text-gray-500 w-28 shrink-0">Клиент</span><span className="text-white font-medium">{selectedOrder.name}</span></div>
              <div className="flex gap-3"><span className="text-gray-500 w-28 shrink-0">Телефон</span><span className="text-white">{selectedOrder.phone}</span></div>
              {selectedOrder.date && <div className="flex gap-3"><span className="text-gray-500 w-28 shrink-0">Дата события</span><span className="text-white">{selectedOrder.date}</span></div>}
              {selectedOrder.place && <div className="flex gap-3"><span className="text-gray-500 w-28 shrink-0">Место</span><span className="text-white">{selectedOrder.place}</span></div>}
              <div className="flex gap-3"><span className="text-gray-500 w-28 shrink-0">Дней аренды</span><span className="text-white">{selectedOrder.days}</span></div>
              <div className="flex gap-3"><span className="text-gray-500 w-28 shrink-0">Доставка</span><span className="text-white">{selectedOrder.delivery}</span></div>
            </div>
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Оборудование</p>
            <div className="space-y-1 mb-4">
              {(selectedOrder.items || []).map((it, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-400">{it.name} × {it.qty}</span>
                  <span className="text-white">{(it.subtotal || 0).toLocaleString()} ₽</span>
                </div>
              ))}
            </div>
            {selectedOrder.extras?.length > 0 && (
              <>
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Доп. услуги</p>
                <div className="space-y-1 mb-4">
                  {selectedOrder.extras.map((ex, i) => <p key={i} className="text-gray-400 text-sm">• {ex}</p>)}
                </div>
              </>
            )}
            <div className="border-t border-amber-500/20 pt-4 flex justify-between items-center mb-6">
              <span className="text-gray-400">Итого</span>
              <span className="font-oswald text-2xl font-bold text-amber-500">{(selectedOrder.total || 0).toLocaleString()} ₽</span>
            </div>
            <a href={`tel:${selectedOrder.phone}`}
              className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2">
              <Icon name="Phone" size={16} /> Позвонить клиенту
            </a>
          </div>
        </div>
      )}

      {/* ── Modal: детали договора ── */}
      {selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          onClick={() => { setSelectedContract(null); setPdfUrl(""); }}>
          <div className="glass-card neon-border rounded-sm max-w-lg w-full max-h-[90vh] overflow-y-auto p-8"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="text-xs text-amber-500 uppercase tracking-widest">Договор #{selectedContract.id}</span>
                <h2 className="font-oswald text-2xl font-bold text-white mt-1">{selectedContract.quote_title}</h2>
                <p className="text-gray-500 text-xs mt-1">{formatDate(selectedContract.created_at)}</p>
              </div>
              <button onClick={() => { setSelectedContract(null); setPdfUrl(""); }} className="text-gray-600 hover:text-gray-300">
                <Icon name="X" size={20} />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {statusBadge(selectedContract.status)}
              <span className="text-gray-500 text-xs">
                {selectedContract.client_type === "individual" ? "Физическое лицо" : "Юридическое лицо"}
              </span>
              {selectedContract.signed_at && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <Icon name="ShieldCheck" size={12} /> ПЭП: {formatDate(selectedContract.signed_at)}
                </span>
              )}
            </div>

            {/* Дата и адрес мероприятия */}
            {(selectedContract.event_date || selectedContract.delivery_address) && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-sm p-3 mb-4 space-y-1.5">
                {selectedContract.event_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Icon name="Calendar" size={13} className="text-amber-500 shrink-0" />
                    <span className="text-gray-500">Дата:</span>
                    <span className="text-white">
                      {new Date(selectedContract.event_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                )}
                {selectedContract.delivery_address && (
                  <div className="flex items-center gap-2 text-sm">
                    <Icon name="MapPin" size={13} className="text-amber-500 shrink-0" />
                    <span className="text-gray-500">Адрес:</span>
                    <span className="text-white">{selectedContract.delivery_address}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 text-sm mb-5">
              {selectedContract.client_type === "individual" ? (
                <div className="flex gap-3"><span className="text-gray-500 w-32 shrink-0">ФИО</span><span className="text-white">{selectedContract.full_name || "—"}</span></div>
              ) : (
                <div className="flex gap-3"><span className="text-gray-500 w-32 shrink-0">Организация</span><span className="text-white">{selectedContract.company_name || "—"}</span></div>
              )}
              <div className="flex gap-3"><span className="text-gray-500 w-32 shrink-0">Телефон</span><span className="text-white">{selectedContract.phone || "—"}</span></div>
              <div className="flex gap-3"><span className="text-gray-500 w-32 shrink-0">Email</span><span className="text-white">{selectedContract.email || "—"}</span></div>
              <div className="flex gap-3"><span className="text-gray-500 w-32 shrink-0">Сумма</span><span className="text-amber-500 font-bold font-oswald text-lg">{selectedContract.total.toLocaleString()} ₽</span></div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {selectedContract.passport_file_url && (
                <a href={selectedContract.passport_file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 py-2 rounded-sm text-xs transition-colors">
                  <Icon name="FileImage" size={13} /> Скан паспорта
                </a>
              )}
              {selectedContract.contract_pdf_url && (
                <a href={selectedContract.contract_pdf_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 px-3 py-2 rounded-sm text-xs transition-colors">
                  <Icon name="FileText" size={13} /> Договор PDF (подписан)
                </a>
              )}
              {selectedContract.invoice_pdf_url && (
                <a href={selectedContract.invoice_pdf_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 px-3 py-2 rounded-sm text-xs transition-colors">
                  <Icon name="Receipt" size={13} /> Счёт PDF
                </a>
              )}
            </div>

            {/* Способ оплаты */}
            <div className={`mb-3 px-3 py-2 rounded-sm border text-sm flex items-center gap-2 ${selectedContract.payment_method === "invoice" ? "border-blue-500/20 bg-blue-500/5 text-blue-300" : "border-amber-500/20 bg-amber-500/5 text-amber-300"}`}>
              <Icon name={selectedContract.payment_method === "invoice" ? "Receipt" : "Wallet"} size={14} />
              {selectedContract.payment_method === "invoice"
                ? <>Оплата по счёту {selectedContract.invoice_total ? <span className="font-bold ml-1">{selectedContract.invoice_total.toLocaleString()} ₽</span> : "(+10%)"}</>
                : "Оплата по факту"
              }
            </div>

            {/* Кнопка генерации PDF */}
            <button
              onClick={() => generatePdf(selectedContract.id)}
              disabled={generatingPdf}
              className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              <Icon name={generatingPdf ? "Loader2" : "FileDown"} size={16} className={generatingPdf ? "animate-spin" : ""} />
              {generatingPdf ? "Генерирую..." : selectedContract.contract_pdf_url ? "Перегенерировать PDF" : "Сгенерировать PDF"}
            </button>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 border border-green-500/30 text-green-400 hover:bg-green-500/10 px-4 py-2 rounded-sm text-sm transition-colors mb-3 justify-center">
                <Icon name="ExternalLink" size={14} /> Открыть PDF
              </a>
            )}
            {/* Подпись менеджера */}
            {selectedContract.signed_at && (
              <div className="mb-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Подпись со стороны компании</p>
                {selectedContract.signed_at && !managerSignDone && (
                  <div className="flex gap-2">
                    <input value={managerName} onChange={e => setManagerName(e.target.value)}
                      placeholder="Ваше имя (менеджер)"
                      className="flex-1 bg-transparent border border-emerald-500/30 rounded-sm px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/60" />
                    <button onClick={() => managerSign(selectedContract.id)} disabled={!managerName.trim() || managerSigningId === selectedContract.id}
                      className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 px-3 py-1.5 rounded-sm text-sm transition-colors disabled:opacity-40">
                      {managerSigningId === selectedContract.id ? <Icon name="Loader2" size={13} className="animate-spin"/> : <Icon name="PenLine" size={13}/>}
                      Подписать
                    </button>
                  </div>
                )}
                {managerSignDone === selectedContract.id && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <Icon name="CheckCircle" size={14}/> Договор подписан с обеих сторон!
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              {(selectedContract.status === "pending" || selectedContract.status === "contracted") && (
                <button onClick={() => markContractReviewed(selectedContract.id)}
                  className="flex-1 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 py-2 rounded-sm text-sm flex items-center justify-center gap-2 transition-colors">
                  <Icon name="Check" size={14} /> Просмотрено
                </button>
              )}
              {selectedContract.phone && (
                <a href={`tel:${selectedContract.phone}`}
                  className="flex items-center gap-2 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-4 py-2 rounded-sm text-sm transition-colors">
                  <Icon name="Phone" size={14} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── РАЗДЕЛЫ ── */}
      {tab === "pages" && (
        <div className="max-w-xl">
          <p className="text-gray-500 text-sm mb-6">Скрытые разделы пропадают из навигации и подвала сайта. Страница по-прежнему доступна по прямой ссылке.</p>
          <div className="space-y-3">
            {ALL_PAGES.map((p) => {
              const isHid = hidden.includes(p.page);
              return (
                <div key={p.page} className="glass-card rounded-sm p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon name={isHid ? "EyeOff" : "Eye"} size={16} className={isHid ? "text-gray-600" : "text-amber-500"} />
                    <span className={`font-medium text-sm ${isHid ? "text-gray-500 line-through" : "text-white"}`}>{p.label}</span>
                    {isHid && <span className="text-xs border border-red-500/30 text-red-400 px-2 py-0.5 rounded-sm">Скрыт</span>}
                  </div>
                  <button
                    onClick={() => togglePage(p.page)}
                    className={`px-4 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                      isHid
                        ? "border border-green-500/30 text-green-400 hover:bg-green-500/10"
                        : "border border-red-500/30 text-red-400 hover:bg-red-500/10"
                    }`}
                  >
                    {isHid ? "Показать" : "Скрыть"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ПОРТФОЛИО ── */}
      {tab === "portfolio" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <span className="text-gray-400 text-sm">{portfolioItems.length} проектов</span>
            <button
              onClick={() => { setNewProject(emptyProject); setShowNewProject(true); setEditingProject(null); }}
              className="neon-btn flex items-center gap-2 px-4 py-2 rounded-sm text-sm"
            >
              <Icon name="Plus" size={14} /> Добавить проект
            </button>
          </div>

          {/* Форма нового проекта */}
          {showNewProject && (
            <div className="glass-card neon-border rounded-sm p-6 mb-6">
              <h3 className="font-oswald text-lg font-bold text-white uppercase mb-4">Новый проект</h3>
              <PortfolioForm
                data={newProject}
                categories={PORTFOLIO_CATEGORIES}
                onChange={setNewProject}
                onSave={() => { addItem(newProject); setShowNewProject(false); }}
                onCancel={() => setShowNewProject(false)}
                password={password}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {portfolioItems.map((project) => (
              <div key={project.id} className="glass-card rounded-sm p-5">
                {editingProject?.id === project.id ? (
                  <>
                    <h3 className="font-oswald text-base font-bold text-white uppercase mb-4">Редактирование</h3>
                    <PortfolioForm
                      data={editingProject}
                      categories={PORTFOLIO_CATEGORIES}
                      onChange={(d) => setEditingProject({ ...editingProject, ...d })}
                      onSave={() => { updateItem(editingProject); setEditingProject(null); }}
                      onCancel={() => setEditingProject(null)}
                      password={password}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs border border-amber-500/30 text-amber-500/70 px-2 py-0.5 rounded-sm">{project.category}</span>
                          {project.highlight && <span className="text-xs bg-amber-500 text-black px-2 py-0.5 font-bold">Избранное</span>}
                        </div>
                        <h3 className="font-oswald text-lg font-bold text-white">{project.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                          <span>{project.date}</span>
                          <span>{project.guests.toLocaleString()} гостей</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setEditingProject(project)}
                          className="w-8 h-8 flex items-center justify-center border border-amber-500/20 text-gray-400 hover:text-amber-500 hover:border-amber-500/50 rounded-sm transition-colors"
                        >
                          <Icon name="Pencil" size={14} />
                        </button>
                        <button
                          onClick={() => { if (confirm("Удалить проект?")) deleteItem(project.id); }}
                          className="w-8 h-8 flex items-center justify-center border border-red-500/20 text-gray-600 hover:text-red-400 hover:border-red-500/40 rounded-sm transition-colors"
                        >
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-500 text-xs line-clamp-2">{project.description}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── AI АВИТО ── */}
      {tab === "ai" && (
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Sparkles" size={20} className="text-amber-500" />
            <h2 className="font-oswald text-2xl font-bold text-white uppercase">AI-ассистент для Авито</h2>
          </div>
          <p className="text-gray-500 text-sm mb-6">Опишите что вы хотите разместить на Авито — AI проанализирует и выдаст готовый текст, цену и советы по фото.</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Форма */}
            <div className="glass-card rounded-sm p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Категория</label>
                  <select value={aiForm.category} onChange={(e) => setAiForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50">
                    {["Звук", "Свет", "Видео", "Сцена", "Конференц", "Генераторы"].map(c => (
                      <option key={c} value={c} className="bg-gray-900">{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Город</label>
                  <input value={aiForm.city} onChange={(e) => setAiForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Текущий заголовок объявления</label>
                <input
                  value={aiForm.title}
                  onChange={(e) => setAiForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Напр.: Аренда колонок JBL"
                  className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Текущее описание</label>
                <textarea
                  value={aiForm.description}
                  onChange={(e) => setAiForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Опишите оборудование, условия аренды, что входит в стоимость..."
                  rows={4}
                  className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Текущая цена (₽)</label>
                  <input
                    value={aiForm.price}
                    onChange={(e) => setAiForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="5000"
                    className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Кол-во фото</label>
                  <input
                    type="number" min={0} max={20}
                    value={aiForm.photo_count}
                    onChange={(e) => setAiForm(f => ({ ...f, photo_count: Number(e.target.value) }))}
                    className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <button
                onClick={runAiAnalysis}
                disabled={aiLoading || (!aiForm.title && !aiForm.description)}
                className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {aiLoading
                  ? <><Icon name="Loader2" size={16} className="animate-spin" /> Анализирую...</>
                  : <><Icon name="Sparkles" size={16} /> Улучшить объявление</>}
              </button>

              {aiError && (
                <div className="border border-red-500/30 text-red-400 rounded-sm px-4 py-3 text-sm">{aiError}</div>
              )}
            </div>

            {/* Результат */}
            <div>
              {!aiResult && !aiLoading && (
                <div className="glass-card rounded-sm p-8 h-full flex flex-col items-center justify-center text-center">
                  <Icon name="Sparkles" size={40} className="text-amber-500/30 mb-4" />
                  <p className="text-gray-600 text-sm">Заполните форму слева и нажмите «Улучшить» — AI выдаст готовое объявление с ценой и советами по фото</p>
                </div>
              )}

              {aiLoading && (
                <div className="glass-card rounded-sm p-8 h-full flex flex-col items-center justify-center text-center">
                  <Icon name="Loader2" size={36} className="text-amber-500 animate-spin mb-4" />
                  <p className="text-gray-400 text-sm">AI анализирует объявление и рынок...</p>
                </div>
              )}

              {aiResult && (
                <div className="space-y-4">
                  {/* Оценка */}
                  <div className="glass-card rounded-sm p-4 flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Текущее качество объявления</span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} className={`w-3 h-3 rounded-sm ${i < aiResult.score ? "bg-amber-500" : "bg-gray-800"}`} />
                        ))}
                      </div>
                      <span className="text-amber-500 font-bold font-oswald text-lg">{aiResult.score}/10</span>
                    </div>
                  </div>

                  {/* Новый заголовок */}
                  <div className="glass-card neon-border rounded-sm p-4">
                    <div className="text-xs text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Icon name="Type" size={12} /> Улучшенный заголовок
                    </div>
                    <p className="text-white font-semibold">{aiResult.title}</p>
                    <button onClick={() => navigator.clipboard.writeText(aiResult.title)}
                      className="mt-2 text-xs text-gray-600 hover:text-amber-500 flex items-center gap-1 transition-colors">
                      <Icon name="Copy" size={11} /> Скопировать
                    </button>
                  </div>

                  {/* Новое описание */}
                  <div className="glass-card rounded-sm p-4">
                    <div className="text-xs text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Icon name="FileText" size={12} /> Улучшенное описание
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{aiResult.description}</p>
                    <button onClick={() => navigator.clipboard.writeText(aiResult.description)}
                      className="mt-2 text-xs text-gray-600 hover:text-amber-500 flex items-center gap-1 transition-colors">
                      <Icon name="Copy" size={11} /> Скопировать
                    </button>
                  </div>

                  {/* Цена */}
                  <div className="glass-card rounded-sm p-4">
                    <div className="text-xs text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Icon name="Tag" size={12} /> Рекомендуемая цена
                    </div>
                    <p className="text-green-400 font-semibold">{aiResult.price_recommendation}</p>
                  </div>

                  {/* Советы по фото */}
                  <div className="glass-card rounded-sm p-4">
                    <div className="text-xs text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                      <Icon name="Camera" size={12} /> Советы по фото
                    </div>
                    <ul className="space-y-2">
                      {aiResult.photo_tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                          <Icon name="ChevronRight" size={14} className="text-amber-500 mt-0.5 shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Сильные/слабые стороны */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-card rounded-sm p-4">
                      <div className="text-xs text-green-500 uppercase tracking-wider mb-2">Сильные стороны</div>
                      <ul className="space-y-1">
                        {aiResult.strengths.map((s, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                            <Icon name="CheckCircle" size={12} className="text-green-500 mt-0.5 shrink-0" />{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="glass-card rounded-sm p-4">
                      <div className="text-xs text-red-400 uppercase tracking-wider mb-2">Слабые стороны</div>
                      <ul className="space-y-1">
                        {aiResult.weaknesses.map((w, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                            <Icon name="AlertCircle" size={12} className="text-red-400 mt-0.5 shrink-0" />{w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Пояснение */}
                  <div className="border border-amber-500/10 rounded-sm p-4 text-xs text-gray-500 italic">
                    {aiResult.why}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ПРОКАТЧИКИ ── */}
      {tab === "renters" && (
        <div>
          {/* Подвкладки */}
          <div className="flex gap-1 mb-6 border-b border-amber-500/10 overflow-x-auto">
            {[
              { key: "equipment",    label: "Оборудование",  count: renterEq.filter(e => e.status === "pending").length },
              { key: "categories",   label: "Разделы",       count: renterCats.filter(c => c.status === "pending").length },
              { key: "subcategories",label: "Подразделы",    count: renterSubs.filter(s => s.status === "pending").length },
              { key: "renters",      label: "Прокатчики",    count: renters.length },
            ].map(t => (
              <button key={t.key} onClick={() => setRenterSubTab(t.key as typeof renterSubTab)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition-all whitespace-nowrap ${
                  renterSubTab === t.key ? "border-amber-500 text-amber-500" : "border-transparent text-gray-500 hover:text-gray-300"
                }`}>
                {t.label}
                {t.count > 0 && <span className={`text-xs rounded-full px-1.5 py-0.5 ${renterSubTab === t.key ? "bg-amber-500/20 text-amber-500" : "bg-gray-800 text-gray-500"}`}>{t.count}</span>}
              </button>
            ))}
            <button onClick={loadRenters} disabled={rentersLoading}
              className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 pb-2 transition-colors">
              <Icon name="RefreshCw" size={12} className={rentersLoading ? "animate-spin" : ""} /> Обновить
            </button>
          </div>

          {rentersLoading ? (
            <div className="flex justify-center py-16"><Icon name="Loader2" size={32} className="text-amber-500 animate-spin" /></div>
          ) : renterSubTab === "equipment" ? (
            /* ── Модерация оборудования ── */
            <div className="space-y-3">
              {renterEq.length === 0 && <div className="glass-card rounded-sm p-12 text-center text-gray-500">Нет оборудования</div>}
              {renterEq.map(eq => (
                <div key={eq.id} className={`glass-card rounded-sm p-5 flex items-start gap-4 ${eq.status === "pending" ? "border border-amber-500/20" : ""}`}>
                  {eq.image && (
                    <div className="w-16 h-12 rounded-sm overflow-hidden border border-amber-500/10 shrink-0">
                      <img src={eq.image} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs border rounded-sm px-2 py-0.5 ${eq.status === "pending" ? "text-yellow-400 border-yellow-500/30" : eq.status === "approved" ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30"}`}>
                            {eq.status === "pending" ? "На модерации" : eq.status === "approved" ? "Опубликовано" : "Отклонено"}
                          </span>
                          <span className="text-xs border border-amber-500/20 text-amber-500/60 px-1.5 py-0.5 rounded-sm">{eq.category}</span>
                        </div>
                        <p className="text-white text-sm font-semibold">{eq.name}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className="font-oswald text-amber-500">{eq.price.toLocaleString()} ₽/{eq.unit}</span>
                          <span>{eq.renter_company}</span>
                          <span className="text-gray-700">{eq.renter_email}</span>
                        </div>
                        {eq.description && <p className="text-gray-600 text-xs mt-1 line-clamp-2">{eq.description}</p>}
                      </div>
                      {eq.status === "pending" && (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => approveEq(eq.id)}
                            className="flex items-center gap-1.5 border border-green-500/30 text-green-400 hover:bg-green-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                            <Icon name="CheckCircle" size={12} /> Одобрить
                          </button>
                          <button onClick={() => rejectEq(eq.id)}
                            className="flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                            <Icon name="XCircle" size={12} /> Отклонить
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          ) : renterSubTab === "categories" ? (
            /* ── Модерация разделов ── */
            <div className="space-y-3 max-w-2xl">
              {renterCats.length === 0 && <div className="glass-card rounded-sm p-12 text-center text-gray-500">Предложений разделов нет</div>}
              {renterCats.map(c => (
                <div key={c.id} className={`glass-card rounded-sm p-4 flex items-center justify-between gap-4 ${c.status === "pending" ? "border border-amber-500/20" : ""}`}>
                  <div className="flex items-center gap-3">
                    <Icon name="FolderOpen" size={16} className="text-amber-500/60 shrink-0" />
                    <div>
                      <p className="text-white text-sm font-semibold">{c.name}</p>
                      <p className="text-gray-600 text-xs">{c.renter_company} · {new Date(c.created_at).toLocaleDateString("ru-RU")}</p>
                    </div>
                    <span className={`text-xs border rounded-sm px-2 py-0.5 ${c.status === "pending" ? "text-yellow-400 border-yellow-500/30" : c.status === "approved" ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30"}`}>
                      {c.status === "pending" ? "На согласовании" : c.status === "approved" ? "Принят" : "Отклонён"}
                    </span>
                  </div>
                  {c.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => approveCat(c.id)}
                        className="flex items-center gap-1.5 border border-green-500/30 text-green-400 hover:bg-green-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                        <Icon name="CheckCircle" size={12} /> Одобрить и добавить в каталог
                      </button>
                      <button onClick={() => rejectCat(c.id)}
                        className="flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                        <Icon name="XCircle" size={12} /> Отклонить
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

          ) : renterSubTab === "subcategories" ? (
            /* ── Модерация подразделов ── */
            <div className="space-y-3 max-w-2xl">
              {renterSubs.length === 0 && <div className="glass-card rounded-sm p-12 text-center text-gray-500">Предложений подразделов нет</div>}
              {renterSubs.map(s => (
                <div key={s.id} className={`glass-card rounded-sm p-4 flex items-center justify-between gap-4 ${s.status === "pending" ? "border border-amber-500/20" : ""}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Icon name="Folder" size={16} className="text-amber-500/60 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">{s.category} /</span>
                        <p className="text-white text-sm font-semibold">{s.name}</p>
                      </div>
                      <p className="text-gray-600 text-xs">{s.renter_company} · {new Date(s.created_at).toLocaleDateString("ru-RU")}</p>
                    </div>
                    <span className={`text-xs border rounded-sm px-2 py-0.5 ${s.status === "pending" ? "text-yellow-400 border-yellow-500/30" : s.status === "approved" ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30"}`}>
                      {s.status === "pending" ? "На согласовании" : s.status === "approved" ? "Принят" : "Отклонён"}
                    </span>
                  </div>
                  {s.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => approveSub(s.id)}
                        className="flex items-center gap-1.5 border border-green-500/30 text-green-400 hover:bg-green-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                        <Icon name="CheckCircle" size={12} /> Одобрить
                      </button>
                      <button onClick={() => rejectSub(s.id)}
                        className="flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                        <Icon name="XCircle" size={12} /> Отклонить
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

          ) : (
            /* ── Список прокатчиков ── */
            <div className="space-y-3">
              {renters.length === 0 && <div className="glass-card rounded-sm p-12 text-center text-gray-500">Прокатчиков пока нет</div>}
              {renters.map(r => (
                <div key={r.id} className="glass-card rounded-sm p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs border rounded-sm px-2 py-0.5 ${r.status === "active" ? "text-green-400 border-green-500/30" : r.status === "blocked" ? "text-red-400 border-red-500/30" : "text-yellow-400 border-yellow-500/30"}`}>
                          {r.status === "active" ? "Активен" : r.status === "blocked" ? "Заблокирован" : "Ожидает"}
                        </span>
                      </div>
                      <p className="text-white text-sm font-semibold">{r.company_name}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                        <span>{r.contact_name}</span>
                        <a href={`tel:${r.phone}`} className="text-amber-500 hover:underline">{r.phone}</a>
                        <span className="text-gray-600">{r.email}</span>
                        <span>{r.city}</span>
                        {r.telegram && <a href={r.telegram} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1"><Icon name="Send" size={10} />TG</a>}
                      </div>
                      <div className="text-xs text-gray-700 mt-1">
                        Зарег. {new Date(r.created_at).toLocaleDateString("ru-RU")} · {renterEq.filter(e => e.renter_id === r.id).length} позиций
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {r.status !== "active" ? (
                        <button onClick={() => toggleRenterStatus(r.id, "approve_renter")}
                          className="flex items-center gap-1.5 border border-green-500/30 text-green-400 hover:bg-green-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                          <Icon name="UserCheck" size={12} /> Активировать
                        </button>
                      ) : (
                        <button onClick={() => { if (confirm("Заблокировать прокатчика?")) toggleRenterStatus(r.id, "block_renter"); }}
                          className="flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                          <Icon name="UserX" size={12} /> Заблокировать
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function PortfolioForm({
  data, categories, onChange, onSave, onCancel, password,
}: {
  data: Omit<PortfolioItem, "id">;
  categories: string[];
  onChange: (d: Omit<PortfolioItem, "id">) => void;
  onSave: () => void;
  onCancel: () => void;
  password?: string;
}) {
  const set = (field: string, val: unknown) => onChange({ ...data, [field]: val });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetch(`${(func2url as Record<string, string>)["upload-image"]}?pwd=${encodeURIComponent(password || "")}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: base64, name: file.name }),
        });
        const result = await res.json();
        if (result.url) set("image", result.url);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      {/* Фото */}
      <div>
        <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Фото проекта</label>
        <div className="flex items-center gap-3">
          {(data as PortfolioItem & { image?: string }).image ? (
            <div className="relative w-24 h-16 rounded-sm overflow-hidden border border-amber-500/20 shrink-0">
              <img src={(data as PortfolioItem & { image?: string }).image} alt="" className="w-full h-full object-cover" />
              <button onClick={() => set("image", "")}
                className="absolute top-1 right-1 w-5 h-5 bg-black/70 text-gray-300 hover:text-white rounded-sm flex items-center justify-center">
                <Icon name="X" size={10} />
              </button>
            </div>
          ) : (
            <div className="w-24 h-16 rounded-sm border border-dashed border-amber-500/20 flex items-center justify-center shrink-0" style={{ background: "var(--surface-2)" }}>
              <Icon name="Image" size={20} className="text-gray-700" />
            </div>
          )}
          <div className="flex-1">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 border border-amber-500/20 text-gray-400 hover:text-white px-3 py-1.5 rounded-sm text-xs transition-colors disabled:opacity-40">
              {uploading ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Upload" size={12} />}
              {uploading ? "Загружаю..." : "Загрузить фото"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Название *</label>
          <input value={data.title} onChange={(e) => set("title", e.target.value)}
            className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
        </div>
        <div>
          <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Категория</label>
          <select value={data.category} onChange={(e) => set("category", e.target.value)}
            className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50">
            {categories.map((c) => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Дата (напр. Март 2024)</label>
          <input value={data.date} onChange={(e) => set("date", e.target.value)}
            className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
        </div>
        <div>
          <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Гостей</label>
          <input type="number" value={data.guests} onChange={(e) => set("guests", Number(e.target.value))}
            className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Описание</label>
        <textarea value={data.description} onChange={(e) => set("description", e.target.value)} rows={2}
          className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Оборудование (через запятую)</label>
          <input
            value={data.equipment.join(", ")}
            onChange={(e) => set("equipment", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Теги (через запятую)</label>
          <input
            value={data.tags.join(", ")}
            onChange={(e) => set("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
        <input type="checkbox" checked={data.highlight} onChange={(e) => set("highlight", e.target.checked)}
          className="accent-amber-500 w-4 h-4" />
        Избранный проект (отображается с пометкой «Избранное»)
      </label>
      <div className="flex gap-3 pt-2">
        <button onClick={onSave} disabled={!data.title}
          className="neon-btn px-6 py-2 rounded-sm text-sm disabled:opacity-40">Сохранить</button>
        <button onClick={onCancel}
          className="border border-amber-500/20 text-gray-400 hover:text-white px-6 py-2 rounded-sm text-sm transition-colors">Отмена</button>
      </div>
    </div>
  );
}