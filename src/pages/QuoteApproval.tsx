import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const URLS = func2url as Record<string, string>;
const UPLOAD_URL = URLS["upload-image"];
const QUOTES_URL = URLS["manage-quotes"];

type QuoteItem = { id: number; name: string; price: number; unit: string; qty: number };
type QuoteExtra = { id: string; name: string; price: number };
type Quote = {
  id: number; token: string; title: string; items: QuoteItem[];
  days: number; delivery: string; delivery_price: number; extras: QuoteExtra[];
  total: number; status: string;
  event_date?: string; delivery_address?: string;
  installation_time?: string; installation_price?: number;
  dismantling_time?: string; dismantling_price?: number;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">{label}</label>
      {children}
    </div>
  );
}

const iClass = "w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50";

export default function QuoteApproval() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);

  const [step, setStep] = useState<"view" | "form" | "done">("view");
  const [clientType, setClientType] = useState<"individual" | "company">("individual");

  // Физ. лицо
  const [fullName, setFullName] = useState("");
  const [passportSeries, setPassportSeries] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [passportIssued, setPassportIssued] = useState("");
  const [passportDate, setPassportDate] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [passportFileUrl, setPassportFileUrl] = useState("");
  const [uploadingPassport, setUploadingPassport] = useState(false);

  // Юр. лицо
  const [companyName, setCompanyName] = useState("");
  const [inn, setInn] = useState("");
  const [kpp, setKpp] = useState("");
  const [ogrn, setOgrn] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  const [director, setDirector] = useState("");

  // Общее
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    fetch(`${QUOTES_URL}?token=${encodeURIComponent(token)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        setQuote(data);
        if (data.status === "contracted") setAlreadyDone(true);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [token]);

  const handlePassportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPassportFile(file);
    setUploadingPassport(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const base64 = (ev.target?.result as string) || "";
        // Загружаем паспорт без пароля — используем публичный токен КП как идентификатор
        // (функция upload-image требует пароль, поэтому используем manage-quotes submit)
        // Загружаем через upload-image с временным обходом — файл паспорта сохраняется в manage-quotes
        const res = await fetch(`${QUOTES_URL}?action=upload_passport&token=${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: base64, name: file.name }),
        });
        if (res.ok) {
          const d = await res.json();
          setPassportFileUrl(d.url || "");
        }
      } catch {
        /* ignore */
      } finally {
        setUploadingPassport(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!phone.trim()) { setSendError("Укажите телефон"); return; }
    if (clientType === "individual" && !fullName.trim()) { setSendError("Укажите ФИО"); return; }
    if (clientType === "company" && !companyName.trim()) { setSendError("Укажите название компании"); return; }
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`${QUOTES_URL}?action=submit_contract&token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_type: clientType,
          full_name: fullName, passport_series: passportSeries, passport_number: passportNumber,
          passport_issued: passportIssued, passport_date: passportDate,
          birth_date: birthDate, address,
          company_name: companyName, inn, kpp, ogrn, legal_address: legalAddress, director,
          phone, email,
          passport_file_url: passportFileUrl || null,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сервера");
      setStep("done");
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Icon name="Loader2" size={32} className="text-amber-500 animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center">
          <Icon name="FileX" size={48} className="text-gray-600 mx-auto mb-4" />
          <h1 className="font-oswald text-2xl font-bold text-white uppercase mb-2">КП не найдено</h1>
          <p className="text-gray-500">Ссылка недействительна или КП было удалено</p>
        </div>
      </div>
    );
  }

  if (alreadyDone) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center">
          <Icon name="CheckCircle" size={48} className="text-amber-500 mx-auto mb-4" />
          <h1 className="font-oswald text-2xl font-bold text-white uppercase mb-2">Договор уже отправлен</h1>
          <p className="text-gray-500">Менеджер свяжется с вами в ближайшее время</p>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="glass-card rounded-sm p-10 text-center max-w-md w-full">
          <Icon name="CheckCircle" size={56} className="text-amber-500 mx-auto mb-4" />
          <h1 className="font-oswald text-3xl font-bold text-white uppercase mb-3">Готово!</h1>
          <p className="text-gray-400 leading-relaxed">
            Ваши данные переданы менеджеру. Договор аренды будет сформирован и отправлен вам на согласование.
            Обычно это занимает не более 30 минут.
          </p>
          {email && <p className="text-amber-500 text-sm mt-4">Ожидайте письмо на {email}</p>}
        </div>
      </div>
    );
  }

  const q = quote!;
  const equipmentTotal = q.items.reduce((s, i) => s + i.price * i.qty * q.days, 0);
  const extrasTotal = q.extras.reduce((s, e) => s + e.price, 0);
  const installDismantleTotal = (q.installation_price || 0) + (q.dismantling_price || 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Global Renta</p>
          <h1 className="font-oswald text-3xl md:text-4xl font-bold text-white uppercase">Коммерческое предложение</h1>
          {q.title && <p className="text-gray-500 mt-1">{q.title}</p>}
        </div>

        {/* Состав КП */}
        {step === "view" && (
          <>
            <div className="glass-card rounded-sm p-6 mb-4">
              <h2 className="font-oswald text-xl font-bold text-white uppercase mb-4">Состав аренды</h2>

              {/* Дата и адрес */}
              {(q.event_date || q.delivery_address) && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-sm p-3 mb-4 space-y-1.5">
                  {q.event_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="Calendar" size={14} className="text-amber-500 shrink-0" />
                      <span className="text-gray-400">Дата мероприятия:</span>
                      <span className="text-white font-medium">
                        {new Date(q.event_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                  )}
                  {q.delivery_address && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="MapPin" size={14} className="text-amber-500 shrink-0" />
                      <span className="text-gray-400">Адрес:</span>
                      <span className="text-white font-medium">{q.delivery_address}</span>
                    </div>
                  )}
                  {q.delivery && q.delivery !== "Без доставки" && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="Truck" size={14} className="text-amber-500 shrink-0" />
                      <span className="text-gray-400">Доставка:</span>
                      <span className="text-white font-medium">{q.delivery}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3 mb-4">
                {q.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start gap-4">
                    <div>
                      <p className="text-gray-300 text-sm">{item.name}</p>
                      <p className="text-gray-600 text-xs">{item.qty} шт. × {item.price.toLocaleString()} ₽/{item.unit} × {q.days} дн.</p>
                    </div>
                    <span className="text-white font-bold text-sm shrink-0">
                      {(item.price * item.qty * q.days).toLocaleString()} ₽
                    </span>
                  </div>
                ))}
              </div>

              {q.extras.length > 0 && (
                <div className="border-t border-amber-500/10 pt-3 mb-3">
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Дополнительные услуги</p>
                  {q.extras.map((ex) => (
                    <div key={ex.id} className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{ex.name}</span>
                      <span className="text-gray-300">{ex.price.toLocaleString()} ₽</span>
                    </div>
                  ))}
                </div>
              )}

              {(q.installation_time || q.dismantling_time) && (
                <div className="border-t border-amber-500/10 pt-3 mb-3">
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Монтаж и демонтаж</p>
                  {q.installation_time && (
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <Icon name="Wrench" size={12} className="text-amber-500/60" />
                        Монтаж: {q.installation_time}
                      </span>
                      {(q.installation_price || 0) > 0 && (
                        <span className="text-gray-300">{q.installation_price!.toLocaleString()} ₽</span>
                      )}
                    </div>
                  )}
                  {q.dismantling_time && (
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <Icon name="PackageOpen" size={12} className="text-amber-500/60" />
                        Демонтаж: {q.dismantling_time}
                      </span>
                      {(q.dismantling_price || 0) > 0 && (
                        <span className="text-gray-300">{q.dismantling_price!.toLocaleString()} ₽</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-amber-500/20 pt-3 space-y-1">
                {equipmentTotal > 0 && (
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Оборудование ({q.days} дн.)</span><span>{equipmentTotal.toLocaleString()} ₽</span>
                  </div>
                )}
                {extrasTotal > 0 && (
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Доп. услуги</span><span>{extrasTotal.toLocaleString()} ₽</span>
                  </div>
                )}
                {q.delivery_price > 0 && (
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Доставка ({q.delivery})</span><span>{q.delivery_price.toLocaleString()} ₽</span>
                  </div>
                )}
                {installDismantleTotal > 0 && (
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Монтаж и демонтаж</span><span>{installDismantleTotal.toLocaleString()} ₽</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-white pt-2">
                  <span>Итого</span>
                  <span className="text-amber-500">{q.total.toLocaleString()} ₽</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={() => setStep("form")}
                className="neon-btn flex items-center gap-2 px-8 py-3 rounded-sm text-sm">
                <Icon name="FileCheck" size={16} />
                Согласовать и заключить договор
              </button>
            </div>
          </>
        )}

        {/* Форма договора */}
        {step === "form" && (
          <div className="glass-card rounded-sm p-6">
            <h2 className="font-oswald text-xl font-bold text-white uppercase mb-6">Данные для договора</h2>

            {/* Тип лица */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setClientType("individual")}
                className={`flex-1 py-3 rounded-sm border text-sm font-medium transition-all ${clientType === "individual" ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-gray-700 text-gray-500 hover:border-gray-500"}`}>
                <Icon name="User" size={16} className="inline mr-2" />
                Физическое лицо
              </button>
              <button
                onClick={() => setClientType("company")}
                className={`flex-1 py-3 rounded-sm border text-sm font-medium transition-all ${clientType === "company" ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-gray-700 text-gray-500 hover:border-gray-500"}`}>
                <Icon name="Building2" size={16} className="inline mr-2" />
                Юридическое лицо
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Общие контакты */}
              <Field label="Телефон *">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 (999) 000-00-00" className={iClass} />
              </Field>
              <Field label="Email">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="для отправки договора" className={iClass} />
              </Field>

              {clientType === "individual" ? (
                <>
                  <div className="md:col-span-2">
                    <Field label="ФИО полностью *">
                      <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" className={iClass} />
                    </Field>
                  </div>
                  <Field label="Дата рождения">
                    <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={iClass} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Адрес регистрации">
                      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="г. Москва, ул. Примерная, д. 1, кв. 1" className={iClass} />
                    </Field>
                  </div>
                  <Field label="Серия паспорта">
                    <input value={passportSeries} onChange={(e) => setPassportSeries(e.target.value)} placeholder="1234" className={iClass} maxLength={4} />
                  </Field>
                  <Field label="Номер паспорта">
                    <input value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} placeholder="567890" className={iClass} maxLength={6} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Кем выдан">
                      <input value={passportIssued} onChange={(e) => setPassportIssued(e.target.value)} placeholder="МВД России по г. Москве" className={iClass} />
                    </Field>
                  </div>
                  <Field label="Дата выдачи">
                    <input type="date" value={passportDate} onChange={(e) => setPassportDate(e.target.value)} className={iClass} />
                  </Field>

                  {/* Загрузка паспорта */}
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Скан / фото паспорта</label>
                    <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-sm border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 cursor-pointer transition-colors text-sm ${uploadingPassport ? "opacity-50 pointer-events-none" : ""}`}>
                      <Icon name={uploadingPassport ? "Loader2" : "Upload"} size={14} className={uploadingPassport ? "animate-spin" : ""} />
                      {passportFile ? passportFile.name : "Прикрепить файл"}
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={handlePassportFile} disabled={uploadingPassport} />
                    </label>
                    {passportFileUrl && (
                      <p className="text-green-500 text-xs mt-1 flex items-center gap-1">
                        <Icon name="Check" size={12} /> Файл прикреплён
                      </p>
                    )}
                    {passportFile && !passportFileUrl && !uploadingPassport && (
                      <p className="text-yellow-500 text-xs mt-1">Файл выбран (будет отправлен вместе с формой)</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="md:col-span-2">
                    <Field label="Название организации *">
                      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder='ООО "Название"' className={iClass} />
                    </Field>
                  </div>
                  <Field label="ИНН">
                    <input value={inn} onChange={(e) => setInn(e.target.value)} placeholder="1234567890" className={iClass} />
                  </Field>
                  <Field label="КПП">
                    <input value={kpp} onChange={(e) => setKpp(e.target.value)} placeholder="123456789" className={iClass} />
                  </Field>
                  <Field label="ОГРН">
                    <input value={ogrn} onChange={(e) => setOgrn(e.target.value)} placeholder="1234567890123" className={iClass} />
                  </Field>
                  <Field label="Директор / Подписант">
                    <input value={director} onChange={(e) => setDirector(e.target.value)} placeholder="Иванов Иван Иванович" className={iClass} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Юридический адрес">
                      <input value={legalAddress} onChange={(e) => setLegalAddress(e.target.value)} placeholder="г. Москва, ул. Примерная, д. 1" className={iClass} />
                    </Field>
                  </div>
                </>
              )}
            </div>

            {/* Итого */}
            <div className="border border-amber-500/20 rounded-sm p-4 mt-6 flex justify-between items-center">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider">Сумма договора</p>
                <p className="text-amber-500 text-2xl font-bold">{q.total.toLocaleString()} ₽</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-xs">{q.days} {q.days === 1 ? "день" : q.days < 5 ? "дня" : "дней"} аренды</p>
                <p className="text-gray-500 text-xs">{q.items.length} {q.items.length === 1 ? "позиция" : "позиций"}</p>
              </div>
            </div>

            {sendError && <p className="text-red-400 text-sm mt-3">{sendError}</p>}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep("view")}
                className="border border-gray-700 text-gray-400 px-6 py-3 rounded-sm text-sm hover:border-gray-500 transition-colors">
                Назад
              </button>
              <button onClick={handleSubmit} disabled={sending}
                className="neon-btn flex-1 py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                <Icon name={sending ? "Loader2" : "Send"} size={16} className={sending ? "animate-spin" : ""} />
                {sending ? "Отправляю..." : "Сформировать договор и отправить менеджеру"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}