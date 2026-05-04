import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

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
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: "Черновик", color: "text-gray-500 border-gray-700" },
    sent: { label: "Отправлено", color: "text-blue-400 border-blue-500/40" },
    approved: { label: "Согласовано", color: "text-green-400 border-green-500/40" },
    contracted: { label: "Договор", color: "text-amber-500 border-amber-500/40" },
    pending: { label: "Ожидает", color: "text-yellow-400 border-yellow-500/40" },
    reviewed: { label: "Просмотрено", color: "text-green-400 border-green-500/40" },
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
  const [tab, setTab] = useState<"orders" | "quotes" | "contracts">("orders");

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState("");

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

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

  useEffect(() => {
    if (!authed) return;
    if (tab === "orders") loadOrders();
    if (tab === "quotes") loadQuotes();
    if (tab === "contracts") loadContracts();
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
                          <td className="px-4 py-3 text-white font-medium">{q.title || "—"}</td>
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
                          <td className="px-4 py-3">{statusBadge(c.status)}</td>
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
          onClick={() => setSelectedContract(null)}>
          <div className="glass-card neon-border rounded-sm max-w-lg w-full max-h-[90vh] overflow-y-auto p-8"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="text-xs text-amber-500 uppercase tracking-widest">Договор #{selectedContract.id}</span>
                <h2 className="font-oswald text-2xl font-bold text-white mt-1">{selectedContract.quote_title}</h2>
                <p className="text-gray-500 text-xs mt-1">{formatDate(selectedContract.created_at)}</p>
              </div>
              <button onClick={() => setSelectedContract(null)} className="text-gray-600 hover:text-gray-300">
                <Icon name="X" size={20} />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              {statusBadge(selectedContract.status)}
              <span className="text-gray-500 text-xs">
                {selectedContract.client_type === "individual" ? "Физическое лицо" : "Юридическое лицо"}
              </span>
            </div>

            <div className="space-y-2 text-sm mb-6">
              {selectedContract.client_type === "individual" ? (
                <div className="flex gap-3"><span className="text-gray-500 w-32 shrink-0">ФИО</span><span className="text-white">{selectedContract.full_name || "—"}</span></div>
              ) : (
                <div className="flex gap-3"><span className="text-gray-500 w-32 shrink-0">Организация</span><span className="text-white">{selectedContract.company_name || "—"}</span></div>
              )}
              <div className="flex gap-3"><span className="text-gray-500 w-32 shrink-0">Телефон</span><span className="text-white">{selectedContract.phone || "—"}</span></div>
              <div className="flex gap-3"><span className="text-gray-500 w-32 shrink-0">Email</span><span className="text-white">{selectedContract.email || "—"}</span></div>
              <div className="flex gap-3"><span className="text-gray-500 w-32 shrink-0">Сумма</span><span className="text-amber-500 font-bold font-oswald text-lg">{selectedContract.total.toLocaleString()} ₽</span></div>
            </div>

            {selectedContract.passport_file_url && (
              <a href={selectedContract.passport_file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-4 py-2 rounded-sm text-sm transition-colors mb-4 w-fit">
                <Icon name="FileImage" size={14} /> Скан паспорта
              </a>
            )}

            <div className="flex gap-3 mt-4">
              {selectedContract.status === "pending" && (
                <button onClick={() => markContractReviewed(selectedContract.id)}
                  className="neon-btn flex-1 py-2 rounded-sm text-sm flex items-center justify-center gap-2">
                  <Icon name="Check" size={14} /> Отметить просмотренным
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
    </div>
  );
}
