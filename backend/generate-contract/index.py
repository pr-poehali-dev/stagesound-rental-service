"""
Генерация PDF договора аренды оборудования по данным договора из БД.
GET /?pwd=X&contract_id=N — сгенерировать PDF, сохранить в S3, вернуть URL
"""
import io
import json
import os
import psycopg2
import boto3
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}

_FONTS_REGISTERED = False


def ensure_fonts():
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    _FONTS_REGISTERED = True


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def fmt_date(d: str) -> str:
    if not d:
        return "_______________"
    try:
        dt = datetime.strptime(d, "%Y-%m-%d")
        months = ["января","февраля","марта","апреля","мая","июня",
                  "июля","августа","сентября","октября","ноября","декабря"]
        return f"{dt.day:02d} {months[dt.month - 1]} {dt.year} г."
    except Exception:
        return d


def money_str(amount: int) -> str:
    ones = ["","один","два","три","четыре","пять","шесть","семь","восемь","девять",
            "десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать",
            "шестнадцать","семнадцать","восемнадцать","девятнадцать"]
    tens = ["","десять","двадцать","тридцать","сорок","пятьдесят",
            "шестьдесят","семьдесят","восемьдесят","девяносто"]
    hundreds = ["","сто","двести","триста","четыреста","пятьсот",
                "шестьсот","семьсот","восемьсот","девятьсот"]
    th_f = ["","одна","две","три","четыре","пять","шесть","семь","восемь","девять",
            "десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать",
            "шестнадцать","семнадцать","восемнадцать","девятнадцать"]
    n = int(amount)
    if n == 0:
        return "ноль рублей 00 копеек"
    parts = []
    if n >= 1000:
        t = n // 1000
        n %= 1000
        h = t // 100
        t2 = t % 100
        if h:
            parts.append(hundreds[h])
        if t2 >= 20:
            parts.append(tens[t2 // 10])
            if t2 % 10:
                parts.append(th_f[t2 % 10])
        elif t2 > 0:
            parts.append(th_f[t2])
        last = (t % 10) if (t % 100) not in range(11, 20) else 0
        parts.append("тысяча" if last == 1 else "тысячи" if last in (2, 3, 4) else "тысяч")
    h = n // 100
    t = n % 100
    if h:
        parts.append(hundreds[h])
    if t >= 20:
        parts.append(tens[t // 10])
        if t % 10:
            parts.append(ones[t % 10])
    elif t > 0:
        parts.append(ones[t])
    words = " ".join(p for p in parts if p)
    return f"{amount:,} ({words}) рублей 00 копеек".replace(",", "\u00a0")


def build_pdf(contract: dict, quote: dict) -> bytes:
    ensure_fonts()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=22*mm, rightMargin=22*mm,
                            topMargin=20*mm, bottomMargin=20*mm)
    F = "STSong-Light"
    BC = colors.HexColor("#111111")
    GC = colors.HexColor("#555555")

    def S(name, **kw):
        d = dict(fontName=F, fontSize=9, leading=13, textColor=BC, spaceAfter=2)
        d.update(kw)
        return ParagraphStyle(name, **d)

    S_TITLE  = S("title",  fontSize=13, alignment=TA_CENTER, spaceAfter=4)
    S_H2     = S("h2",     fontSize=10, spaceAfter=3)
    S_BODY   = S("body",   alignment=TA_JUSTIFY)
    S_CENTER = S("center", alignment=TA_CENTER)
    S_SMALL  = S("small",  fontSize=8, textColor=GC)
    S_BOLD   = S("bold",   fontSize=9)
    S_RIGHT  = S("right",  alignment=TA_RIGHT)

    today = datetime.now()
    contract_num = f"А-{contract['id']:04d}"
    client_type  = contract.get("client_type", "individual")

    if client_type == "individual":
        client_name  = contract.get("full_name") or "_______________"
        client_label = "Физическое лицо"
        ps = contract.get("passport_series", "____")
        pn = contract.get("passport_number", "______")
        pi = contract.get("passport_issued", "_______________")
        pd = fmt_date(contract.get("passport_date", ""))
        bd = fmt_date(contract.get("birth_date", ""))
        ra = contract.get("address", "_______________")
        client_req = (
            f"Паспорт: {ps} {pn}, выдан {pi}, {pd}\n"
            f"Дата рождения: {bd}\n"
            f"Адрес регистрации: {ra}"
        )
    else:
        company      = contract.get("company_name", "_______________")
        inn          = contract.get("inn", "_______________")
        kpp          = contract.get("kpp", "")
        ogrn         = contract.get("ogrn", "_______________")
        la           = contract.get("legal_address", "_______________")
        director     = contract.get("director", "_______________")
        client_name  = company
        client_label = "Юридическое лицо"
        kpp_str      = f", КПП: {kpp}" if kpp else ""
        client_req   = (
            f"ИНН: {inn}{kpp_str}, ОГРН: {ogrn}\n"
            f"Юридический адрес: {la}\n"
            f"Директор: {director}"
        )

    phone = contract.get("phone", "_______________")
    email = contract.get("email", "_______________")
    items       = quote.get("items") or []
    extras      = quote.get("extras") or []
    days        = quote.get("days", 1)
    delivery    = quote.get("delivery", "Без доставки")
    delivery_p  = quote.get("delivery_price") or 0
    total       = quote.get("total") or 0
    quote_title = quote.get("title", "Аренда оборудования")

    if days == 1:
        days_word = "один (1) календарный день"
    elif days < 5:
        days_word = f"{days} ({days}) календарных дня"
    else:
        days_word = f"{days} ({days}) календарных дней"

    story = []
    story.append(Paragraph("ДОГОВОР АРЕНДЫ ОБОРУДОВАНИЯ", S_TITLE))
    story.append(Paragraph(f"№ {contract_num}", S_CENTER))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph(
        f"г. Москва" + "&nbsp;" * 80 + f"«___» ______________ {today.year} г.", S_BODY))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        f"ООО «Stage Sound» (далее — Арендодатель), с одной стороны, и "
        f"{client_name} ({client_label}), (далее — Арендатор), с другой стороны, "
        f"заключили настоящий Договор о нижеследующем:", S_BODY))
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#bbbbbb")))
    story.append(Spacer(1, 3*mm))

    def section(title, *paras):
        story.append(Paragraph(title, S_H2))
        for p in paras:
            story.append(Paragraph(p, S_BODY))
        story.append(Spacer(1, 3*mm))

    section("1. ПРЕДМЕТ ДОГОВОРА",
        "1.1. Арендодатель предоставляет Арендатору во временное пользование оборудование "
        "согласно Приложению №1 к настоящему Договору.",
        f"1.2. Цель использования: {quote_title}.",
        f"1.3. Срок аренды: {days_word}.",
    )
    section("2. АРЕНДНАЯ ПЛАТА",
        f"2.1. Общая стоимость аренды составляет: {money_str(total)}.",
        "2.2. Оплата производится до начала срока аренды перечислением на расчётный счёт Арендодателя.",
    )
    section("3. ПРАВА И ОБЯЗАННОСТИ СТОРОН",
        "3.1. Арендодатель обязуется передать Оборудование в исправном состоянии.",
        "3.2. Арендатор обязуется использовать Оборудование по назначению, обеспечить его "
        "сохранность и возвратить в срок и в исправном состоянии.",
        "3.3. В случае повреждения или утраты Оборудования Арендатор возмещает его полную стоимость.",
    )
    section("4. ОТВЕТСТВЕННОСТЬ",
        "4.1. При несвоевременном возврате Оборудования Арендатор уплачивает неустойку 0,5% "
        "от суммы Договора за каждый день просрочки.",
        "4.2. Стороны освобождаются от ответственности при форс-мажорных обстоятельствах.",
    )
    section("5. ПРОЧИЕ УСЛОВИЯ",
        "5.1. Договор вступает в силу с момента подписания обеими Сторонами.",
        "5.2. Споры решаются переговорами, при недостижении согласия — в суде по месту Арендодателя.",
        "5.3. Договор составлен в двух экземплярах, имеющих равную юридическую силу.",
    )

    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#bbbbbb")))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("6. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН", S_H2))

    def ml(text):
        return Paragraph(text.replace("\n", "<br/>"), S_SMALL)

    arend = (
        "ООО «Stage Sound»\n"
        "ИНН: _______________\n"
        "ОГРН: _______________\n"
        "Адрес: г. Москва\n"
        "Email: info@global.promo\n\n"
        "Подпись: _____________________\n\nМ.П."
    )
    client_block = (
        f"{client_name}\n{client_req}\n"
        f"Тел.: {phone}\nEmail: {email}\n\n"
        f"Подпись: _____________________\n\n"
        f"{'М.П.' if client_type == 'company' else ''}"
    )

    req_t = Table(
        [[Paragraph("АРЕНДОДАТЕЛЬ", S_BOLD), Paragraph("АРЕНДАТОР", S_BOLD)],
         [ml(arend), ml(client_block)]],
        colWidths=[85*mm, 85*mm]
    )
    req_t.setStyle(TableStyle([
        ("VALIGN",        (0,0),(-1,-1), "TOP"),
        ("LEFTPADDING",   (0,0),(-1,-1), 0),
        ("RIGHTPADDING",  (0,0),(-1,-1), 8),
        ("TOPPADDING",    (0,0),(-1,-1), 4),
        ("BOTTOMPADDING", (0,0),(-1,-1), 4),
        ("LINEAFTER",     (0,0),(0,-1),  0.5, colors.HexColor("#bbbbbb")),
    ]))
    story.append(req_t)

    # ── Приложение №1 ──
    story.append(Spacer(1, 10*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#333333")))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(f"ПРИЛОЖЕНИЕ №1 к Договору № {contract_num}", S_CENTER))
    story.append(Paragraph("ПЕРЕЧЕНЬ АРЕНДУЕМОГО ОБОРУДОВАНИЯ", S_TITLE))
    story.append(Spacer(1, 4*mm))

    eq_rows = [[
        Paragraph("№", S_CENTER),
        Paragraph("Наименование", S_BOLD),
        Paragraph("Кол-во", S_CENTER),
        Paragraph("Цена/ед.", S_CENTER),
        Paragraph("Дней", S_CENTER),
        Paragraph("Сумма", S_RIGHT),
    ]]

    for i, item in enumerate(items, 1):
        pr = item.get("price", 0)
        qt = item.get("qty", 1)
        st = pr * qt * days
        eq_rows.append([
            Paragraph(str(i), S_CENTER),
            Paragraph(item.get("name", "—"), S_BODY),
            Paragraph(str(qt), S_CENTER),
            Paragraph(f"{pr:,} р.".replace(",", " "), S_RIGHT),
            Paragraph(str(days), S_CENTER),
            Paragraph(f"{st:,} р.".replace(",", " "), S_RIGHT),
        ])

    if extras:
        eq_rows.append([Paragraph("", S_BODY)] * 6)
        for ex in extras:
            ep = ex.get("price", 0)
            eq_rows.append([
                Paragraph("—", S_CENTER),
                Paragraph(ex.get("name", "—"), S_BODY),
                Paragraph("1", S_CENTER),
                Paragraph(f"{ep:,} р.".replace(",", " "), S_RIGHT),
                Paragraph("—", S_CENTER),
                Paragraph(f"{ep:,} р.".replace(",", " "), S_RIGHT),
            ])

    if delivery_p:
        eq_rows.append([
            Paragraph("—", S_CENTER),
            Paragraph(f"Доставка ({delivery})", S_BODY),
            Paragraph("1", S_CENTER),
            Paragraph(f"{delivery_p:,} р.".replace(",", " "), S_RIGHT),
            Paragraph("—", S_CENTER),
            Paragraph(f"{delivery_p:,} р.".replace(",", " "), S_RIGHT),
        ])

    eq_rows.append([
        Paragraph("", S_BODY),
        Paragraph("ИТОГО:", S_BOLD),
        Paragraph("", S_CENTER),
        Paragraph("", S_CENTER),
        Paragraph("", S_CENTER),
        Paragraph(f"{total:,} р.".replace(",", " "), S_RIGHT),
    ])

    eq_t = Table(eq_rows, colWidths=[10*mm, 75*mm, 17*mm, 22*mm, 15*mm, 22*mm], repeatRows=1)
    eq_t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  colors.HexColor("#eeeeee")),
        ("GRID",          (0,0), (-1,-2), 0.3, colors.HexColor("#cccccc")),
        ("LINEABOVE",     (0,-1),(-1,-1), 1,   colors.HexColor("#333333")),
        ("TOPPADDING",    (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("LEFTPADDING",   (0,0), (-1,-1), 4),
        ("RIGHTPADDING",  (0,0), (-1,-1), 4),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(eq_t)
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(f"Итого: {money_str(total)}.", S_BODY))
    story.append(Spacer(1, 8*mm))
    story.append(Table(
        [[Paragraph("Арендодатель: _____________________  М.П.", S_SMALL),
          Paragraph("Арендатор: _____________________", S_SMALL)]],
        colWidths=[85*mm, 85*mm]
    ))

    doc.build(story)
    return buf.getvalue()


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qp = event.get("queryStringParameters") or {}
    pwd = qp.get("pwd", "")
    if pwd.lower() != os.environ.get("ADMIN_PASSWORD", "Qwert12345").lower():
        return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}

    contract_id = qp.get("contract_id")
    if not contract_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "contract_id required"})}

    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        f"""SELECT c.id, c.quote_id, c.client_type,
            c.full_name, c.passport_series, c.passport_number, c.passport_issued,
            c.passport_date, c.birth_date, c.address,
            c.company_name, c.inn, c.kpp, c.ogrn, c.legal_address, c.director,
            c.phone, c.email,
            q.title, q.items, q.days, q.delivery, q.delivery_price, q.extras, q.total
        FROM {schema}.contracts c
        JOIN {schema}.quotes q ON q.id = c.quote_id
        WHERE c.id = %s""",
        (int(contract_id),)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}

    keys_c = ["id","quote_id","client_type","full_name","passport_series","passport_number",
              "passport_issued","passport_date","birth_date","address",
              "company_name","inn","kpp","ogrn","legal_address","director","phone","email"]
    keys_q = ["title","items","days","delivery","delivery_price","extras","total"]
    data     = dict(zip(keys_c + keys_q, row))
    contract = {k: data[k] for k in keys_c}
    quote    = {k: data[k] for k in keys_q}
    for f in ("items", "extras"):
        if isinstance(quote[f], str):
            quote[f] = json.loads(quote[f])

    pdf_bytes = build_pdf(contract, quote)

    key = f"contracts/contract_{contract['id']:04d}.pdf"
    s3 = boto3.client("s3", endpoint_url="https://bucket.poehali.dev",
                      aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                      aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"])
    s3.put_object(Bucket="files", Key=key, Body=pdf_bytes, ContentType="application/pdf")
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "pdf_url": cdn_url})}
