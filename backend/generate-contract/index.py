"""
Генерация PDF договора аренды оборудования по данным договора из БД.
GET /?pwd=X&contract_id=N — сгенерировать PDF, сохранить в S3, вернуть URL
"""
import io, json, os
from datetime import datetime
import psycopg2
import boto3
import urllib.request

# ReportLab
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_JUSTIFY, TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}

# ── Шрифты ──────────────────────────────────────────────────────────────────
_FONTS_OK = False

FONT_URLS = {
    "PT": "https://fonts.gstatic.com/s/ptsans/v17/jizaRExUiTo99u79P0U.ttf",
    "PT-Bold": "https://fonts.gstatic.com/s/ptsans/v17/jizaBo-dKScqlMqCygY.ttf",
}


def ensure_fonts():
    global _FONTS_OK
    if _FONTS_OK:
        return
    for name, url in FONT_URLS.items():
        path = f"/tmp/font_{name}.ttf"
        if not os.path.exists(path):
            urllib.request.urlretrieve(url, path)
        pdfmetrics.registerFont(TTFont(name, path))
    _FONTS_OK = True


# ── Хелперы ─────────────────────────────────────────────────────────────────
def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def fmt_date(d: str) -> str:
    if not d:
        return "«___» __________ _____ г."
    try:
        dt = datetime.strptime(d.strip(), "%Y-%m-%d")
        months = ["января","февраля","марта","апреля","мая","июня",
                  "июля","августа","сентября","октября","ноября","декабря"]
        return f"«{dt.day:02d}» {months[dt.month-1]} {dt.year} г."
    except Exception:
        return d


_ONES = ["","один","два","три","четыре","пять","шесть","семь","восемь","девять",
         "десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать",
         "шестнадцать","семнадцать","восемнадцать","девятнадцать"]
_ONES_F = ["","одна","две","три","четыре","пять","шесть","семь","восемь","девять",
           "десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать",
           "шестнадцать","семнадцать","восемнадцать","девятнадцать"]
_TENS = ["","десять","двадцать","тридцать","сорок","пятьдесят",
         "шестьдесят","семьдесят","восемьдесят","девяносто"]
_HUND = ["","сто","двести","триста","четыреста","пятьсот",
         "шестьсот","семьсот","восемьсот","девятьсот"]


