import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { equipment } from "@/data/equipment";
import { useSeo } from "@/hooks/useSeo";
import { useCity } from "@/context/CityContext";
import { CITY_CONTENT } from "@/data/cityContent";
import func2url from "../../backend/func2url.json";

const extraServices = [
  { id: "install", label: "Монтаж и демонтаж", price: 15000 },
  { id: "tech", label: "Техник на месте (1 день)", price: 12000 },
  { id: "sound", label: "Звукорежиссёр (1 день)", price: 21000 },
  { id: "light", label: "Световой оператор (1 день)", price: 19500 },
];

type CartItem = {
  id: number;
  qty: number;
};

export default function Calculator() {
  useSeo({ page: "calculator" });
  const { city } = useCity();
  const content = CITY_CONTENT[city.id] ?? CITY_CONTENT.moscow;
  const deliveryZones = [
    { name: "Без доставки", price: 0 },
    ...content.delivery.zones.map((z) => ({
      name: z.name,
      price: parseInt(z.price.replace(/\s/g, "").replace("₽", "")),
    })),
  ];

  const [cart, setCart] = useState<CartItem[]>([]);
  const [days, setDays] = useState(1);
  const [delivery, setDelivery] = useState("Без доставки");
  const [extras, setExtras] = useState<string[]>([]);
  const [step, setStep] = useState<"select" | "summary">("select");
  const [booked, setBooked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Все");

  const categories = ["Все", "Звук", "Свет", "Видео", "Сцена", "Конференц", "Генераторы"];

  const filteredEq = useMemo(() => {
    return equipment.filter((e) => {
      const matchCat = catFilter === "Все" || e.category === catFilter;
      const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [catFilter, search]);

  const addToCart = (id: number) => {
    setCart((prev) => {
      const found = prev.find((c) => c.id === id);
      if (found) return prev.map((c) => c.id === id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id, qty: 1 }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => {
      const found = prev.find((c) => c.id === id);
      if (!found) return prev;
      if (found.qty <= 1) return prev.filter((c) => c.id !== id);
      return prev.map((c) => c.id === id ? { ...c, qty: c.qty - 1 } : c);
    });
  };

  const getQty = (id: number) => cart.find((c) => c.id === id)?.qty || 0;

  const equipmentTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const eq = equipment.find((e) => e.id === item.id);
      return sum + (eq ? eq.price * item.qty * days : 0);
    }, 0);
  }, [cart, days]);

  const extrasTotal = extras.reduce((sum, id) => {
    const s = extraServices.find((s) => s.id === id);
    return sum + (s ? s.price : 0);
  }, 0);

  const deliveryTotal = deliveryZones.find((z) => z.name === delivery)?.price || 0;
  const total = equipmentTotal + extrasTotal + deliveryTotal;

  const toggleExtra = (id: string) => {
    setExtras((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]);
  };

  const handleSubmitOrder = async () => {
    if (!formName.trim() || !formPhone.trim()) return;
    setSending(true);
    const items = cart.map((c) => {
      const eq = equipment.find((e) => e.id === c.id)!;
      return { name: eq.name, qty: c.qty, subtotal: eq.price * c.qty * days };
    });
    const extrasLabels = extras.map((id) => extraServices.find((s) => s.id === id)?.label || id);
    await fetch(func2url["send-order"], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName, phone: formPhone, items, days, delivery, extras: extrasLabels, total }),
    });
    setSending(false);
    setShowForm(false);
    setBooked(true);
  };

  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        <div className="relative mb-10">
          <div className="section-number">07</div>
          <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Онлайн-расчёт</p>
          <h1 className="font-oswald text-5xl md:text-6xl font-bold uppercase text-white">Калькулятор аренды</h1>
        </div>

        {booked ? (
          <div className="glass-card neon-border rounded-sm p-16 flex flex-col items-center justify-center text-center max-w-xl mx-auto">
            <div className="w-20 h-20 flex items-center justify-center border-2 border-amber-500 rounded-sm mb-6 pulse-neon">
              <Icon name="CheckCircle" size={40} className="text-amber-500" />
            </div>
            <h2 className="font-oswald text-4xl font-bold text-white uppercase mb-3">Бронирование оформлено!</h2>
            <p className="text-gray-400 mb-2">Заявка на сумму <span className="neon-text font-bold">{total.toLocaleString()} ₽</span> принята.</p>
            <p className="text-gray-500 text-sm mb-8">Менеджер свяжется с вами в течение 30 минут для подтверждения.</p>
            <div className="flex gap-3">
              <button onClick={() => { setBooked(false); setCart([]); setStep("select"); }} className="text-amber-500 text-sm uppercase tracking-wider hover:text-white transition-colors">
                Новый расчёт
              </button>
              <Link to="/contacts" className="neon-btn px-6 py-3 rounded-sm text-sm">
                Связаться с нами
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left: Equipment selector */}
            <div className="xl:col-span-2 space-y-6">
              {/* Step 1: Equipment */}
              <div className="glass-card rounded-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 neon-btn flex items-center justify-center text-sm font-bold">1</div>
                  <h2 className="font-oswald text-xl font-bold text-white uppercase">Выбор оборудования</h2>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCatFilter(c)}
                      className={`px-3 py-1 text-xs rounded-sm uppercase tracking-wider transition-all ${catFilter === c ? "neon-btn" : "border border-amber-500/20 text-gray-500 hover:text-white"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <div className="relative mb-4">
                  <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск оборудования..."
                    className="w-full bg-transparent border border-amber-500/20 rounded-sm pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredEq.map((item) => {
                    const qty = getQty(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-sm border transition-all ${qty > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-amber-500/10 hover:border-amber-500/20"}`}
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="text-sm font-medium text-white truncate">{item.name}</div>
                          <div className="text-xs text-gray-600">{item.category} · {item.price.toLocaleString()} ₽/{item.unit}</div>
                          {item.category === "Сцена" && item.description && (
                            <div className="text-xs text-gray-500 mt-1 leading-relaxed">{item.description}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {qty > 0 ? (
                            <>
                              <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 flex items-center justify-center border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 rounded-sm transition-colors">
                                <Icon name="Minus" size={12} />
                              </button>
                              <span className="text-white font-bold w-5 text-center text-sm">{qty}</span>
                              <button onClick={() => addToCart(item.id)} className="w-7 h-7 flex items-center justify-center neon-btn rounded-sm">
                                <Icon name="Plus" size={12} />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => addToCart(item.id)} className="neon-btn px-3 py-1 text-xs rounded-sm">
                              + Добавить
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Dates */}
              <div className="glass-card rounded-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 neon-btn flex items-center justify-center text-sm font-bold">2</div>
                  <h2 className="font-oswald text-xl font-bold text-white uppercase">Срок аренды</h2>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setDays(Math.max(1, days - 1))}
                    className="w-10 h-10 flex items-center justify-center border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 rounded-sm transition-colors"
                  >
                    <Icon name="Minus" size={16} />
                  </button>
                  <div className="text-center">
                    <div className="font-oswald text-4xl font-bold neon-text">{days}</div>
                    <div className="text-gray-600 text-xs uppercase tracking-wider">{days === 1 ? "день" : days < 5 ? "дня" : "дней"}</div>
                  </div>
                  <button
                    onClick={() => setDays(days + 1)}
                    className="w-10 h-10 flex items-center justify-center neon-btn rounded-sm"
                  >
                    <Icon name="Plus" size={16} />
                  </button>
                  <div className="ml-4 flex flex-wrap gap-2">
                    {[1, 2, 3, 5, 7].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDays(d)}
                        className={`px-3 py-1 text-xs rounded-sm transition-all ${days === d ? "neon-btn" : "border border-amber-500/20 text-gray-500 hover:text-white"}`}
                      >
                        {d} {d === 1 ? "день" : d < 5 ? "дня" : "дней"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 3: Delivery */}
              <div className="glass-card rounded-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 neon-btn flex items-center justify-center text-sm font-bold">3</div>
                  <h2 className="font-oswald text-xl font-bold text-white uppercase">Доставка</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {deliveryZones.map((zone) => (
                    <button
                      key={zone.name}
                      onClick={() => setDelivery(zone.name)}
                      className={`p-3 rounded-sm border text-left transition-all ${delivery === zone.name ? "border-amber-500/50 bg-amber-500/5" : "border-amber-500/10 hover:border-amber-500/20"}`}
                    >
                      <div className="text-sm text-white">{zone.name}</div>
                      <div className={`text-xs font-bold ${delivery === zone.name ? "neon-text" : "text-gray-500"}`}>
                        {zone.price === 0 ? "Бесплатно" : `${zone.price.toLocaleString()} ₽`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 4: Extras */}
              <div className="glass-card rounded-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 neon-btn flex items-center justify-center text-sm font-bold">4</div>
                  <h2 className="font-oswald text-xl font-bold text-white uppercase">Дополнительные услуги</h2>
                </div>
                <div className="space-y-2">
                  {extraServices.map((s) => (
                    <label
                      key={s.id}
                      className={`flex items-center justify-between p-3 rounded-sm border cursor-pointer transition-all ${extras.includes(s.id) ? "border-amber-500/40 bg-amber-500/5" : "border-amber-500/10 hover:border-amber-500/20"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 border rounded-sm flex items-center justify-center transition-colors ${extras.includes(s.id) ? "bg-amber-500 border-amber-500" : "border-gray-600"}`}>
                          {extras.includes(s.id) && <Icon name="Check" size={10} className="text-black" />}
                        </div>
                        <span className="text-sm text-white">{s.label}</span>
                      </div>
                      <span className="text-xs neon-text font-bold">{s.price.toLocaleString()} ₽</span>
                      <input type="checkbox" className="hidden" checked={extras.includes(s.id)} onChange={() => toggleExtra(s.id)} />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Summary */}
            <div>
              <div className="glass-card neon-border rounded-sm p-6 sticky top-20">
                <h2 className="font-oswald text-xl font-bold text-white uppercase mb-4">Итог</h2>

                {cart.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    <Icon name="ShoppingCart" size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Добавьте оборудование из каталога слева</p>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {cart.map((item) => {
                      const eq = equipment.find((e) => e.id === item.id)!;
                      return (
                        <div key={item.id} className="flex items-start justify-between text-sm gap-2">
                          <span className="text-gray-400 flex-1 text-xs leading-tight">{eq.name} × {item.qty} × {days} д.</span>
                          <span className="text-white font-medium shrink-0">{(eq.price * item.qty * days).toLocaleString()} ₽</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-2 border-t border-amber-500/10 pt-4 mb-4 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Оборудование ({days} д.)</span>
                    <span>{equipmentTotal.toLocaleString()} ₽</span>
                  </div>
                  {deliveryTotal > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Доставка</span>
                      <span>{deliveryTotal.toLocaleString()} ₽</span>
                    </div>
                  )}
                  {extrasTotal > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Доп. услуги</span>
                      <span>{extrasTotal.toLocaleString()} ₽</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between py-3 border-t border-amber-500/20 mb-6">
                  <span className="font-oswald text-lg font-bold text-white uppercase">Итого</span>
                  <span className="font-oswald text-3xl font-bold neon-text">{total.toLocaleString()} ₽</span>
                </div>

                <button
                  onClick={() => { if (cart.length > 0) setShowForm(true); }}
                  disabled={cart.length === 0}
                  className="neon-btn w-full py-4 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name="CalendarCheck" size={16} />
                  Забронировать
                </button>

                <Link to="/contacts" className="block text-center text-xs text-gray-600 hover:text-amber-500 mt-3 transition-colors">
                  Нужна помощь с подбором?
                </Link>

                {cart.length > 0 && (
                  <div className="mt-4 p-3 border border-amber-500/10 rounded-sm">
                    <div className="flex items-center gap-2 text-xs text-amber-500/70">
                      <Icon name="Info" size={12} />
                      Наличие оборудования подтверждается менеджером после заявки
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Форма контактов */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowForm(false)}
        >
          <div
            className="glass-card neon-border rounded-sm max-w-md w-full p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <Icon name="X" size={20} />
            </button>
            <h2 className="font-oswald text-2xl font-bold text-white uppercase mb-1">Оформить заявку</h2>
            <p className="text-gray-500 text-sm mb-6">Укажите контакты — менеджер свяжется в течение 30 минут</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Ваше имя</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Иван Иванов"
                  className="w-full bg-transparent border border-amber-500/30 rounded-sm px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/70 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Телефон</label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+7 (999) 000-00-00"
                  className="w-full bg-transparent border border-amber-500/30 rounded-sm px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/70 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-amber-500/10 mb-6">
              <span className="text-gray-400 text-sm">Итого</span>
              <span className="font-oswald text-2xl font-bold neon-text">{total.toLocaleString()} ₽</span>
            </div>

            <button
              onClick={handleSubmitOrder}
              disabled={!formName.trim() || !formPhone.trim() || sending}
              className="neon-btn w-full py-4 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Send" size={16} />}
              {sending ? "Отправляем..." : "Отправить заявку"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}