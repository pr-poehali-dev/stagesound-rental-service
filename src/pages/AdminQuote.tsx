import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const URLS = func2url as Record<string, string>;

const extraServices = [
  { id: "install", label: "Монтаж и демонтаж", price: 15000 },
  { id: "tech", label: "Техник на месте (1 день)", price: 12000 },
  { id: "sound", label: "Звукорежиссёр (1 день)", price: 21000 },
  { id: "light", label: "Световой оператор (1 день)", price: 19500 },
];

const deliveryZones = [
  { name: "Без доставки", price: 0 },
  { name: "МКАД (до 30 км)", price: 5000 },
  { name: "30–60 км от МКАД", price: 9000 },
  { name: "60–100 км от МКАД", price: 15000 },
];

type Eq = {
  id: number; name: string; category: string; price: number; unit: string;
  image?: string; is_active: boolean;
};
type CartItem = { id: number; qty: number };

function inp(className = "") {
  return `w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 ${className}`;
}

export default function AdminQuote() {
  const navigate = useNavigate();
  const [password, setPassword] = useState(() => sessionStorage.getItem("admin_pwd") || "");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);

  const [equipment, setEquipment] = useState<Eq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Все");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [days, setDays] = useState(1);
  const [delivery, setDelivery] = useState("Без доставки");
  const [extras, setExtras] = useState<string[]>([]);
  const [title, setTitle] = useState("");

  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState("");
  const [shareLink, setShareLink] = useState("");

  // Auth
  const handleAuth = async () => {
    const res = await fetch(`${URLS["manage-quotes"]}?pwd=${encodeURIComponent(password)}`);
    if (res.ok) {
      sessionStorage.setItem("admin_pwd", password);
      setAuthed(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  useEffect(() => {
    if (password) handleAuth();
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetch(URLS["get-catalog"])
      .then((r) => r.json())
      .then((d) => { setEquipment((d.equipment || []).filter((e: Eq) => e.is_active)); setLoading(false); })
      .catch(() => setLoading(false));
  }, [authed]);

  const categories = useMemo(() => ["Все", ...Array.from(new Set(equipment.map((e) => e.category)))], [equipment]);

  const filtered = useMemo(() =>
    equipment.filter((e) => {
      const matchCat = catFilter === "Все" || e.category === catFilter;
      const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    }), [equipment, catFilter, search]);

  const getQty = (id: number) => cart.find((c) => c.id === id)?.qty || 0;

  const addToCart = (id: number) => setCart((prev) => {
    const found = prev.find((c) => c.id === id);
    if (found) return prev.map((c) => c.id === id ? { ...c, qty: c.qty + 1 } : c);
    return [...prev, { id, qty: 1 }];
  });

  const removeFromCart = (id: number) => setCart((prev) => {
    const found = prev.find((c) => c.id === id);
    if (!found) return prev;
    if (found.qty <= 1) return prev.filter((c) => c.id !== id);
    return prev.map((c) => c.id === id ? { ...c, qty: c.qty - 1 } : c);
  });

  const setQty = (id: number, qty: number) => {
    if (qty <= 0) { setCart((prev) => prev.filter((c) => c.id !== id)); return; }
    setCart((prev) => {
      const found = prev.find((c) => c.id === id);
      if (found) return prev.map((c) => c.id === id ? { ...c, qty } : c);
      return [...prev, { id, qty }];
    });
  };

  const toggleExtra = (id: string) => setExtras((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]);

  const equipmentTotal = useMemo(() =>
    cart.reduce((sum, item) => {
      const eq = equipment.find((e) => e.id === item.id);
      return sum + (eq ? eq.price * item.qty * days : 0);
    }, 0), [cart, days, equipment]);

  const extrasTotal = extras.reduce((sum, id) => {
    const s = extraServices.find((s) => s.id === id);
    return sum + (s ? s.price : 0);
  }, 0);
  const deliveryTotal = deliveryZones.find((z) => z.name === delivery)?.price || 0;
  const total = equipmentTotal + extrasTotal + deliveryTotal;

  const handleSaveAndShare = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    const items = cart.map((c) => {
      const eq = equipment.find((e) => e.id === c.id)!;
      return { id: eq.id, name: eq.name, price: eq.price, unit: eq.unit, qty: c.qty };
    });
    const extrasData = extras.map((id) => {
      const s = extraServices.find((s) => s.id === id)!;
      return { id, name: s.label, price: s.price };
    });
    const res = await fetch(`${URLS["manage-quotes"]}?pwd=${encodeURIComponent(password)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || "КП без названия", items, days, delivery, delivery_price: deliveryTotal, extras: extrasData, total }),
    });
    const data = await res.json();

    // Сразу помечаем как отправленное, получаем токен
    await fetch(`${URLS["manage-quotes"]}?pwd=${encodeURIComponent(password)}&action=send&id=${data.id}`, { method: "POST" });

    const link = `${window.location.origin}/quote/${data.token}`;
    setShareLink(link);
    setSaving(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(shareLink);
    setTimeout(() => setCopiedLink(""), 2000);
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
        <div className="glass-card rounded-sm p-8 w-full max-w-sm">
          <h2 className="font-oswald text-2xl font-bold text-white uppercase mb-6 text-center">Вход в Admin</h2>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            placeholder="Пароль" className={inp("mb-3")} />
          {authError && <p className="text-red-400 text-sm mb-3">Неверный пароль</p>}
          <button onClick={handleAuth} className="neon-btn w-full py-2 rounded-sm text-sm">Войти</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/admin")} className="text-gray-500 hover:text-amber-500 transition-colors">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div>
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Admin Panel</p>
            <h1 className="font-oswald text-3xl font-bold text-white uppercase">Новое коммерческое предложение</h1>
          </div>
        </div>

        {shareLink ? (
          /* ── Ссылка готова ── */
          <div className="glass-card neon-border rounded-sm p-8 text-center max-w-2xl mx-auto">
            <Icon name="CheckCircle" size={48} className="text-amber-500 mx-auto mb-4" />
            <h2 className="font-oswald text-2xl font-bold text-white uppercase mb-2">КП готово!</h2>
            <p className="text-gray-400 text-sm mb-6">Отправьте эту ссылку клиенту для согласования</p>
            <div className="bg-black/40 border border-amber-500/30 rounded-sm px-4 py-3 text-amber-400 text-sm break-all mb-4 text-left">
              {shareLink}
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={copyLink} className="neon-btn flex items-center gap-2 px-6 py-2 rounded-sm text-sm">
                <Icon name={copiedLink ? "Check" : "Copy"} size={14} />
                {copiedLink ? "Скопировано!" : "Скопировать ссылку"}
              </button>
              <button onClick={() => { setShareLink(""); setCart([]); setTitle(""); }}
                className="border border-gray-700 text-gray-400 px-6 py-2 rounded-sm text-sm hover:border-gray-500 transition-colors">
                Создать новое КП
              </button>
              <button onClick={() => navigate("/admin")}
                className="border border-gray-700 text-gray-400 px-6 py-2 rounded-sm text-sm hover:border-gray-500 transition-colors">
                В Admin Panel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* ── Каталог ── */}
            <div className="xl:col-span-2 space-y-4">
              <div className="glass-card rounded-sm p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск оборудования..." className={inp("flex-1")} />
                  <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
                    className="border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none"
                    style={{ background: "var(--surface-2, #111)" }}>
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="text-center text-gray-500 py-12">Загрузка каталога...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtered.map((eq) => {
                    const qty = getQty(eq.id);
                    return (
                      <div key={eq.id} className={`glass-card rounded-sm p-4 flex gap-3 transition-all ${qty > 0 ? "border border-amber-500/40" : ""}`}>
                        {eq.image && (
                          <img src={eq.image} alt={eq.name}
                            className="w-16 h-16 object-cover rounded-sm shrink-0 opacity-80" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium leading-tight mb-1 truncate">{eq.name}</p>
                          <p className="text-amber-500 text-xs font-bold mb-3">{eq.price.toLocaleString()} ₽/{eq.unit}</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => removeFromCart(eq.id)}
                              className="w-7 h-7 border border-amber-500/30 rounded-sm text-amber-500 hover:bg-amber-500/10 flex items-center justify-center text-lg leading-none transition-colors">−</button>
                            <span className="text-white text-sm w-6 text-center">{qty}</span>
                            <button onClick={() => addToCart(eq.id)}
                              className="w-7 h-7 border border-amber-500/30 rounded-sm text-amber-500 hover:bg-amber-500/10 flex items-center justify-center text-lg leading-none transition-colors">+</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="col-span-2 text-center text-gray-500 py-12">Ничего не найдено</div>
                  )}
                </div>
              )}
            </div>

            {/* ── Сводка КП ── */}
            <div className="xl:col-span-1 space-y-4">
              {/* Название КП */}
              <div className="glass-card rounded-sm p-4">
                <label className="text-xs text-gray-600 uppercase tracking-wider block mb-2">Название КП</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Мероприятие, событие..." className={inp()} />
              </div>

              {/* Корзина */}
              <div className="glass-card rounded-sm p-4">
                <h3 className="text-xs text-gray-600 uppercase tracking-wider mb-3">Выбранное оборудование</h3>
                {cart.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-4">Добавьте позиции из каталога</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {cart.map((c) => {
                      const eq = equipment.find((e) => e.id === c.id);
                      if (!eq) return null;
                      return (
                        <div key={c.id} className="flex items-center gap-2 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-300 truncate">{eq.name}</p>
                            <p className="text-amber-500 text-xs">{eq.price.toLocaleString()} × {c.qty} × {days} дн.</p>
                          </div>
                          <span className="text-white font-bold shrink-0">{(eq.price * c.qty * days).toLocaleString()} ₽</span>
                          <button onClick={() => setQty(eq.id, 0)} className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                            <Icon name="X" size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Дни */}
                <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1 mt-4">Дней аренды</label>
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => setDays((d) => Math.max(1, d - 1))}
                    className="w-8 h-8 border border-amber-500/30 rounded-sm text-amber-500 hover:bg-amber-500/10 flex items-center justify-center transition-colors">−</button>
                  <span className="text-white font-bold text-lg w-8 text-center">{days}</span>
                  <button onClick={() => setDays((d) => d + 1)}
                    className="w-8 h-8 border border-amber-500/30 rounded-sm text-amber-500 hover:bg-amber-500/10 flex items-center justify-center transition-colors">+</button>
                </div>

                {/* Доставка */}
                <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">Доставка</label>
                <select value={delivery} onChange={(e) => setDelivery(e.target.value)}
                  className="w-full border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none mb-4"
                  style={{ background: "var(--surface-2, #111)" }}>
                  {deliveryZones.map((z) => (
                    <option key={z.name} value={z.name}>{z.name}{z.price ? ` — ${z.price.toLocaleString()} ₽` : ""}</option>
                  ))}
                </select>

                {/* Доп. услуги */}
                <label className="text-xs text-gray-600 uppercase tracking-wider block mb-2">Доп. услуги</label>
                <div className="space-y-1 mb-4">
                  {extraServices.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={extras.includes(s.id)} onChange={() => toggleExtra(s.id)}
                        className="w-4 h-4 accent-amber-500" />
                      <span className="text-gray-400 flex-1">{s.label}</span>
                      <span className="text-gray-500">{s.price.toLocaleString()} ₽</span>
                    </label>
                  ))}
                </div>

                {/* Итог */}
                <div className="border-t border-amber-500/20 pt-3 space-y-1 mb-4">
                  {equipmentTotal > 0 && (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Оборудование</span><span>{equipmentTotal.toLocaleString()} ₽</span>
                    </div>
                  )}
                  {extrasTotal > 0 && (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Доп. услуги</span><span>{extrasTotal.toLocaleString()} ₽</span>
                    </div>
                  )}
                  {deliveryTotal > 0 && (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Доставка</span><span>{deliveryTotal.toLocaleString()} ₽</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-white pt-1">
                    <span>Итого</span><span className="text-amber-500">{total.toLocaleString()} ₽</span>
                  </div>
                </div>

                <button
                  onClick={handleSaveAndShare}
                  disabled={cart.length === 0 || saving}
                  className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name={saving ? "Loader2" : "Share2"} size={16} className={saving ? "animate-spin" : ""} />
                  {saving ? "Создаю КП..." : "Сформировать и отправить клиенту"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
