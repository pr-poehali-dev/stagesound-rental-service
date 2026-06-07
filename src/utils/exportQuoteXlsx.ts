import * as XLSX from "xlsx";

interface QuoteItem { name: string; price: number; unit: string; qty: number }
interface QuoteExtra { name: string; price: number }

interface QuoteData {
  title: string;
  items: QuoteItem[];
  days: number;
  delivery: string;
  delivery_price: number;
  delivery_address?: string;
  delivery_time?: string;
  pickup_time?: string;
  extras: QuoteExtra[];
  total: number;
  event_date?: string;
  installation_time?: string;
  installation_price?: number;
  dismantling_time?: string;
  dismantling_price?: number;
  no_installation?: boolean;
  discount?: number;
}

export function exportQuoteToXlsx(q: QuoteData) {
  const wb = XLSX.utils.book_new();
  const rows: (string | number)[][] = [];

  // Заголовок
  rows.push(["КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ", ""]);
  rows.push([q.title || "", ""]);
  rows.push([""]);

  // Реквизиты мероприятия
  if (q.event_date) {
    const d = new Date(q.event_date);
    const formatted = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    rows.push(["Дата мероприятия:", formatted]);
  }
  if (q.delivery_address) rows.push(["Адрес:", q.delivery_address]);
  if (q.delivery && q.delivery !== "Без доставки") rows.push(["Зона доставки:", q.delivery]);
  if (q.delivery_time) rows.push(["Привоз оборудования:", q.delivery_time]);
  if (q.pickup_time) rows.push(["Увоз оборудования:", q.pickup_time]);
  if (q.no_installation) {
    rows.push(["Монтаж и демонтаж:", "Не требуется"]);
  } else {
    if (q.installation_time) rows.push(["Монтаж:", q.installation_time]);
    if (q.dismantling_time) rows.push(["Демонтаж:", q.dismantling_time]);
  }
  rows.push([""]);

  // Состав аренды
  rows.push(["Позиция", "Кол-во", "Ед.", "Цена за ед., ₽", "Дней", "Сумма, ₽"]);

  const discountPct = q.discount || 0;
  let equipmentRaw = 0;

  for (const item of q.items) {
    const lineTotal = item.price * item.qty * q.days;
    equipmentRaw += lineTotal;
    rows.push([item.name, item.qty, item.unit, item.price, q.days, lineTotal]);
  }

  // Доп. услуги
  let extrasTotal = 0;
  if (q.extras.length > 0) {
    rows.push([""]);
    rows.push(["Дополнительные услуги", "", "", "", "", ""]);
    for (const ex of q.extras) {
      extrasTotal += ex.price;
      rows.push([ex.name, "", "", "", "", ex.price]);
    }
  }

  // Монтаж/демонтаж стоимость
  let installTotal = 0;
  if (!q.no_installation) {
    if (q.installation_price && q.installation_price > 0) {
      installTotal += q.installation_price;
    }
    if (q.dismantling_price && q.dismantling_price > 0) {
      installTotal += q.dismantling_price;
    }
  }

  // Итоги
  rows.push([""]);
  const discountAmt = discountPct > 0 ? Math.round(equipmentRaw * discountPct / 100) : 0;
  const equipmentTotal = equipmentRaw - discountAmt;

  if (discountPct > 0) {
    rows.push(["Оборудование (до скидки):", "", "", "", "", equipmentRaw]);
    rows.push([`Скидка ${discountPct}%:`, "", "", "", "", -discountAmt]);
    rows.push(["Оборудование (со скидкой):", "", "", "", "", equipmentTotal]);
  } else {
    rows.push(["Оборудование:", "", "", "", "", equipmentTotal]);
  }
  if (extrasTotal > 0) rows.push(["Доп. услуги:", "", "", "", "", extrasTotal]);
  if (q.delivery_price > 0) rows.push(["Доставка:", "", "", "", "", q.delivery_price]);
  if (installTotal > 0) rows.push(["Монтаж и демонтаж:", "", "", "", "", installTotal]);
  rows.push(["ИТОГО:", "", "", "", "", q.total]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Ширина колонок
  ws["!cols"] = [
    { wch: 46 }, { wch: 8 }, { wch: 6 }, { wch: 16 }, { wch: 7 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "КП");

  const filename = `КП_${(q.title || "заказ").replace(/[^а-яА-ЯёЁa-zA-Z0-9 _]/g, "").trim()}.xlsx`;
  XLSX.writeFile(wb, filename);
}
