import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

type Category = { id: number; name: string; sort_order: number };
type Subcategory = { id: number; name: string; category: string; sort_order: number };
type EquipmentItem = {
  id: number; name: string; category: string; subcategory?: string;
  price: number; unit: string; rating: number; reviews: number;
  popular: boolean; specs: Record<string, string>; description: string;
  tags: string[]; image?: string; usage?: string; sort_order: number; is_active: boolean;
};

const EMPTY_ITEM: Omit<EquipmentItem, "id"> = {
  name: "", category: "", subcategory: "", price: 0, unit: "день",
  rating: 5, reviews: 0, popular: false, specs: {}, description: "",
  tags: [], image: "", usage: "", sort_order: 0, is_active: true,
};

const BASE_URL = (func2url as Record<string, string>)["manage-catalog"];

export default function AdminCatalog() {
  const [password, setPassword] = useState(() => sessionStorage.getItem("adminPwd") || "");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState<"equipment" | "categories" | "subcategories">("equipment");

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);

  const [filterCat, setFilterCat] = useState("Все");
  const [search, setSearch] = useState("");

  const [editItem, setEditItem] = useState<EquipmentItem | null>(null);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [editSub, setEditSub] = useState<Subcategory | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItem, setNewItem] = useState<Omit<EquipmentItem, "id">>(EMPTY_ITEM);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showNewSub, setShowNewSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubCat, setNewSubCat] = useState("");

  // Specs editor helpers
  const [specsStr, setSpecsStr] = useState("");
  const [newSpecsStr, setNewSpecsStr] = useState("");

  const headers = { "Content-Type": "application/json", "X-Admin-Password": password };

  const api = async (path: string, method = "GET", body?: object) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  };

  const load = async (pwd?: string) => {
    setLoading(true);
    const usePwd = pwd ?? password;
    const hdrs = { "Content-Type": "application/json", "X-Admin-Password": usePwd };
    try {
      const [cRes, sRes, eRes] = await Promise.all([
        fetch(`${BASE_URL}/categories`, { headers: hdrs }),
        fetch(`${BASE_URL}/subcategories`, { headers: hdrs }),
        fetch(`${BASE_URL}/equipment`, { headers: hdrs }),
      ]);
      if (cRes.status === 401) { setAuthError(true); setLoading(false); return; }
      const cData = await cRes.json();
      const sData = await sRes.json();
      const eData = await eRes.json();
      setCategories(cData.categories || []);
      setSubcategories(sData.subcategories || []);
      setEquipment(eData.equipment || []);
      setAuthed(true);
    } catch (err) {
      console.error("Ошибка загрузки каталога:", err);
      setAuthError(true);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    setLoading(true);
    setAuthError(false);
    sessionStorage.setItem("adminPwd", password);
    await load(password);
  };

  // ── Equipment CRUD ────────────────────────────────────────────────
  const saveItem = async () => {
    if (!editItem) return;
    const specs = parseSpecs(specsStr);
    await api(`/equipment/${editItem.id}`, "PUT", { ...editItem, specs });
    setEditItem(null);
    load();
  };

  const createItem = async () => {
    const specs = parseSpecs(newSpecsStr);
    await api("/equipment", "POST", { ...newItem, specs });
    setShowNewItem(false);
    setNewItem(EMPTY_ITEM);
    setNewSpecsStr("");
    load();
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Удалить позицию?")) return;
    await api(`/equipment/${id}`, "DELETE");
    load();
  };

  const toggleActive = async (item: EquipmentItem) => {
    await api(`/equipment/${item.id}`, "PUT", { ...item, is_active: !item.is_active });
    load();
  };

  // ── Categories CRUD ───────────────────────────────────────────────
  const saveCat = async () => {
    if (!editCat) return;
    await api(`/categories/${editCat.id}`, "PUT", editCat);
    setEditCat(null);
    load();
  };

  const createCat = async () => {
    if (!newCatName.trim()) return;
    await api("/categories", "POST", { name: newCatName.trim(), sort_order: categories.length });
    setShowNewCat(false);
    setNewCatName("");
    load();
  };

  const deleteCat = async (id: number) => {
    if (!confirm("Удалить раздел? Все подкатегории этого раздела тоже будут удалены.")) return;
    await api(`/categories/${id}`, "DELETE");
    load();
  };

  // ── Subcategories CRUD ────────────────────────────────────────────
  const saveSub = async () => {
    if (!editSub) return;
    await api(`/subcategories/${editSub.id}`, "PUT", editSub);
    setEditSub(null);
    load();
  };

  const createSub = async () => {
    if (!newSubName.trim() || !newSubCat) return;
    await api("/subcategories", "POST", { name: newSubName.trim(), category: newSubCat, sort_order: 0 });
    setShowNewSub(false);
    setNewSubName("");
    setNewSubCat("");
    load();
  };

  const deleteSub = async (id: number) => {
    if (!confirm("Удалить подраздел?")) return;
    await api(`/subcategories/${id}`, "DELETE");
    load();
  };

  // ── Specs helpers ─────────────────────────────────────────────────
  const specsToStr = (specs: Record<string, string>) =>
    Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join("\n");

  const parseSpecs = (str: string): Record<string, string> => {
    const result: Record<string, string> = {};
    str.split("\n").forEach((line) => {
      const idx = line.indexOf(":");
      if (idx > 0) {
        result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    });
    return result;
  };

  const filteredEquipment = equipment.filter((e) => {
    const matchCat = filterCat === "Все" || e.category === filterCat;
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Login screen ─────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-primary)" }}>
        <div className="glass-card neon-border rounded-sm p-10 max-w-sm w-full text-center">
          <div className="w-16 h-16 flex items-center justify-center border border-amber-500/30 rounded-sm mx-auto mb-6">
            <Icon name="LayoutDashboard" size={32} className="text-amber-500" />
          </div>
          <h1 className="font-oswald text-2xl font-bold text-white uppercase mb-1">Управление каталогом</h1>
          <p className="text-gray-500 text-sm mb-8">Введите пароль администратора</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="Пароль"
            className="w-full bg-transparent border border-amber-500/30 rounded-sm px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/70 text-sm mb-3"
          />
          {authError && <p className="text-red-400 text-xs mb-3">Неверный пароль</p>}
          <button
            onClick={login}
            disabled={loading || !password}
            className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="LogIn" size={16} />}
            Войти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Администратор</p>
            <h1 className="font-oswald text-4xl font-bold text-white uppercase">Каталог</h1>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="flex items-center gap-2 border border-amber-500/20 text-gray-400 hover:text-amber-500 px-4 py-2 rounded-sm text-sm transition-colors">
              <Icon name="ClipboardList" size={14} />
              Заявки
            </a>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-4 py-2 rounded-sm text-sm transition-colors"
            >
              <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
              Обновить
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-amber-500/10 pb-0">
          {(["equipment", "categories", "subcategories"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? "border-amber-500 text-amber-500"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t === "equipment" ? `Позиции (${equipment.length})` : t === "categories" ? `Разделы (${categories.length})` : `Подразделы (${subcategories.length})`}
            </button>
          ))}
        </div>

        {/* ── EQUIPMENT TAB ─────────────────────────────────────── */}
        {tab === "equipment" && (
          <div>
            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 mb-5">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по названию..."
                className="flex-1 min-w-48 bg-transparent border border-amber-500/20 rounded-sm px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
                className="border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50"
                style={{ background: "var(--surface-2)" }}
              >
                <option value="Все">Все разделы</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <button
                onClick={() => { setShowNewItem(true); setNewItem(EMPTY_ITEM); setNewSpecsStr(""); }}
                className="neon-btn flex items-center gap-2 px-5 py-2 rounded-sm text-sm"
              >
                <Icon name="Plus" size={14} />
                Добавить позицию
              </button>
            </div>

            {/* Add form */}
            {showNewItem && (
              <div className="glass-card neon-border rounded-sm p-6 mb-5">
                <h3 className="font-oswald text-xl font-bold text-white uppercase mb-4">Новая позиция</h3>
                <ItemForm
                  item={newItem}
                  setItem={(v) => setNewItem(v as Omit<EquipmentItem, "id">)}
                  specsStr={newSpecsStr}
                  setSpecsStr={setNewSpecsStr}
                  categories={categories}
                  subcategories={subcategories}
                />
                <div className="flex gap-3 mt-4">
                  <button onClick={createItem} className="neon-btn px-6 py-2 rounded-sm text-sm flex items-center gap-2">
                    <Icon name="Save" size={14} /> Сохранить
                  </button>
                  <button onClick={() => setShowNewItem(false)} className="border border-gray-700 text-gray-400 px-6 py-2 rounded-sm text-sm hover:border-gray-500 transition-colors">
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {/* List */}
            <div className="space-y-2">
              {filteredEquipment.length === 0 && (
                <div className="glass-card rounded-sm p-12 text-center">
                  <Icon name="Package" size={40} className="text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">Позиций нет. Добавьте первую!</p>
                </div>
              )}
              {filteredEquipment.map((item) => (
                <div key={item.id}>
                  <div
                    className={`glass-card rounded-sm p-4 flex items-center gap-4 transition-all ${!item.is_active ? "opacity-50" : ""}`}
                  >
                    {item.image && (
                      <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded-sm shrink-0 border border-amber-500/10" />
                    )}
                    {!item.image && (
                      <div className="w-14 h-14 flex items-center justify-center border border-amber-500/10 rounded-sm shrink-0 bg-amber-500/5">
                        <Icon name="Package" size={20} className="text-gray-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-amber-500/70 bg-amber-500/10 px-2 py-0.5 rounded-sm">{item.category}</span>
                        {item.subcategory && <span className="text-xs text-gray-600">{item.subcategory}</span>}
                        {item.popular && <span className="text-xs text-green-400/70 bg-green-400/10 px-2 py-0.5 rounded-sm">Популярное</span>}
                        {!item.is_active && <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-sm">Скрыто</span>}
                      </div>
                      <p className="text-white font-medium truncate">{item.name}</p>
                      <p className="text-amber-500 text-sm font-bold">{item.price.toLocaleString()} ₽ / {item.unit}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleActive(item)}
                        title={item.is_active ? "Скрыть" : "Показать"}
                        className="p-2 border border-gray-700 text-gray-500 hover:text-amber-500 hover:border-amber-500/30 rounded-sm transition-colors"
                      >
                        <Icon name={item.is_active ? "Eye" : "EyeOff"} size={14} />
                      </button>
                      <button
                        onClick={() => { setEditItem(item); setSpecsStr(specsToStr(item.specs)); }}
                        className="p-2 border border-gray-700 text-gray-500 hover:text-amber-500 hover:border-amber-500/30 rounded-sm transition-colors"
                      >
                        <Icon name="Pencil" size={14} />
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-2 border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-400/30 rounded-sm transition-colors"
                      >
                        <Icon name="Trash2" size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {editItem?.id === item.id && (
                    <div className="glass-card neon-border rounded-sm p-6 mt-1 mb-1">
                      <h3 className="font-oswald text-lg font-bold text-white uppercase mb-4">Редактировать позицию</h3>
                      <ItemForm
                        item={editItem}
                        setItem={(v) => setEditItem(v as EquipmentItem)}
                        specsStr={specsStr}
                        setSpecsStr={setSpecsStr}
                        categories={categories}
                        subcategories={subcategories}
                      />
                      <div className="flex gap-3 mt-4">
                        <button onClick={saveItem} className="neon-btn px-6 py-2 rounded-sm text-sm flex items-center gap-2">
                          <Icon name="Save" size={14} /> Сохранить
                        </button>
                        <button onClick={() => setEditItem(null)} className="border border-gray-700 text-gray-400 px-6 py-2 rounded-sm text-sm hover:border-gray-500 transition-colors">
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CATEGORIES TAB ─────────────────────────────────────── */}
        {tab === "categories" && (
          <div>
            <div className="flex justify-end mb-5">
              <button
                onClick={() => { setShowNewCat(true); setNewCatName(""); }}
                className="neon-btn flex items-center gap-2 px-5 py-2 rounded-sm text-sm"
              >
                <Icon name="Plus" size={14} />
                Добавить раздел
              </button>
            </div>

            {showNewCat && (
              <div className="glass-card neon-border rounded-sm p-5 mb-4 flex items-center gap-3">
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Название раздела"
                  className="flex-1 bg-transparent border border-amber-500/30 rounded-sm px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/60"
                />
                <button onClick={createCat} className="neon-btn px-5 py-2 rounded-sm text-sm flex items-center gap-2">
                  <Icon name="Save" size={14} /> Сохранить
                </button>
                <button onClick={() => setShowNewCat(false)} className="border border-gray-700 text-gray-400 px-4 py-2 rounded-sm text-sm">
                  Отмена
                </button>
              </div>
            )}

            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="glass-card rounded-sm p-4">
                  {editCat?.id === cat.id ? (
                    <div className="flex items-center gap-3">
                      <input
                        value={editCat.name}
                        onChange={(e) => setEditCat({ ...editCat, name: e.target.value })}
                        className="flex-1 bg-transparent border border-amber-500/30 rounded-sm px-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60"
                      />
                      <input
                        type="number"
                        value={editCat.sort_order}
                        onChange={(e) => setEditCat({ ...editCat, sort_order: Number(e.target.value) })}
                        placeholder="Порядок"
                        className="w-24 bg-transparent border border-amber-500/30 rounded-sm px-3 py-2 text-sm text-white focus:outline-none"
                      />
                      <button onClick={saveCat} className="neon-btn px-4 py-2 rounded-sm text-sm flex items-center gap-1">
                        <Icon name="Save" size={13} /> Сохр.
                      </button>
                      <button onClick={() => setEditCat(null)} className="border border-gray-700 text-gray-400 px-4 py-2 rounded-sm text-sm">
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-amber-500 font-oswald font-bold text-lg">{cat.name}</span>
                        <span className="text-xs text-gray-600">порядок: {cat.sort_order}</span>
                        <span className="text-xs text-gray-600">
                          позиций: {equipment.filter((e) => e.category === cat.name).length}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditCat(cat)} className="p-2 border border-gray-700 text-gray-500 hover:text-amber-500 hover:border-amber-500/30 rounded-sm transition-colors">
                          <Icon name="Pencil" size={14} />
                        </button>
                        <button onClick={() => deleteCat(cat.id)} className="p-2 border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-400/30 rounded-sm transition-colors">
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {categories.length === 0 && (
                <div className="glass-card rounded-sm p-12 text-center">
                  <p className="text-gray-500">Разделов нет. Добавьте первый!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SUBCATEGORIES TAB ────────────────────────────────────── */}
        {tab === "subcategories" && (
          <div>
            <div className="flex justify-end mb-5">
              <button
                onClick={() => { setShowNewSub(true); setNewSubName(""); setNewSubCat(""); }}
                className="neon-btn flex items-center gap-2 px-5 py-2 rounded-sm text-sm"
              >
                <Icon name="Plus" size={14} />
                Добавить подраздел
              </button>
            </div>

            {showNewSub && (
              <div className="glass-card neon-border rounded-sm p-5 mb-4 flex flex-wrap items-center gap-3">
                <input
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="Название подраздела"
                  className="flex-1 min-w-48 bg-transparent border border-amber-500/30 rounded-sm px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/60"
                />
                <select
                  value={newSubCat}
                  onChange={(e) => setNewSubCat(e.target.value)}
                  className="border border-amber-500/30 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none"
                  style={{ background: "var(--surface-2)" }}
                >
                  <option value="">Выберите раздел...</option>
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <button onClick={createSub} className="neon-btn px-5 py-2 rounded-sm text-sm flex items-center gap-2">
                  <Icon name="Save" size={14} /> Сохранить
                </button>
                <button onClick={() => setShowNewSub(false)} className="border border-gray-700 text-gray-400 px-4 py-2 rounded-sm text-sm">
                  Отмена
                </button>
              </div>
            )}

            <div className="space-y-2">
              {categories.map((cat) => {
                const subs = subcategories.filter((s) => s.category === cat.name);
                if (subs.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <p className="text-xs text-gray-600 uppercase tracking-widest mb-1 mt-3">{cat.name}</p>
                    {subs.map((sub) => (
                      <div key={sub.id} className="glass-card rounded-sm p-4 mb-1">
                        {editSub?.id === sub.id ? (
                          <div className="flex items-center gap-3">
                            <input
                              value={editSub.name}
                              onChange={(e) => setEditSub({ ...editSub, name: e.target.value })}
                              className="flex-1 bg-transparent border border-amber-500/30 rounded-sm px-4 py-2 text-sm text-white focus:outline-none"
                            />
                            <select
                              value={editSub.category}
                              onChange={(e) => setEditSub({ ...editSub, category: e.target.value })}
                              className="border border-amber-500/30 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none"
                              style={{ background: "var(--surface-2)" }}
                            >
                              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                            <button onClick={saveSub} className="neon-btn px-4 py-2 rounded-sm text-sm flex items-center gap-1">
                              <Icon name="Save" size={13} /> Сохр.
                            </button>
                            <button onClick={() => setEditSub(null)} className="border border-gray-700 text-gray-400 px-4 py-2 rounded-sm text-sm">
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-white">{sub.name}</span>
                            <div className="flex gap-2">
                              <button onClick={() => setEditSub(sub)} className="p-2 border border-gray-700 text-gray-500 hover:text-amber-500 hover:border-amber-500/30 rounded-sm transition-colors">
                                <Icon name="Pencil" size={14} />
                              </button>
                              <button onClick={() => deleteSub(sub.id)} className="p-2 border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-400/30 rounded-sm transition-colors">
                                <Icon name="Trash2" size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
              {subcategories.length === 0 && (
                <div className="glass-card rounded-sm p-12 text-center">
                  <p className="text-gray-500">Подразделов нет.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── ItemForm Component ────────────────────────────────────────────────
function ItemForm({
  item, setItem, specsStr, setSpecsStr, categories, subcategories,
}: {
  item: Omit<EquipmentItem, "id"> & { id?: number };
  setItem: (v: Omit<EquipmentItem, "id"> & { id?: number }) => void;
  specsStr: string;
  setSpecsStr: (v: string) => void;
  categories: Category[];
  subcategories: Subcategory[];
}) {
  const catSubs = subcategories.filter((s) => s.category === item.category);

  const field = (label: string, el: React.ReactNode) => (
    <div>
      <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1">{label}</label>
      {el}
    </div>
  );

  const inp = (key: keyof typeof item, type = "text", placeholder = "") => (
    <input
      type={type}
      value={item[key] as string | number}
      onChange={(e) => setItem({ ...item, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
      placeholder={placeholder}
      className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50"
    />
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {field("Название *", inp("name", "text", "Название позиции"))}
      {field("Цена (₽/день) *",
        <div className="flex gap-2">
          {inp("price", "number", "0")}
          <input
            value={item.unit}
            onChange={(e) => setItem({ ...item, unit: e.target.value })}
            placeholder="день"
            className="w-28 bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
          />
        </div>
      )}
      {field("Раздел *",
        <select
          value={item.category}
          onChange={(e) => setItem({ ...item, category: e.target.value, subcategory: "" })}
          className="w-full border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50"
          style={{ background: "var(--surface-2)" }}
        >
          <option value="">Выберите раздел...</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      )}
      {field("Подраздел",
        <select
          value={item.subcategory || ""}
          onChange={(e) => setItem({ ...item, subcategory: e.target.value })}
          className="w-full border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50"
          style={{ background: "var(--surface-2)" }}
        >
          <option value="">Без подраздела</option>
          {catSubs.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      )}
      <div className="md:col-span-2">
        {field("Описание", (
          <textarea
            value={item.description}
            onChange={(e) => setItem({ ...item, description: e.target.value })}
            rows={3}
            placeholder="Описание оборудования..."
            className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50 resize-none"
          />
        ))}
      </div>
      <div className="md:col-span-2">
        {field("Характеристики (каждая с новой строки: Ключ: Значение)", (
          <textarea
            value={specsStr}
            onChange={(e) => setSpecsStr(e.target.value)}
            rows={4}
            placeholder={"Мощность: 1000 Вт\nВес: 20 кг"}
            className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50 resize-none font-mono"
          />
        ))}
      </div>
      {field("URL изображения", inp("image", "text", "https://..."))}
      {field("Применение",
        <select
          value={item.usage || ""}
          onChange={(e) => setItem({ ...item, usage: e.target.value })}
          className="w-full border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50"
          style={{ background: "var(--surface-2)" }}
        >
          <option value="">Не указано</option>
          <option value="indoor">Indoor</option>
          <option value="outdoor">Outdoor</option>
          <option value="indoor/outdoor">Indoor / Outdoor</option>
        </select>
      )}
      {field("Теги (через запятую)",
        <input
          value={Array.isArray(item.tags) ? item.tags.join(", ") : ""}
          onChange={(e) => setItem({ ...item, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
          placeholder="концерт, фестиваль, аутдор"
          className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50"
        />
      )}
      {field("Порядок сортировки", inp("sort_order", "number", "0"))}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={item.popular}
            onChange={(e) => setItem({ ...item, popular: e.target.checked })}
            className="w-4 h-4 accent-amber-500"
          />
          <span className="text-sm text-gray-400">Популярное</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={item.is_active}
            onChange={(e) => setItem({ ...item, is_active: e.target.checked })}
            className="w-4 h-4 accent-amber-500"
          />
          <span className="text-sm text-gray-400">Показывать на сайте</span>
        </label>
      </div>
    </div>
  );
}