"""
Генерация PDF договора аренды оборудования.
GET /?pwd=X&contract_id=N — сгенерировать PDF, сохранить в S3, вернуть URL
Шрифт DejaVu кешируется в S3 при первом вызове.
"""
import json, os, io
from datetime import datetime
import psycopg2
import boto3
import requests

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

_FONTS_OK = False

# Источники шрифта: наш S3 → cdnjs (Roboto с кириллицей)
_FONT_SOURCES = [
    lambda key_id: f"https://cdn.poehali.dev/projects/{key_id}/bucket/fonts/font_F.ttf",
    lambda _: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf",
]
_BOLD_SOURCES = [
    lambda key_id: f"https://cdn.poehali.dev/projects/{key_id}/bucket/fonts/font_FB.ttf",
    lambda _: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf",
]


def get_s3():
    return boto3.client("s3", endpoint_url="https://bucket.poehali.dev",
                        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"])


def is_valid_ttf_bytes(data: bytes) -> bool:
    return len(data) > 1000 and data[:4] in (b"\x00\x01\x00\x00", b"OTTO", b"true", b"typ1")


def fetch_font(path_local: str, s3_key: str, sources: list):
    """Скачивает шрифт: сначала наш S3, потом внешние источники. Кеширует в S3."""
    key_id = os.environ.get("AWS_ACCESS_KEY_ID", "")
    s3 = get_s3()

    # 1. Пробуем скачать с нашего S3 (только если там валидный TTF)
    try:
        obj = s3.get_object(Bucket="files", Key=s3_key)
        data = obj["Body"].read()
        if is_valid_ttf_bytes(data):
            with open(path_local, "wb") as f:
                f.write(data)
            return
        # В S3 лежит мусор — удаляем
        try:
            s3.delete_object(Bucket="files", Key=s3_key)
        except Exception:
            pass
    except Exception:
        pass

    # 2. Пробуем внешние источники
    for source_fn in sources:
        url = source_fn(key_id)
        try:
            resp = requests.get(url, timeout=20, headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/octet-stream, */*",
            })
            if resp.status_code == 200 and is_valid_ttf_bytes(resp.content):
                with open(path_local, "wb") as f:
                    f.write(resp.content)
                # Кешируем в S3
                try:
                    s3.put_object(Bucket="files", Key=s3_key,
                                  Body=resp.content, ContentType="font/ttf")
                except Exception:
                    pass
                return
        except Exception:
            continue

    raise RuntimeError(f"Не удалось загрузить TTF шрифт. Все источники недоступны.")


def is_valid_ttf(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            return is_valid_ttf_bytes(f.read())
    except Exception:
        return False


def ensure_fonts():
    global _FONTS_OK
    if _FONTS_OK:
        return
    for name, local, s3key, sources in [
        ("F",  "/tmp/font_F.ttf",  "fonts/font_F.ttf",  _FONT_SOURCES),
        ("FB", "/tmp/font_FB.ttf", "fonts/font_FB.ttf", _BOLD_SOURCES),
    ]:
        # Удаляем невалидный кеш
        if os.path.exists(local) and not is_valid_ttf(local):
            os.remove(local)
        if not os.path.exists(local):
            fetch_font(local, s3key, sources)
        pdfmetrics.registerFont(TTFont(name, local))
    _FONTS_OK = True


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def fn(n: int) -> str:
    return f"{n:,}".replace(",", "\u00a0")


def fmt_date(d: str) -> str:
    if not d:
        return "«___» ___________ _____ г."
    try:
        dt = datetime.strptime(d.strip(), "%Y-%m-%d")
        months = ["января","февраля","марта","апреля","мая","июня",
                  "июля","августа","сентября","октября","ноября","декабря"]
        return f"«{dt.day:02d}» {months[dt.month-1]} {dt.year} г."
    except Exception:
        return d


def money_words(amount: int) -> str:
    ones_f = ["","одна","две","три","четыре","пять","шесть","семь","восемь","девять",
              "десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать",
              "шестнадцать","семнадцать","восемнадцать","девятнадцать"]
    ones_m = ["","один","два","три","четыре","пять","шесть","семь","восемь","девять",
              "десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать",
              "шестнадцать","семнадцать","восемнадцать","девятнадцать"]
    tens  = ["","десять","двадцать","тридцать","сорок","пятьдесят",
             "шестьдесят","семьдесят","восемьдесят","девяносто"]
    hunds = ["","сто","двести","триста","четыреста","пятьсот",
             "шестьсот","семьсот","восемьсот","девятьсот"]
    def chunk(n, female=False):
        p = []
        h, t = n // 100, n % 100
        if h: p.append(hunds[h])
        if t >= 20:
            p.append(tens[t // 10])
            r = t % 10
            if r: p.append((ones_f if female else ones_m)[r])
        elif t:
            p.append((ones_f if female else ones_m)[t])
        return p
    n = int(amount)
    if n == 0:
        return "ноль рублей 00 копеек"
    parts = []
    mil = n // 1_000_000
    tho = (n % 1_000_000) // 1000
    rem = n % 1000
    if mil:
        p = chunk(mil)
        last = mil % 10
        suf = "миллионов" if mil%100 in range(11,20) else ("миллион" if last==1 else "миллиона" if last in(2,3,4) else "миллионов")
        parts += p + [suf]
    if tho:
        p = chunk(tho, female=True)
        last = tho % 10
        suf = "тысяч" if tho%100 in range(11,20) else ("тысяча" if last==1 else "тысячи" if last in(2,3,4) else "тысяч")
        parts += p + [suf]
    if rem:
        parts += chunk(rem)
    words = " ".join(x for x in parts if x)
    return f"{amount:,} ({words}) рублей 00 копеек".replace(",", "\u00a0")


def build_pdf(contract: dict, quote: dict, company_reqs: dict = None, tpl: dict = None, is_preview: bool = False) -> bytes:
    ensure_fonts()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=25*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=20*mm)

    F, FB = "F", "FB"
    BK = colors.HexColor("#111111")
    GR = colors.HexColor("#666666")
    AM = colors.HexColor("#92400e")

    def S(name, **kw):
        d = dict(fontName=F, fontSize=9, leading=14, textColor=BK, spaceAfter=0)
        d.update(kw)
        return ParagraphStyle(name, **d)

    Ss = {
        "title":  S("title",  fontName=FB, fontSize=13, alignment=TA_CENTER, leading=18),
        "sub":    S("sub",    fontSize=9,  alignment=TA_CENTER, textColor=GR),
        "h2":     S("h2",     fontName=FB, fontSize=9, textColor=AM),
        "body":   S("body",   fontSize=8.5, alignment=TA_JUSTIFY, leading=13),
        "bodyL":  S("bodyL",  fontSize=8.5, leading=13),
        "center": S("center", fontSize=8.5, alignment=TA_CENTER, leading=13),
        "small":  S("small",  fontSize=8,  textColor=GR, leading=12),
        "smallB": S("smallB", fontName=FB, fontSize=8, leading=12),
        "bold":   S("bold",   fontName=FB, fontSize=8.5, leading=13),
        "boldC":  S("boldC",  fontName=FB, fontSize=8.5, alignment=TA_CENTER, leading=13),
        "right":  S("right",  fontSize=8.5, alignment=TA_RIGHT, leading=13),
        "boldR":  S("boldR",  fontName=FB, fontSize=8.5, alignment=TA_RIGHT, leading=13),
        "sign":   S("sign",   fontSize=8.5, textColor=GR, leading=13),
    }

    today = datetime.now()
    num   = f"А-{contract['id']:04d}"
    ctype = contract.get("client_type", "individual")

    if ctype == "individual":
        cname  = contract.get("full_name") or "_______________"
        clabel = "Физическое лицо"
        creq   = [
            ("Паспорт", f"{contract.get('passport_series') or '____'} {contract.get('passport_number') or '______'}"),
            ("Выдан", contract.get("passport_issued") or "_______________"),
            ("Дата выдачи", fmt_date(contract.get("passport_date") or "")),
            ("Дата рождения", fmt_date(contract.get("birth_date") or "")),
            ("Адрес", contract.get("address") or "_______________"),
        ]
    else:
        company  = contract.get("company_name") or "_______________"
        inn      = contract.get("inn") or "_______________"
        kpp      = contract.get("kpp") or ""
        ogrn     = contract.get("ogrn") or "_______________"
        la       = contract.get("legal_address") or "_______________"
        director = contract.get("director") or "_______________"
        cname    = company
        clabel   = "Юридическое лицо"
        creq     = [
            ("ИНН", inn + (f" / КПП: {kpp}" if kpp else "")),
            ("ОГРН", ogrn),
            ("Юр. адрес", la),
            ("Директор", director),
        ]

    phone    = contract.get("phone") or "_______________"
    email    = contract.get("email") or "_______________"
    items       = quote.get("items") or []
    extras      = quote.get("extras") or []
    days        = int(quote.get("days") or 1)
    delivery    = quote.get("delivery") or "Без доставки"
    deliv_p     = int(quote.get("delivery_price") or 0)
    total       = int(quote.get("total") or 0)
    qtitle      = quote.get("title") or "Аренда оборудования"
    ev_date     = quote.get("event_date") or ""
    ev_addr     = quote.get("delivery_address") or ""
    inst_time       = quote.get("installation_time") or ""
    inst_price      = int(quote.get("installation_price") or 0)
    dis_time        = quote.get("dismantling_time") or ""
    dis_price       = int(quote.get("dismantling_price") or 0)
    no_install      = bool(quote.get("no_installation", False))
    delivery_time   = quote.get("delivery_time") or ""
    pickup_time     = quote.get("pickup_time") or ""
    discount_pct    = int(quote.get("discount") or 0)

    days_str   = "1 (один) календарный день" if days == 1 else f"{days} календарных {'дня' if days in (2,3,4) else 'дней'}"
    event_str  = fmt_date(ev_date) if ev_date else "по согласованию Сторон"
    addr_str   = ev_addr if ev_addr else "по адресу, согласованному Сторонами"
    deliv_str  = delivery if delivery and delivery != "Без доставки" else "самовывоз"

    W = doc.width
    story = []

    # Шапка
    story.append(Paragraph("ДОГОВОР АРЕНДЫ ОБОРУДОВАНИЯ", Ss["title"]))
    story.append(Spacer(1, 1*mm))
    story.append(Paragraph(f"&#8470;&nbsp;{num}", Ss["sub"]))
    story.append(Spacer(1, 5*mm))
    loc = Table([[Paragraph("г. Москва", Ss["body"]),
                  Paragraph(f"&laquo;&nbsp;&nbsp;&nbsp;&raquo; _______________ {today.year}&nbsp;г.", Ss["right"])]],
                colWidths=[W/2, W/2])
    loc.setStyle(TableStyle([("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
                              ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)]))
    story.append(loc)
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph(
        f'<b>ООО &laquo;Global Renta&raquo;</b>, именуемое далее <b>&laquo;Арендодатель&raquo;</b>, '
        f'и <b>{cname}</b> ({clabel}), именуемый(-ая) далее <b>&laquo;Арендатор&raquo;</b>, '
        f'заключили настоящий Договор о нижеследующем:', Ss["body"]))
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 3*mm))

    def section(n, title, *paras):
        block = [Paragraph(f"{n}. {title}", Ss["h2"]), Spacer(1, 1.5*mm)]
        for p in paras:
            block.append(Paragraph(p, Ss["body"]))
            block.append(Spacer(1, 1*mm))
        block.append(Spacer(1, 2*mm))
        story.append(KeepTogether(block))

    # Строим параграфы раздела 1 динамически
    s1_paras = [
        "1.1. Арендодатель предоставляет Арендатору во временное пользование оборудование согласно Приложению &numero;1.",
        f"1.2. Назначение: <b>{qtitle}</b>.",
        f"1.3. Дата мероприятия: <b>{event_str}</b>.",
        f"1.4. Адрес: <b>{addr_str}</b>.",
        f"1.5. Доставка: <b>{deliv_str}</b>.",
    ]
    pnum = 6
    if delivery_time:
        s1_paras.append(f"1.{pnum}. Время привоза оборудования: <b>{delivery_time}</b>.")
        pnum += 1
    if pickup_time:
        s1_paras.append(f"1.{pnum}. Время увоза оборудования: <b>{pickup_time}</b>.")
        pnum += 1
    if no_install:
        s1_paras.append(f"1.{pnum}. Монтаж и демонтаж оборудования: <b>не требуются</b>.")
        pnum += 1
    elif inst_time or dis_time:
        if inst_time:
            s1_paras.append(f"1.{pnum}. Время монтажа: <b>{inst_time}</b>.")
            pnum += 1
        if dis_time:
            s1_paras.append(f"1.{pnum}. Время демонтажа: <b>{dis_time}</b>.")
            pnum += 1
    s1_paras.append(f"1.{pnum}. Срок аренды: <b>{days_str}</b>.")

    section("1", "ПРЕДМЕТ ДОГОВОРА", *s1_paras)

    t = tpl or {}
    def tpl_extra(key):
        v = t.get(key, "").strip()
        return [v] if v else []

    disc_note = f" (с учётом скидки {discount_pct}%)" if discount_pct > 0 else ""
    section("2", "СТОИМОСТЬ И ПОРЯДОК РАСЧЁТОВ",
        f"2.1. Общая стоимость аренды{disc_note}: <b>{money_words(total)}</b>.",
        "2.2. Оплата производится до начала срока аренды путём безналичного перечисления.",
        *tpl_extra("section_2_extra"),
    )
    section("3", "ПРАВА И ОБЯЗАННОСТИ СТОРОН",
        "3.1. Арендодатель передаёт Оборудование в исправном состоянии и обеспечивает доставку при наличии в Приложении &numero;1.",
        "3.2. Арендатор использует Оборудование по назначению, обеспечивает сохранность и возвращает в срок.",
        "3.3. Арендатор не вправе передавать Оборудование третьим лицам без согласия Арендодателя.",
        *tpl_extra("section_3_extra"),
    )
    section("4", "ОТВЕТСТВЕННОСТЬ",
        "4.1. При просрочке возврата — неустойка 0,5% от суммы Договора за каждый день.",
        "4.2. При повреждении или утрате — полная рыночная стоимость Оборудования.",
        "4.3. Форс-мажор освобождает Стороны от ответственности.",
        *tpl_extra("section_4_extra"),
    )
    section("5", "ПРОЧИЕ УСЛОВИЯ",
        "5.1. Договор вступает в силу с момента подписания.",
        "5.2. Споры — переговоры, затем суд по месту Арендодателя.",
        "5.3. Два равных экземпляра.",
        *tpl_extra("section_5_extra"),
    )

    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("6. РЕКВИЗИТЫ И ПОДПИСИ", Ss["h2"]))
    story.append(Spacer(1, 3*mm))

    def make_col(title_text, rows, with_stamp=False):
        col = [Paragraph(title_text, Ss["smallB"]), Spacer(1, 2*mm)]
        for label, val in rows:
            col.append(Paragraph(f'<font color="#666">{label}:</font> {val}', Ss["small"]))
        col.append(Spacer(1, 5*mm))
        col.append(Paragraph("Подпись: _____________________", Ss["sign"]))
        if with_stamp:
            col.append(Spacer(1, 2*mm))
            col.append(Paragraph("М.П.", Ss["small"]))
        return col

    cr = company_reqs or {}
    arend_rows = [
        ("Организация", cr.get("company_name") or "ООО &laquo;Global Renta&raquo;"),
    ]
    if cr.get("company_inn"):
        arend_rows.append(("ИНН", cr["company_inn"] + (f" / КПП: {cr['company_kpp']}" if cr.get("company_kpp") else "")))
    if cr.get("company_ogrn"):
        arend_rows.append(("ОГРН", cr["company_ogrn"]))
    if cr.get("company_address"):
        arend_rows.append(("Адрес", cr["company_address"]))
    if cr.get("company_bank"):
        arend_rows.append(("Банк", cr["company_bank"]))
    if cr.get("company_bik"):
        arend_rows.append(("БИК", cr["company_bik"]))
    if cr.get("company_rs"):
        arend_rows.append(("Р/с", cr["company_rs"]))
    if cr.get("company_ks"):
        arend_rows.append(("К/с", cr["company_ks"]))
    if cr.get("company_email"):
        arend_rows.append(("Email", cr["company_email"]))
    if cr.get("company_phone"):
        arend_rows.append(("Тел.", cr["company_phone"]))
    arend_col = make_col("АРЕНДОДАТЕЛЬ", arend_rows, with_stamp=True)

    client_col = make_col("АРЕНДАТОР",
        [("Наименование", f"<b>{cname}</b>"), ("Тип", clabel)] + creq +
        [("Тел.", phone), ("Email", email)],
        with_stamp=(ctype == "company")
    )

    req_t = Table([[arend_col, client_col]], colWidths=[W/2 - 3*mm, W/2 + 3*mm])
    req_t.setStyle(TableStyle([
        ("VALIGN",        (0,0),(-1,-1), "TOP"),
        ("LEFTPADDING",   (0,0),(-1,-1), 0),
        ("RIGHTPADDING",  (0,0),(0,-1),  6),
        ("TOPPADDING",    (0,0),(-1,-1), 0),
        ("BOTTOMPADDING", (0,0),(-1,-1), 0),
        ("LINEAFTER",     (0,0),(0,-1),  0.5, colors.HexColor("#cccccc")),
        ("LEFTPADDING",   (1,0),(1,-1),  8),
    ]))
    story.append(req_t)

    # Приложение №1
    story.append(Spacer(1, 8*mm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=AM))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(f"ПРИЛОЖЕНИЕ &numero;1 к Договору &numero;&nbsp;{num}", Ss["sub"]))
    story.append(Spacer(1, 1*mm))
    story.append(Paragraph("ПЕРЕЧЕНЬ ОБОРУДОВАНИЯ И УСЛУГ", Ss["title"]))
    story.append(Spacer(1, 4*mm))

    CW = [8*mm, 77*mm, 14*mm, 22*mm, 13*mm, 22*mm]
    rows = [[Paragraph("&numero;", Ss["boldC"]),
             Paragraph("Наименование", Ss["bold"]),
             Paragraph("Кол-во", Ss["boldC"]),
             Paragraph("Цена/ед., руб.", Ss["boldC"]),
             Paragraph("Дней", Ss["boldC"]),
             Paragraph("Сумма, руб.", Ss["boldR"])]]

    equip_raw_total = 0
    for i, item in enumerate(items, 1):
        pr = int(item.get("price") or 0)
        qt = int(item.get("qty") or 1)
        st = pr * qt * days
        equip_raw_total += st
        rows.append([
            Paragraph(str(i),                   Ss["center"]),
            Paragraph(item.get("name") or "—",  Ss["bodyL"]),
            Paragraph(str(qt),                  Ss["center"]),
            Paragraph(fn(pr),                   Ss["right"]),
            Paragraph(str(days),                Ss["center"]),
            Paragraph(fn(st),                   Ss["right"]),
        ])

    # Строка скидки
    if discount_pct > 0:
        discount_sum = round(equip_raw_total * discount_pct / 100)
        rows.append([
            Paragraph("—",                                       Ss["center"]),
            Paragraph(f"Скидка {discount_pct}% на оборудование", Ss["bodyL"]),
            Paragraph("",                                        Ss["center"]),
            Paragraph("",                                        Ss["right"]),
            Paragraph("",                                        Ss["center"]),
            Paragraph(f"−{fn(discount_sum)}",                    Ss["right"]),
        ])

    if no_install:
        rows.append([
            Paragraph("—",                               Ss["center"]),
            Paragraph("Монтаж и демонтаж",               Ss["bodyL"]),
            Paragraph("",                                Ss["center"]),
            Paragraph("",                                Ss["right"]),
            Paragraph("",                                Ss["center"]),
            Paragraph("не требуется",                    Ss["right"]),
        ])

    if extras:
        rows.append([Paragraph("", Ss["body"])] * 6)
        for ex in extras:
            ep = int(ex.get("price") or 0)
            rows.append([
                Paragraph("—",                      Ss["center"]),
                Paragraph(ex.get("name") or "—",    Ss["bodyL"]),
                Paragraph("1",                      Ss["center"]),
                Paragraph(fn(ep),                   Ss["right"]),
                Paragraph("—",                      Ss["center"]),
                Paragraph(fn(ep),                   Ss["right"]),
            ])

    if deliv_p > 0:
        rows.append([
            Paragraph("—",                          Ss["center"]),
            Paragraph(f"Доставка: {delivery}",      Ss["bodyL"]),
            Paragraph("1",                          Ss["center"]),
            Paragraph(fn(deliv_p),                  Ss["right"]),
            Paragraph("—",                          Ss["center"]),
            Paragraph(fn(deliv_p),                  Ss["right"]),
        ])

    if inst_time or inst_price > 0:
        label = f"Монтаж оборудования" + (f": {inst_time}" if inst_time else "")
        rows.append([
            Paragraph("—",              Ss["center"]),
            Paragraph(label,            Ss["bodyL"]),
            Paragraph("1",              Ss["center"]),
            Paragraph(fn(inst_price),   Ss["right"]),
            Paragraph("—",              Ss["center"]),
            Paragraph(fn(inst_price),   Ss["right"]),
        ])

    if dis_time or dis_price > 0:
        label = f"Демонтаж оборудования" + (f": {dis_time}" if dis_time else "")
        rows.append([
            Paragraph("—",             Ss["center"]),
            Paragraph(label,           Ss["bodyL"]),
            Paragraph("1",             Ss["center"]),
            Paragraph(fn(dis_price),   Ss["right"]),
            Paragraph("—",             Ss["center"]),
            Paragraph(fn(dis_price),   Ss["right"]),
        ])

    rows.append([
        Paragraph("", Ss["body"]),
        Paragraph("ИТОГО:", Ss["bold"]),
        Paragraph("", Ss["body"]),
        Paragraph("", Ss["body"]),
        Paragraph("", Ss["body"]),
        Paragraph(fn(total), Ss["boldR"]),
    ])

    tbl = Table(rows, colWidths=CW, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,0),   colors.HexColor("#fef3c7")),
        ("LINEBELOW",     (0,0),(-1,0),   1, AM),
        ("GRID",          (0,1),(-1,-2),  0.3, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS",(0,1),(-1,-2),  [colors.white, colors.HexColor("#fafafa")]),
        ("LINEABOVE",     (0,-1),(-1,-1), 1, AM),
        ("BACKGROUND",    (0,-1),(-1,-1), colors.HexColor("#fffbeb")),
        ("TOPPADDING",    (0,0),(-1,-1),  4),
        ("BOTTOMPADDING", (0,0),(-1,-1),  4),
        ("LEFTPADDING",   (0,0),(-1,-1),  4),
        ("RIGHTPADDING",  (0,0),(-1,-1),  4),
        ("VALIGN",        (0,0),(-1,-1),  "MIDDLE"),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(f"<b>Итого по Договору:</b> {money_words(total)}.", Ss["body"]))
    story.append(Spacer(1, 8*mm))

    # Подписи
    pep_uid          = contract.get("pep_uid") or ""
    signed_at        = contract.get("signed_at")
    manager_signed_at = contract.get("manager_signed_at")
    manager_name_val  = contract.get("manager_name") or ""

    sign_date = ""
    if signed_at:
        try:
            sign_date = signed_at.strftime("%d.%m.%Y %H:%M UTC") if hasattr(signed_at, "strftime") else str(signed_at)[:16]
        except Exception:
            sign_date = str(signed_at)[:16]

    mgr_date = ""
    if manager_signed_at:
        try:
            mgr_date = manager_signed_at.strftime("%d.%m.%Y %H:%M UTC") if hasattr(manager_signed_at, "strftime") else str(manager_signed_at)[:16]
        except Exception:
            mgr_date = str(manager_signed_at)[:16]

    if is_preview:
        # Левая — арендодатель с пустыми полями
        left_parts = ["Арендодатель: _____________________________",
                      "<font color='#888'>М.П.</font>"]
        # Правая — арендатор с пустыми полями
        right_parts = [f"Арендатор: {cname}",
                       "Подпись: _____________________________",
                       "<font color='#888'>(будет заполнено после подписания)</font>"]
    else:
        # Арендодатель
        if manager_signed_at and manager_name_val:
            left_parts = [
                f"Арендодатель: <b>{cr.get('company_name','ООО Global Renta')}</b>",
                f"От имени: <b>{manager_name_val}</b>",
                f"Подписано: {mgr_date}",
                "<font color='#888'>М.П.</font>",
            ]
        else:
            left_parts = [
                f"Арендодатель: <b>{cr.get('company_name','ООО Global Renta')}</b>",
                "Подпись: _____________________________",
                "<font color='#888'>М.П.</font>",
            ]
        # Арендатор
        if signed_at:
            right_parts = [
                f"Арендатор: <b>{cname}</b>",
                f"Email: {email}",
                f"<b>ПЭП подписан: {sign_date}</b>",
                "Подпись подтверждена кодом на email",
            ]
            if pep_uid:
                right_parts.append(f"<font color='#888'>ID подписи: {pep_uid}</font>")
        else:
            right_parts = [f"Арендатор: {cname}", "Подпись: _____________________________"]

    sign = Table(
        [[Paragraph("<br/>".join(left_parts), Ss["sign"]),
          Paragraph("<br/>".join(right_parts), Ss["sign"])]],
        colWidths=[W/2, W/2]
    )
    sign.setStyle(TableStyle([("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
                               ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
                               ("VALIGN",(0,0),(-1,-1),"TOP")]))
    story.append(sign)

    # Водяной знак ЧЕРНОВИК для preview
    if is_preview:
        story.append(Spacer(1, 4*mm))
        story.append(Paragraph(
            "<font color='#cc0000'><b>ЧЕРНОВИК — только для ознакомления. Документ не является подписанным.</b></font>",
            Ss["small"]
        ))

    # Блок ПЭП если договор подписан
    if signed_at and not is_preview:
        story.append(Spacer(1, 6*mm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")))
        story.append(Spacer(1, 3*mm))
        pep_lines = [
            f"<b>Документ подписан простой электронной подписью (ПЭП)</b> в соответствии с ФЗ № 63-ФЗ «Об электронной подписи».",
            f"Подписант (Арендатор): {cname} &lt;{email}&gt;.",
            f"Дата и время подписания: {sign_date}.",
            f"Метод: подтверждение одноразового кода, направленного на email подписанта.",
        ]
        if pep_uid:
            pep_lines.append(f"<b>Уникальный идентификатор ПЭП: {pep_uid}</b>")
        if manager_signed_at and manager_name_val:
            pep_lines.append(f"Арендодатель ({manager_name_val}) подписал: {mgr_date}.")
        elif not manager_signed_at:
            pep_lines.append("Подпись Арендодателя: ожидается.")
        for line in pep_lines:
            story.append(Paragraph(line, Ss["small"]))
            story.append(Spacer(1, 1*mm))

    doc.build(story)
    return buf.getvalue()


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

    is_preview = qp.get("preview", "") == "1"
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn   = get_db()
    cur    = conn.cursor()
    cur.execute(
        f"""SELECT c.id, c.quote_id, c.client_type,
            c.full_name, c.passport_series, c.passport_number, c.passport_issued,
            c.passport_date, c.birth_date, c.address,
            c.company_name, c.inn, c.kpp, c.ogrn, c.legal_address, c.director,
            c.phone, c.email,
            q.title, q.items, q.days, q.delivery, q.delivery_price, q.extras, q.total,
            q.event_date, q.delivery_address,
            q.installation_time, q.installation_price, q.dismantling_time, q.dismantling_price,
            q.no_installation, q.delivery_time, q.pickup_time, q.discount,
            c.signed_at, c.pep_uid, c.manager_signed_at, c.manager_name
        FROM {schema}.contracts c
        JOIN {schema}.quotes q ON q.id = c.quote_id
        WHERE c.id = %s""",
        (int(contract_id),)
    )
    row = cur.fetchone()

    if not row:
        cur.close(); conn.close()
        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}

    keys_c = ["id","quote_id","client_type","full_name","passport_series","passport_number",
              "passport_issued","passport_date","birth_date","address",
              "company_name","inn","kpp","ogrn","legal_address","director","phone","email"]
    keys_q = ["title","items","days","delivery","delivery_price","extras","total",
              "event_date","delivery_address",
              "installation_time","installation_price","dismantling_time","dismantling_price",
              "no_installation","delivery_time","pickup_time","discount"]
    keys_extra = ["signed_at","pep_uid","manager_signed_at","manager_name"]
    data     = dict(zip(keys_c + keys_q + keys_extra, row))
    contract = {k: data[k] for k in keys_c}
    quote    = {k: data[k] for k in keys_q}
    for k in keys_extra:
        contract[k] = data.get(k)
    for f in ("items", "extras"):
        if isinstance(quote[f], str):
            quote[f] = json.loads(quote[f])

    # Читаем реквизиты компании из settings
    cur.execute(
        f"SELECT key, value FROM {schema}.settings WHERE key LIKE 'company_%%'"
    )
    company_reqs = {r[0]: r[1] for r in cur.fetchall()}

    # Читаем шаблон договора
    cur.execute(f"SELECT section, content FROM {schema}.contract_template ORDER BY section")
    tpl = {r[0]: r[1] for r in cur.fetchall()}

    # Генерируем уникальный UID ПЭП если нет
    pep_uid = contract.get("pep_uid")
    if not pep_uid and contract.get("signed_at") and not is_preview:
        import hashlib
        uid_src = f"{contract['id']}-{contract.get('email','')}-{str(contract.get('signed_at',''))}"
        pep_uid = "PEP-" + hashlib.sha256(uid_src.encode()).hexdigest()[:16].upper()
        cur.execute(f"UPDATE {schema}.contracts SET pep_uid=%s WHERE id=%s", (pep_uid, contract["id"]))
        conn.commit()
    contract["pep_uid"] = pep_uid

    pdf_bytes = build_pdf(contract, quote, company_reqs=company_reqs, tpl=tpl, is_preview=is_preview)

    if is_preview:
        key = f"contracts/preview_{contract['id']:04d}.pdf"
    else:
        key = f"contracts/contract_{contract['id']:04d}.pdf"
    s3  = get_s3()
    s3.put_object(Bucket="files", Key=key, Body=pdf_bytes, ContentType="application/pdf")
    cdn = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

    # Сохраняем URL PDF в контракте (только финальный, не превью)
    if not is_preview:
        cur.execute(f"UPDATE {schema}.contracts SET contract_pdf_url=%s WHERE id=%s", (cdn, contract["id"]))
        conn.commit()
    cur.close(); conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "pdf_url": cdn})}