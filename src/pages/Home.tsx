import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useSeo } from "@/hooks/useSeo";
import { useCity } from "@/context/CityContext";
import { CITY_CONTENT } from "@/data/cityContent";

const stats = [
  { value: "500+", label: "Единиц оборудования" },
  { value: "1200+", label: "Мероприятий" },
  { value: "8 лет", label: "На рынке" },
  { value: "98%", label: "Довольных клиентов" },
];

const categories = [
  { icon: "Mic2", title: "Звук", desc: "Профессиональный звук для любых площадок", count: 87 },
  { icon: "Lightbulb", title: "Свет", desc: "Световые установки и эффекты", count: 124 },
  { icon: "Monitor", title: "Видео", desc: "Проекторы, экраны, LED-панели", count: 56 },
  { icon: "Stage", title: "Сцена", desc: "Сценические конструкции и оборудование", count: 43 },
  { icon: "Wifi", title: "Конференц", desc: "Системы конференц-связи и переговоров", count: 38 },
  { icon: "Zap", title: "Генераторы", desc: "Автономное электроснабжение", count: 22 },
];

const reviews = [
  {
    name: "Анастасия Волкова",
    role: "Event-директор, TechConf",
    text: "Работаем с Global Renta уже 3 года. Качество звукового оборудования на высшем уровне, монтажная команда — профессионалы. Ни разу не подвели.",
    rating: 5,
  },
  {
    name: "Игорь Семёнов",
    role: "Организатор концертов",
    text: "Арендовали световое шоу на фестиваль 3000 человек. Всё было настроено идеально, техподдержка работала всю ночь. Рекомендую!",
    rating: 5,
  },
  {
    name: "Марина Козлова",
    role: "PR-менеджер, Luxe Events",
    text: "Отличный сервис от заявки до монтажа. Калькулятор на сайте точно посчитал стоимость, никаких сюрпризов. Будем обращаться снова.",
    rating: 5,
  },
];

