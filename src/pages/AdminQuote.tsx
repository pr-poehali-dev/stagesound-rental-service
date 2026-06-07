import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { exportQuoteToXlsx } from "@/utils/exportQuoteXlsx";
import func2url from "../../backend/func2url.json";

const URLS = func2url as Record<string, string>;

// Города и их зоны доставки (цены редактируются менеджером)
const CITIES: Record<string, { label: string; zones: { name: string; defaultPrice: number }[] }> = {
  moscow: {
    label: "Москва",
    zones: [
      { name: "Без доставки", defaultPrice: 0 },
      { name: "Центр Москвы", defaultPrice: 4500 },
      { name: "Москва (в пределах МКАД)", defaultPrice: 6600 },
      { name: "Подмосковье (до 50 км)", defaultPrice: 10500 },
      { name: "Подмосковье (50–100 км)", defaultPrice: 16500 },
    ],
  },
  spb: {
    label: "Санкт-Петербург",
    zones: [
      { name: "Без доставки", defaultPrice: 0 },
      { name: "Центр СПб (внутри КАД)", defaultPrice: 4500 },
      { name: "Санкт-Петербург (за КАД)", defaultPrice: 6600 },
      { name: "Ленобласть (до 50 км)", defaultPrice: 10500 },
      { name: "Ленобласть (50–100 км)", defaultPrice: 16500 },
    ],
  },
  krasnoyarsk: {
    label: "Красноярск",
    zones: [
      { name: "Без доставки", defaultPrice: 0 },
      { name: "Центр Красноярска", defaultPrice: 4500 },
      { name: "Красноярск (все районы)", defaultPrice: 6600 },
      { name: "Пригород (до 50 км)", defaultPrice: 10500 },
      { name: "Красноярский край (50–100 км)", defaultPrice: 16500 },
    ],
  },
};

type ExtraService = { id: string; label: string; price: number };

const DEFAULT_EXTRAS: ExtraService[] = [
  { id: "install", label: "Монтаж и демонтаж", price: 15000 },
  { id: "tech", label: "Техник на месте (1 день)", price: 12000 },
  { id: "sound", label: "Звукорежиссёр (1 день)", price: 21000 },
  { id: "light", label: "Световой оператор (1 день)", price: 19500 },
];

type EqVariant = { label: string; price: number };
type Eq = { id: number; name: string; category: string; price: number; unit: string; image?: string; variants?: EqVariant[] };
type CartItem = { id: number; qty: number; customPrice?: number; customName?: string; isCustom?: boolean; variantLabel?: string; variantPrice?: number };

const iCls = "w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50";

