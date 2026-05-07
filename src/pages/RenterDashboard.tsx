import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const URLS = func2url as Record<string, string>;

type Renter = {
  id: number; email: string; company_name: string; contact_name: string;
  phone: string; city: string; telegram?: string; description?: string; status: string;
};

type RenterEq = {
  id: number; name: string; category: string; subcategory?: string;
  price: number; unit: string; description: string; specs: Record<string, string>;
  tags: string[]; image?: string; status: string; is_active: boolean; created_at: string;
};

type RenterOrder = {
  id: number; order_id: number; equipment_name: string; qty: number;
  days: number; subtotal: number; status: string; created_at: string;
  client_name?: string; client_phone?: string; event_date?: string;
};

const CATEGORIES = ["Звук", "Свет", "Видео", "Сцена", "Конференц", "Генераторы"];

const statusEqBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending:  { label: "На модерации", cls: "text-yellow-400 border-yellow-500/30" },
    approved: { label: "Опубликовано", cls: "text-green-400 border-green-500/30" },
    rejected: { label: "Отклонено",    cls: "text-red-400 border-red-500/30" },
  };
  const s = map[status] || { label: status, cls: "text-gray-400 border-gray-600" };
  return <span className={`text-xs border rounded-sm px-2 py-0.5 ${s.cls}`}>{s.label}</span>;
};

const statusOrderBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    new:      { label: "Новый",      cls: "text-amber-400 border-amber-500/30" },
    accepted: { label: "Принят",     cls: "text-green-400 border-green-500/30" },
    declined: { label: "Отказан",    cls: "text-red-400 border-red-500/30" },
  };
  const s = map[status] || { label: status, cls: "text-gray-400 border-gray-600" };
  return <span className={`text-xs border rounded-sm px-2 py-0.5 ${s.cls}`}>{s.label}</span>;
};

const emptyEq = {
  name: "", category: "Звук", subcategory: "", price: 0, unit: "день",
  description: "", tags: "", image: "",
};

