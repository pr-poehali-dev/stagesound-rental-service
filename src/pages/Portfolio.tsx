import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useSeo } from "@/hooks/useSeo";
import { useCity } from "@/context/CityContext";
import { CITY_CONTENT } from "@/data/cityContent";

const portfolioFilters = ["Все", "Концерты", "Конференции", "Корпоративы", "Фестивали", "Шоу"];

const projects = [
  {
    id: 1,
    title: "TechForum 2024",
    category: "Конференции",
    date: "Март 2024",
    guests: 1200,
    equipment: ["LED-экран 200 м²", "Конференц-система Bosch", "Лазерный проектор 30000 лм"],
    description: "Крупнейшая IT-конференция года. Обеспечили полное техническое оснащение трёх залов и центральной сцены.",
    tags: ["LED-экран", "конференц-система", "проектор"],
    highlight: true,
  },
  {
    id: 2,
    title: "Фестиваль Aurora 2024",
    category: "Фестивали",
    date: "Июль 2024",
    guests: 5000,
    equipment: ["Line Array JBL VTX", "Лазерное шоу 10 кВт", "Сцена 20×12 м"],
    description: "Трёхдневный музыкальный фестиваль под открытым небом. Полный звуко-световой комплекс.",
    tags: ["line array", "лазер", "сцена"],
    highlight: true,
  },
  {
    id: 3,
    title: "Гала-вечер X5 Group",
    category: "Корпоративы",
    date: "Декабрь 2023",
    guests: 800,
    equipment: ["Звуковая система d&b", "Световой rig 60 приборов", "Дым и спецэффекты"],
    description: "Новогодний корпоратив с тематическим световым шоу и живой музыкой.",
    tags: ["корпоратив", "свет", "спецэффекты"],
    highlight: false,
  },
  {
    id: 4,
    title: "Концерт Иванова",
    category: "Концерты",
    date: "Октябрь 2023",
    guests: 3000,
    equipment: ["Line Array 32 блока", "Диммерная ферма 24 прибора", "LED-экран сцены"],
    description: "Сольный концерт в СК Лужники. Полный технический райдер исполнителя.",
    tags: ["концерт", "line array", "свет"],
    highlight: true,
  },
  {
    id: 5,
    title: "Brand Forum 2024",
    category: "Конференции",
    date: "Апрель 2024",
    guests: 400,
    equipment: ["Конференц-система 400 мест", "Синхронный перевод 4 языка", "Потоковое вещание"],
    description: "Международный форум брендов. Синхронный перевод, потоковая трансляция на 15 000 онлайн-зрителей.",
    tags: ["форум", "перевод", "стриминг"],
    highlight: false,
  },
  {
    id: 6,
    title: "Cirque du Lumière",
    category: "Шоу",
    date: "Февраль 2024",
    guests: 650,
    equipment: ["Световые роботы 48 ед.", "Лазеры RGB 5 кВт", "Пиротехника сцены"],
    description: "Цирковое шоу с элементами световой инсталляции и лазерного перформанса.",
    tags: ["шоу", "лазер", "роботы"],
    highlight: true,
  },
];

