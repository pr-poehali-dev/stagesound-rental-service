import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const URLS = func2url as Record<string, string>;
const LOANS_URL = URLS["manage-loans"];

type Loan = {
  id: number;
  token: string;
  amount: number;
  interest_rate: number;
  issue_date: string | null;
  return_date: string | null;
  doc_number: string | null;
  status: string;
  pdf_url: string | null;
};

const iCls = "w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50";
const iErr = "w-full bg-transparent border border-red-500/60 bg-red-500/5 rounded-sm px-3 py-2.5 text-sm text-white placeholder-red-900 focus:outline-none focus:border-red-500";

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function LoanApproval() {
  const { token } = useParams<{ token: string }>();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [borrowerType, setBorrowerType] = useState<"individual" | "company">("individual");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [passportSeries, setPassportSeries] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [passportIssued, setPassportIssued] = useState("");
  const [passportDate, setPassportDate] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inn, setInn] = useState("");
  const [kpp, setKpp] = useState("");
  const [ogrn, setOgrn] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  const [director, setDirector] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    fetch(`${LOANS_URL}?token=${token}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data: Loan) => {
        setLoan(data);
        if (data.status === "filled" && data.pdf_url) setPdfUrl(data.pdf_url);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const validate = () => {
    const err = new Set<string>();
    if (borrowerType === "individual") {
      if (!fullName.trim()) err.add("fullName");
      if (!passportSeries.trim()) err.add("passportSeries");
      if (!passportNumber.trim()) err.add("passportNumber");
      if (!passportIssued.trim()) err.add("passportIssued");
      if (!address.trim()) err.add("address");
    } else {
      if (!companyName.trim()) err.add("companyName");
      if (!inn.trim()) err.add("inn");
      if (!ogrn.trim()) err.add("ogrn");
      if (!legalAddress.trim()) err.add("legalAddress");
      if (!director.trim()) err.add("director");
    }
    if (!phone.trim()) err.add("phone");
    if (!email.trim()) err.add("email");
    setErrorFields(err);
    return err.size === 0;
  };

  const submit = async () => {
    setFormError("");
    if (!validate()) {
      setFormError("Заполните все обязательные поля");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${LOANS_URL}?action=fill&token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrower_type: borrowerType,
          full_name: fullName, birth_date: birthDate, address,
          passport_series: passportSeries, passport_number: passportNumber,
          passport_issued: passportIssued, passport_date: passportDate,
          company_name: companyName, inn, kpp, ogrn,
          legal_address: legalAddress, director, phone, email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      if (data.pdf_url) {
        setPdfUrl(data.pdf_url);
      } else {
        setFormError("Договор сформирован, но не удалось получить файл. Обратитесь к менеджеру.");
      }
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
        <Icon name="Loader2" size={32} className="animate-spin text-amber-500" />
      </div>
    );
  }

  if (notFound || !loan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4" style={{ background: "var(--surface)" }}>
        <Icon name="FileX" size={48} className="text-gray-600" />
        <p className="text-gray-400 text-center">Договор займа не найден или ссылка недействительна</p>
      </div>
    );
  }

  // Готовый PDF
  if (pdfUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4" style={{ background: "var(--surface)" }}>
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <Icon name="CheckCircle" size={36} className="text-emerald-400" />
        </div>
        <h1 className="font-oswald text-2xl font-bold text-white uppercase text-center">Договор займа сформирован</h1>
        <p className="text-gray-400 text-sm text-center max-w-md">
          Скачайте документ, распечатайте и подпишите. Один экземпляр остаётся у вас, второй — у Займодавца.
        </p>
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 bg-amber-500 text-black font-medium px-6 py-3 rounded-sm hover:bg-amber-400 transition-colors">
          <Icon name="FileDown" size={18} /> Скачать договор (PDF)
        </a>
      </div>
    );
  }

  const rateNote = loan.interest_rate > 0 ? `${loan.interest_rate}% годовых` : "Беспроцентный заём";

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "var(--surface)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <span className="font-oswald text-xl font-bold tracking-widest text-white uppercase">
            Global<span className="neon-text">Renta</span>
          </span>
          <h1 className="font-oswald text-2xl font-bold text-white uppercase mt-4">Договор займа</h1>
        </div>

        {/* Условия займа */}
        <div className="glass-card rounded-sm p-5 mb-6">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-4">Условия займа</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-500 text-xs mb-1">Сумма займа</p>
              <p className="text-amber-400 text-xl font-bold">{fmtMoney(loan.amount)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Проценты</p>
              <p className="text-white text-sm mt-1.5">{rateNote}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Дата выдачи</p>
              <p className="text-white text-sm mt-1.5">{fmtDate(loan.issue_date)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Дата возврата</p>
              <p className="text-white text-sm mt-1.5">{fmtDate(loan.return_date)}</p>
            </div>
          </div>
        </div>

        {/* Форма реквизитов заёмщика */}
        <div className="glass-card rounded-sm p-5">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-4">Ваши реквизиты (Заёмщик)</h3>

          {/* Тип */}
          <div className="flex gap-2 mb-5">
            {([
              { key: "individual", label: "Физлицо" },
              { key: "company", label: "Юрлицо / ИП" },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setBorrowerType(t.key)}
                className={`flex-1 py-2.5 rounded-sm text-sm transition-colors border ${
                  borrowerType === t.key
                    ? "border-amber-500 text-amber-400 bg-amber-500/10"
                    : "border-white/10 text-gray-500 hover:text-gray-300"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {borrowerType === "individual" ? (
              <>
                <div className="md:col-span-2">
                  <Field label="ФИО полностью *">
                    <input value={fullName} onChange={e => setFullName(e.target.value)}
                      className={errorFields.has("fullName") ? iErr : iCls} placeholder="Иванов Иван Иванович" />
                  </Field>
                </div>
                <Field label="Серия паспорта *">
                  <input value={passportSeries} onChange={e => setPassportSeries(e.target.value)}
                    className={errorFields.has("passportSeries") ? iErr : iCls} placeholder="4000" />
                </Field>
                <Field label="Номер паспорта *">
                  <input value={passportNumber} onChange={e => setPassportNumber(e.target.value)}
                    className={errorFields.has("passportNumber") ? iErr : iCls} placeholder="123456" />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Кем и когда выдан *">
                    <input value={passportIssued} onChange={e => setPassportIssued(e.target.value)}
                      className={errorFields.has("passportIssued") ? iErr : iCls} placeholder="ГУ МВД России по..." />
                  </Field>
                </div>
                <Field label="Дата выдачи">
                  <input type="date" value={passportDate} onChange={e => setPassportDate(e.target.value)} className={iCls} />
                </Field>
                <Field label="Дата рождения">
                  <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className={iCls} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Адрес регистрации *">
                    <input value={address} onChange={e => setAddress(e.target.value)}
                      className={errorFields.has("address") ? iErr : iCls} placeholder="г. Санкт-Петербург, ул. ..." />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-2">
                  <Field label="Наименование организации / ИП *">
                    <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                      className={errorFields.has("companyName") ? iErr : iCls} placeholder='ООО "Ромашка"' />
                  </Field>
                </div>
                <Field label="ИНН *">
                  <input value={inn} onChange={e => setInn(e.target.value)}
                    className={errorFields.has("inn") ? iErr : iCls} placeholder="7800000000" />
                </Field>
                <Field label="КПП">
                  <input value={kpp} onChange={e => setKpp(e.target.value)} className={iCls} placeholder="780000000" />
                </Field>
                <Field label="ОГРН / ОГРНИП *">
                  <input value={ogrn} onChange={e => setOgrn(e.target.value)}
                    className={errorFields.has("ogrn") ? iErr : iCls} placeholder="1000000000000" />
                </Field>
                <Field label="Директор *">
                  <input value={director} onChange={e => setDirector(e.target.value)}
                    className={errorFields.has("director") ? iErr : iCls} placeholder="Иванов И.И." />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Юридический адрес *">
                    <input value={legalAddress} onChange={e => setLegalAddress(e.target.value)}
                      className={errorFields.has("legalAddress") ? iErr : iCls} placeholder="г. Санкт-Петербург, ..." />
                  </Field>
                </div>
              </>
            )}
            <Field label="Телефон *">
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className={errorFields.has("phone") ? iErr : iCls} placeholder="+7 900 000-00-00" />
            </Field>
            <Field label="Email *">
              <input value={email} onChange={e => setEmail(e.target.value)}
                className={errorFields.has("email") ? iErr : iCls} placeholder="you@mail.ru" />
            </Field>
          </div>

          {formError && <p className="text-red-400 text-sm mt-4">{formError}</p>}

          <button onClick={submit} disabled={sending}
            className="w-full mt-6 flex items-center justify-center gap-2 bg-amber-500 text-black font-medium py-3 rounded-sm hover:bg-amber-400 transition-colors disabled:opacity-50">
            {sending ? <Icon name="Loader2" size={18} className="animate-spin" /> : <Icon name="FileCheck" size={18} />}
            Сформировать договор
          </button>
        </div>
      </div>
    </div>
  );
}