export default function Home() {
  useSeo({ page: "home" });
  const { city } = useCity();
  const content = CITY_CONTENT[city.id] ?? CITY_CONTENT.moscow;

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster="https://cdn.poehali.dev/projects/bbfa4077-327f-4ddf-84d0-e92a698a19e6/files/6b27e5a8-dfd1-4749-bf9b-5f9ba48a1b99.jpg"
        >
          <source src="https://videos.pexels.com/video-files/3257809/3257809-uhd_2560_1440_25fps.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm border border-amber-500/30 text-amber-500 text-xs font-medium uppercase tracking-widest mb-6">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              Профессиональная аренда оборудования · {city.name}
            </div>

            <h1 className="font-oswald text-6xl md:text-8xl font-bold uppercase leading-none mb-6">
              <span className="text-white">Звук. Свет.</span>
              <br />
              <span className="neon-text">Сцена.</span>
            </h1>

            <p className="text-gray-400 text-lg md:text-xl max-w-xl mb-10 leading-relaxed">
              {content.heroSubtitle}
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/catalog" className="neon-btn px-8 py-4 rounded-sm text-sm flex items-center gap-2">
                Смотреть каталог
                <Icon name="ArrowRight" size={16} />
              </Link>
              <Link
                to="/calculator"
                className="px-8 py-4 rounded-sm text-sm border border-amber-500/30 text-white hover:border-amber-500/60 transition-all flex items-center gap-2 uppercase tracking-wider font-semibold"
              >
                <Icon name="Calculator" size={16} className="text-amber-500" />
                Рассчитать стоимость
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden xl:block">
          <div className="font-oswald text-[200px] font-bold leading-none select-none" style={{ color: "rgba(255,140,0,0.04)" }}>
            01
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-amber-500/10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.value} className="text-center">
                <div className="font-oswald text-4xl md:text-5xl font-bold neon-text mb-1">{s.value}</div>
                <div className="text-gray-500 text-sm uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Что мы предлагаем</p>
              <h2 className="font-oswald text-4xl md:text-5xl font-bold uppercase text-white">
                Категории<br />оборудования
              </h2>
            </div>
            <Link to="/catalog" className="hidden md:flex items-center gap-2 text-amber-500 text-sm uppercase tracking-wider hover:gap-4 transition-all">
              Весь каталог <Icon name="ArrowRight" size={16} />
            </Link>
          </div>
          <p className="text-gray-500 text-sm mb-10 max-w-2xl">{content.categoriesIntro}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.title}
                to={`/catalog?category=${cat.title.toLowerCase()}`}
                className="glass-card p-6 rounded-sm group hover:border-amber-500/30 transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 flex items-center justify-center border border-amber-500/20 rounded-sm group-hover:border-amber-500/50 transition-colors">
                      <Icon name={cat.icon} size={22} className="text-amber-500" />
                    </div>
                    <span className="text-xs text-gray-600 font-mono">{cat.count} ед.</span>
                  </div>
                  <h3 className="font-oswald text-xl font-bold text-white uppercase mb-1">{cat.title}</h3>
                  <p className="text-gray-500 text-sm">{cat.desc}</p>
                  <div className="flex items-center gap-1 mt-4 text-amber-500 text-xs uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                    Перейти <Icon name="ArrowRight" size={12} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Calculator */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/5" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="glass-card neon-border rounded-sm p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="font-oswald text-4xl md:text-5xl font-bold uppercase text-white mb-4">
                Рассчитай стоимость<br />за 2 минуты
              </h2>
              <p className="text-gray-400 max-w-md">
                Выбери оборудование, укажи даты мероприятия — получи точную стоимость аренды {content.cityNameIn} без скрытых платежей
              </p>
            </div>
            <Link to="/calculator" className="neon-btn px-10 py-5 rounded-sm text-base whitespace-nowrap flex items-center gap-3">
              <Icon name="Calculator" size={20} />
              Открыть калькулятор
            </Link>
          </div>
        </div>
      </section>

      {/* How we work */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Полный цикл</p>
            <h2 className="font-oswald text-4xl md:text-5xl font-bold uppercase text-white">Как мы работаем</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { num: "01", icon: "ShoppingCart", title: "Выбор", desc: "Подбираем оборудование под задачи вашего события" },
              { num: "02", icon: "Truck", title: "Доставка", desc: `Привозим ${content.cityNameFrom} в удобное время` },
              { num: "03", icon: "Wrench", title: "Монтаж", desc: "Профессиональная установка и настройка" },
              { num: "04", icon: "Headphones", title: "Поддержка", desc: "Техник на месте весь период мероприятия" },
            ].map((step) => (
              <div key={step.num} className="relative pl-4 border-l border-amber-500/20">
                <div className="font-oswald text-5xl font-bold mb-4" style={{ color: "rgba(255,140,0,0.1)" }}>{step.num}</div>
                <Icon name={step.icon} size={24} className="text-amber-500 mb-3" />
                <h3 className="font-oswald text-xl font-bold text-white uppercase mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-20 border-t border-amber-500/10">
        <div className="container mx-auto px-4">
          <div className="mb-12">
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Отзывы клиентов</p>
            <h2 className="font-oswald text-4xl md:text-5xl font-bold uppercase text-white">Нам доверяют</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <div key={review.name} className="glass-card p-6 rounded-sm">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Icon key={i} name="Star" size={14} className="text-amber-500 fill-amber-500" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6">"{review.text}"</p>
                <div className="border-t border-amber-500/10 pt-4">
                  <div className="font-semibold text-white text-sm">{review.name}</div>
                  <div className="text-gray-600 text-xs mt-0.5">{review.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEO Text Block */}
      <section className="py-16 border-t border-amber-500/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            <h2 className="font-oswald text-3xl md:text-4xl font-bold uppercase text-white mb-8">
              {content.seoBlock.title}
            </h2>
            <div className="space-y-4">
              {content.seoBlock.paragraphs.map((p, i) => (
                <p key={i} className="text-gray-500 text-sm leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 border-t border-amber-500/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Часто спрашивают</p>
            <h2 className="font-oswald text-3xl md:text-4xl font-bold uppercase text-white mb-8">
              Вопросы и ответы
            </h2>
            <div className="space-y-4">
              {content.faq.map((item, i) => (
                <div key={i} className="glass-card p-6 rounded-sm">
                  <h3 className="font-semibold text-white mb-2">{item.q}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
