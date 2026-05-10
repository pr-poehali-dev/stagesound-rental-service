import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const URLS = func2url as Record<string, string>;
const QUOTES_URL  = URLS["manage-quotes"];
const SIGN_URL    = URLS["sign-contract"];
const GEN_URL     = URLS["generate-contract"];

// ── Типы ────────────────────────────────────────────────────────────────────
type QuoteItem  = { id: number; name: string; price: number; unit: string; qty: number };
type QuoteExtra = { id: string; name: string; price: number };
type Quote = {
  id: number; token: string; title: string; items: QuoteItem[];
  days: number; delivery: string; delivery_price: number; extras: QuoteExtra[];
  total: number; status: string;
  event_date?: string; delivery_address?: string;
  installation_time?: string; installation_price?: number;
  dismantling_time?: string;  dismantling_price?: number;
  no_installation?: boolean;
  delivery_time?: string; pickup_time?: string;
  discount?: number;
};

// ── Вспомогательные компоненты ───────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">{label}</label>
      {children}
    </div>
  );
}
const iCls = "w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50";
const iErr = "w-full bg-transparent border border-red-500/60 bg-red-500/5 rounded-sm px-3 py-2.5 text-sm text-white placeholder-red-900 focus:outline-none focus:border-red-500";

// ── Главный компонент ────────────────────────────────────────────────────────
export default function QuoteApproval() {
  const { token } = useParams<{ token: string }>();

  // Данные КП
  const [quote, setQuote]     = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // PIN-защита
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput]       = useState("");
  const [pinError, setPinError]       = useState("");
  const [pinChecking, setPinChecking] = useState(false);
  const [confirmedPin, setConfirmedPin] = useState("");

  // Флоу: "view" → "form" → "preview" → "otp" → "generating" → "done"
  const [step, setStep] = useState<"view" | "form" | "preview" | "otp" | "generating" | "done">("view");
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // Способ оплаты
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "invoice">("cash");

  // Форма клиентских данных
  const [clientType, setClientType] = useState<"individual" | "company">("individual");
  const [fullName,        setFullName]        = useState("");
  const [birthDate,       setBirthDate]       = useState("");
  const [address,         setAddress]         = useState("");
  const [passportSeries,  setPassportSeries]  = useState("");
  const [passportNumber,  setPassportNumber]  = useState("");
  const [passportIssued,  setPassportIssued]  = useState("");
  const [passportDate,    setPassportDate]    = useState("");
  const [passportFileUrl, setPassportFileUrl] = useState("");
  const [companyName,     setCompanyName]     = useState("");
  const [inn,             setInn]             = useState("");
  const [kpp,             setKpp]             = useState("");
  const [ogrn,            setOgrn]            = useState("");
  const [legalAddress,    setLegalAddress]    = useState("");
  const [director,        setDirector]        = useState("");
  const [phone,           setPhone]           = useState("");
  const [email,           setEmail]           = useState("");

  // OTP
  const [otpCode,         setOtpCode]       = useState("");
  const [otpError,        setOtpError]      = useState("");
  const [otpSending,      setOtpSending]    = useState(false);
  const [otpVerifying,    setOtpVerifying]  = useState(false);
  const [otpCooldown,     setOtpCooldown]   = useState(0);
  const [contractId,      setContractId]    = useState<number | null>(null);
  const [pdfUrl,          setPdfUrl]        = useState("");
  const [signedAt,        setSignedAt]      = useState("");
  const [formError,       setFormError]     = useState("");
  const [formSending,     setFormSending]   = useState(false);
  const [emailWarning,    setEmailWarning]  = useState("");
  const [errorFields,     setErrorFields]   = useState<Set<string>>(new Set());

  // Паспорт
  const fileRef   = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Cooldown таймер
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  // Загрузка КП (с PIN если нужен)
  const loadQuote = async (pin = "") => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    const headers: Record<string, string> = {};
    if (pin) headers["X-Quote-Pin"] = pin;

    const quoteRes = await fetch(`${QUOTES_URL}?token=${token}`, { headers });
    if (quoteRes.status === 401) {
      setPinRequired(true);
      setLoading(false);
      return;
    }
    const q = await quoteRes.json();
    if (q.error) { setNotFound(true); setLoading(false); return; }

    const c = await fetch(`${SIGN_URL}?token=${token}`)
      .then(r => r.ok ? r.json() : null).catch(() => null);

    setQuote(q);
    if (q.status === "signed") setStep("done");
    if (c && !c.error) {
      setContractId(c.contract_id ?? null);
      if (c.client_type) setClientType(c.client_type);
      if (c.phone)            setPhone(c.phone);
      if (c.email)            setEmail(c.email);
      if (c.full_name)        setFullName(c.full_name);
      if (c.birth_date)       setBirthDate(c.birth_date);
      if (c.address)          setAddress(c.address);
      if (c.passport_series)  setPassportSeries(c.passport_series);
      if (c.passport_number)  setPassportNumber(c.passport_number);
      if (c.passport_issued)  setPassportIssued(c.passport_issued);
      if (c.passport_date)    setPassportDate(c.passport_date);
      if (c.company_name)     setCompanyName(c.company_name);
      if (c.inn)              setInn(c.inn);
      if (c.kpp)              setKpp(c.kpp);
      if (c.ogrn)             setOgrn(c.ogrn);
      if (c.director)         setDirector(c.director);
      if (c.legal_address)    setLegalAddress(c.legal_address);
    }
    setLoading(false);
  };

  useEffect(() => { loadQuote(); }, [token]);

  const handlePinSubmit = async () => {
    if (!pinInput.trim()) { setPinError("Введите пароль"); return; }
    setPinChecking(true); setPinError("");
    try {
      const headers: Record<string, string> = { "X-Quote-Pin": pinInput.trim() };
      const res = await fetch(`${QUOTES_URL}?token=${token}`, { headers });
      if (res.status === 401) {
        setPinError("Неверный пароль");
        return;
      }
      const q = await res.json();
      if (q.error) { setNotFound(true); return; }
      setConfirmedPin(pinInput.trim());
      setPinRequired(false);
      setQuote(q);
      if (q.status === "signed") setStep("done");
    } catch {
      setPinError("Ошибка соединения");
    } finally {
      setPinChecking(false);
    }
  };

  // ── Загрузка паспорта ──────────────────────────────────────────────────
  const handlePassportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res  = await fetch(`${QUOTES_URL}?action=upload_passport&token=${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: reader.result, name: file.name }),
        });
        const data = await res.json();
        if (data.url) setPassportFileUrl(data.url);
        else setFormError("Не удалось загрузить файл");
      } catch {
        setFormError("Ошибка загрузки файла");
      } finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  // ── Отправить данные и получить OTP ────────────────────────────────────
  const handleSubmitForm = async () => {
    const bad = new Set<string>();
    if (!phone.trim()) bad.add("phone");
    if (!email.trim()) bad.add("email");

    if (clientType === "individual") {
      if (!fullName.trim())       bad.add("fullName");
      if (!birthDate.trim())      bad.add("birthDate");
      if (!address.trim())        bad.add("address");
      if (!passportSeries.trim()) bad.add("passportSeries");
      if (!passportNumber.trim()) bad.add("passportNumber");
      if (!passportIssued.trim()) bad.add("passportIssued");
      if (!passportDate.trim())   bad.add("passportDate");
    } else {
      if (!companyName.trim())    bad.add("companyName");
      if (!inn.trim())            bad.add("inn");
      if (!ogrn.trim())           bad.add("ogrn");
      if (!director.trim())       bad.add("director");
      if (!legalAddress.trim())   bad.add("legalAddress");
    }

    if (bad.size > 0) {
      setErrorFields(bad);
      setFormError("Заполните все обязательные поля, отмеченные красным");
      return;
    }

    setErrorFields(new Set());
    setFormError(""); setFormSending(true);
    try {
      // Шаг 1: сохраняем данные (без OTP — без отправки письма)
      const res = await fetch(`${SIGN_URL}?action=submit&token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_type: clientType,
          full_name: fullName, birth_date: birthDate, address,
          passport_series: passportSeries, passport_number: passportNumber,
          passport_issued: passportIssued, passport_date: passportDate,
          passport_file_url: passportFileUrl || null,
          company_name: companyName, inn, kpp, ogrn, legal_address: legalAddress, director,
          phone, email,
          payment_method: paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "already_signed") { setStep("done"); return; }
        throw new Error(data.error || "Ошибка сервера");
      }
      setContractId(data.contract_id);

      // Шаг 2: загружаем превью PDF договора
      setPreviewLoading(true);
      setStep("preview");
      try {
        const previewRes = await fetch(`${SIGN_URL}?action=preview_pdf&token=${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contract_id: data.contract_id }),
        });
        const previewData = await previewRes.json();
        if (previewData.pdf_url) setPreviewPdfUrl(previewData.pdf_url);
      } catch { /* превью не критично */ }
      finally { setPreviewLoading(false); }
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Ошибка");
    } finally { setFormSending(false); }
  };

  // ── Подтвердить согласие с договором и отправить OTP ───────────────────
  const handleConfirmAndSendOtp = async () => {
    setFormError(""); setFormSending(true);
    try {
      const res = await fetch(`${SIGN_URL}?action=send_otp&token=${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setOtpCooldown(60);
      if (data.email_error) {
        setEmailWarning(`Не удалось отправить письмо на ${email}. Проверьте адрес и запросите код повторно.`);
      }
      setStep("otp");
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Ошибка");
    } finally { setFormSending(false); }
  };

  // ── Повторно отправить OTP ──────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (otpCooldown > 0) return;
    setOtpSending(true); setOtpError("");
    try {
      const res  = await fetch(`${SIGN_URL}?action=send_otp&token=${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setOtpCooldown(60);
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : "Ошибка");
    } finally { setOtpSending(false); }
  };

  // ── Проверить OTP и подписать ───────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) { setOtpError("Введите 6-значный код"); return; }
    setOtpVerifying(true); setOtpError("");
    try {
      const res  = await fetch(`${SIGN_URL}?action=verify_otp&token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "wrong_code") {
          setOtpError(`Неверный код. Осталось попыток: ${data.attempts_left ?? "?"}`);
        } else if (data.error === "code_expired") {
          setOtpError("Код истёк. Запросите новый.");
        } else if (data.error === "too_many_attempts") {
          setOtpError("Превышено число попыток. Запросите новый код.");
        } else {
          setOtpError(data.error || "Ошибка");
        }
        return;
      }
      setSignedAt(data.signed_at || "");
      setStep("generating");
      // Генерируем PDF
      await generatePdf(data.contract_id ?? contractId);
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : "Ошибка");
    } finally { setOtpVerifying(false); }
  };

  // ── Генерация PDF ──────────────────────────────────────────────────────
  const generatePdf = async (cid: number | null) => {
    if (!cid) { setStep("done"); return; }
    try {
      const adminPwd = sessionStorage.getItem("admin_pwd") || sessionStorage.getItem("adminPwd") || "";
      const res  = await fetch(`${GEN_URL}?pwd=${encodeURIComponent(adminPwd)}&contract_id=${cid}`);
      const data = await res.json();
      if (data.pdf_url) setPdfUrl(data.pdf_url);
    } catch { /* PDF не критичен */ }
    finally { setStep("done"); }
  };

  // ────────────────────────────────────────────────────────────────────────
  // Вспомогательные значения
  const q                   = quote!;
  const equipmentTotalRaw   = quote ? quote.items.reduce((s, i) => s + i.price * i.qty * quote.days, 0) : 0;
  const discountPct         = quote?.discount || 0;
  const discountAmt         = discountPct > 0 ? Math.round(equipmentTotalRaw * discountPct / 100) : 0;
  const equipmentTotal      = equipmentTotalRaw - discountAmt;
  const extrasTotal         = quote ? quote.extras.reduce((s, e) => s + e.price, 0) : 0;
  const installDismTotal    = quote?.no_installation ? 0 : ((quote?.installation_price || 0) + (quote?.dismantling_price || 0));

  // ── Экраны ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Icon name="Loader2" size={32} className="text-amber-500 animate-spin" />
    </div>
  );

  // ── Экран ввода PIN ──────────────────────────────────────────────────────
  if (pinRequired) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="glass-card neon-border rounded-sm p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 flex items-center justify-center border border-amber-500/30 rounded-sm mx-auto mb-5">
          <Icon name="Lock" size={28} className="text-amber-500" />
        </div>
        <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Global Renta</p>
        <h2 className="font-oswald text-2xl font-bold text-white uppercase mb-2">Защищённое КП</h2>
        <p className="text-gray-500 text-sm mb-6">Введите пароль, который вам сообщил менеджер</p>

        <input
          type="password"
          value={pinInput}
          onChange={e => { setPinInput(e.target.value); setPinError(""); }}
          onKeyDown={e => e.key === "Enter" && handlePinSubmit()}
          placeholder="Пароль"
          className={`w-full bg-transparent border rounded-sm px-4 py-3 text-white text-center text-lg tracking-widest placeholder-gray-700 focus:outline-none transition-colors mb-3 ${pinError ? "border-red-500/60" : "border-amber-500/30 focus:border-amber-500"}`}
          autoFocus
        />
        {pinError && (
          <p className="text-red-400 text-sm mb-3 flex items-center justify-center gap-1">
            <Icon name="AlertCircle" size={14} /> {pinError}
          </p>
        )}
        <button onClick={handlePinSubmit} disabled={pinChecking}
          className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-40">
          {pinChecking
            ? <><Icon name="Loader2" size={16} className="animate-spin" /> Проверяю...</>
            : <><Icon name="Unlock" size={16} /> Открыть КП</>
          }
        </button>
      </div>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="text-center">
        <Icon name="FileX" size={48} className="text-gray-600 mx-auto mb-4" />
        <h1 className="font-oswald text-2xl font-bold text-white uppercase mb-2">КП не найдено</h1>
        <p className="text-gray-500">Ссылка недействительна или КП было удалено</p>
      </div>
    </div>
  );

  // ── Генерация PDF (промежуточный экран) ──────────────────────────────────
  if (step === "generating") return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="glass-card rounded-sm p-12 text-center max-w-md w-full">
        <Icon name="Loader2" size={48} className="text-amber-500 animate-spin mx-auto mb-6" />
        <h2 className="font-oswald text-2xl font-bold text-white uppercase mb-3">Формируем договор</h2>
        <p className="text-gray-500 text-sm">Создаём PDF с вашей подписью, пожалуйста подождите...</p>
      </div>
    </div>
  );

  // ── Готово ───────────────────────────────────────────────────────────────
  if (step === "done") return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="glass-card neon-border rounded-sm p-10 text-center max-w-lg w-full">
        <div className="w-20 h-20 flex items-center justify-center border-2 border-amber-500 rounded-sm mx-auto mb-6 pulse-neon">
          <Icon name="CheckCircle" size={40} className="text-amber-500" />
        </div>
        <h1 className="font-oswald text-3xl font-bold text-white uppercase mb-3">Договор подписан!</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          Договор подписан простой электронной подписью (ПЭП).
          Менеджер свяжется с вами для подтверждения и оплаты.
        </p>
        {signedAt && (
          <p className="text-gray-600 text-xs mb-4">
            Дата подписания: {new Date(signedAt).toLocaleString("ru-RU")}
          </p>
        )}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 neon-btn px-6 py-3 rounded-sm text-sm mb-3">
            <Icon name="FileText" size={16} />
            Скачать договор (PDF)
          </a>
        )}
        {email && (
          <p className="text-amber-500/70 text-xs mt-2">
            Копия направлена на {email}
          </p>
        )}
      </div>
    </div>
  );

  // ── Шаг ознакомления с договором ────────────────────────────────────────
  if (step === "preview") return (
    <div className="min-h-screen bg-[#0a0a0a] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Global Renta</p>
          <h1 className="font-oswald text-3xl font-bold text-white uppercase">Ознакомьтесь с договором</h1>
          <p className="text-gray-500 text-sm mt-2">Перед подписанием внимательно прочитайте договор</p>
        </div>

        <div className="glass-card rounded-sm p-6 mb-4">
          {previewLoading ? (
            <div className="flex items-center justify-center gap-3 py-12">
              <Icon name="Loader2" size={24} className="text-amber-500 animate-spin" />
              <span className="text-gray-400">Формируем договор для ознакомления...</span>
            </div>
          ) : previewPdfUrl ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400 text-sm mb-4">
                <Icon name="FileText" size={16} />
                Договор сформирован и готов к просмотру
              </div>
              <a href={previewPdfUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 px-5 py-3 rounded-sm text-sm transition-colors w-full">
                <Icon name="ExternalLink" size={16} />
                Открыть договор (PDF) для прочтения
              </a>
              <div className="mt-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-sm">
                <p className="text-gray-500 text-xs leading-relaxed">
                  Данный файл — черновик договора с вашими данными. После нажатия «Согласен, подписать» вы получите код на email и подпишете договор ПЭП.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Icon name="FileWarning" size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Не удалось загрузить превью договора.</p>
              <p className="text-gray-600 text-xs mt-1">Вы можете продолжить подписание.</p>
            </div>
          )}
        </div>

        <div className="glass-card neon-border rounded-sm p-5">
          <div className="flex items-start gap-3 mb-5">
            <Icon name="ShieldCheck" size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-white text-sm font-medium mb-1">Подписание договора</p>
              <p className="text-gray-500 text-xs leading-relaxed">
                Нажимая «Согласен», вы подтверждаете что ознакомились с условиями договора и готовы его подписать. На email <span className="text-amber-500">{email}</span> придёт код подтверждения.
              </p>
            </div>
          </div>
          {formError && (
            <div className="mb-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-sm px-4 py-2.5">
              <Icon name="AlertCircle" size={14} /> {formError}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setStep("form")}
              className="border border-gray-700 text-gray-400 hover:text-white px-5 py-3 rounded-sm text-sm transition-colors">
              Назад
            </button>
            <button onClick={handleConfirmAndSendOtp} disabled={previewLoading || formSending}
              className="flex-1 neon-btn py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-40">
              {formSending
                ? <><Icon name="Loader2" size={16} className="animate-spin" /> Отправляю код...</>
                : <><Icon name="Mail" size={16} /> Согласен — получить код на email</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (step === "otp") return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="glass-card neon-border rounded-sm p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 flex items-center justify-center border border-amber-500/30 rounded-sm mx-auto mb-4">
            <Icon name="Mail" size={28} className="text-amber-500" />
          </div>
          <h2 className="font-oswald text-2xl font-bold text-white uppercase mb-2">Подтвердите подпись</h2>
          <p className="text-gray-500 text-sm">
            Код подтверждения отправлен на<br/>
            <span className="text-amber-500 font-medium">{email}</span>
          </p>
        </div>

        {emailWarning && (
          <div className="mb-4 flex items-start gap-2 text-yellow-400 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-sm px-4 py-3">
            <Icon name="AlertTriangle" size={15} className="shrink-0 mt-0.5" />
            <span>{emailWarning}</span>
          </div>
        )}

        {/* OTP инпут */}
        <div className="mb-6">
          <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2 text-center">
            Введите 6-значный код
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpCode}
            onChange={e => { setOtpCode(e.target.value.replace(/\D/g, "")); setOtpError(""); }}
            onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
            placeholder="_ _ _ _ _ _"
            className="w-full bg-transparent border-2 border-amber-500/30 focus:border-amber-500 rounded-sm px-4 py-4 text-white text-3xl text-center tracking-[0.4em] placeholder-gray-700 focus:outline-none transition-colors"
          />
          {otpError && (
            <p className="text-red-400 text-sm mt-2 text-center flex items-center justify-center gap-1">
              <Icon name="AlertCircle" size={14} /> {otpError}
            </p>
          )}
        </div>

        <button
          onClick={handleVerifyOtp}
          disabled={otpVerifying || otpCode.length !== 6}
          className="neon-btn w-full py-3 rounded-sm text-sm flex items-center justify-center gap-2 mb-4 disabled:opacity-40"
        >
          {otpVerifying
            ? <><Icon name="Loader2" size={16} className="animate-spin" /> Проверяем...</>
            : <><Icon name="ShieldCheck" size={16} /> Подписать договор ПЭП</>
          }
        </button>

        <div className="text-center">
          {otpCooldown > 0 ? (
            <p className="text-gray-600 text-sm">
              Выслать повторно через {otpCooldown} сек.
            </p>
          ) : (
            <button onClick={handleResendOtp} disabled={otpSending}
              className="text-amber-500/70 hover:text-amber-500 text-sm transition-colors disabled:opacity-40 flex items-center gap-1 mx-auto">
              {otpSending ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="RefreshCw" size={13} />}
              Выслать новый код
            </button>
          )}
        </div>

        <div className="mt-6 p-3 border border-amber-500/10 rounded-sm">
          <p className="text-gray-600 text-xs text-center">
            🔒 Введя код, вы подтверждаете согласие с условиями договора аренды и подписываете его ПЭП согласно ФЗ-63
          </p>
        </div>
      </div>
    </div>
  );

  // ── Форма данных клиента ─────────────────────────────────────────────────
  if (step === "form") return (
    <div className="min-h-screen bg-[#0a0a0a] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Global Renta</p>
          <h1 className="font-oswald text-3xl font-bold text-white uppercase">Данные для договора</h1>
          {q?.title && <p className="text-gray-500 mt-1">{q.title}</p>}
        </div>

        <div className="glass-card rounded-sm p-6">
          {/* Тип лица */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setClientType("individual")}
              className={`flex-1 py-3 rounded-sm border text-sm font-medium transition-all ${clientType === "individual" ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-gray-700 text-gray-500 hover:border-gray-500"}`}
            >
              <Icon name="User" size={16} className="inline mr-2" />
              Физическое лицо
            </button>
            <button
              onClick={() => setClientType("company")}
              className={`flex-1 py-3 rounded-sm border text-sm font-medium transition-all ${clientType === "company" ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-gray-700 text-gray-500 hover:border-gray-500"}`}
            >
              <Icon name="Building2" size={16} className="inline mr-2" />
              Юридическое лицо
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Контакты — всегда */}
            <Field label="Телефон *">
              <input value={phone} onChange={e => { setPhone(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("phone"); return n; }); }} placeholder="+7 (999) 000-00-00" className={errorFields.has("phone") ? iErr : iCls} />
            </Field>
            <Field label="Email * (для кода подтверждения)">
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("email"); return n; }); }} placeholder="your@email.com" className={errorFields.has("email") ? iErr : iCls} />
            </Field>

            {clientType === "individual" ? (
              <>
                <div className="md:col-span-2">
                  <Field label="ФИО полностью *">
                    <input value={fullName} onChange={e => { setFullName(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("fullName"); return n; }); }} placeholder="Иванов Иван Иванович" className={errorFields.has("fullName") ? iErr : iCls} />
                  </Field>
                </div>
                <Field label="Дата рождения *">
                  <input type="date" value={birthDate} onChange={e => { setBirthDate(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("birthDate"); return n; }); }} className={errorFields.has("birthDate") ? iErr : iCls} />
                </Field>
                <Field label="Адрес регистрации *">
                  <input value={address} onChange={e => { setAddress(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("address"); return n; }); }} placeholder="г. Москва, ул. Примерная, д. 1" className={errorFields.has("address") ? iErr : iCls} />
                </Field>
                <Field label="Серия паспорта *">
                  <input value={passportSeries} onChange={e => { setPassportSeries(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("passportSeries"); return n; }); }} placeholder="1234" className={errorFields.has("passportSeries") ? iErr : iCls} />
                </Field>
                <Field label="Номер паспорта *">
                  <input value={passportNumber} onChange={e => { setPassportNumber(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("passportNumber"); return n; }); }} placeholder="567890" className={errorFields.has("passportNumber") ? iErr : iCls} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Кем выдан *">
                    <input value={passportIssued} onChange={e => { setPassportIssued(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("passportIssued"); return n; }); }} placeholder="Отдел УФМС России..." className={errorFields.has("passportIssued") ? iErr : iCls} />
                  </Field>
                </div>
                <Field label="Дата выдачи *">
                  <input type="date" value={passportDate} onChange={e => { setPassportDate(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("passportDate"); return n; }); }} className={errorFields.has("passportDate") ? iErr : iCls} />
                </Field>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Скан/фото паспорта</label>
                  <div className="flex items-center gap-3">
                    {passportFileUrl && (
                      <a href={passportFileUrl} target="_blank" rel="noopener noreferrer" className="text-amber-500 text-xs underline truncate max-w-[120px]">
                        Файл загружен
                      </a>
                    )}
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handlePassportUpload} />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="flex items-center gap-1.5 border border-amber-500/20 text-gray-400 hover:text-white px-3 py-2 rounded-sm text-xs transition-colors disabled:opacity-40">
                      {uploading ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Upload" size={12} />}
                      {uploading ? "Загружаю..." : passportFileUrl ? "Заменить" : "Загрузить"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-2">
                  <Field label="Название организации *">
                    <input value={companyName} onChange={e => { setCompanyName(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("companyName"); return n; }); }} placeholder='ООО "Компания"' className={errorFields.has("companyName") ? iErr : iCls} />
                  </Field>
                </div>
                <Field label="ИНН *">
                  <input value={inn} onChange={e => { setInn(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("inn"); return n; }); }} placeholder="7701234567" className={errorFields.has("inn") ? iErr : iCls} />
                </Field>
                <Field label="КПП">
                  <input value={kpp} onChange={e => setKpp(e.target.value)} placeholder="770101001" className={iCls} />
                </Field>
                <Field label="ОГРН *">
                  <input value={ogrn} onChange={e => { setOgrn(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("ogrn"); return n; }); }} placeholder="1234567890123" className={errorFields.has("ogrn") ? iErr : iCls} />
                </Field>
                <Field label="Директор / Подписант *">
                  <input value={director} onChange={e => { setDirector(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("director"); return n; }); }} placeholder="Иванов И.И." className={errorFields.has("director") ? iErr : iCls} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Юридический адрес *">
                    <input value={legalAddress} onChange={e => { setLegalAddress(e.target.value); setErrorFields(p => { const n=new Set(p); n.delete("legalAddress"); return n; }); }} placeholder="г. Москва, ул. Примерная, д. 1" className={errorFields.has("legalAddress") ? iErr : iCls} />
                  </Field>
                </div>
              </>
            )}
          </div>

          {formError && (
            <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-sm px-4 py-2.5">
              <Icon name="AlertCircle" size={14} /> {formError}
            </div>
          )}

          {/* Способ оплаты */}
          <div className="mt-6 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Способ оплаты</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`p-4 rounded-sm border text-left transition-all ${paymentMethod === "cash" ? "border-amber-500 bg-amber-500/10" : "border-amber-500/20 hover:border-amber-500/40"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon name={paymentMethod === "cash" ? "CheckCircle" : "Circle"} size={16} className={paymentMethod === "cash" ? "text-amber-500" : "text-gray-600"} />
                  <span className="text-white font-medium text-sm">Оплата по факту</span>
                </div>
                <p className="text-gray-500 text-xs pl-6">Наличными или переводом в день мероприятия. Сумма не меняется.</p>
                <p className="text-amber-500 font-oswald font-bold mt-2 pl-6">{q.total.toLocaleString()} ₽</p>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("invoice")}
                className={`p-4 rounded-sm border text-left transition-all ${paymentMethod === "invoice" ? "border-amber-500 bg-amber-500/10" : "border-amber-500/20 hover:border-amber-500/40"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon name={paymentMethod === "invoice" ? "CheckCircle" : "Circle"} size={16} className={paymentMethod === "invoice" ? "text-amber-500" : "text-gray-600"} />
                  <span className="text-white font-medium text-sm">Оплата по счёту</span>
                </div>
                <p className="text-gray-500 text-xs pl-6">Безналичный расчёт. Мы выставим счёт — к сумме добавляется 10%.</p>
                <p className="text-amber-500 font-oswald font-bold mt-2 pl-6">{Math.round(q.total * 1.1).toLocaleString()} ₽</p>
              </button>
            </div>
          </div>

          <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-sm mb-6">
            <div className="flex items-start gap-2">
              <Icon name="Info" size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-gray-400 text-xs leading-relaxed">
                После заполнения данных на ваш email придёт 6-значный код подтверждения.
                Введя код, вы подписываете договор простой электронной подписью (ПЭП) в соответствии с ФЗ-63.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("view")}
              className="border border-gray-700 text-gray-400 hover:text-white px-5 py-3 rounded-sm text-sm transition-colors">
              Назад
            </button>
            <button onClick={handleSubmitForm} disabled={formSending}
              className="flex-1 neon-btn py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-40">
              {formSending
                ? <><Icon name="Loader2" size={16} className="animate-spin" /> Отправляю...</>
                : <><Icon name="Mail" size={16} /> Получить код на email</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Просмотр КП (step === "view") ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Шапка */}
        <div className="text-center mb-8">
          <p className="text-amber-500 text-xs uppercase tracking-widest mb-1">Global Renta</p>
          <h1 className="font-oswald text-3xl md:text-4xl font-bold text-white uppercase">
            Коммерческое предложение
          </h1>
          {q.title && <p className="text-gray-500 mt-1">{q.title}</p>}
        </div>

        {/* Состав аренды */}
        <div className="glass-card rounded-sm p-6 mb-4">
          <h2 className="font-oswald text-xl font-bold text-white uppercase mb-4">Состав аренды</h2>

          {/* Дата, адрес, логистика, монтаж */}
          {(q.event_date || q.delivery_address || q.delivery_time || q.pickup_time || q.installation_time || q.dismantling_time || q.no_installation) && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-sm p-3 mb-4 space-y-2">
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
              {q.delivery_time && (
                <div className="flex items-center gap-2 text-sm">
                  <Icon name="PackageCheck" size={14} className="text-amber-500 shrink-0" />
                  <span className="text-gray-400">Время привоза:</span>
                  <span className="text-white font-medium">{q.delivery_time}</span>
                </div>
              )}
              {q.pickup_time && (
                <div className="flex items-center gap-2 text-sm">
                  <Icon name="PackageX" size={14} className="text-amber-500 shrink-0" />
                  <span className="text-gray-400">Время увоза:</span>
                  <span className="text-white font-medium">{q.pickup_time}</span>
                </div>
              )}
              {q.no_installation ? (
                <div className="flex items-center gap-2 text-sm">
                  <Icon name="CheckCircle" size={14} className="text-green-400 shrink-0" />
                  <span className="text-green-400 font-medium">Монтаж и демонтаж не требуются</span>
                </div>
              ) : (
                <>
                  {q.installation_time && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="Wrench" size={14} className="text-amber-500 shrink-0" />
                      <span className="text-gray-400">Монтаж:</span>
                      <span className="text-white font-medium">{q.installation_time}</span>
                    </div>
                  )}
                  {q.dismantling_time && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="PackageOpen" size={14} className="text-amber-500 shrink-0" />
                      <span className="text-gray-400">Демонтаж:</span>
                      <span className="text-white font-medium">{q.dismantling_time}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Оборудование */}
          <div className="space-y-3 mb-4">
            {q.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start gap-4">
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

          {/* Доп. услуги */}
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

          {/* Монтаж/демонтаж */}
          {q.no_installation ? (
            <div className="border-t border-amber-500/10 pt-3 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <Icon name="CheckCircle" size={13} className="text-green-400" />
                <span className="text-green-400">Монтаж и демонтаж не требуются</span>
              </div>
            </div>
          ) : (q.installation_time || q.dismantling_time) ? (
            <div className="border-t border-amber-500/10 pt-3 mb-3">
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Монтаж и демонтаж</p>
              {q.installation_time && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400 flex items-center gap-1.5"><Icon name="Wrench" size={12} className="text-amber-500/60" />Монтаж: {q.installation_time}</span>
                  {(q.installation_price || 0) > 0 && <span className="text-gray-300">{q.installation_price!.toLocaleString()} ₽</span>}
                </div>
              )}
              {q.dismantling_time && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400 flex items-center gap-1.5"><Icon name="PackageOpen" size={12} className="text-amber-500/60" />Демонтаж: {q.dismantling_time}</span>
                  {(q.dismantling_price || 0) > 0 && <span className="text-gray-300">{q.dismantling_price!.toLocaleString()} ₽</span>}
                </div>
              )}
            </div>
          ) : null}

          {/* Итог */}
          <div className="border-t border-amber-500/20 pt-3 space-y-1">
            {discountPct > 0 && equipmentTotalRaw > 0 && (
              <div className="flex justify-between text-sm text-gray-500 line-through">
                <span>Оборудование ({q.days} дн.)</span><span>{equipmentTotalRaw.toLocaleString()} ₽</span>
              </div>
            )}
            {discountPct > 0 && (
              <div className="flex justify-between text-sm text-green-400">
                <span>Скидка {discountPct}%</span><span>−{discountAmt.toLocaleString()} ₽</span>
              </div>
            )}
            {equipmentTotal > 0 && (
              <div className="flex justify-between text-sm text-gray-400">
                <span>Оборудование{discountPct > 0 ? " (со скидкой)" : ` (${q.days} дн.)`}</span><span>{equipmentTotal.toLocaleString()} ₽</span>
              </div>
            )}
            {extrasTotal > 0 && (
              <div className="flex justify-between text-sm text-gray-400">
                <span>Доп. услуги</span><span>{extrasTotal.toLocaleString()} ₽</span>
              </div>
            )}
            {q.delivery_price > 0 && (
              <div className="flex justify-between text-sm text-gray-400">
                <span>Доставка</span><span>{q.delivery_price.toLocaleString()} ₽</span>
              </div>
            )}
            {!q.no_installation && installDismTotal > 0 && (
              <div className="flex justify-between text-sm text-gray-400">
                <span>Монтаж и демонтаж</span><span>{installDismTotal.toLocaleString()} ₽</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-amber-500/20">
              <span>ИТОГО</span>
              <span className="font-oswald neon-text">{q.total.toLocaleString()} ₽</span>
            </div>
          </div>
        </div>

        {/* Блок подписания */}
        <div className="glass-card neon-border rounded-sm p-6">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 flex items-center justify-center border border-amber-500/30 rounded-sm shrink-0">
              <Icon name="FileSignature" size={20} className="text-amber-500" />
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Согласование и подписание договора</h3>
              <p className="text-gray-500 text-sm">
                Нажмите кнопку, заполните данные и подпишите договор электронной подписью (ПЭП) — код придёт на ваш email.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStep("form")}
            className="neon-btn w-full py-4 rounded-sm text-sm flex items-center justify-center gap-2"
          >
            <Icon name="FileCheck" size={16} />
            Согласовать и подписать договор
          </button>
          <p className="text-gray-700 text-xs text-center mt-3">
            Подпись осуществляется по ФЗ-63 «Об электронной подписи»
          </p>
        </div>
      </div>
    </div>
  );
}