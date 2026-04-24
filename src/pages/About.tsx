import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useSeo } from "@/hooks/useSeo";
import { useCity } from "@/context/CityContext";
import { CITY_CONTENT } from "@/data/cityContent";

const team = [
  { name: "Алексей Рогозин", role: "Генеральный директор", exp: "15 лет в event-индустрии", icon: "User" },
  { name: "Дмитрий Семёнов", role: "Главный звукорежиссёр", exp: "Более 800 концертов", icon: "Mic2" },
  { name: "Ксения Павлова", role: "Руководитель проектов", exp: "200+ корпоративных событий", icon: "Briefcase" },
  { name: "Владимир Тихонов", role: "Главный технический специалист", exp: "10 лет, сертификат JBL", icon: "Wrench" },
];

const milestones = [
  { year: "2016", event: "Основание компании. Первый склад в Москве." },
  { year: "2018", event: "Выход на рынок крупных фестивалей. Первый концерт 5000+ зрителей." },
  { year: "2020", event: "Расширение парка видеооборудования. Открытие отдела конференц-систем." },
  { year: "2022", event: "Партнёрство с JBL, Martin Lighting, Panasonic." },
  { year: "2024", event: "Более 1200 успешных мероприятий. Топ-3 в Москве по аренде сценического оборудования." },
];

const certificates = [
  "Авторизованный дилер JBL Professional",
  "Партнёр Martin by Harman",
  "Сертификат Panasonic Pro AV",
  "Член Ассоциации event-индустрии России",
];

export default function About() {
  useSeo({ page: "about" });
  const { city } = useCity();
  const content = CITY_CONTENT[city.id] ?? CITY_CONTENT.moscow;
  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="relative mb-16">
          <div className="section-number">04</div>
          <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Кто мы</p>
          <h1 className="font-oswald text-5xl md:text-6xl font-bold uppercase text-white">О компании</h1>
        </div>

        {/* Main story */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
          <div>
            <h2 className="font-oswald text-3xl font-bold uppercase text-white mb-6">
              8 лет в профессиональном звуке и свете
            </h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              Global Renta — компания, которую основали практикующие звукорежиссёры и технические директора.
              Мы знаем изнутри, каково это — когда оборудование подводит в самый ответственный момент.
              Именно поэтому мы выстроили систему, где этого не происходит.
            </p>
            <p className="text-gray-400 leading-relaxed mb-8">
              Наш парк оборудования — это то, что мы сами хотели бы арендовать: техника топовых брендов,
              обслуживаемая каждые 90 дней, с резервным фондом под каждый заказ.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: "Package", value: "500+", label: "Единиц оборудования" },
                { icon: "CalendarCheck", value: "1200+", label: "Мероприятий" },
                { icon: "Users", value: "45", label: "Специалистов" },
                { icon: "Award", value: "Top 3", label: "В Москве" },
              ].map((stat) => (
                <div key={stat.label} className="glass-card p-4 rounded-sm">
                  <Icon name={stat.icon} size={18} className="text-amber-500 mb-2" />
                  <div className="font-oswald text-2xl font-bold neon-text">{stat.value}</div>
                  <div className="text-gray-600 text-xs">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="glass-card rounded-sm p-8 h-full flex flex-col justify-between relative overflow-hidden">
              <div className="absolute inset-0 grid-pattern opacity-30" />
              <div className="relative z-10">
                <h3 className="font-oswald text-2xl font-bold text-white uppercase mb-6">Наш путь</h3>
                <div className="space-y-4">
                  {milestones.map((m) => (
                    <div key={m.year} className="flex gap-4">
                      <div className="font-oswald text-sm font-bold neon-text w-10 shrink-0 pt-0.5">{m.year}</div>
                      <div className="flex-1 border-l border-amber-500/20 pl-4 pb-4 last:pb-0">
                        <p className="text-gray-400 text-sm">{m.event}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team */}
        <div className="mb-20">
          <div className="mb-10">
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Люди</p>
            <h2 className="font-oswald text-4xl font-bold uppercase text-white">Команда</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {team.map((member) => (
              <div key={member.name} className="glass-card rounded-sm p-6 group">
                <div className="w-16 h-16 flex items-center justify-center border border-amber-500/20 rounded-sm mb-4 group-hover:border-amber-500/50 transition-colors">
                  <Icon name={member.icon} size={28} className="text-amber-500" />
                </div>
                <h3 className="font-semibold text-white mb-0.5">{member.name}</h3>
                <p className="text-amber-500 text-xs uppercase tracking-wider mb-2">{member.role}</p>
                <p className="text-gray-600 text-xs">{member.exp}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Certificates */}
        <div className="mb-20">
          <div className="mb-8">
            <p className="text-amber-500 text-xs uppercase tracking-widest mb-2">Партнёрства</p>
            <h2 className="font-oswald text-4xl font-bold uppercase text-white">Сертификаты</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {certificates.map((cert) => (
              <div key={cert} className="glass-card p-4 rounded-sm flex items-center gap-3">
                <Icon name="Award" size={18} className="text-amber-500 shrink-0" />
                <span className="text-gray-300 text-sm">{cert}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="glass-card neon-border rounded-sm p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-oswald text-3xl font-bold text-white uppercase mb-2">Начнём сотрудничество?</h2>
            <p className="text-gray-500">Расскажите о вашем мероприятии — мы подберём идеальное решение</p>
          </div>
          <div className="flex gap-3">
            <Link to="/contacts" className="neon-btn px-6 py-3 rounded-sm text-sm">
              Написать нам
            </Link>
            <Link to="/catalog" className="border border-amber-500/30 text-white px-6 py-3 rounded-sm text-sm hover:border-amber-500/60 transition-colors">
              Каталог
            </Link>
          </div>
        </div>

        {/* SEO Text Block */}
        <div className="mt-16 pt-16 border-t border-amber-500/10">
          <div className="max-w-4xl">
            <h2 className="font-oswald text-3xl font-bold uppercase text-white mb-6">
              {content.aboutSeoBlock.title}
            </h2>
            <div className="space-y-4">
              {content.aboutSeoBlock.paragraphs.map((p, i) => (
                <p key={i} className="text-gray-500 text-sm leading-relaxed">{p}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}