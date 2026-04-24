import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useCity } from "@/context/CityContext";
import { useSeo } from "@/hooks/useSeo";
import { CITY_CONTENT } from "@/data/cityContent";

export default function Contacts() {
  useSeo({ page: "contacts" });
  const { city } = useCity();
  const content = CITY_CONTENT[city.id] ?? CITY_CONTENT.moscow;
  const [form, setForm] = useState({ name: "", phone: "", email: "", type: "", message: "", date: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1200);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        <div className="relative mb-12">
          <div className="section-number">06</div>
          <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Свяжитесь с нами</p>
          <h1 className="font-oswald text-5xl md:text-6xl font-bold uppercase text-white">Контакты</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Contact Info */}
          <div>
            <div className="space-y-4 mb-8">
              {[
                { icon: "Phone", label: "Телефон", value: city.phoneDisplay, sub: city.name },
                { icon: "Mail", label: "Email", value: city.email, sub: "Ответим за 30 минут" },
                { icon: "MapPin", label: "Адрес склада", value: city.address, sub: `${city.workdays} / ${city.weekend}` },
                { icon: "Send", label: "Telegram", value: "+7 933 322-20-28", sub: "Оперативная связь" },
              ].map((item) => (
                <div key={item.label} className="glass-card p-5 rounded-sm flex items-center gap-4">
                  <div className="w-11 h-11 flex items-center justify-center border border-amber-500/20 rounded-sm shrink-0">
                    <Icon name={item.icon} size={20} className="text-amber-500" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 uppercase tracking-wider">{item.label}</div>
                    <div className="text-white font-semibold">{item.value}</div>
                    <div className="text-gray-600 text-xs">{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Мессенджеры */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <a
                href="https://max.ru/+79333222028"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 rounded-sm py-3 text-sm font-medium transition-colors"
              >
                <Icon name="MessageSquare" size={16} />
                Написать в MAX
              </a>
              <a
                href="https://t.me/+79333222028"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 rounded-sm py-3 text-sm font-medium transition-colors"
              >
                <Icon name="Send" size={16} />
                Написать в Telegram
              </a>
            </div>

            <div className="glass-card p-6 rounded-sm">
              <h3 className="font-oswald text-xl font-bold text-white uppercase mb-4">Как добраться</h3>
              <div className="rounded-sm overflow-hidden border border-amber-500/10 h-48 flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
                <div className="text-center">
                  <Icon name="MapPin" size={32} className="text-amber-500 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">м. Профсоюзная, 5 мин. пешком</p>
                  <p className="text-gray-600 text-xs">ул. Профсоюзная, 65, стр. 2</p>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-500 space-y-1">
                <div className="flex items-center gap-2"><Icon name="Train" size={14} className="text-amber-500" /> м. Профсоюзная — 5 минут пешком</div>
                <div className="flex items-center gap-2"><Icon name="Car" size={14} className="text-amber-500" /> Парковка для клиентов — бесплатно</div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div>
            {submitted ? (
              <div className="glass-card neon-border rounded-sm p-12 flex flex-col items-center justify-center text-center h-full">
                <div className="w-16 h-16 flex items-center justify-center border-2 border-amber-500 rounded-sm mb-6 pulse-neon">
                  <Icon name="CheckCircle" size={32} className="text-amber-500" />
                </div>
                <h2 className="font-oswald text-3xl font-bold text-white uppercase mb-3">Заявка принята!</h2>
                <p className="text-gray-400 mb-6">Мы свяжемся с вами в течение 30 минут в рабочее время. Если срочно — звоните: {city.phoneDisplay}</p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: "", phone: "", email: "", type: "", message: "", date: "" }); }}
                  className="text-amber-500 text-sm uppercase tracking-wider hover:text-white transition-colors"
                >
                  Отправить ещё раз
                </button>
              </div>
            ) : (
              <div className="glass-card p-8 rounded-sm">
                <h2 className="font-oswald text-2xl font-bold text-white uppercase mb-2">Оставить заявку</h2>
                <p className="text-gray-500 text-sm mb-6">Ответим в течение 30 минут и подберём оборудование под ваш бюджет</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1.5">Имя *</label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Иван Иванов"
                        className="w-full bg-transparent border border-amber-500/20 rounded-sm px-4 py-3 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1.5">Телефон *</label>
                      <input
                        type="tel"
                        name="phone"
                        required
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="+7 (999) 000-00-00"
                        className="w-full bg-transparent border border-amber-500/20 rounded-sm px-4 py-3 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1.5">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="email@company.ru"
                      className="w-full bg-transparent border border-amber-500/20 rounded-sm px-4 py-3 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1.5">Тип мероприятия</label>
                      <select
                        name="type"
                        value={form.type}
                        onChange={handleChange}
                        className="w-full bg-transparent border border-amber-500/20 rounded-sm px-4 py-3 text-sm text-gray-400 focus:outline-none focus:border-amber-500/50 transition-colors"
                        style={{ background: "var(--surface-2)" }}
                      >
                        <option value="">Выбрать...</option>
                        <option>Концерт</option>
                        <option>Конференция</option>
                        <option>Корпоратив</option>
                        <option>Фестиваль</option>
                        <option>Шоу</option>
                        <option>Другое</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1.5">Дата мероприятия</label>
                      <input
                        type="date"
                        name="date"
                        value={form.date}
                        onChange={handleChange}
                        className="w-full bg-transparent border border-amber-500/20 rounded-sm px-4 py-3 text-sm text-gray-400 focus:outline-none focus:border-amber-500/50 transition-colors"
                        style={{ colorScheme: "dark" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 uppercase tracking-wider block mb-1.5">Сообщение</label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Опишите ваше мероприятие: площадка, количество гостей, нужное оборудование..."
                      className="w-full bg-transparent border border-amber-500/20 rounded-sm px-4 py-3 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="neon-btn w-full py-4 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <Icon name="Loader2" size={16} className="animate-spin" />
                        Отправляем...
                      </>
                    ) : (
                      <>
                        <Icon name="Send" size={16} />
                        Отправить заявку
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-700 text-center">
                    Нажимая кнопку, вы соглашаетесь с политикой обработки персональных данных
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEO Text Block */}
      <div className="container mx-auto px-4 py-16 border-t border-amber-500/10">
        <div className="max-w-4xl">
          <h2 className="font-oswald text-3xl font-bold uppercase text-white mb-6">
            {content.contactsSeoBlock.title}
          </h2>
          <div className="space-y-4">
            {content.contactsSeoBlock.paragraphs.map((p, i) => (
              <p key={i} className="text-gray-500 text-sm leading-relaxed">{p}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}