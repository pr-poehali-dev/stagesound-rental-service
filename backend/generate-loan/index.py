"""
Генерация PDF договора займа.
GET /?pwd=X&loan_id=N — сгенерировать PDF, сохранить в S3, вернуть URL.
Займодавец — реквизиты компании из settings (company_*).
Заёмщик — реквизиты из строки loans.
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
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
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
    key_id = os.environ.get("AWS_ACCESS_KEY_ID", "")
    s3 = get_s3()
    try:
        obj = s3.get_object(Bucket="files", Key=s3_key)
        data = obj["Body"].read()
        if is_valid_ttf_bytes(data):
            with open(path_local, "wb") as f:
                f.write(data)
            return
    except Exception:
        pass
    for source_fn in sources:
        url = source_fn(key_id)
        try:
            resp = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200 and is_valid_ttf_bytes(resp.content):
                with open(path_local, "wb") as f:
                    f.write(resp.content)
                try:
                    s3.put_object(Bucket="files", Key=s3_key, Body=resp.content, ContentType="font/ttf")
                except Exception:
                    pass
                return
        except Exception:
            continue
    raise RuntimeError("Не удалось загрузить TTF шрифт.")


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
        ("F", "/tmp/font_F.ttf", "fonts/font_F.ttf", _FONT_SOURCES),
        ("FB", "/tmp/font_FB.ttf", "fonts/font_FB.ttf", _BOLD_SOURCES),
    ]:
        if os.path.exists(local) and not is_valid_ttf(local):
            os.remove(local)
        if not os.path.exists(local):
            fetch_font(local, s3key, sources)
        pdfmetrics.registerFont(TTFont(name, local))
    _FONTS_OK = True


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def fmt_date(d: str) -> str:
    if not d:
        return "«___» ___________ _____ г."
    try:
        dt = datetime.strptime(str(d).strip()[:10], "%Y-%m-%d")
        months = ["января", "февраля", "марта", "апреля", "мая", "июня",
                  "июля", "августа", "сентября", "октября", "ноября", "декабря"]
        return f"«{dt.day:02d}» {months[dt.month-1]} {dt.year} г."
    except Exception:
        return str(d)


def money_words(amount) -> str:
    ones_f = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять",
              "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать",
              "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"]
    ones_m = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять",
              "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать",
              "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"]
    tens = ["", "десять", "двадцать", "тридцать", "сорок", "пятьдесят",
            "шестьдесят", "семьдесят", "восемьдесят", "девяносто"]
    hunds = ["", "сто", "двести", "триста", "четыреста", "пятьсот",
             "шестьсот", "семьсот", "восемьсот", "девятьсот"]

    def chunk(n, female=False):
        p = []
        h, t = n // 100, n % 100
        if h:
            p.append(hunds[h])
        if t >= 20:
            p.append(tens[t // 10])
            r = t % 10
            if r:
                p.append((ones_f if female else ones_m)[r])
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
        suf = "миллионов" if mil % 100 in range(11, 20) else ("миллион" if last == 1 else "миллиона" if last in (2, 3, 4) else "миллионов")
        parts += p + [suf]
    if tho:
        p = chunk(tho, female=True)
        last = tho % 10
        suf = "тысяч" if tho % 100 in range(11, 20) else ("тысяча" if last == 1 else "тысячи" if last in (2, 3, 4) else "тысяч")
        parts += p + [suf]
    if rem:
        parts += chunk(rem)
    words = " ".join(x for x in parts if x)
    return f"{n:,} ({words}) рублей 00 копеек".replace(",", "\u00a0")


def fn(n) -> str:
    return f"{int(n):,}".replace(",", "\u00a0")


def build_loan_pdf(loan: dict, company: dict) -> bytes:
    ensure_fonts()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=25*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=20*mm)
    F, FB = "F", "FB"
    BK = colors.HexColor("#111111")
    GR = colors.HexColor("#666666")
    AM = colors.HexColor("#92400e")

    def St(name, **kw):
        d = dict(fontName=F, fontSize=9, leading=14, textColor=BK, spaceAfter=0)
        d.update(kw)
        return ParagraphStyle(name, **d)

    Ss = {
        "title": St("title", fontName=FB, fontSize=13, alignment=TA_CENTER, leading=18),
        "sub":   St("sub", fontSize=9, alignment=TA_CENTER, textColor=GR),
        "h2":    St("h2", fontName=FB, fontSize=9, textColor=AM, spaceAfter=3),
        "body":  St("body", fontSize=8.5, alignment=TA_JUSTIFY, leading=13, spaceAfter=3),
        "small": St("small", fontSize=8, textColor=GR, leading=12),
        "bold":  St("bold", fontName=FB, fontSize=8.5, leading=13),
        "right": St("right", fontSize=8.5, alignment=TA_RIGHT, leading=13),
        "body2": St("body2", fontSize=8, leading=12),
    }

    W = doc.width
    today = datetime.now()

    # Номер и дата
    custom_num = (loan.get("doc_number") or "").strip()
    num = custom_num if custom_num else f"З-{loan['id']:04d}"
    issue = loan.get("issue_date")
    if issue:
        try:
            _d = datetime.strptime(str(issue)[:10], "%Y-%m-%d")
            months = ["января", "февраля", "марта", "апреля", "мая", "июня",
                      "июля", "августа", "сентября", "октября", "ноября", "декабря"]
            date_hdr = f"«{_d.day:02d}» {months[_d.month-1]} {_d.year} г."
        except Exception:
            date_hdr = f"«___» ___________ {today.year} г."
    else:
        date_hdr = f"«___» ___________ {today.year} г."

    amount = int(round(float(loan.get("amount") or 0)))
    rate = float(loan.get("interest_rate") or 0)
    return_str = fmt_date(loan.get("return_date"))

    # Займодавец (компания)
    lender_name = company.get("company_name") or "Займодавец"
    lender_city = company.get("company_city") or "г. Санкт-Петербург"
    lender_inn = company.get("company_inn") or ""
    lender_ogrn = company.get("company_ogrn") or ""
    lender_addr = company.get("company_address") or ""
    lender_bank = company.get("company_bank") or ""
    lender_bik = company.get("company_bik") or ""
    lender_rs = company.get("company_rs") or ""
    lender_ks = company.get("company_ks") or ""
    lender_phone = company.get("company_phone") or ""
    lender_email = company.get("company_email") or ""

    # Заёмщик
    btype = loan.get("borrower_type", "individual")
    if btype == "individual":
        b_name = loan.get("full_name") or "_______________"
        b_reqs = [
            ("Паспорт", f"{loan.get('passport_series') or '____'} {loan.get('passport_number') or '______'}"),
            ("Выдан", loan.get("passport_issued") or "—"),
            ("Дата выдачи", fmt_date(loan.get("passport_date") or "")),
            ("Дата рождения", fmt_date(loan.get("birth_date") or "")),
            ("Адрес регистрации", loan.get("address") or "—"),
        ]
        b_label = "физическое лицо"
    else:
        b_name = loan.get("company_name") or "_______________"
        kpp = loan.get("kpp") or ""
        b_reqs = [
            ("ИНН", (loan.get("inn") or "—") + (f" / КПП: {kpp}" if kpp else "")),
            ("ОГРН", loan.get("ogrn") or "—"),
            ("Юр. адрес", loan.get("legal_address") or "—"),
            ("Директор", loan.get("director") or "—"),
        ]
        b_label = "юридическое лицо"
    b_phone = loan.get("phone") or "—"
    b_email = loan.get("email") or "—"

    story = []
    story.append(Paragraph("ДОГОВОР ЗАЙМА", Ss["title"]))
    story.append(Spacer(1, 1*mm))
    story.append(Paragraph(f"№&nbsp;{num}", Ss["sub"]))
    story.append(Spacer(1, 4*mm))
    loc = Table([[Paragraph(lender_city, Ss["body"]), Paragraph(date_hdr, Ss["right"])]],
                colWidths=[W/2, W/2])
    loc.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                             ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    story.append(loc)
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph(
        f'<b>{lender_name}</b>, именуемый(-ая) далее <b>«Займодавец»</b>, с одной стороны, '
        f'и <b>{b_name}</b> ({b_label}), именуемый(-ая) далее <b>«Заёмщик»</b>, с другой стороны, '
        f'а вместе именуемые «Стороны», заключили настоящий Договор о нижеследующем:', Ss["body"]))
    story.append(Spacer(1, 3*mm))

    # 1. Предмет
    story.append(Paragraph("1. ПРЕДМЕТ ДОГОВОРА", Ss["h2"]))
    story.append(Paragraph(
        f'1.1. Займодавец передаёт в собственность Заёмщику денежные средства в размере '
        f'<b>{money_words(amount)}</b>, а Заёмщик обязуется вернуть Займодавцу сумму займа '
        f'в срок и в порядке, установленные настоящим Договором.', Ss["body"]))
    if rate > 0:
        rate_str = str(int(rate)) if rate == int(rate) else str(rate)
        story.append(Paragraph(
            f'1.2. За пользование займом Заёмщик уплачивает Займодавцу проценты из расчёта '
            f'<b>{rate_str}%</b> годовых, начисляемых на сумму займа со дня, следующего за днём '
            f'передачи суммы займа, по день фактического возврата займа включительно.', Ss["body"]))
    else:
        story.append(Paragraph(
            '1.2. Заём является беспроцентным. Проценты за пользование суммой займа не начисляются '
            'и не уплачиваются.', Ss["body"]))
    story.append(Paragraph(
        f'1.3. Сумма займа предоставляется на срок до <b>{return_str}</b>', Ss["body"]))

    # 2. Порядок передачи и возврата
    story.append(Paragraph("2. ПОРЯДОК ПЕРЕДАЧИ И ВОЗВРАТА ЗАЙМА", Ss["h2"]))
    story.append(Paragraph(
        '2.1. Сумма займа передаётся Заёмщику путём выдачи наличных денежных средств либо '
        'перечисления на банковский счёт Заёмщика. Датой предоставления займа считается дата '
        'выдачи наличных денежных средств или дата зачисления суммы займа на счёт Заёмщика.', Ss["body"]))
    story.append(Paragraph(
        f'2.2. Заёмщик обязуется возвратить сумму займа{" и начисленные проценты" if rate > 0 else ""} '
        f'в срок, указанный в п. 1.3 настоящего Договора. Заём может быть возвращён досрочно, '
        f'полностью или частично.', Ss["body"]))
    story.append(Paragraph(
        '2.3. Датой возврата займа считается дата поступления денежных средств Займодавцу '
        '(в кассу либо на банковский счёт).', Ss["body"]))

    # 3. Ответственность
    story.append(Paragraph("3. ОТВЕТСТВЕННОСТЬ СТОРОН", Ss["h2"]))
    story.append(Paragraph(
        '3.1. За несвоевременный возврат суммы займа Займодавец вправе требовать уплаты неустойки '
        '(пени) в размере 0,1% от невозвращённой в срок суммы за каждый день просрочки.', Ss["body"]))
    story.append(Paragraph(
        '3.2. Во всём остальном, что не предусмотрено настоящим Договором, Стороны руководствуются '
        'действующим законодательством Российской Федерации.', Ss["body"]))

    # 4. Заключительные положения
    story.append(Paragraph("4. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ", Ss["h2"]))
    story.append(Paragraph(
        '4.1. Настоящий Договор вступает в силу с момента передачи Займодавцем суммы займа Заёмщику '
        'и действует до полного исполнения Сторонами своих обязательств.', Ss["body"]))
    story.append(Paragraph(
        '4.2. Настоящий Договор составлен в двух экземплярах, имеющих равную юридическую силу, '
        'по одному для каждой из Сторон.', Ss["body"]))
    story.append(Spacer(1, 4*mm))

    # 5. Реквизиты и подписи
    story.append(Paragraph("5. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН", Ss["h2"]))

    lender_lines = [f"<b>Займодавец:</b> {lender_name}"]
    if lender_inn:
        lender_lines.append(f"ИНН: {lender_inn}")
    if lender_ogrn:
        lender_lines.append(f"ОГРН/ОГРНИП: {lender_ogrn}")
    if lender_addr:
        lender_lines.append(f"Адрес: {lender_addr}")
    if lender_bank:
        lender_lines.append(f"Банк: {lender_bank}")
    if lender_rs:
        lender_lines.append(f"Р/с: {lender_rs}")
    if lender_ks:
        lender_lines.append(f"К/с: {lender_ks}")
    if lender_bik:
        lender_lines.append(f"БИК: {lender_bik}")
    if lender_phone:
        lender_lines.append(f"Тел.: {lender_phone}")
    if lender_email:
        lender_lines.append(f"Email: {lender_email}")

    borrower_lines = [f"<b>Заёмщик:</b> {b_name}"]
    for label, val in b_reqs:
        borrower_lines.append(f"{label}: {val}")
    borrower_lines.append(f"Тел.: {b_phone}")
    borrower_lines.append(f"Email: {b_email}")

    left = Paragraph("<br/>".join(lender_lines), Ss["body2"])
    right = Paragraph("<br/>".join(borrower_lines), Ss["body2"])
    req = Table([[left, right]], colWidths=[W/2 - 4, W/2 - 4])
    req.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("BOX", (0, 0), (-1, -1), 0.5, GR), ("INNERGRID", (0, 0), (-1, -1), 0.5, GR),
    ]))
    story.append(req)
    story.append(Spacer(1, 8*mm))

    sign = Table([
        [Paragraph("_______________ / " + lender_name.split()[0] if lender_name else "_______________", Ss["small"]),
         Paragraph("_______________ / " + (b_name.split()[0] if b_name and b_name != "_______________" else ""), Ss["small"])],
        [Paragraph("Займодавец", Ss["small"]), Paragraph("Заёмщик", Ss["small"])],
    ], colWidths=[W/2, W/2])
    sign.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 2)]))
    story.append(sign)

    doc.build(story)
    return buf.getvalue()


LOAN_COLS = [
    "id", "token", "amount", "interest_rate", "issue_date", "return_date", "doc_number",
    "borrower_type", "full_name", "passport_series", "passport_number", "passport_issued",
    "passport_date", "birth_date", "address", "company_name", "inn", "kpp", "ogrn",
    "legal_address", "director", "phone", "email", "status", "pdf_url", "filled_at", "created_at",
]


def handler(event: dict, context) -> dict:
    """Сгенерировать PDF договора займа по loan_id, сохранить в S3, вернуть URL."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qp = event.get("queryStringParameters") or {}
    pwd = qp.get("pwd", "")
    if pwd.lower() != os.environ.get("ADMIN_PASSWORD", "Qwert12345").lower():
        return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}

    loan_id = qp.get("loan_id")
    if not loan_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "loan_id required"})}

    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = get_db()
    cur = conn.cursor()
    cur.execute(f"SELECT {', '.join(LOAN_COLS)} FROM {schema}.loans WHERE id = %s", (int(loan_id),))
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
    loan = dict(zip(LOAN_COLS, row))

    cur.execute(f"SELECT key, value FROM {schema}.settings WHERE key LIKE 'company_%%'")
    company = {r[0]: r[1] for r in cur.fetchall()}

    pdf_bytes = build_loan_pdf(loan, company)
    key = f"loans/loan_{loan['id']:04d}.pdf"
    s3 = get_s3()
    s3.put_object(Bucket="files", Key=key, Body=pdf_bytes, ContentType="application/pdf")
    cdn = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    cur.execute(f"UPDATE {schema}.loans SET pdf_url=%s WHERE id=%s", (cdn, loan["id"]))
    conn.commit()
    cur.close(); conn.close()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "pdf_url": cdn})}
