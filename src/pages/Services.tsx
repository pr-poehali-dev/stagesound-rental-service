import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useSeo } from "@/hooks/useSeo";

const services = [
  {
    id: "delivery",
    icon: "Truck",
    title: "Доставка",
    subtitle: "По Москве и области",
    price: "от 1 500 ₽",
    description: "Доставляем оборудование в любую точку Москвы и Подмосковья. Опытные водители-экспедиторы бережно транспортируют технику в фирменных кейсах и кофрах.",
    features: [
      "Доставка в день заказа при бронировании до 18:00",
      "GPS-отслеживание транспорта",
      "Страхование груза",
      "Работаем 24/7, включая праздники",
      "Разгрузка на месте в комплекте",
    ],
    zones: [
      { name: "Центр Москвы", price: "1 500 ₽" },
      { name: "Москва (в пределах МКАД)", price: "2 200 ₽" },
      { name: "Подмосковье (до 50 км)", price: "3 500 ₽" },
      { name: "Подмосковье (50–100 км)", price: "5 500 ₽" },
    ],
  },
  {
    id: "installation",
    icon: "Wrench",
    title: "Монтаж и демонтаж",
    subtitle: "Профессиональная установка",
    price: "от 3 000 ₽",
    description: "Наши технические специалисты профессионально смонтируют, настроят и проверят всё оборудование перед мероприятием. После — демонтируем и заберём всё в срок.",
    features: [
      "Выезд бригады с опытом от 5 лет",
      "Монтаж акустики, света, видео и сцены",
      "Прокладка кабельных трасс",
      "Тестирование и настройка перед шоу",
      "Демонтаж после окончания мероприятия",
    ],
    zones: [
      { name: "Звук (малый)", price: "3 000 ₽" },
      { name: "Звук + Свет (средний)", price: "7 500 ₽" },
      { name: "Полный комплекс (крупный)", price: "от 18 000 ₽" },
      { name: "Фестиваль / аутдор", price: "по запросу" },
    ],
  },
  {
    id: "support",
    icon: "Headphones",
    title: "Техническая поддержка",
    subtitle: "Техник на месте",
    price: "от 4 000 ₽/день",
    description: "Опытный технический специалист присутствует на вашем мероприятии от начала до конца: следит за работой оборудования, оперативно решает любые технические вопросы.",
    features: [
      "Постоянное присутствие на мероприятии",
      "Звукорежиссёр / световой оператор",
      "Экстренное реагирование на неполадки",
      "Склад резервного оборудования рядом",
      "Отчёт после мероприятия",
    ],
    zones: [
      { name: "Техник (до 8 ч)", price: "4 000 ₽" },
      { name: "Звукорежиссёр (до 8 ч)", price: "7 000 ₽" },
      { name: "Световой оператор (до 8 ч)", price: "6 500 ₽" },
      { name: "Полная бригада (до 8 ч)", price: "18 000 ₽" },
    ],
  },
  {
    id: "turnkey",
    icon: "Star",
    title: "Мероприятие под ключ",
    subtitle: "Всё включено",
    price: "Индивидуально",
    description: "Полный технический продакшн вашего события: от концепции технического райдера до финального демонтажа. Один контакт — все вопросы решены.",
    features: [
      "Разработка технического проекта",
      "Подбор и аренда оборудования",
      "Доставка, монтаж и демонтаж",
      "Постоянная техподдержка",
      "Документальный отчёт",
    ],
    zones: [
      { name: "Корпоратив (до 200 чел.)", price: "от 80 000 ₽" },
      { name: "Конференция (200–500 чел.)", price: "от 150 000 ₽" },
      { name: "Концерт (500–2000 чел.)", price: "от 350 000 ₽" },
      { name: "Фестиваль (2000+ чел.)", price: "по запросу" },
    ],
  },
];

export default function Services() {
  useSeo({ page: "services" });
  const [activeService, setActiveService] = useState(services[0].id);
  const current = services.find((s) => s.id === activeService)!;

  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        <div className="relative mb-12">
          <div className="section-number">03</div>
          <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Что входит</p>
          <h1 className="font-oswald text-5xl md:text-6xl font-bold uppercase text-white">Наши услуги</h1>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-10">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveService(s.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-sm text-sm font-medium uppercase tracking-wider transition-all ${
                activeService === s.id
                  ? "neon-btn"
                  : "border border-amber-500/20 text-gray-400 hover:text-white hover:border-amber-500/40"
              }`}
            >
              <Icon name={s.icon} size={16} />
              {s.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <div>
            <div className="glass-card p-8 rounded-sm h-full">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 flex items-center justify-center border border-amber-500/30 rounded-sm">
                  <Icon name={current.icon} size={28} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="font-oswald text-3xl font-bold text-white uppercase">{current.title}</h2>
                  <p className="text-gray-500 text-sm">{current.subtitle}</p>
                </div>
              </div>

              <p className="text-gray-400 leading-relaxed mb-8">{current.description}</p>

              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-4">Что включено</h3>
              <ul className="space-y-3">
                {current.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-300">
                    <Icon name="CheckCircle" size={16} className="text-amber-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-card p-6 rounded-sm">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-4">Стоимость</h3>
              <div className="space-y-3">
                {current.zones.map((z) => (
                  <div key={z.name} className="flex items-center justify-between py-2 border-b border-amber-500/10 last:border-0">
                    <span className="text-gray-400 text-sm">{z.name}</span>
                    <span className="font-oswald font-bold neon-text">{z.price}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-6 rounded-sm border border-amber-500/20">
              <div className="flex items-center gap-3 mb-4">
                <Icon name="Zap" size={20} className="text-amber-500" />
                <h3 className="font-semibold text-white">Быстрый расчёт</h3>
              </div>
              <p className="text-gray-500 text-sm mb-4">
                Укажи детали мероприятия и получи точное коммерческое предложение в течение 30 минут
              </p>
              <Link to="/calculator" className="neon-btn block text-center px-6 py-3 rounded-sm text-sm">
                Рассчитать стоимость
              </Link>
            </div>

            <div className="glass-card p-6 rounded-sm">
              <div className="flex items-center gap-3 mb-3">
                <Icon name="Shield" size={20} className="text-amber-500" />
                <h3 className="font-semibold text-white">Гарантии</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-amber-500" /> Возврат при отмене за 72 часа</li>
                <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-amber-500" /> Замена оборудования при неисправности</li>
                <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-amber-500" /> Фиксированная цена без надбавок</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Delivery info */}
        <div className="border-t border-amber-500/10 pt-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "Clock", title: "Быстрая доставка", text: "Привозим оборудование в день заказа при бронировании до 18:00" },
              { icon: "Shield", title: "Страховка включена", text: "Всё оборудование застраховано, вы несёте ответственность только за намеренный ущерб" },
              { icon: "RefreshCw", title: "Замена за 2 часа", text: "Если оборудование выйдет из строя — заменим резервным в течение 2 часов" },
            ].map((item) => (
              <div key={item.title} className="glass-card p-6 rounded-sm flex gap-4">
                <div className="w-10 h-10 flex items-center justify-center border border-amber-500/20 rounded-sm shrink-0">
                  <Icon name={item.icon} size={20} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-gray-500 text-sm">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}