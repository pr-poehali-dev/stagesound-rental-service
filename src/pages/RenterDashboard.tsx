import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const URLS = func2url as Record<string, string>;
const EQ_URL = URLS["renter-equipment"];
const AUTH_URL = URLS["renter-auth"];
const ORDER_URL = URLS["renter-orders"];
const IMG_URL = URLS["upload-image"];

// ── Типы ────────────────────────────────────────────────────────────────────
type Renter = {
  id: number; email: string; company_name: string; contact_name: string;
  phone: string; city: string; telegram?: string; description?: string; status: string;
};
type Variant = { label: string; price: number };
type RenterEq = {
  id: number; name: string; category: string; subcategory?: string;
  price: number; unit: string; description: string; specs: Record<string, string>;
  tags: string[]; image?: string; status: string; is_active: boolean; created_at: string;
  variants: Variant[];
};
type RenterCat = { id: number; name: string; status: string; created_at?: string; mine: boolean };
type RenterSub = { id: number; name: string; category: string; status: string; created_at?: string; mine: boolean };
type RenterOrder = {
  id: number; order_id: number; equipment_name: string; qty: number;
  days: number; subtotal: number; status: string; created_at: string;
  client_name?: string; client_phone?: string; event_date?: string; place?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const specsToStr = (specs: Record<string, string>) =>
  Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join("\n");

const parseSpecs = (str: string): Record<string, string> => {
  const res: Record<string, string> = {};
  str.split("\n").forEach(line => {
    const idx = line.indexOf(":");
    if (idx > 0) res[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  });
  return res;
};

const statusBadge = (status: string, type: "eq" | "cat" | "order" = "eq") => {
  const maps = {
    eq: {
      pending:  { label: "На модерации", cls: "text-yellow-400 border-yellow-500/30" },
      approved: { label: "Опубликовано", cls: "text-green-400 border-green-500/30" },
      rejected: { label: "Отклонено",    cls: "text-red-400 border-red-500/30" },
    },
    cat: {
      pending:  { label: "На согласовании", cls: "text-yellow-400 border-yellow-500/30" },
      approved: { label: "Принят",          cls: "text-green-400 border-green-500/30" },
      rejected: { label: "Отклонён",        cls: "text-red-400 border-red-500/30" },
    },
    order: {
      new:      { label: "Новый",   cls: "text-amber-400 border-amber-500/30" },
      accepted: { label: "Принят",  cls: "text-green-400 border-green-500/30" },
      declined: { label: "Отказан", cls: "text-red-400 border-red-500/30" },
    },
  };
  const m = (maps[type] as Record<string, { label: string; cls: string }>)[status]
    || { label: status, cls: "text-gray-400 border-gray-600" };
  return <span className={`text-xs border rounded-sm px-2 py-0.5 ${m.cls}`}>{m.label}</span>;
};

const EMPTY_EQ = {
  name: "", category: "", subcategory: "", price: 0, unit: "день",
  description: "", tags: "", image: "", specsStr: "", variants: [] as Variant[],
};

// ── Компонент ────────────────────────────────────────────────────────────────
export default function RenterDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("renter_token") || "";
  const fileRef = useRef<HTMLInputElement>(null);

  const [renter, setRenter] = useState<Renter | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tab, setTab] = useState<"equipment" | "categories" | "subcategories" | "orders">("equipment");

  // Оборудование
  const [equipment, setEquipment] = useState<RenterEq[]>([]);
  const [eqLoading, setEqLoading] = useState(false);
  const [editEq, setEditEq] = useState<RenterEq | null>(null);
  const [showNewEq, setShowNewEq] = useState(false);
  const [newEq, setNewEq] = useState({ ...EMPTY_EQ });
  const [uploading, setUploading] = useState(false);
  const [eqError, setEqError] = useState("");
  const [eqSuccess, setEqSuccess] = useState("");
  const [eqSaving, setEqSaving] = useState(false);
  const [editSpecsStr, setEditSpecsStr] = useState("");
  const [newSpecsStr, setNewSpecsStr] = useState("");

  // Категории
  const [allCats, setAllCats] = useState<{ id: number; name: string }[]>([]);
  const [mineCats, setMineCats] = useState<RenterCat[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");
  const [catSuccess, setCatSuccess] = useState("");

  // Подкатегории
  const [allSubs, setAllSubs] = useState<RenterSub[]>([]);
  const [mineSubs, setMineSubs] = useState<RenterSub[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubCat, setNewSubCat] = useState("");
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState("");
  const [subSuccess, setSubSuccess] = useState("");

  // Заказы
  const [orders, setOrders] = useState<RenterOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const hdrs = { "X-Renter-Token": token };

  // ── Авторизация ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { navigate("/renter/login"); return; }
    fetch(AUTH_URL, { headers: hdrs })
      .then(r => r.json())
      .then(d => {
        if (d.error) { localStorage.removeItem("renter_token"); navigate("/renter/login"); return; }
        setRenter(d);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // ── Загрузки по вкладке ──────────────────────────────────────────
  const loadEquipment = () => {
    setEqLoading(true);
    fetch(EQ_URL, { headers: hdrs })
      .then(r => r.json())
      .then(d => setEquipment(Array.isArray(d) ? d : []))
      .finally(() => setEqLoading(false));
  };

  const loadCategories = () => {
    setCatsLoading(true);
    fetch(`${EQ_URL}?resource=categories`, { headers: hdrs })
      .then(r => r.json())
      .then(d => { setMineCats(d.mine || []); setAllCats(d.all || []); })
      .finally(() => setCatsLoading(false));
  };

  const loadSubcategories = () => {
    setSubsLoading(true);
    fetch(`${EQ_URL}?resource=subcategories`, { headers: hdrs })
      .then(r => r.json())
      .then(d => { setMineSubs(d.mine || []); setAllSubs(d.all || []); })
      .finally(() => setSubsLoading(false));
  };

  const loadOrders = () => {
    setOrdersLoading(true);
    fetch(ORDER_URL, { headers: hdrs })
      .then(r => r.json())
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .finally(() => setOrdersLoading(false));
  };

  useEffect(() => {
    if (!renter) return;
    if (tab === "equipment")    loadEquipment();
    if (tab === "categories")   loadCategories();
    if (tab === "subcategories") loadSubcategories();
    if (tab === "orders")       loadOrders();
  }, [tab, renter]);

  // ── Выход ────────────────────────────────────────────────────────
  const logout = () => {
    fetch(`${AUTH_URL}?action=logout`, { method: "POST", headers: hdrs })
      .finally(() => { localStorage.removeItem("renter_token"); navigate("/renter/login"); });
  };

  // ── Загрузка фото ────────────────────────────────────────────────
  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch(IMG_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file: reader.result, name: file.name }),
          });
          const d = await res.json();
          resolve(d.url || null);
        } catch { resolve(null); }
        finally { setUploading(false); }
      };
      reader.readAsDataURL(file);
    });
  };

  // ── Сохранить оборудование ───────────────────────────────────────
  const saveEq = async (isEdit: boolean) => {
    setEqError(""); setEqSuccess(""); setEqSaving(true);
    try {
      const base = isEdit ? editEq! : newEq;
      const specsStr = isEdit ? editSpecsStr : newSpecsStr;
      const variants = isEdit
        ? (editEq as RenterEq).variants || []
        : (newEq as typeof EMPTY_EQ).variants || [];
      const payload = {
        ...(isEdit ? { id: editEq!.id } : {}),
        name: (base as typeof newEq).name ?? (base as RenterEq).name,
        category: (base as typeof newEq).category ?? (base as RenterEq).category,
        subcategory: (base as typeof newEq).subcategory ?? (base as RenterEq).subcategory,
        price: Number((base as typeof newEq).price ?? (base as RenterEq).price),
        unit: (base as typeof newEq).unit ?? (base as RenterEq).unit,
        description: (base as typeof newEq).description ?? (base as RenterEq).description,
        image: (base as typeof newEq).image ?? (base as RenterEq).image,
        tags: typeof (base as typeof newEq).tags === "string"
          ? (base as typeof newEq).tags.split(",").map((t: string) => t.trim()).filter(Boolean)
          : (base as RenterEq).tags,
        specs: parseSpecs(specsStr),
        variants,
      };
      const res = await fetch(EQ_URL, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...hdrs },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Ошибка");
      setEqSuccess(d.message || "Отправлено на модерацию");
      setEditEq(null); setShowNewEq(false);
      setNewEq({ ...EMPTY_EQ }); setNewSpecsStr("");
      loadEquipment();
    } catch (e: unknown) {
      setEqError(e instanceof Error ? e.message : "Ошибка");
    } finally { setEqSaving(false); }
  };

  const openEditEq = (eq: RenterEq) => {
    setEditEq(eq);
    setEditSpecsStr(specsToStr(eq.specs || {}));
    setEqError(""); setEqSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Категории CRUD ───────────────────────────────────────────────
  const createCat = async () => {
    setCatError(""); setCatSuccess(""); setCatSaving(true);
    try {
      const res = await fetch(`${EQ_URL}?resource=categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...hdrs },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Ошибка");
      setCatSuccess(d.message || "Раздел отправлен на согласование");
      setNewCatName("");
      loadCategories();
    } catch (e: unknown) {
      setCatError(e instanceof Error ? e.message : "Ошибка");
    } finally { setCatSaving(false); }
  };

  const deleteCat = async (id: number) => {
    if (!confirm("Удалить предложение раздела?")) return;
    await fetch(`${EQ_URL}?resource=categories&id=${id}`, { method: "DELETE", headers: hdrs });
    loadCategories();
  };

  // ── Подкатегории CRUD ────────────────────────────────────────────
  const createSub = async () => {
    setSubError(""); setSubSuccess(""); setSubSaving(true);
    try {
      const res = await fetch(`${EQ_URL}?resource=subcategories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...hdrs },
        body: JSON.stringify({ name: newSubName.trim(), category: newSubCat }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Ошибка");
      setSubSuccess(d.message || "Подраздел отправлен на согласование");
      setNewSubName(""); setNewSubCat("");
      loadSubcategories();
    } catch (e: unknown) {
      setSubError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSubSaving(false); }
  };

  const deleteSub = async (id: number) => {
    if (!confirm("Удалить предложение подраздела?")) return;
    await fetch(`${EQ_URL}?resource=subcategories&id=${id}`, { method: "DELETE", headers: hdrs });
    loadSubcategories();
  };

  // ── Заказы ───────────────────────────────────────────────────────
  const respondOrder = async (id: number, status: "accepted" | "declined") => {
    await fetch(`${ORDER_URL}?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...hdrs },
      body: JSON.stringify({ status }),
    });
    loadOrders();
  };

  const newOrdersCount = orders.filter(o => o.status === "new").length;
  const pendingCatsCount = mineCats.filter(c => c.status === "pending").length;
  const pendingSubsCount = mineSubs.filter(s => s.status === "pending").length;

  // ── Список категорий для select (все одобренные + свои одобренные) ──
  const availableCategories = allCats.map(c => c.name);

  // ── Форма оборудования (переиспользуется для новой и редактирования) ──
  const EqForm = ({ isEdit }: { isEdit: boolean }) => {
    const base = isEdit ? editEq! : newEq;
    const setF = isEdit
      ? (upd: Partial<typeof newEq>) => setEditEq(e => e ? ({ ...e, ...upd } as RenterEq) : e)
      : (upd: Partial<typeof newEq>) => setNewEq(e => ({ ...e, ...upd }));
    const specsStr = isEdit ? editSpecsStr : newSpecsStr;
    const setSpecsStr = isEdit ? setEditSpecsStr : setNewSpecsStr;
    const name = (base as typeof newEq).name ?? (base as RenterEq).name ?? "";
    const category = (base as typeof newEq).category ?? (base as RenterEq).category ?? "";
    const subcategory = (base as typeof newEq).subcategory ?? (base as RenterEq).subcategory ?? "";
    const price = (base as typeof newEq).price ?? (base as RenterEq).price ?? 0;
    const unit = (base as typeof newEq).unit ?? (base as RenterEq).unit ?? "день";
    const description = (base as typeof newEq).description ?? (base as RenterEq).description ?? "";
    const tagsVal = typeof (base as typeof newEq).tags === "string"
      ? (base as typeof newEq).tags
      : ((base as RenterEq).tags || []).join(", ");
    const image = (base as typeof newEq).image ?? (base as RenterEq).image ?? "";

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Название *</label>
            <input value={name} onChange={e => setF({ name: e.target.value })}
              placeholder="Напр.: Line Array JBL VTX A12"
              className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Раздел *</label>
            <select value={category} onChange={e => setF({ category: e.target.value })}
              className="w-full bg-[#111] border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-amber-500/60">
              <option value="">— выберите —</option>
              {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Подраздел</label>
            <select value={subcategory} onChange={e => setF({ subcategory: e.target.value })}
              className="w-full bg-[#111] border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-amber-500/60">
              <option value="">— без подраздела —</option>
              {allSubs.filter(s => s.category === category).map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Цена</label>
            <div className="flex gap-2">
              <input type="number" value={price} onChange={e => setF({ price: Number(e.target.value) })}
                className="flex-1 bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60" />
              <select value={unit} onChange={e => setF({ unit: e.target.value })}
                className="bg-[#111] border border-amber-500/20 rounded-sm px-2 py-2.5 text-sm text-gray-300 focus:outline-none">
                <option>день</option><option>час</option><option>шт</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Описание</label>
          <textarea value={description} onChange={e => setF({ description: e.target.value })}
            rows={3} placeholder="Технические характеристики, особенности, комплектация..."
            className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60 resize-none" />
        </div>

        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
            Характеристики <span className="text-gray-700 normal-case">(каждая с новой строки: Ключ: Значение)</span>
          </label>
          <textarea value={specsStr} onChange={e => setSpecsStr(e.target.value)}
            rows={5}
            placeholder={"Мощность: 2000 Вт\nЧастотный диапазон: 40 Гц — 20 кГц\nИмпеданс: 8 Ом\nВес: 28 кг"}
            className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-500/60 resize-none" />
          {specsStr && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(parseSpecs(specsStr)).map(([k, v]) => (
                <span key={k} className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-sm">
                  {k}: {v}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Теги (через запятую)</label>
          <input value={tagsVal} onChange={e => setF({ tags: e.target.value })}
            placeholder="line array, jbl, звук"
            className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60" />
        </div>

        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Фото</label>
          <div className="flex items-center gap-3">
            {image && (
              <div className="w-20 h-14 rounded-sm overflow-hidden border border-amber-500/20 shrink-0">
                <img src={image} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) { const url = await uploadImage(file); if (url) setF({ image: url }); }
              }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 border border-amber-500/20 text-gray-400 hover:text-white px-3 py-2 rounded-sm text-xs transition-colors disabled:opacity-40">
              {uploading ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Upload" size={12} />}
              {uploading ? "Загружаю..." : image ? "Заменить" : "Загрузить"}
            </button>
            {image && (
              <button type="button" onClick={() => setF({ image: "" })}
                className="text-gray-600 hover:text-red-400 text-xs transition-colors">Удалить</button>
            )}
          </div>
        </div>

        <RenterVariantsEditor
          variants={isEdit ? ((editEq as RenterEq).variants || []) : (newEq.variants || [])}
          unit={unit}
          onChange={v => setF({ variants: v } as Partial<typeof newEq>)}
        />
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
        <Icon name="Loader2" size={32} className="text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: "var(--surface)" }}>
      <div className="max-w-6xl mx-auto">

        {/* ── Шапка ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Партнёрский кабинет</p>
            <h1 className="font-oswald text-4xl font-bold text-white uppercase">
              {renter?.company_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs border rounded-sm px-2 py-0.5 ${
                renter?.status === "active"
                  ? "text-green-400 border-green-500/30"
                  : "text-yellow-400 border-yellow-500/30"
              }`}>
                {renter?.status === "active" ? "Активен" : "Ожидает активации"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="font-oswald text-lg font-bold tracking-widest text-white uppercase cursor-pointer"
              onClick={() => navigate("/")}
            >
              Global<span className="neon-text">Renta</span>
            </span>
            <button onClick={logout}
              className="flex items-center gap-2 border border-amber-500/20 text-gray-400 hover:text-white px-4 py-2 rounded-sm text-sm transition-colors ml-4">
              <Icon name="LogOut" size={14} /> Выйти
            </button>
          </div>
        </div>

        {renter?.status === "pending" && (
          <div className="mb-6 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-sm px-4 py-3">
            <Icon name="Clock" size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-amber-400 text-sm">
              Аккаунт ожидает активации администратором. Оборудование не будет опубликовано до активации.
            </p>
          </div>
        )}

        {/* ── Табы ── */}
        <div className="flex gap-1 mb-6 border-b border-amber-500/10 overflow-x-auto">
          {[
            { key: "equipment",    label: "Оборудование",  icon: "Package",  count: equipment.filter(e => e.status === "pending").length },
            { key: "categories",   label: "Разделы",       icon: "FolderOpen", count: pendingCatsCount },
            { key: "subcategories",label: "Подразделы",    icon: "Folder",   count: pendingSubsCount },
            { key: "orders",       label: "Заказы",        icon: "ShoppingBag", count: newOrdersCount },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`flex items-center gap-2 px-5 py-3 text-sm transition-all border-b-2 -mb-px whitespace-nowrap ${
                tab === t.key ? "border-amber-500 text-amber-500" : "border-transparent text-gray-500 hover:text-gray-300"
              }`}>
              <Icon name={t.icon} size={14} />
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${tab === t.key ? "bg-amber-500/20 text-amber-500" : "bg-gray-800 text-gray-500"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════ ОБОРУДОВАНИЕ ══════════════════ */}
        {tab === "equipment" && (
          <div>
            {/* Уведомление */}
            {eqSuccess && (
              <div className="mb-4 flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-sm px-4 py-2.5">
                <Icon name="CheckCircle" size={14} className="text-green-400" />
                <span className="text-green-400 text-sm">{eqSuccess}</span>
                <button onClick={() => setEqSuccess("")} className="ml-auto text-gray-500 hover:text-white"><Icon name="X" size={12} /></button>
              </div>
            )}
            {eqError && (
              <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-sm px-4 py-2.5">
                <Icon name="AlertCircle" size={14} className="text-red-400" />
                <span className="text-red-400 text-sm">{eqError}</span>
                <button onClick={() => setEqError("")} className="ml-auto text-gray-500 hover:text-white"><Icon name="X" size={12} /></button>
              </div>
            )}

            {/* Форма редактирования */}
            {editEq && (
              <div className="glass-card neon-border rounded-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-oswald text-xl font-bold text-white uppercase">Редактировать позицию</h2>
                  <button onClick={() => { setEditEq(null); setEqError(""); }} className="text-gray-500 hover:text-white">
                    <Icon name="X" size={20} />
                  </button>
                </div>
                <EqForm isEdit={true} />
                <div className="flex gap-3 mt-5">
                  <button onClick={() => saveEq(true)} disabled={eqSaving}
                    className="neon-btn px-6 py-2.5 rounded-sm text-sm flex items-center gap-2 disabled:opacity-40">
                    {eqSaving ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Send" size={14} />}
                    {eqSaving ? "Сохраняю..." : "Отправить на модерацию"}
                  </button>
                  <button onClick={() => setEditEq(null)}
                    className="border border-amber-500/20 text-gray-400 hover:text-white px-6 py-2.5 rounded-sm text-sm transition-colors">
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {/* Форма добавления */}
            {showNewEq && (
              <div className="glass-card neon-border rounded-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-oswald text-xl font-bold text-white uppercase">Новая позиция</h2>
                  <button onClick={() => { setShowNewEq(false); setNewEq({ ...EMPTY_EQ }); setNewSpecsStr(""); setEqError(""); }}
                    className="text-gray-500 hover:text-white">
                    <Icon name="X" size={20} />
                  </button>
                </div>
                <EqForm isEdit={false} />
                <div className="flex gap-3 mt-5">
                  <button onClick={() => saveEq(false)} disabled={eqSaving}
                    className="neon-btn px-6 py-2.5 rounded-sm text-sm flex items-center gap-2 disabled:opacity-40">
                    {eqSaving ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Plus" size={14} />}
                    {eqSaving ? "Сохраняю..." : "Добавить и отправить на модерацию"}
                  </button>
                  <button onClick={() => { setShowNewEq(false); setNewEq({ ...EMPTY_EQ }); setNewSpecsStr(""); }}
                    className="border border-amber-500/20 text-gray-400 hover:text-white px-6 py-2.5 rounded-sm text-sm transition-colors">
                    Отмена
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600 text-sm">{equipment.length} позиций</p>
              {!showNewEq && !editEq && (
                <button onClick={() => { setShowNewEq(true); setEditEq(null); setEqError(""); setEqSuccess(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="neon-btn flex items-center gap-2 px-4 py-2 rounded-sm text-sm">
                  <Icon name="Plus" size={14} /> Добавить оборудование
                </button>
              )}
            </div>

            {eqLoading ? (
              <div className="flex justify-center py-16"><Icon name="Loader2" size={32} className="text-amber-500 animate-spin" /></div>
            ) : equipment.length === 0 ? (
              <div className="glass-card rounded-sm p-16 text-center">
                <Icon name="Package" size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 mb-1">Оборудования пока нет</p>
                <p className="text-gray-700 text-sm">Добавьте первую позицию</p>
              </div>
            ) : (
              <div className="space-y-3">
                {equipment.map(eq => (
                  <div key={eq.id} className="glass-card rounded-sm p-4 flex items-start gap-4">
                    {eq.image && (
                      <div className="w-16 h-12 rounded-sm overflow-hidden border border-amber-500/10 shrink-0">
                        <img src={eq.image} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                        <p className="text-white text-sm font-semibold">{eq.name}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {statusBadge(eq.status, "eq")}
                          <button onClick={() => openEditEq(eq)}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-500 transition-colors border border-amber-500/10 hover:border-amber-500/30 px-2 py-1 rounded-sm">
                            <Icon name="Pencil" size={11} /> Изменить
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                        <span className="border border-amber-500/20 text-amber-500/60 px-1.5 py-0.5 rounded-sm">{eq.category}{eq.subcategory ? ` / ${eq.subcategory}` : ""}</span>
                        {eq.variants?.length > 0 ? (
                          <span className="text-blue-400/70">{eq.variants.length} вар.: {eq.variants.map(v => `${v.label} — ${v.price.toLocaleString()} ₽`).join(", ")}</span>
                        ) : (
                          <span className="font-oswald text-amber-500">{eq.price.toLocaleString()} ₽/{eq.unit}</span>
                        )}
                        {Object.keys(eq.specs || {}).length > 0 && (
                          <span className="text-gray-700">{Object.keys(eq.specs).length} характеристик</span>
                        )}
                      </div>
                      {eq.status === "rejected" && (
                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                          <Icon name="AlertCircle" size={11} /> Отклонено — отредактируйте и отправьте снова
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ РАЗДЕЛЫ ══════════════════ */}
        {tab === "categories" && (
          <div className="max-w-2xl">
            <p className="text-gray-500 text-sm mb-6">
              Предложите новый раздел каталога. После согласования с администратором он появится в списке при добавлении оборудования.
            </p>

            {catSuccess && (
              <div className="mb-4 flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-sm px-4 py-2.5">
                <Icon name="CheckCircle" size={14} className="text-green-400" />
                <span className="text-green-400 text-sm">{catSuccess}</span>
              </div>
            )}
            {catError && (
              <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-sm px-4 py-2.5">
                <Icon name="AlertCircle" size={14} className="text-red-400" />
                <span className="text-red-400 text-sm">{catError}</span>
              </div>
            )}

            {/* Форма добавления */}
            <div className="glass-card rounded-sm p-5 mb-6">
              <h3 className="font-oswald text-base font-bold text-white uppercase mb-4">Предложить новый раздел</h3>
              <div className="flex gap-3">
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && newCatName.trim() && createCat()}
                  placeholder="Название раздела"
                  className="flex-1 bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60" />
                <button onClick={createCat} disabled={catSaving || !newCatName.trim()}
                  className="neon-btn px-4 py-2.5 rounded-sm text-sm flex items-center gap-2 disabled:opacity-40">
                  {catSaving ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Plus" size={14} />}
                  Предложить
                </button>
              </div>
            </div>

            {/* Мои предложения */}
            {mineCats.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Мои предложения</h4>
                <div className="space-y-2">
                  {mineCats.map(c => (
                    <div key={c.id} className="glass-card rounded-sm px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon name="FolderOpen" size={14} className="text-amber-500/60" />
                        <span className="text-white text-sm">{c.name}</span>
                        {statusBadge(c.status, "cat")}
                      </div>
                      {c.status !== "approved" && (
                        <button onClick={() => deleteCat(c.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                          <Icon name="Trash2" size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Существующие разделы */}
            {catsLoading ? (
              <div className="flex justify-center py-8"><Icon name="Loader2" size={24} className="text-amber-500 animate-spin" /></div>
            ) : (
              <div>
                <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Разделы в каталоге</h4>
                <div className="grid grid-cols-2 gap-2">
                  {allCats.map(c => (
                    <div key={c.id} className="flex items-center gap-2 px-3 py-2 border border-amber-500/10 rounded-sm text-sm text-gray-400">
                      <Icon name="Folder" size={13} className="text-amber-500/40" />
                      {c.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ ПОДРАЗДЕЛЫ ══════════════════ */}
        {tab === "subcategories" && (
          <div className="max-w-2xl">
            <p className="text-gray-500 text-sm mb-6">
              Предложите новый подраздел для существующего раздела.
            </p>

            {subSuccess && (
              <div className="mb-4 flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-sm px-4 py-2.5">
                <Icon name="CheckCircle" size={14} className="text-green-400" />
                <span className="text-green-400 text-sm">{subSuccess}</span>
              </div>
            )}
            {subError && (
              <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-sm px-4 py-2.5">
                <Icon name="AlertCircle" size={14} className="text-red-400" />
                <span className="text-red-400 text-sm">{subError}</span>
              </div>
            )}

            <div className="glass-card rounded-sm p-5 mb-6">
              <h3 className="font-oswald text-base font-bold text-white uppercase mb-4">Предложить новый подраздел</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <select value={newSubCat} onChange={e => setNewSubCat(e.target.value)}
                  className="bg-[#111] border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-amber-500/60">
                  <option value="">— выберите раздел —</option>
                  {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input value={newSubName} onChange={e => setNewSubName(e.target.value)}
                  placeholder="Название подраздела"
                  className="bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60" />
              </div>
              <button onClick={createSub} disabled={subSaving || !newSubName.trim() || !newSubCat}
                className="neon-btn px-4 py-2.5 rounded-sm text-sm flex items-center gap-2 disabled:opacity-40">
                {subSaving ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Plus" size={14} />}
                Предложить подраздел
              </button>
            </div>

            {mineSubs.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Мои предложения</h4>
                <div className="space-y-2">
                  {mineSubs.map(s => (
                    <div key={s.id} className="glass-card rounded-sm px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Icon name="Folder" size={13} className="text-amber-500/60" />
                        <span className="text-gray-500 text-xs">{s.category} /</span>
                        <span className="text-white text-sm">{s.name}</span>
                        {statusBadge(s.status, "cat")}
                      </div>
                      {s.status !== "approved" && (
                        <button onClick={() => deleteSub(s.id)} className="text-gray-600 hover:text-red-400 transition-colors ml-2">
                          <Icon name="Trash2" size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {subsLoading ? (
              <div className="flex justify-center py-8"><Icon name="Loader2" size={24} className="text-amber-500 animate-spin" /></div>
            ) : (
              <div>
                <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Подразделы в каталоге</h4>
                {availableCategories.map(cat => {
                  const subs = allSubs.filter(s => s.category === cat);
                  if (!subs.length) return null;
                  return (
                    <div key={cat} className="mb-4">
                      <p className="text-xs text-amber-500/60 uppercase tracking-wider mb-2">{cat}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {subs.map(s => (
                          <div key={s.id} className="flex items-center gap-2 px-3 py-2 border border-amber-500/10 rounded-sm text-sm text-gray-400">
                            <Icon name="ChevronRight" size={11} className="text-amber-500/30" />
                            {s.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ ЗАКАЗЫ ══════════════════ */}
        {tab === "orders" && (
          <div>
            {ordersLoading ? (
              <div className="flex justify-center py-16"><Icon name="Loader2" size={32} className="text-amber-500 animate-spin" /></div>
            ) : orders.length === 0 ? (
              <div className="glass-card rounded-sm p-16 text-center">
                <Icon name="ShoppingBag" size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500">Заказов на ваше оборудование пока нет</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div key={order.id} className={`glass-card rounded-sm p-5 ${order.status === "new" ? "border border-amber-500/30" : ""}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          {statusBadge(order.status, "order")}
                          {order.status === "new" && (
                            <span className="text-xs text-amber-500 flex items-center gap-1 animate-pulse">
                              <Icon name="Bell" size={11} /> Требует ответа
                            </span>
                          )}
                        </div>
                        <p className="text-white text-sm font-semibold mb-1">{order.equipment_name}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                          <span>{order.qty} шт × {order.days} дн.</span>
                          <span className="text-amber-500 font-bold font-oswald">{order.subtotal.toLocaleString()} ₽</span>
                          {order.client_name && <span><Icon name="User" size={10} className="inline mr-1" />{order.client_name}</span>}
                          {order.event_date && <span><Icon name="Calendar" size={10} className="inline mr-1" />{order.event_date}</span>}
                          {order.client_phone && (
                            <a href={`tel:${order.client_phone}`} className="text-amber-500 hover:underline flex items-center gap-1">
                              <Icon name="Phone" size={10} /> {order.client_phone}
                            </a>
                          )}
                        </div>
                      </div>
                      {order.status === "new" && (
                        <div className="flex gap-2">
                          <button onClick={() => respondOrder(order.id, "accepted")}
                            className="flex items-center gap-1.5 border border-green-500/30 text-green-400 hover:bg-green-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                            <Icon name="Check" size={12} /> Принять
                          </button>
                          <button onClick={() => respondOrder(order.id, "declined")}
                            className="flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                            <Icon name="X" size={12} /> Отказать
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Редактор вариантов для прокатчика ────────────────────────────────────────
function RenterVariantsEditor({
  variants, unit, onChange,
}: {
  variants: Variant[];
  unit: string;
  onChange: (v: Variant[]) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newPrice, setNewPrice] = useState(0);

  const add = () => {
    if (!newLabel.trim()) return;
    onChange([...variants, { label: newLabel.trim(), price: newPrice }]);
    setNewLabel(""); setNewPrice(0);
  };
  const remove = (i: number) => onChange(variants.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof Variant, val: string | number) =>
    onChange(variants.map((v, idx) => idx === i ? { ...v, [field]: field === "price" ? Number(val) : val } : v));

  return (
    <div className="border-t border-amber-500/10 pt-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-gray-500 uppercase tracking-wider">Варианты / модификации</label>
        <span className="text-xs text-gray-700">(необязательно — напр.: 5 м, 10 м, 15 м)</span>
      </div>

      {variants.length > 0 && (
        <div className="space-y-2 mb-3">
          {variants.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={v.label}
                onChange={e => update(i, "label", e.target.value)}
                placeholder="Название варианта"
                className="flex-1 bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
              <input
                type="number"
                value={v.price}
                onChange={e => update(i, "price", e.target.value)}
                className="w-28 bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
              <span className="text-xs text-gray-600 whitespace-nowrap">₽/{unit}</span>
              <button type="button" onClick={() => remove(i)}
                className="p-1.5 border border-gray-700 text-gray-600 hover:text-red-400 rounded-sm transition-colors">
                <Icon name="X" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          placeholder="Новый вариант (напр.: 10 метров)"
          className="flex-1 bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50"
        />
        <input
          type="number"
          value={newPrice}
          onChange={e => setNewPrice(Number(e.target.value))}
          onKeyDown={e => e.key === "Enter" && add()}
          placeholder="Цена"
          className="w-28 bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
        />
        <span className="text-xs text-gray-600 whitespace-nowrap">₽/{unit}</span>
        <button type="button" onClick={add} disabled={!newLabel.trim()}
          className="flex items-center gap-1.5 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 py-2 rounded-sm text-xs transition-colors disabled:opacity-30">
          <Icon name="Plus" size={12} /> Добавить
        </button>
      </div>
    </div>
  );
}