export default function Portfolio() {
  useSeo({ page: "portfolio" });
  const { city } = useCity();
  const content = CITY_CONTENT[city.id] ?? CITY_CONTENT.moscow;
  const [activeFilter, setActiveFilter] = useState("Все");
  const [selected, setSelected] = useState<null | (typeof projects)[0]>(null);

  const filtered = activeFilter === "Все" ? projects : projects.filter((p) => p.category === activeFilter);

  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        <div className="relative mb-12">
          <div className="section-number">05</div>
          <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Наши работы</p>
          <h1 className="font-oswald text-5xl md:text-6xl font-bold uppercase text-white">Портфолио</h1>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-6 mb-12 py-6 border-y border-amber-500/10">
          {[
            { value: "1200+", label: "Завершённых проектов" },
            { value: "5 000 000+", label: "Гостей на мероприятиях" },
            { value: "8 лет", label: "Опыта" },
            { value: "98%", label: "Клиентов возвращаются" },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-oswald text-3xl font-bold neon-text">{s.value}</div>
              <div className="text-gray-600 text-xs uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {portfolioFilters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 text-sm rounded-sm uppercase tracking-wider transition-all ${
                activeFilter === f
                  ? "neon-btn"
                  : "border border-amber-500/20 text-gray-500 hover:text-white hover:border-amber-500/40"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {filtered.map((project) => (
            <div
              key={project.id}
              className="glass-card rounded-sm overflow-hidden cursor-pointer group hover:border-amber-500/30 transition-all"
              onClick={() => setSelected(project)}
            >
              {/* Image placeholder */}
              <div className="h-48 relative overflow-hidden" style={{ background: "var(--surface-2)" }}>
                <div className="absolute inset-0 grid-pattern opacity-40" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="font-oswald text-7xl font-bold opacity-10 text-amber-500 select-none">
                    {project.guests.toLocaleString()}
                  </div>
                </div>
                {project.highlight && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs bg-amber-500 text-black font-bold px-2 py-0.5 uppercase">
                    <Icon name="Star" size={10} />
                    Избранное
                  </div>
                )}
                <div className="absolute top-3 right-3 text-xs border border-amber-500/30 text-amber-500/70 px-2 py-0.5 rounded-sm">
                  {project.category}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-900/80 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                  <span className="text-white text-sm font-semibold">{project.title}</span>
                  <Icon name="ArrowUpRight" size={16} className="text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1"><Icon name="Calendar" size={12} />{project.date}</span>
                  <span className="flex items-center gap-1"><Icon name="Users" size={12} />{project.guests.toLocaleString()} гостей</span>
                </div>
                <p className="text-gray-500 text-xs line-clamp-2 mb-3">{project.description}</p>
                <div className="flex flex-wrap gap-1">
                  {project.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-xs border border-amber-500/15 text-gray-600 px-2 py-0.5 rounded-sm">#{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reviews */}
        <div className="border-t border-amber-500/10 pt-16">
          <div className="mb-8">
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Отзывы о проектах</p>
            <h2 className="font-oswald text-4xl font-bold uppercase text-white">Что говорят клиенты</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Владимир К.", project: "TechForum 2024", text: "Звук на форуме был идеальным. Монтажная бригада прибыла за 5 часов до начала и успела всё проверить трижды.", rating: 5 },
              { name: "Светлана М.", project: "Aurora Festival", text: "Лазерное шоу произвело впечатление на всех 5000 гостей. Ни одного сбоя за три дня фестиваля. Это профессионализм.", rating: 5 },
              { name: "Артём П.", project: "Cirque du Lumière", text: "Световые роботы отработали шоу идеально. Дополнительных правок не потребовалось — сразу попали в наш концепт.", rating: 5 },
            ].map((r) => (
              <div key={r.name} className="glass-card p-6 rounded-sm">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Icon key={i} name="Star" size={12} className="text-amber-500 fill-amber-500" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-4">"{r.text}"</p>
                <div className="border-t border-amber-500/10 pt-3">
                  <div className="text-white text-sm font-semibold">{r.name}</div>
                  <div className="text-gray-600 text-xs">{r.project}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SEO Text Block */}
      <div className="container mx-auto px-4 py-16 border-t border-amber-500/10">
        <div className="max-w-4xl">
          <h2 className="font-oswald text-3xl font-bold uppercase text-white mb-6">
            {content.portfolioSeoBlock.title}
          </h2>
          <div className="space-y-4">
            {content.portfolioSeoBlock.paragraphs.map((p, i) => (
              <p key={i} className="text-gray-500 text-sm leading-relaxed">{p}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="glass-card neon-border rounded-sm p-8 max-w-xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs text-amber-500 uppercase tracking-wider">{selected.category}</span>
                <h2 className="font-oswald text-3xl font-bold text-white uppercase">{selected.title}</h2>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                  <span>{selected.date}</span>
                  <span>{selected.guests.toLocaleString()} гостей</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white">
                <Icon name="X" size={20} />
              </button>
            </div>
            <p className="text-gray-400 mb-6">{selected.description}</p>
            <div className="mb-6">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Использованное оборудование</h3>
              <ul className="space-y-2">
                {selected.equipment.map((eq) => (
                  <li key={eq} className="flex items-center gap-2 text-sm text-gray-300">
                    <Icon name="CheckCircle" size={14} className="text-amber-500" />
                    {eq}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.tags.map((tag) => (
                <span key={tag} className="text-xs border border-amber-500/20 text-amber-500/70 px-2 py-1 rounded-sm">#{tag}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}