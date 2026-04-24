import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

type OrderItem = { name: string; qty: number; subtotal: number };

type Order = {
  id: number;
  order_number: string;
  name: string;
  phone: string;
  date: string;
  place: string;
  comment: string;
  items: OrderItem[];
  days: number;
  delivery: string;
  extras: string[];
  total: number;
  created_at: string;
};

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);

  const login = async () => {
    setLoading(true);
    setAuthError(false);
    const res = await fetch(func2url["get-orders"], {
      headers: { "X-Admin-Password": password },
    });
    if (res.status === 401) {
      setAuthError(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setOrders(data.orders || []);
    setAuthed(true);
    setLoading(false);
  };

  const refresh = async () => {
    setLoading(true);
    const res = await fetch(func2url["get-orders"], {
      headers: { "X-Admin-Password": password },
    });
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-primary)" }}>
        <div className="glass-card neon-border rounded-sm p-10 max-w-sm w-full text-center">
          <div className="w-16 h-16 flex items-center justify-center border border-amber-500/30 rounded-sm mx-auto mb-6">
            <Icon name="ShieldCheck" size={32} className="text-amber-500" />
          </div>
          <h1 className="font-oswald text-2xl font-bold text-white uppercase mb-1">Панель заявок</h1>
          <p className="text-gray-500 text-sm mb-8">Введите пароль для доступа</p>
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
    <div className="min-h-screen py-10 px-4" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Администратор</p>
            <h1 className="font-oswald text-4xl font-bold text-white uppercase">Заявки</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">{orders.length} заявок</span>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-2 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-4 py-2 rounded-sm text-sm transition-colors"
            >
              <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
              Обновить
            </button>
          </div>
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
                    <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Дата заявки</th>
                    <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Клиент</th>
                    <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Телефон</th>
                    <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Дата события</th>
                    <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Место</th>
                    <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Дней</th>
                    <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right">Сумма</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, i) => (
                    <tr
                      key={order.id}
                      className={`border-b border-amber-500/5 hover:bg-amber-500/5 cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                      onClick={() => setSelected(order)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-oswald text-amber-500 font-bold">{order.order_number}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{formatDate(order.created_at)}</td>
                      <td className="px-4 py-3 text-white font-medium">{order.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-300">{order.phone || "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{order.date || "—"}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-[150px] truncate">{order.place || "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{order.days}</td>
                      <td className="px-4 py-3 text-right font-oswald font-bold neon-text">{(order.total || 0).toLocaleString()} ₽</td>
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

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="glass-card neon-border rounded-sm max-w-lg w-full max-h-[90vh] overflow-y-auto p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="text-xs text-amber-500 uppercase tracking-widest">Заявка</span>
                <h2 className="font-oswald text-3xl font-bold text-white">{selected.order_number}</h2>
                <p className="text-gray-500 text-xs mt-1">{formatDate(selected.created_at)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white transition-colors">
                <Icon name="X" size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: "Клиент", value: selected.name, icon: "User" },
                { label: "Телефон", value: selected.phone, icon: "Phone" },
                { label: "Дата события", value: selected.date || "—", icon: "Calendar" },
                { label: "Место", value: selected.place || "—", icon: "MapPin" },
                { label: "Дней аренды", value: String(selected.days), icon: "Clock" },
                { label: "Доставка", value: selected.delivery, icon: "Truck" },
              ].map((f) => (
                <div key={f.label} className="bg-black/30 rounded-sm px-3 py-2">
                  <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                    <Icon name={f.icon as "User"} size={10} />{f.label}
                  </div>
                  <div className="text-white text-sm font-medium">{f.value}</div>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Оборудование</h3>
              <div className="space-y-1">
                {(selected.items || []).map((it, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-400">{it.name} × {it.qty} × {selected.days} дн.</span>
                    <span className="text-white font-medium">{(it.subtotal || 0).toLocaleString()} ₽</span>
                  </div>
                ))}
              </div>
            </div>

            {selected.extras && selected.extras.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Доп. услуги</h3>
                {selected.extras.map((ex, i) => (
                  <div key={i} className="text-gray-400 text-sm">• {ex}</div>
                ))}
              </div>
            )}

            {selected.comment && (
              <div className="mb-4 p-3 border border-amber-500/10 rounded-sm">
                <div className="text-xs text-gray-500 mb-1">Комментарий</div>
                <div className="text-gray-300 text-sm">{selected.comment}</div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-amber-500/10">
              <span className="text-gray-400">Итого</span>
              <span className="font-oswald text-3xl font-bold neon-text">{(selected.total || 0).toLocaleString()} ₽</span>
            </div>

            <a
              href={`tel:${selected.phone}`}
              className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 mt-4"
            >
              <Icon name="Phone" size={16} />
              Позвонить клиенту
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
