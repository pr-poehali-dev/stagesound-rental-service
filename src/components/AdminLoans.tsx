import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const URLS = func2url as Record<string, string>;

type Loan = {
  id: number;
  token: string;
  amount: number;
  interest_rate: number;
  issue_date: string | null;
  return_date: string | null;
  doc_number: string | null;
  borrower_type: string;
  full_name: string;
  company_name: string;
  phone: string;
  email: string;
  status: string;
  pdf_url: string | null;
  filled_at: string | null;
  created_at: string;
};

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const statusLabel: Record<string, { text: string; cls: string }> = {
  draft: { text: "Ожидает заёмщика", cls: "bg-amber-500/15 text-amber-400" },
  filled: { text: "Договор сформирован", cls: "bg-emerald-500/15 text-emerald-400" },
};

export default function AdminLoans({ password }: { password: string }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Форма создания
  const [amount, setAmount] = useState("");
  const [hasInterest, setHasInterest] = useState(false);
  const [rate, setRate] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [returnDate, setReturnDate] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [manualNumber, setManualNumber] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${URLS["manage-loans"]}?pwd=${encodeURIComponent(password)}`);
      if (res.ok) setLoans(await res.json());
    } finally {
      setLoading(false);
    }
  }, [password]);

  useEffect(() => { load(); }, [load]);

  const createLoan = async () => {
    if (!amount || Number(amount) <= 0 || !returnDate) return;
    setCreating(true);
    try {
      const res = await fetch(`${URLS["manage-loans"]}?pwd=${encodeURIComponent(password)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          interest_rate: hasInterest ? Number(rate || 0) : 0,
          issue_date: issueDate,
          return_date: returnDate,
          doc_number: manualNumber ? docNumber.trim() : "",
        }),
      });
      if (res.ok) {
        setAmount(""); setRate(""); setHasInterest(false);
        setReturnDate(""); setDocNumber(""); setManualNumber(false);
        await load();
      }
    } finally {
      setCreating(false);
    }
  };

  const deleteLoan = async (id: number) => {
    if (!confirm("Удалить договор займа?")) return;
    await fetch(`${URLS["manage-loans"]}?pwd=${encodeURIComponent(password)}&id=${id}`, { method: "DELETE" });
    load();
  };

  const copyLink = (loan: Loan) => {
    const url = `${window.location.origin}/loan/${loan.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(loan.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-oswald text-2xl font-bold text-white uppercase">Займы</h2>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-4 py-2 rounded-sm text-sm transition-colors">
          <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} /> Обновить
        </button>
      </div>

      {/* Форма создания */}
      <div className="glass-card rounded-sm p-5 mb-6">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-4">Новый договор займа</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Сумма займа, ₽ *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="150000"
              className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Дата возврата *</label>
            <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
              className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Дата выдачи</label>
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
              className="w-full bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Проценты</label>
            <div className="flex items-center gap-3 h-[38px]">
              <button type="button" onClick={() => setHasInterest(v => !v)}
                className="flex items-center gap-2 text-sm text-gray-300">
                <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hasInterest ? "bg-amber-500/60" : "bg-white/10"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hasInterest ? "translate-x-4" : "translate-x-0.5"}`} />
                </span>
                {hasInterest ? "С процентами" : "Беспроцентный"}
              </button>
              {hasInterest && (
                <input type="number" value={rate} onChange={e => setRate(e.target.value)}
                  placeholder="% годовых"
                  className="w-28 bg-transparent border border-amber-500/20 rounded-sm px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
              )}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <button type="button" onClick={() => setManualNumber(v => !v)}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-amber-400 transition-colors">
            <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${manualNumber ? "bg-amber-500/60" : "bg-white/10"}`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${manualNumber ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </span>
            Указать номер договора вручную
          </button>
          {manualNumber && (
            <input value={docNumber} onChange={e => setDocNumber(e.target.value)}
              placeholder="Номер договора"
              className="mt-2 w-full md:w-64 bg-transparent border border-amber-500/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
          )}
        </div>

        <button onClick={createLoan} disabled={creating || !amount || Number(amount) <= 0 || !returnDate}
          className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 px-5 py-2.5 rounded-sm text-sm transition-colors disabled:opacity-40">
          {creating ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="Plus" size={15} />}
          Создать и получить ссылку
        </button>
      </div>

      {/* Список займов */}
      {loans.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-10">Договоров займа пока нет</p>
      ) : (
        <div className="space-y-3">
          {loans.map(loan => {
            const st = statusLabel[loan.status] || { text: loan.status, cls: "bg-gray-700 text-gray-400" };
            const borrower = loan.borrower_type === "company"
              ? (loan.company_name || "—")
              : (loan.full_name || "—");
            return (
              <div key={loan.id} className="glass-card rounded-sm p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">
                        {loan.doc_number || `З-${String(loan.id).padStart(4, "0")}`}
                      </span>
                      <span className={`text-xs rounded-full px-2 py-0.5 ${st.cls}`}>{st.text}</span>
                    </div>
                    <p className="text-amber-400 text-lg font-bold">{fmtMoney(loan.amount)}
                      {loan.interest_rate > 0 && <span className="text-gray-500 text-sm font-normal"> · {loan.interest_rate}% годовых</span>}
                      {loan.interest_rate === 0 && <span className="text-gray-500 text-sm font-normal"> · беспроцентный</span>}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Возврат до {fmtDate(loan.return_date)}
                      {loan.status === "filled" && ` · Заёмщик: ${borrower}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => copyLink(loan)}
                      className="flex items-center gap-1.5 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                      <Icon name={copiedId === loan.id ? "Check" : "Link"} size={13} />
                      {copiedId === loan.id ? "Скопировано" : "Ссылка для заёмщика"}
                    </button>
                    {loan.pdf_url && (
                      <a href={loan.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 border border-green-500/30 text-green-400 hover:bg-green-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                        <Icon name="FileDown" size={13} /> PDF
                      </a>
                    )}
                    <button onClick={() => deleteLoan(loan.id)}
                      className="flex items-center gap-1.5 border border-red-500/20 text-red-400/70 hover:bg-red-500/10 px-3 py-1.5 rounded-sm text-xs transition-colors">
                      <Icon name="Trash2" size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