export default function RenterDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("renter_token") || "";
  const fileRef = useRef<HTMLInputElement>(null);

  const [renter, setRenter] = useState<Renter | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tab, setTab] = useState<"equipment" | "orders">("equipment");
  const [equipment, setEquipment] = useState<RenterEq[]>([]);
  const [eqLoading, setEqLoading] = useState(false);
  const [orders, setOrders] = useState<RenterOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editEq, setEditEq] = useState<(RenterEq & { tags: string }) | null>(null);
  const [form, setForm] = useState(emptyEq);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [uploading, setUploading] = useState(false);

  // ── Авторизация ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { navigate("/renter/login"); return; }
    fetch(`${URLS["renter-auth"]}`, { headers: { "X-Renter-Token": token } })
      .then(r => r.json())
      .then(data => {
        if (data.error) { localStorage.removeItem("renter_token"); navigate("/renter/login"); return; }
        setRenter(data);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // ── Загрузка оборудования ───────────────────────────────────────
  const loadEquipment = () => {
    setEqLoading(true);
    fetch(URLS["renter-equipment"], { headers: { "X-Renter-Token": token } })
      .then(r => r.json())
      .then(data => setEquipment(Array.isArray(data) ? data : []))
      .finally(() => setEqLoading(false));
  };

  // ── Загрузка заказов ────────────────────────────────────────────
  const loadOrders = () => {
    setOrdersLoading(true);
    fetch(URLS["renter-orders"], { headers: { "X-Renter-Token": token } })
      .then(r => r.json())
      .then(data => setOrders(Array.isArray(data) ? data : []))
      .finally(() => setOrdersLoading(false));
  };

  useEffect(() => {
    if (!renter) return;
    if (tab === "equipment") loadEquipment();
    if (tab === "orders") loadOrders();
  }, [tab, renter]);

  // ── Выход ─────────────────────────────────────────────────────
  const logout = () => {
    fetch(`${URLS["renter-auth"]}?action=logout`, {
      method: "POST", headers: { "X-Renter-Token": token }
    }).finally(() => {
      localStorage.removeItem("renter_token");
      navigate("/renter/login");
    });
  };

  // ── Загрузка фото ──────────────────────────────────────────────
  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch(`${URLS["upload-image"]}?pwd=noadmin`, {
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

  // ── Сохранить оборудование ─────────────────────────────────────
  const saveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(""); setFormSuccess("");
    if (!form.name.trim() || !form.category) { setFormError("Укажите название и категорию"); return; }
    setFormLoading(true);
    try {
      const payload = {
        ...form, price: Number(form.price),
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        ...(editEq ? { id: editEq.id } : {}),
      };
      const res = await fetch(URLS["renter-equipment"], {
        method: editEq ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "X-Renter-Token": token },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setFormSuccess(editEq ? "Изменения отправлены на модерацию" : "Оборудование отправлено на модерацию");
      setShowForm(false); setEditEq(null); setForm(emptyEq);
      loadEquipment();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Ошибка");
    } finally { setFormLoading(false); }
  };

  // ── Принять / отклонить заказ ──────────────────────────────────
  const respondOrder = async (orderId: number, status: "accepted" | "declined") => {
    await fetch(`${URLS["renter-orders"]}?id=${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Renter-Token": token },
      body: JSON.stringify({ status }),
    });
    loadOrders();
  };

  const openEdit = (eq: RenterEq) => {
    setEditEq({ ...eq, tags: eq.tags?.join(", ") || "" });
    setForm({
      name: eq.name, category: eq.category, subcategory: eq.subcategory || "",
      price: eq.price, unit: eq.unit, description: eq.description,
      tags: eq.tags?.join(", ") || "", image: eq.image || "",
    });
    setShowForm(true); setFormError(""); setFormSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const newOrders = orders.filter(o => o.status === "new").length;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
        <Icon name="Loader2" size={32} className="text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: "var(--surface)" }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <span
              className="font-oswald text-xl font-bold tracking-widest text-white uppercase cursor-pointer"
              onClick={() => navigate("/")}
            >
              Global<span className="neon-text">Renta</span>
            </span>
            <div className="text-gray-500 text-sm mt-1 flex items-center gap-2">
              <Icon name="Building2" size={13} className="text-amber-500" />
              {renter?.company_name}
              <span className={`text-xs border rounded-sm px-1.5 py-0.5 ml-1 ${
                renter?.status === "active" ? "text-green-400 border-green-500/30" : "text-yellow-400 border-yellow-500/30"
              }`}>
                {renter?.status === "active" ? "Активен" : "Ожидает активации"}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 border border-amber-500/20 text-gray-400 hover:text-white px-4 py-2 rounded-sm text-sm transition-colors"
          >
            <Icon name="LogOut" size={14} /> Выйти
          </button>
        </div>

        {/* Форма добавления/редактирования */}
        {showForm && (
          <div className="glass-card neon-border rounded-sm p-6 mb-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-oswald text-xl font-bold text-white uppercase">
                {editEq ? "Редактировать оборудование" : "Добавить оборудование"}
              </h2>
              <button onClick={() => { setShowForm(false); setEditEq(null); setForm(emptyEq); }}
                className="text-gray-500 hover:text-white transition-colors">
                <Icon name="X" size={20} />
              </button>
            </div>
            <form onSubmit={saveEquipment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Название *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Напр.: Line Array JBL VTX A12"
                    className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Категория *</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-[#111] border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Подкатегория</label>
                  <input value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}
                    placeholder="Напр.: Комплекты звука"
                    className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Цена (₽ / {form.unit})</label>
                  <div className="flex gap-2">
                    <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                      className="flex-1 bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                    <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                      className="bg-[#111] border border-amber-500/20 rounded-sm px-2 py-2.5 text-sm text-gray-300 focus:outline-none">
                      <option value="день">день</option>
                      <option value="час">час</option>
                      <option value="шт">шт</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Описание</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} placeholder="Технические характеристики, особенности, комплектация..."
                  className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Теги (через запятую)</label>
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="line array, jbl, звук"
                  className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Фото</label>
                <div className="flex items-center gap-3">
                  {form.image && (
                    <div className="w-20 h-14 rounded-sm overflow-hidden border border-amber-500/20 shrink-0">
                      <img src={form.image} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) { const url = await uploadImage(file); if (url) setForm(f => ({ ...f, image: url })); }
                    }} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-2 border border-amber-500/20 text-gray-400 hover:text-white px-3 py-2 rounded-sm text-xs transition-colors disabled:opacity-40">
                    {uploading ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Upload" size={12} />}
                    {uploading ? "Загружаю..." : form.image ? "Заменить" : "Загрузить фото"}
                  </button>
                  {form.image && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, image: "" }))}
                      className="text-gray-600 hover:text-red-400 text-xs transition-colors">Удалить</button>
                  )}
                </div>
              </div>

              {formError && <div className="border border-red-500/30 text-red-400 text-sm px-4 py-2.5 rounded-sm">{formError}</div>}
              {formSuccess && <div className="border border-green-500/30 text-green-400 text-sm px-4 py-2.5 rounded-sm">{formSuccess}</div>}

              <div className="flex gap-3">
                <button type="submit" disabled={formLoading}
                  className="neon-btn px-6 py-2.5 rounded-sm text-sm flex items-center gap-2 disabled:opacity-40">
                  {formLoading ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Send" size={14} />}
                  {formLoading ? "Сохраняю..." : "Отправить на модерацию"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditEq(null); setForm(emptyEq); }}
                  className="border border-amber-500/20 text-gray-400 hover:text-white px-6 py-2.5 rounded-sm text-sm transition-colors">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-amber-500/10">
          {[
            { key: "equipment", label: "Моё оборудование", icon: "Package", count: equipment.length },
            { key: "orders", label: "Заказы", icon: "ShoppingBag", count: newOrders },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`flex items-center gap-2 px-5 py-3 text-sm transition-all border-b-2 -mb-px ${
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

        {/* ── МОЁ ОБОРУДОВАНИЕ ── */}
        {tab === "equipment" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-gray-500 text-sm">{equipment.length} позиций</p>
              <button
                onClick={() => { setEditEq(null); setForm(emptyEq); setShowForm(true); setFormError(""); setFormSuccess(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="neon-btn flex items-center gap-2 px-4 py-2 rounded-sm text-sm"
              >
                <Icon name="Plus" size={14} /> Добавить оборудование
              </button>
            </div>

            {eqLoading ? (
              <div className="flex justify-center py-16"><Icon name="Loader2" size={32} className="text-amber-500 animate-spin" /></div>
            ) : equipment.length === 0 ? (
              <div className="glass-card rounded-sm p-16 text-center">
                <Icon name="Package" size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">Оборудования пока нет</p>
                <p className="text-gray-600 text-sm">Добавьте первую позицию и отправьте на модерацию</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {equipment.map(eq => (
                  <div key={eq.id} className="glass-card rounded-sm p-5">
                    <div className="flex items-start gap-4">
                      {eq.image && (
                        <div className="w-16 h-12 rounded-sm overflow-hidden border border-amber-500/10 shrink-0">
                          <img src={eq.image} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-white text-sm font-semibold truncate">{eq.name}</h3>
                          {statusEqBadge(eq.status)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                          <span className="border border-amber-500/20 text-amber-500/60 px-1.5 py-0.5 rounded-sm">{eq.category}</span>
                          <span className="font-oswald text-amber-500">{eq.price.toLocaleString()} ₽/{eq.unit}</span>
                        </div>
                        {eq.status === "rejected" && (
                          <div className="text-xs text-red-400 mb-2 flex items-center gap-1">
                            <Icon name="AlertCircle" size={11} /> Отклонено — отредактируйте и отправьте снова
                          </div>
                        )}
                        <button
                          onClick={() => openEdit(eq)}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-500 transition-colors"
                        >
                          <Icon name="Pencil" size={11} /> Редактировать
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ЗАКАЗЫ ── */}
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
                        <div className="flex items-center gap-3 mb-2">
                          {statusOrderBadge(order.status)}
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