export default function AdminQuote() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editIdRaw = searchParams.get("id");
  const editId = editIdRaw && editIdRaw !== "undefined" && !isNaN(Number(editIdRaw)) ? Number(editIdRaw) : null;
  const [editToken, setEditToken] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [password, setPassword] = useState(() => sessionStorage.getItem("admin_pwd") || "");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);

  const [equipment, setEquipment] = useState<Eq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Все");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [days, setDays] = useState(1);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // Город и доставка
  const [cityKey, setCityKey] = useState("moscow");
  const [deliveryZoneIdx, setDeliveryZoneIdx] = useState(0); // индекс зоны
  // Редактируемые цены доставки (по городу)
  const [deliveryPrices, setDeliveryPrices] = useState<Record<string, number[]>>({
    moscow: CITIES.moscow.zones.map((z) => z.defaultPrice),
    spb: CITIES.spb.zones.map((z) => z.defaultPrice),
    krasnoyarsk: CITIES.krasnoyarsk.zones.map((z) => z.defaultPrice),
  });

  // Доп. услуги с редактируемыми ценами
  const [extraServices, setExtraServices] = useState<ExtraService[]>(DEFAULT_EXTRAS);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  const [installationDate, setInstallationDate] = useState("");
  const [installationTime, setInstallationTime] = useState("");
  const [installationPrice, setInstallationPrice] = useState(0);
  const [dismantlingDate, setDismantlingDate] = useState("");
  const [dismantlingTime, setDismantlingTime] = useState("");
  const [dismantlingPrice, setDismantlingPrice] = useState(0);
  const [noInstallation, setNoInstallation] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountInput, setDiscountInput] = useState("");

  const [accessPin, setAccessPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState("");
  const [shareLink, setShareLink] = useState("");

  // Кастомная позиция
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customUnit, setCustomUnit] = useState("шт");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customIdCounter, setCustomIdCounter] = useState(-1);

  // Редактирование цены в корзине
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState("");

  // Выбор варианта (id позиции с вариантами, которую раскрыли)
  const [expandedVariantId, setExpandedVariantId] = useState<number | null>(null);

  const currentCity = CITIES[cityKey];
  const currentZones = currentCity.zones;
  const currentPrices = deliveryPrices[cityKey];
  const deliveryZone = currentZones[deliveryZoneIdx];
  const deliveryTotal = deliveryZoneIdx === 0 ? 0 : currentPrices[deliveryZoneIdx];

  const setDeliveryPrice = (idx: number, val: number) => {
    setDeliveryPrices((prev) => ({
      ...prev,
      [cityKey]: prev[cityKey].map((p, i) => (i === idx ? val : p)),
    }));
  };

  const setExtraPrice = (id: string, val: number) => {
    setExtraServices((prev) => prev.map((s) => (s.id === id ? { ...s, price: val } : s)));
  };

  const handleAuth = async () => {
    const res = await fetch(`${URLS["manage-quotes"]}?pwd=${encodeURIComponent(password)}`);
    if (res.ok) { sessionStorage.setItem("admin_pwd", password); setAuthed(true); setAuthError(false); }
    else setAuthError(true);
  };

  useEffect(() => { if (password) handleAuth(); }, []);

  useEffect(() => {
    if (!authed) return;
    // Загружаем каталог, и если editId — сразу после загружаем КП
    if (editId) setEditLoading(true);
    fetch(URLS["get-catalog"])
      .then((r) => r.json())
      .then((d) => {
        const catalog: Eq[] = d.equipment || [];
        setEquipment(catalog);
        setLoading(false);
        if (!editId) return;
        // Загружаем КП после каталога, чтобы fakeEq не затёрся
        return fetch(`${URLS["manage-quotes"]}?pwd=${encodeURIComponent(password)}&id=${editId}`)
          .then(r => r.json())
          .then((q: Record<string, unknown>) => {
            setTitle((q.title as string) || "");
            setEventDate((q.event_date as string) || "");
            setDeliveryAddress((q.delivery_address as string) || "");
            setDays(Number(q.days) || 1);
            setDiscount(Number(q.discount) || 0);
            setDiscountInput(q.discount ? String(q.discount) : "");
            setAccessPin((q.access_pin as string) || "");
            setEditToken((q.token as string) || null);

            // Восстанавливаем город и зону доставки
            const deliveryStr = (q.delivery as string) || "";
            let foundCity = "moscow";
            let foundZoneIdx = 0;
            for (const [key, city] of Object.entries(CITIES)) {
              for (let zi = 1; zi < city.zones.length; zi++) {
                if (deliveryStr.includes(city.zones[zi].name)) {
                  foundCity = key; foundZoneIdx = zi; break;
                }
              }
            }
            setCityKey(foundCity);
            // Восстанавливаем кастомную цену доставки если отличается от дефолтной
            const savedDeliveryPrice = Number(q.delivery_price) || 0;
            if (savedDeliveryPrice > 0 && foundZoneIdx > 0) {
              setDeliveryPrices(prev => ({
                ...prev,
                [foundCity]: prev[foundCity].map((p, i) => i === foundZoneIdx ? savedDeliveryPrice : p),
              }));
            }
            // setDeliveryZoneIdx после setCityKey — ставим напрямую
            setTimeout(() => setDeliveryZoneIdx(foundZoneIdx), 0);

            // Восстанавливаем время доставки и монтажа (хранятся как форматированные строки)
            const instTime = (q.installation_time as string) || "";
            const dismTime = (q.dismantling_time as string) || "";
            const delTime = (q.delivery_time as string) || "";
            const pickTime = (q.pickup_time as string) || "";
            // Разбиваем "5 июня, 09:00" → date="" time="5 июня, 09:00" (вставляем в текстовое поле)
            setInstallationTime(instTime);
            setDismantlingTime(dismTime);
            setDeliveryTime(delTime);
            setPickupTime(pickTime);

            // Восстанавливаем корзину из items
            const items = (q.items as {id:number|null;name:string;price:number;unit:string;qty:number}[]) || [];
            let counter = -1;
            const cartItems: CartItem[] = [];
            const fakeEq: Eq[] = [];
            for (const item of items) {
              if (item.id === null || item.id < 0) {
                // кастомная позиция
                const baseName = item.name.replace(/\s*\([^)]+\)$/, "").trim();
                cartItems.push({ id: counter, qty: item.qty, isCustom: true, customName: baseName, customPrice: item.price });
                fakeEq.push({ id: counter, name: baseName, category: "Другое", price: item.price, unit: item.unit });
                counter--;
              } else {
                // Парсим вариант из названия вида "Название (Вариант)"
                // Ищем совпадение с вариантами из каталога
                const catalogItem = catalog.find(e => e.id === item.id);
                const variantMatch = item.name.match(/\(([^)]+)\)$/);
                if (variantMatch && catalogItem?.variants?.find(v => v.label === variantMatch[1])) {
                  cartItems.push({ id: item.id, qty: item.qty, variantLabel: variantMatch[1], variantPrice: item.price });
                } else {
                  cartItems.push({ id: item.id, qty: item.qty, customPrice: item.price });
                }
              }
            }
            setCart(cartItems);
            if (fakeEq.length) setEquipment(prev => [...prev, ...fakeEq]);

            // Восстанавливаем extras с кастомными ценами
            const extras = (q.extras as {id:string; price:number}[]) || [];
            setSelectedExtras(extras.map(e => e.id).filter(Boolean));
            if (extras.length) {
              setExtraServices(prev => prev.map(s => {
                const saved = extras.find(e => e.id === s.id);
                return saved ? { ...s, price: saved.price } : s;
              }));
            }

            // Монтаж / доставка
            setNoInstallation(Boolean(q.no_installation));
            setInstallationPrice(Number(q.installation_price) || 0);
            setDismantlingPrice(Number(q.dismantling_price) || 0);
            // Восстанавливаем цену доставки как кастомную для текущей зоны (если отличается)
            // (уже сделано выше через setDeliveryPrices)

            setEditLoading(false);
          });
      })
      .catch(() => { setLoading(false); setEditLoading(false); });
  }, [authed]);

  // Сбрасываем зону при смене города
  useEffect(() => { setDeliveryZoneIdx(0); }, [cityKey]);

  const categories = useMemo(() => ["Все", ...Array.from(new Set(equipment.map((e) => e.category)))], [equipment]);
  const filtered = useMemo(() =>
    equipment.filter((e) => {
      const matchCat = catFilter === "Все" || e.category === catFilter;
      const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    }), [equipment, catFilter, search]);

  const cartKey = (id: number, variantLabel?: string) => variantLabel ? `${id}__${variantLabel}` : String(id);
  const getQty = (id: number, variantLabel?: string) => cart.find((c) => c.id === id && c.variantLabel === variantLabel)?.qty || 0;
  const getTotalQty = (id: number) => cart.filter((c) => c.id === id).reduce((s, c) => s + c.qty, 0);
  const addToCart = (id: number, variantLabel?: string, variantPrice?: number) => setCart((prev) => {
    const f = prev.find((c) => c.id === id && c.variantLabel === variantLabel);
    return f ? prev.map((c) => cartKey(c.id, c.variantLabel) === cartKey(id, variantLabel) ? { ...c, qty: c.qty + 1 } : c)
             : [...prev, { id, qty: 1, variantLabel, variantPrice }];
  });
  const removeFromCart = (id: number, variantLabel?: string) => setCart((prev) => {
    const f = prev.find((c) => c.id === id && c.variantLabel === variantLabel);
    if (!f) return prev;
    return f.qty <= 1 ? prev.filter((c) => cartKey(c.id, c.variantLabel) !== cartKey(id, variantLabel))
                      : prev.map((c) => cartKey(c.id, c.variantLabel) === cartKey(id, variantLabel) ? { ...c, qty: c.qty - 1 } : c);
  });
  const setQty = (id: number, qty: number, variantLabel?: string) => {
    if (qty <= 0) { setCart((prev) => prev.filter((c) => cartKey(c.id, c.variantLabel) !== cartKey(id, variantLabel))); return; }
    setCart((prev) => {
      const f = prev.find((c) => c.id === id && c.variantLabel === variantLabel);
      return f ? prev.map((c) => cartKey(c.id, c.variantLabel) === cartKey(id, variantLabel) ? { ...c, qty } : c)
               : [...prev, { id, qty, variantLabel, variantPrice: undefined }];
    });
  };
  const toggleExtra = (id: string) =>
    setSelectedExtras((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]);

  const addCustomToCart = () => {
    const p = Number(customPrice);
    if (!customName.trim() || !p) return;
    const id = customIdCounter;
    setCustomIdCounter((n) => n - 1);
    setCart((prev) => [...prev, { id, qty: 1, isCustom: true, customName: customName.trim(), customPrice: p }]);
    // добавляем как фейковый equipment чтобы корзина его находила
    setEquipment((prev) => [...prev, { id, name: customName.trim(), category: "Другое", price: p, unit: customUnit }]);
    setCustomName(""); setCustomPrice(""); setCustomUnit("шт");
    setShowCustomForm(false);
  };

  const setPriceOverride = (id: number, price: number) => {
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, customPrice: price } : c));
    setEquipment((prev) => prev.map((e) => e.id === id ? { ...e, price } : e));
  };

  const equipmentTotalRaw = useMemo(() =>
    cart.reduce((sum, item) => {
      const eq = equipment.find((e) => e.id === item.id);
      const price = item.customPrice !== undefined ? item.customPrice : (item.variantPrice !== undefined ? item.variantPrice : eq?.price ?? 0);
      return sum + (price * item.qty * days);
    }, 0), [cart, days, equipment]);

  const discountAmount = discount > 0 ? Math.round(equipmentTotalRaw * discount / 100) : 0;
  const equipmentTotal = equipmentTotalRaw - discountAmount;

  const extrasTotal = selectedExtras.reduce((sum, id) => {
    const s = extraServices.find((s) => s.id === id);
    return sum + (s ? s.price : 0);
  }, 0);
  const installDismantleTotal = (installationTime && !noInstallation ? installationPrice : 0) + (dismantlingTime && !noInstallation ? dismantlingPrice : 0);
  const total = equipmentTotal + extrasTotal + deliveryTotal + installDismantleTotal;

  const fmtDateTime = (date: string, time: string) => {
    const parts = [date ? new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "", time].filter(Boolean);
    return parts.join(", ") || null;
  };

  const buildPayload = () => {
    const items = cart.map((c) => {
      const eq = equipment.find((e) => e.id === c.id)!;
      const price = c.customPrice !== undefined ? c.customPrice : (c.variantPrice !== undefined ? c.variantPrice : eq.price);
      const name = c.variantLabel ? `${eq.name} (${c.variantLabel})` : eq.name;
      return { id: c.isCustom ? null : eq.id, name, price, unit: eq.unit, qty: c.qty };
    });
    const extrasData = selectedExtras.map((id) => {
      const s = extraServices.find((s) => s.id === id)!;
      return { id, name: s.label, price: s.price };
    });
    const deliveryName = deliveryZoneIdx === 0 ? "Без доставки" : `${currentCity.label} — ${deliveryZone.name}`;
    return {
      title: title || "КП без названия",
      items, days,
      delivery: deliveryName,
      delivery_price: deliveryTotal,
      extras: extrasData, total,
      event_date: eventDate,
      delivery_address: deliveryAddress,
      installation_time: noInstallation ? null : (fmtDateTime(installationDate, installationTime) || null),
      installation_price: noInstallation ? 0 : (installationTime ? installationPrice : 0),
      dismantling_time: noInstallation ? null : (fmtDateTime(dismantlingDate, dismantlingTime) || null),
      dismantling_price: noInstallation ? 0 : (dismantlingTime ? dismantlingPrice : 0),
      no_installation: noInstallation,
      delivery_time: fmtDateTime(deliveryDate, deliveryTime) || null,
      pickup_time: fmtDateTime(pickupDate, pickupTime) || null,
      discount,
      access_pin: accessPin.trim() || null,
    };
  };

  const handleSaveAndShare = async () => {
    if (cart.length === 0) return;
    setSaving(true);

    if (editId) {
      // Режим редактирования — PUT
      await fetch(`${URLS["manage-quotes"]}?pwd=${encodeURIComponent(password)}&id=${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (editToken) setShareLink(`${window.location.origin}/quote/${editToken}`);
      setSaving(false);
      return;
    }

    // Режим создания — POST
    const res = await fetch(`${URLS["manage-quotes"]}?pwd=${encodeURIComponent(password)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    const data = await res.json();
    await fetch(`${URLS["manage-quotes"]}?pwd=${encodeURIComponent(password)}&action=send&id=${data.id}`, { method: "POST" });
    setShareLink(`${window.location.origin}/quote/${data.token}`);
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
            onKeyDown={(e) => e.key === "Enter" && handleAuth()} placeholder="Пароль" className={`${iCls} mb-3`} />
          {authError && <p className="text-red-400 text-sm mb-3">Неверный пароль</p>}
          <button onClick={handleAuth} className="neon-btn w-full py-2 rounded-sm text-sm">Войти</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/admin")} className="text-gray-500 hover:text-amber-500 transition-colors">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div>
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Admin Panel</p>
            <h1 className="font-oswald text-3xl font-bold text-white uppercase">
              {editId ? "Редактирование КП" : "Новое коммерческое предложение"}
            </h1>
            {editId && <p className="text-gray-500 text-xs mt-0.5">КП #{editId} — не подписан, доступен для изменений</p>}
          </div>
        </div>

        {editLoading && (
          <div className="flex items-center justify-center gap-3 py-20 text-gray-400">
            <Icon name="Loader2" size={24} className="animate-spin text-amber-500" />
            Загружаю данные КП...
          </div>
        )}

        {shareLink && !editLoading ? (
          <div className="glass-card neon-border rounded-sm p-8 text-center max-w-2xl mx-auto">
            <Icon name="CheckCircle" size={48} className="text-amber-500 mx-auto mb-4" />
            <h2 className="font-oswald text-2xl font-bold text-white uppercase mb-2">
              {editId ? "КП обновлено!" : "КП готово!"}
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              {editId ? "Изменения сохранены. Ссылка клиенту остаётся прежней." : "Отправьте эту ссылку клиенту для согласования"}
            </p>
            <div className="bg-black/40 border border-amber-500/30 rounded-sm px-4 py-3 text-amber-400 text-sm break-all mb-4 text-left">{shareLink}</div>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={copyLink} className="neon-btn flex items-center gap-2 px-6 py-2 rounded-sm text-sm">
                <Icon name={copiedLink ? "Check" : "Copy"} size={14} />
                {copiedLink ? "Скопировано!" : "Скопировать ссылку"}
              </button>
              <button onClick={() => exportQuoteToXlsx(buildPayload())}
                className="flex items-center gap-2 border border-amber-500/30 text-amber-500/80 hover:text-amber-500 hover:border-amber-500/60 px-6 py-2 rounded-sm text-sm transition-colors">
                <Icon name="Download" size={14} />
                Скачать Excel
              </button>
              {editId ? (
                <button onClick={() => setShareLink("")}
                  className="border border-gray-700 text-gray-400 px-6 py-2 rounded-sm text-sm hover:border-gray-500 transition-colors">
                  Продолжить редактирование
                </button>
              ) : (
                <button onClick={() => { setShareLink(""); setCart([]); setTitle(""); setSelectedExtras([]); setEventDate(""); setDeliveryAddress(""); setInstallationTime(""); setInstallationPrice(0); setDismantlingTime(""); setDismantlingPrice(0); setNoInstallation(false); setDeliveryTime(""); setPickupTime(""); setDiscount(0); setDiscountInput(""); }}
                  className="border border-gray-700 text-gray-400 px-6 py-2 rounded-sm text-sm hover:border-gray-500 transition-colors">
                  Создать новое КП
                </button>
              )}
              <button onClick={() => navigate("/admin")}
                className="border border-gray-700 text-gray-400 px-6 py-2 rounded-sm text-sm hover:border-gray-500 transition-colors">
                В Admin Panel
              </button>
            </div>
          </div>
        ) : !editLoading ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* ── Каталог ── */}
            <div className="xl:col-span-2 space-y-4">
              <div className="glass-card rounded-sm p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск оборудования..." className={`${iCls} flex-1`} />
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
                    const hasVariants = eq.variants && eq.variants.length > 0;
                    const totalQty = getTotalQty(eq.id);
                    const isExpanded = expandedVariantId === eq.id;
                    return (
                      <div key={eq.id} className={`glass-card rounded-sm p-4 flex gap-3 transition-all ${totalQty > 0 ? "border border-amber-500/40" : ""}`}>
                        {eq.image && <img src={eq.image} alt={eq.name} className="w-16 h-16 object-cover rounded-sm shrink-0 opacity-80" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium leading-tight mb-1 truncate">{eq.name}</p>
                          {hasVariants ? (
                            <p className="text-amber-500 text-xs font-bold mb-2">от {Math.min(...eq.variants!.map(v => v.price)).toLocaleString()} ₽/{eq.unit}</p>
                          ) : (
                            <p className="text-amber-500 text-xs font-bold mb-3">{eq.price.toLocaleString()} ₽/{eq.unit}</p>
                          )}
                          {hasVariants ? (
                            <div>
                              <button
                                onClick={() => setExpandedVariantId(isExpanded ? null : eq.id)}
                                className="flex items-center gap-1 text-xs border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-2.5 py-1 rounded-sm transition-colors"
                              >
                                <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={11} />
                                {totalQty > 0 ? `Выбрано: ${totalQty} шт` : "Выбрать вариант"}
                              </button>
                              {isExpanded && (
                                <div className="mt-2 space-y-1">
                                  {eq.variants!.map((v) => {
                                    const vQty = getQty(eq.id, v.label);
                                    return (
                                      <div key={v.label} className="flex items-center justify-between bg-black/30 border border-amber-500/10 rounded-sm px-2 py-1.5">
                                        <span className="text-gray-300 text-xs flex-1 mr-2">{v.label}</span>
                                        <span className="text-amber-500 text-xs font-bold mr-2 shrink-0">{v.price.toLocaleString()} ₽</span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button onClick={() => removeFromCart(eq.id, v.label)}
                                            className="w-5 h-5 border border-amber-500/30 rounded-sm text-amber-500 hover:bg-amber-500/10 flex items-center justify-center text-xs">−</button>
                                          <span className="text-white text-xs w-4 text-center">{vQty}</span>
                                          <button onClick={() => addToCart(eq.id, v.label, v.price)}
                                            className="w-5 h-5 border border-amber-500/30 rounded-sm text-amber-500 hover:bg-amber-500/10 flex items-center justify-center text-xs">+</button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button onClick={() => removeFromCart(eq.id)}
                                className="w-7 h-7 border border-amber-500/30 rounded-sm text-amber-500 hover:bg-amber-500/10 flex items-center justify-center transition-colors text-base leading-none">−</button>
                              <span className="text-white text-sm w-6 text-center">{totalQty}</span>
                              <button onClick={() => addToCart(eq.id)}
                                className="w-7 h-7 border border-amber-500/30 rounded-sm text-amber-500 hover:bg-amber-500/10 flex items-center justify-center transition-colors text-base leading-none">+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filtered.length === 0 && <div className="col-span-2 text-center text-gray-500 py-12">Ничего не найдено</div>}
                </div>
              )}

              {/* Добавить свою позицию */}
              <div className="glass-card rounded-sm p-4">
                <button onClick={() => setShowCustomForm((v) => !v)}
                  className="flex items-center gap-2 text-amber-500/80 hover:text-amber-500 text-sm transition-colors w-full">
                  <Icon name={showCustomForm ? "ChevronUp" : "Plus"} size={15} />
                  Добавить позицию не из каталога
                </button>
                {showCustomForm && (
                  <div className="mt-3 space-y-2">
                    <input value={customName} onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Название позиции" className={iCls} />
                    <div className="flex gap-2">
                      <input type="number" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)}
                        placeholder="Цена ₽" className={`${iCls} flex-1`} />
                      <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)}
                        className="bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-gray-300 focus:outline-none w-24"
                        style={{ background: "#111" }}>
                        {["шт", "день", "час", "компл.", "услуга"].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <button onClick={addCustomToCart}
                      disabled={!customName.trim() || !customPrice}
                      className="neon-btn w-full py-2 rounded-sm text-sm disabled:opacity-40">
                      Добавить в КП
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Правая панель ── */}
            <div className="xl:col-span-1 space-y-4">

              {/* Название КП + детали мероприятия */}
              <div className="glass-card rounded-sm p-4 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Название КП</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Мероприятие, событие..." className={iCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Дата мероприятия</label>
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                    className={iCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Адрес доставки / проведения</label>
                  <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="г. Москва, ул. Примерная, д. 1" className={iCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                    <Icon name="Lock" size={11} className="inline mr-1 text-amber-500" />
                    Пароль на ссылку КП
                  </label>
                  <p className="text-gray-600 text-xs mb-2">Если не задан — ссылка открыта для всех</p>
                  <input value={accessPin} onChange={(e) => setAccessPin(e.target.value)}
                    placeholder="Например: 1234 или любое слово" className={iCls} />
                </div>
              </div>

              {/* Корзина */}
              <div className="glass-card rounded-sm p-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Выбранное оборудование</h3>
                {cart.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-4">Добавьте позиции из каталога</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {cart.map((c) => {
                      const eq = equipment.find((e) => e.id === c.id);
                      if (!eq) return null;
                      const price = c.customPrice !== undefined ? c.customPrice : (c.variantPrice !== undefined ? c.variantPrice : eq.price);
                      const ck = cartKey(c.id, c.variantLabel);
                      const isEditing = editingPriceId !== null && cartKey(editingPriceId, c.variantLabel) === ck;
                      return (
                        <div key={ck} className="text-sm">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-300 truncate">{eq.name}{c.variantLabel && <span className="text-gray-500 ml-1">({c.variantLabel})</span>}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editingPriceVal}
                                    onChange={(e) => setEditingPriceVal(e.target.value)}
                                    onBlur={() => { const v = Number(editingPriceVal); if (v > 0) { if (c.variantLabel) setCart(prev => prev.map(x => cartKey(x.id, x.variantLabel) === ck ? { ...x, variantPrice: v } : x)); else setPriceOverride(c.id, v); } setEditingPriceId(null); }}
                                    onKeyDown={(e) => { if (e.key === "Enter") { const v = Number(editingPriceVal); if (v > 0) { if (c.variantLabel) setCart(prev => prev.map(x => cartKey(x.id, x.variantLabel) === ck ? { ...x, variantPrice: v } : x)); else setPriceOverride(c.id, v); } setEditingPriceId(null); } }}
                                    autoFocus
                                    className="w-24 bg-transparent border border-amber-500/50 rounded-sm px-1.5 py-0.5 text-xs text-white focus:outline-none"
                                  />
                                ) : (
                                  <button onClick={() => { setEditingPriceId(c.id); setEditingPriceVal(String(price)); }}
                                    className="text-amber-500 text-xs hover:underline flex items-center gap-1">
                                    {price.toLocaleString()} ₽/{eq.unit}
                                    <Icon name="Pencil" size={10} />
                                  </button>
                                )}
                                <span className="text-gray-600 text-xs">× {c.qty} × {days} дн.</span>
                              </div>
                            </div>
                            <span className="text-white font-bold shrink-0">{(price * c.qty * days).toLocaleString()} ₽</span>
                            <button onClick={() => setQty(eq.id, 0, c.variantLabel)} className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                              <Icon name="X" size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Дней */}
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1 mt-2">Дней аренды</label>
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => setDays((d) => Math.max(1, d - 1))}
                    className="w-8 h-8 border border-amber-500/30 rounded-sm text-amber-500 hover:bg-amber-500/10 flex items-center justify-center transition-colors">−</button>
                  <span className="text-white font-bold text-lg w-8 text-center">{days}</span>
                  <button onClick={() => setDays((d) => d + 1)}
                    className="w-8 h-8 border border-amber-500/30 rounded-sm text-amber-500 hover:bg-amber-500/10 flex items-center justify-center transition-colors">+</button>
                </div>

                {/* Скидка */}
                {cart.length > 0 && (
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Скидка на оборудование</label>
                    <div className="flex items-center gap-2">
                      {[0, 5, 10, 15, 20].map(p => (
                        <button key={p} onClick={() => { setDiscount(p); setDiscountInput(p > 0 ? String(p) : ""); }}
                          className={`px-2.5 py-1 rounded-sm text-xs transition-colors ${discount === p ? "neon-btn" : "border border-amber-500/20 text-gray-500 hover:text-white"}`}>
                          {p === 0 ? "Нет" : `${p}%`}
                        </button>
                      ))}
                      <div className="flex items-center gap-1 ml-1">
                        <input type="number" min={0} max={90} value={discountInput}
                          onChange={e => setDiscountInput(e.target.value)}
                          onBlur={() => { const v = Math.min(90, Math.max(0, Number(discountInput) || 0)); setDiscount(v); setDiscountInput(v > 0 ? String(v) : ""); }}
                          placeholder="0"
                          className="w-14 bg-transparent border border-amber-500/20 rounded-sm px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-amber-500/50" />
                        <span className="text-gray-600 text-xs">%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Итог оборудование */}
                {cart.length > 0 && (
                  <div className="text-sm text-gray-400 mb-4 pb-4 border-b border-amber-500/10 space-y-1">
                    {discount > 0 && (
                      <div className="flex justify-between">
                        <span>Оборудование (до скидки)</span>
                        <span className="text-gray-600 line-through">{equipmentTotalRaw.toLocaleString()} ₽</span>
                      </div>
                    )}
                    {discount > 0 && (
                      <div className="flex justify-between text-green-400">
                        <span>Скидка {discount}%</span>
                        <span>−{discountAmount.toLocaleString()} ₽</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Оборудование{discount > 0 ? " (со скидкой)" : ""}</span>
                      <span className="text-white">{equipmentTotal.toLocaleString()} ₽</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Город и доставка */}
              <div className="glass-card rounded-sm p-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Город и доставка</h3>

                <label className="text-xs text-gray-600 block mb-1">Город</label>
                <select value={cityKey} onChange={(e) => setCityKey(e.target.value)}
                  className="w-full border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none mb-3"
                  style={{ background: "var(--surface-2, #111)" }}>
                  {Object.entries(CITIES).map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
                </select>

                <label className="text-xs text-gray-600 block mb-1">Зона доставки</label>
                <select value={deliveryZoneIdx} onChange={(e) => setDeliveryZoneIdx(Number(e.target.value))}
                  className="w-full border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none mb-3"
                  style={{ background: "var(--surface-2, #111)" }}>
                  {currentZones.map((z, i) => (
                    <option key={i} value={i}>
                      {z.name}{i > 0 ? ` — ${currentPrices[i].toLocaleString()} ₽` : ""}
                    </option>
                  ))}
                </select>

                {/* Редактирование цен доставки */}
                <details className="mt-1">
                  <summary className="text-xs text-amber-500/70 hover:text-amber-500 cursor-pointer select-none mb-2">
                    Изменить цены доставки
                  </summary>
                  <div className="space-y-2 mt-2">
                    {currentZones.slice(1).map((z, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs flex-1 truncate">{z.name}</span>
                        <input
                          type="number"
                          value={currentPrices[i + 1]}
                          onChange={(e) => setDeliveryPrice(i + 1, Number(e.target.value))}
                          className="w-24 bg-transparent border border-amber-500/20 rounded-sm px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-amber-500/50"
                        />
                        <span className="text-gray-600 text-xs">₽</span>
                      </div>
                    ))}
                  </div>
                </details>

                {deliveryTotal > 0 && (
                  <div className="flex justify-between text-sm text-gray-400 mt-3 pt-3 border-t border-amber-500/10">
                    <span>Доставка</span>
                    <span className="text-white">{deliveryTotal.toLocaleString()} ₽</span>
                  </div>
                )}
              </div>

              {/* Доп. услуги */}
              <div className="glass-card rounded-sm p-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Доп. услуги</h3>
                <div className="space-y-2">
                  {extraServices.map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedExtras.includes(s.id)}
                        onChange={() => toggleExtra(s.id)} className="w-4 h-4 accent-amber-500 shrink-0" />
                      <span className="text-gray-400 text-sm flex-1">{s.label}</span>
                      <input
                        type="number"
                        value={s.price}
                        onChange={(e) => setExtraPrice(s.id, Number(e.target.value))}
                        className="w-24 bg-transparent border border-amber-500/20 rounded-sm px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-amber-500/50"
                      />
                      <span className="text-gray-600 text-xs">₽</span>
                    </div>
                  ))}
                </div>
                {extrasTotal > 0 && (
                  <div className="flex justify-between text-sm text-gray-400 mt-3 pt-3 border-t border-amber-500/10">
                    <span>Доп. услуги</span>
                    <span className="text-white">{extrasTotal.toLocaleString()} ₽</span>
                  </div>
                )}
              </div>

              {/* Время привоза / увоза */}
              <div className="glass-card rounded-sm p-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Логистика</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-600 block mb-1.5">Привоз оборудования</label>
                    <div className="flex gap-2">
                      <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                        className="w-36 bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                      <input value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)}
                        placeholder="напр.: 08:00 — 10:00"
                        className={`${iCls} flex-1`} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1.5">Увоз оборудования</label>
                    <div className="flex gap-2">
                      <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)}
                        className="w-36 bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                      <input value={pickupTime} onChange={e => setPickupTime(e.target.value)}
                        placeholder="напр.: 23:00 — 01:00"
                        className={`${iCls} flex-1`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Монтаж и демонтаж */}
              <div className="glass-card rounded-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider">Монтаж и демонтаж</h3>
                  <button
                    onClick={() => setNoInstallation(v => !v)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border transition-colors ${noInstallation ? "border-green-500/50 text-green-400 bg-green-500/10" : "border-amber-500/20 text-gray-500 hover:text-white"}`}
                  >
                    <Icon name={noInstallation ? "CheckCircle" : "Circle"} size={12} />
                    Монтаж не нужен
                  </button>
                </div>

                {noInstallation ? (
                  <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-sm px-3 py-2.5">
                    <Icon name="CheckCircle" size={14} className="text-green-400" />
                    <p className="text-green-400 text-sm">Монтаж и демонтаж не требуются</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1.5">Монтаж</label>
                      <div className="flex gap-2">
                        <input type="date" value={installationDate} onChange={e => setInstallationDate(e.target.value)}
                          className="w-36 bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                        <input value={installationTime} onChange={e => setInstallationTime(e.target.value)}
                          placeholder="напр.: 10:00 — 14:00"
                          className={`${iCls} flex-1`} />
                        <input type="number" value={installationPrice || ""} onChange={e => setInstallationPrice(Number(e.target.value))}
                          placeholder="₽" className="w-20 bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-white text-right focus:outline-none focus:border-amber-500/50" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 block mb-1.5">Демонтаж</label>
                      <div className="flex gap-2">
                        <input type="date" value={dismantlingDate} onChange={e => setDismantlingDate(e.target.value)}
                          className="w-36 bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                        <input value={dismantlingTime} onChange={e => setDismantlingTime(e.target.value)}
                          placeholder="напр.: 23:00 — 02:00"
                          className={`${iCls} flex-1`} />
                        <input type="number" value={dismantlingPrice || ""} onChange={e => setDismantlingPrice(Number(e.target.value))}
                          placeholder="₽" className="w-20 bg-transparent border border-amber-500/20 rounded-sm px-2 py-2 text-sm text-white text-right focus:outline-none focus:border-amber-500/50" />
                      </div>
                    </div>
                  </div>
                )}

                {!noInstallation && installDismantleTotal > 0 && (
                  <div className="flex justify-between text-sm text-gray-400 mt-3 pt-3 border-t border-amber-500/10">
                    <span>Монтаж + демонтаж</span>
                    <span className="text-white">{installDismantleTotal.toLocaleString()} ₽</span>
                  </div>
                )}
              </div>

              {/* Итого и кнопка */}
              <div className="glass-card rounded-sm p-4">
                <div className="space-y-1 mb-4">
                  {equipmentTotalRaw > 0 && discount > 0 && (
                    <div className="flex justify-between text-sm text-gray-500 line-through">
                      <span>Оборудование</span><span>{equipmentTotalRaw.toLocaleString()} ₽</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-400">
                      <span>Скидка {discount}%</span><span>−{discountAmount.toLocaleString()} ₽</span>
                    </div>
                  )}
                  {equipmentTotal > 0 && (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Оборудование{discount > 0 ? " (со скидкой)" : ""}</span><span>{equipmentTotal.toLocaleString()} ₽</span>
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
                  {noInstallation ? (
                    <div className="flex justify-between text-sm text-green-400/70">
                      <span>Монтаж</span><span>не требуется</span>
                    </div>
                  ) : installDismantleTotal > 0 && (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Монтаж и демонтаж</span><span>{installDismantleTotal.toLocaleString()} ₽</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-amber-500/20">
                    <span>Итого</span>
                    <span className="text-amber-500">{total.toLocaleString()} ₽</span>
                  </div>
                </div>

                <button
                  onClick={handleSaveAndShare}
                  disabled={cart.length === 0 || saving}
                  className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name={saving ? "Loader2" : (editId ? "Save" : "Share2")} size={16} className={saving ? "animate-spin" : ""} />
                  {saving ? (editId ? "Сохраняю..." : "Создаю КП...") : (editId ? "Сохранить изменения" : "Сформировать и отправить клиенту")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}