def _chunk(n, female=False):
    parts = []
    h = n // 100
    t = n % 100
    if h:
        parts.append(_HUND[h])
    if t >= 20:
        parts.append(_TENS[t // 10])
        r = t % 10
        if r:
            parts.append((_ONES_F if female else _ONES)[r])
    elif t:
        parts.append((_ONES_F if female else _ONES)[t])
    return parts


def money_words(amount: int) -> str:
    if amount == 0:
        return "ноль рублей 00 копеек"
    parts = []
    millions = amount // 1_000_000
    thousands = (amount % 1_000_000) // 1000
    remainder = amount % 1000

    if millions:
        p = _chunk(millions)
        last = millions % 10
        if millions % 100 in range(11, 20):
            suffix = "миллионов"
        elif last == 1:
            suffix = "миллион"
        elif last in (2, 3, 4):
            suffix = "миллиона"
        else:
            suffix = "миллионов"
        parts.extend(p)
        parts.append(suffix)

    if thousands:
        p = _chunk(thousands, female=True)
        last = thousands % 10
        if thousands % 100 in range(11, 20):
            suffix = "тысяч"
        elif last == 1:
            suffix = "тысяча"
        elif last in (2, 3, 4):
            suffix = "тысячи"
        else:
            suffix = "тысяч"
        parts.extend(p)
        parts.append(suffix)

    if remainder:
        parts.extend(_chunk(remainder))

    words = " ".join(p for p in parts if p)
    return f"{amount:,} ({words}) рублей 00 копеек".replace(",", "\u00a0")


# ── PDF ──────────────────────────────────────────────────────────────────────
def build_pdf(contract: dict, quote: dict) -> bytes:
    ensure_fonts()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=25*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
        title="Договор аренды оборудования",
    )

    F  = "PT"
    FB = "PT-Bold"
    BK = colors.HexColor("#1a1a1a")
    GR = colors.HexColor("#555555")
    LG = colors.HexColor("#999999")
    AM = colors.HexColor("#b45309")   # amber-700

    def sty(name, **kw):
        base = dict(fontName=F, fontSize=10, leading=15, textColor=BK, spaceAfter=0)
        base.update(kw)
        return ParagraphStyle(name, **base)

    S = {
        "title":   sty("title",  fontName=FB, fontSize=14, alignment=TA_CENTER, spaceAfter=2, leading=18),
        "sub":     sty("sub",    fontSize=10, alignment=TA_CENTER, textColor=GR),
        "h2":      sty("h2",     fontName=FB, fontSize=10, textColor=AM, spaceAfter=1),
        "body":    sty("body",   fontSize=9,  alignment=TA_JUSTIFY, leading=14),
        "bodyL":   sty("bodyL",  fontSize=9,  alignment=TA_LEFT, leading=14),
        "center":  sty("center", fontSize=9,  alignment=TA_CENTER, leading=14),
        "small":   sty("small",  fontSize=8,  textColor=GR, leading=12),
        "smallB":  sty("smallB", fontName=FB, fontSize=8, leading=12),
        "bold":    sty("bold",   fontName=FB, fontSize=9, leading=14),
        "boldC":   sty("boldC",  fontName=FB, fontSize=9, alignment=TA_CENTER, leading=14),
        "right":   sty("right",  fontSize=9,  alignment=TA_RIGHT, leading=14),
        "boldR":   sty("boldR",  fontName=FB, fontSize=9, alignment=TA_RIGHT, leading=14),
        "label":   sty("label",  fontSize=7,  textColor=LG, spaceAfter=1, leading=10),
        "sign":    sty("sign",   fontSize=9,  textColor=GR, leading=14),
    }

    today = datetime.now()
    contract_num = f"А-{contract['id']:04d}"
    ctype = contract.get("client_type", "individual")

    if ctype == "individual":
        cname  = contract.get("full_name") or "_______________"
        clabel = "Физическое лицо"
        ps = contract.get("passport_series") or "____"
        pn = contract.get("passport_number") or "______"
        pi = contract.get("passport_issued") or "_______________"
        pd = fmt_date(contract.get("passport_date") or "")
        bd = fmt_date(contract.get("birth_date") or "")
        ra = contract.get("address") or "_______________"
        creq_lines = [
            f"Паспорт: серия {ps} № {pn}",
            f"Выдан: {pi}, {pd}",
            f"Дата рождения: {bd}",
            f"Адрес: {ra}",
        ]
    else:
        company  = contract.get("company_name") or "_______________"
        inn      = contract.get("inn") or "_______________"
        kpp      = contract.get("kpp") or ""
        ogrn     = contract.get("ogrn") or "_______________"
        la       = contract.get("legal_address") or "_______________"
        director = contract.get("director") or "_______________"
        cname  = company
        clabel = "Юридическое лицо"
        kpp_str = f"  КПП: {kpp}" if kpp else ""
        creq_lines = [
            f"ИНН: {inn}{kpp_str}",
            f"ОГРН: {ogrn}",
            f"Юр. адрес: {la}",
            f"Директор: {director}",
        ]

    phone = contract.get("phone") or "_______________"
    email = contract.get("email") or "_______________"
    items      = quote.get("items") or []
    extras     = quote.get("extras") or []
    days       = int(quote.get("days") or 1)
    delivery   = quote.get("delivery") or "Без доставки"
    delivery_p = int(quote.get("delivery_price") or 0)
    total      = int(quote.get("total") or 0)
    qtitle     = quote.get("title") or "Аренда оборудования"

    if days == 1:
        days_str = "1 (один) календарный день"
    elif 2 <= days <= 4:
        days_str = f"{days} ({money_words(days).split('(')[1].split(')')[0]}) календарных дня"
    else:
        days_str = f"{days} календарных дней"

    W = doc.width  # полная ширина текста

    story = []

    # ── ШАПКА ──────────────────────────────────────────────────────────────
    story.append(Paragraph("ДОГОВОР АРЕНДЫ ОБОРУДОВАНИЯ", S["title"]))
    story.append(Paragraph(f"№&nbsp;{contract_num}", S["sub"]))
    story.append(Spacer(1, 6*mm))

    # Город + дата
    loc_table = Table(
        [[Paragraph("г. Москва", S["body"]),
          Paragraph(f"«&nbsp;&nbsp;&nbsp;»&nbsp;_______________&nbsp;{today.year}&nbsp;г.", S["right"])]],
        colWidths=[W/2, W/2]
    )
    loc_table.setStyle(TableStyle([
        ("LEFTPADDING",  (0,0),(-1,-1), 0),
        ("RIGHTPADDING", (0,0),(-1,-1), 0),
        ("TOPPADDING",   (0,0),(-1,-1), 0),
        ("BOTTOMPADDING",(0,0),(-1,-1), 0),
    ]))
    story.append(loc_table)
    story.append(Spacer(1, 6*mm))

    # ── ПРЕАМБУЛА ───────────────────────────────────────────────────────────
    story.append(Paragraph(
        f'<b>ООО «Stage Sound»</b>, именуемое в дальнейшем <b>«Арендодатель»</b>, '
        f'с одной стороны, и '
        f'<b>{cname}</b> ({clabel}), именуемый(-ая) в дальнейшем <b>«Арендатор»</b>, '
        f'с другой стороны, совместно именуемые «Стороны», заключили настоящий Договор '
        f'о нижеследующем:',
        S["body"]
    ))
    story.append(Spacer(1, 5*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#dddddd")))
    story.append(Spacer(1, 4*mm))

    # ── СТАТЬИ ──────────────────────────────────────────────────────────────
    def section(num, title, *paras):
        items_block = [
            Paragraph(f"{num}.&nbsp;{title}", S["h2"]),
            Spacer(1, 2*mm),
        ]
        for p in paras:
            items_block.append(Paragraph(p, S["body"]))
            items_block.append(Spacer(1, 1.5*mm))
        items_block.append(Spacer(1, 3*mm))
        story.append(KeepTogether(items_block))

    section("1", "ПРЕДМЕТ ДОГОВОРА",
        "1.1. Арендодатель обязуется предоставить Арендатору во временное платное пользование "
        "оборудование согласно Перечню (Приложение №&nbsp;1), а Арендатор обязуется принять "
        "его, оплатить аренду и вернуть в исправном состоянии.",
        f"1.2. Назначение: <b>{qtitle}</b>.",
        f"1.3. Срок аренды: <b>{days_str}</b>.",
    )
    section("2", "СТОИМОСТЬ И ПОРЯДОК РАСЧЁТОВ",
        f"2.1. Общая стоимость аренды по настоящему Договору составляет: "
        f"<b>{money_words(total)}</b>.",
        "2.2. Оплата производится в полном объёме до начала срока аренды путём безналичного "
        "перечисления на расчётный счёт Арендодателя либо иным согласованным Сторонами способом.",
        "2.3. Датой исполнения обязательства по оплате считается дата поступления денежных "
        "средств на расчётный счёт Арендодателя.",
    )
    section("3", "ПРАВА И ОБЯЗАННОСТИ СТОРОН",
        "3.1. Арендодатель обязуется: передать Оборудование в исправном техническом состоянии; "
        "обеспечить доставку и монтаж в соответствии с условиями настоящего Договора (при наличии "
        "соответствующих услуг в Приложении №&nbsp;1); своевременно устранять неисправности, "
        "возникшие не по вине Арендатора.",
        "3.2. Арендатор обязуется: использовать Оборудование строго по его назначению; "
        "обеспечить сохранность Оборудования и не передавать его третьим лицам без письменного "
        "согласия Арендодателя; своевременно вернуть Оборудование по окончании срока аренды "
        "в том же состоянии, в котором оно было получено, с учётом нормального износа.",
    )
    section("4", "ОТВЕТСТВЕННОСТЬ СТОРОН",
        "4.1. В случае несвоевременного возврата Оборудования Арендатор уплачивает неустойку "
        "в размере 0,5&nbsp;% от суммы настоящего Договора за каждый день просрочки.",
        "4.2. В случае повреждения, порчи или утраты Оборудования Арендатор возмещает "
        "Арендодателю его полную рыночную стоимость на дату причинения ущерба.",
        "4.3. Стороны освобождаются от ответственности за неисполнение обязательств, "
        "если это вызвано обстоятельствами непреодолимой силы (форс-мажор).",
    )
    section("5", "ПОРЯДОК РАЗРЕШЕНИЯ СПОРОВ",
        "5.1. Все разногласия Стороны стремятся урегулировать путём переговоров.",
        "5.2. При недостижении соглашения спор передаётся на рассмотрение арбитражного суда "
        "по месту нахождения Арендодателя в соответствии с законодательством РФ.",
    )
    section("6", "ПРОЧИЕ УСЛОВИЯ",
        "6.1. Настоящий Договор вступает в силу с момента подписания обеими Сторонами.",
        "6.2. Любые изменения и дополнения к Договору действительны лишь при условии их "
        "оформления в письменном виде и подписания уполномоченными представителями Сторон.",
        "6.3. Договор составлен в двух экземплярах, имеющих равную юридическую силу, "
        "по одному для каждой из Сторон.",
    )

    # ── РЕКВИЗИТЫ И ПОДПИСИ ─────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#dddddd")))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("7. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН", S["h2"]))
    story.append(Spacer(1, 3*mm))

    def req_col(header, lines, sign_label=""):
        items_col = [Paragraph(header, S["smallB"]), Spacer(1, 2*mm)]
        for ln in lines:
            items_col.append(Paragraph(ln, S["small"]))
        items_col.append(Spacer(1, 5*mm))
        items_col.append(Paragraph(sign_label or "Подпись: ________________________", S["sign"]))
        if "Арендодатель" in header:
            items_col.append(Spacer(1, 2*mm))
            items_col.append(Paragraph("М.П.", S["small"]))
        elif "company" in (ctype if "Арендатор" not in header else ""):
            pass
        return items_col

    arend_col = req_col(
        "АРЕНДОДАТЕЛЬ",
        [
            "ООО «Stage Sound»",
            "ИНН: _____________   ОГРН: _____________",
            "Адрес: г. Москва",
            "Email: info@global.promo",
        ],
    )
    arend_col.append(Spacer(1, 2*mm))
    arend_col.append(Paragraph("М.П.", S["small"]))

    client_col_lines = [cname, clabel] + creq_lines + [f"Тел.: {phone}", f"Email: {email}"]
    client_col = req_col("АРЕНДАТОР", client_col_lines)
    if ctype == "company":
        client_col.append(Spacer(1, 2*mm))
        client_col.append(Paragraph("М.П.", S["small"]))

    def col_to_para(items_list):
        result = []
        for el in items_list:
            result.append(el)
        return result

    req_t = Table(
        [[col_to_para(arend_col), col_to_para(client_col)]],
        colWidths=[W/2 - 5*mm, W/2 + 5*mm]
    )
    req_t.setStyle(TableStyle([
        ("VALIGN",        (0,0),(-1,-1), "TOP"),
        ("LEFTPADDING",   (0,0),(-1,-1), 0),
        ("RIGHTPADDING",  (0,0),(-1,-1), 4),
        ("TOPPADDING",    (0,0),(-1,-1), 0),
        ("BOTTOMPADDING", (0,0),(-1,-1), 0),
        ("LINEAFTER",     (0,0),(0,-1),  0.5, colors.HexColor("#dddddd")),
        ("LEFTPADDING",   (1,0),(1,-1),  8),
    ]))
    story.append(req_t)

    # ── ПРИЛОЖЕНИЕ №1 ────────────────────────────────────────────────────────
    story.append(Spacer(1, 10*mm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#b45309")))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph(f"ПРИЛОЖЕНИЕ №&nbsp;1 к Договору аренды оборудования №&nbsp;{contract_num}", S["sub"]))
    story.append(Spacer(1, 1*mm))
    story.append(Paragraph("ПЕРЕЧЕНЬ АРЕНДУЕМОГО ОБОРУДОВАНИЯ И УСЛУГ", S["title"]))
    story.append(Spacer(1, 5*mm))

    # Таблица оборудования
    COL_W = [8*mm, 78*mm, 14*mm, 22*mm, 13*mm, 22*mm]

    header_row = [
        Paragraph("№", S["boldC"]),
        Paragraph("Наименование", S["bold"]),
        Paragraph("Кол-во", S["boldC"]),
        Paragraph("Цена/ед., ₽", S["boldC"]),
        Paragraph("Дней", S["boldC"]),
        Paragraph("Сумма, ₽", S["boldR"]),
    ]
    eq_rows = [header_row]

    equip_sum = 0
    for i, item in enumerate(items, 1):
        pr = int(item.get("price") or 0)
        qt = int(item.get("qty") or 1)
        nm = item.get("name") or "—"
        un = item.get("unit") or "день"
        st = pr * qt * days
        equip_sum += st
        eq_rows.append([
            Paragraph(str(i), S["center"]),
            Paragraph(nm, S["bodyL"]),
            Paragraph(str(qt), S["center"]),
            Paragraph(f"{pr:,}".replace(",", "\u00a0"), S["right"]),
            Paragraph(str(days), S["center"]),
            Paragraph(f"{st:,}".replace(",", "\u00a0"), S["right"]),
        ])

    # Доп. услуги
    if extras:
        eq_rows.append([
            Paragraph("", S["body"]),
            Paragraph("Дополнительные услуги:", S["bold"]),
            Paragraph("", S["body"]),
            Paragraph("", S["body"]),
            Paragraph("", S["body"]),
            Paragraph("", S["body"]),
        ])
        for ex in extras:
            ep = int(ex.get("price") or 0)
            eq_rows.append([
                Paragraph("—", S["center"]),
                Paragraph(ex.get("name") or "—", S["bodyL"]),
                Paragraph("1", S["center"]),
                Paragraph(f"{ep:,}".replace(",", "\u00a0"), S["right"]),
                Paragraph("—", S["center"]),
                Paragraph(f"{ep:,}".replace(",", "\u00a0"), S["right"]),
            ])

    # Доставка
    if delivery_p > 0:
        eq_rows.append([
            Paragraph("—", S["center"]),
            Paragraph(f"Доставка: {delivery}", S["bodyL"]),
            Paragraph("1", S["center"]),
            Paragraph(f"{delivery_p:,}".replace(",", "\u00a0"), S["right"]),
            Paragraph("—", S["center"]),
            Paragraph(f"{delivery_p:,}".replace(",", "\u00a0"), S["right"]),
        ])

    # Итого
    eq_rows.append([
        Paragraph("", S["body"]),
        Paragraph("ИТОГО:", S["bold"]),
        Paragraph("", S["body"]),
        Paragraph("", S["body"]),
        Paragraph("", S["body"]),
        Paragraph(f"{total:,}".replace(",", "\u00a0"), S["boldR"]),
    ])

    eq_t = Table(eq_rows, colWidths=COL_W, repeatRows=1)
    eq_t.setStyle(TableStyle([
        # Шапка
        ("BACKGROUND",    (0, 0), (-1, 0),  colors.HexColor("#fef3c7")),
        ("LINEBELOW",     (0, 0), (-1, 0),  1, colors.HexColor("#b45309")),
        # Сетка данных
        ("GRID",          (0, 1), (-1, -2), 0.3, colors.HexColor("#e5e7eb")),
        # Итого
        ("LINEABOVE",     (0, -1), (-1, -1), 1, colors.HexColor("#b45309")),
        ("BACKGROUND",    (0, -1), (-1, -1), colors.HexColor("#fffbeb")),
        # Отступы
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        # Чередование строк
        ("ROWBACKGROUNDS",(0, 1), (-1, -2), [colors.white, colors.HexColor("#fafafa")]),
    ]))
    story.append(eq_t)

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        f"<b>Итого по Договору:</b> {money_words(total)}.",
        S["body"]
    ))
    story.append(Spacer(1, 8*mm))

    # Подписи к приложению
    sign_t = Table(
        [[Paragraph("Арендодатель: ________________________&nbsp;/&nbsp;________________/ М.П.", S["sign"]),
          Paragraph("Арендатор: ________________________&nbsp;/&nbsp;________________/", S["sign"])]],
        colWidths=[W/2, W/2]
    )
    sign_t.setStyle(TableStyle([
        ("LEFTPADDING",  (0,0),(-1,-1), 0),
        ("RIGHTPADDING", (0,0),(-1,-1), 0),
        ("TOPPADDING",   (0,0),(-1,-1), 0),
        ("BOTTOMPADDING",(0,0),(-1,-1), 0),
    ]))
    story.append(sign_t)

    doc.build(story)
    return buf.getvalue()


# ── HANDLER ──────────────────────────────────────────────────────────────────
def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qp  = event.get("queryStringParameters") or {}
    pwd = qp.get("pwd", "")
    if pwd.lower() != os.environ.get("ADMIN_PASSWORD", "Qwert12345").lower():
        return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}

    contract_id = qp.get("contract_id")
    if not contract_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "contract_id required"})}

    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = get_db()
    cur  = conn.cursor()
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
    cur.close(); conn.close()

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
    cdn = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "pdf_url": cdn})}
