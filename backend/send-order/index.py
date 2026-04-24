import json
import os
import urllib.request
import urllib.parse
import psycopg2
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_confirmation_email(to_email: str, order_number: str, name: str, total: int, items: list, days: int, date: str, place: str, extras: list, delivery: str):
    smtp_user = os.environ["SMTP_USER"]
    smtp_password = os.environ["SMTP_PASSWORD"]

    items_html = "".join(
        f"<tr><td style='padding:6px 0;color:#ccc;font-size:13px;'>{it['name']} × {it['qty']} × {days} дн.</td>"
        f"<td style='padding:6px 0;color:#fff;text-align:right;font-weight:bold;font-size:13px;'>{it['subtotal']:,} ₽</td></tr>"
        for it in items
    )
    extras_html = ""
    if extras:
        extras_html = "<p style='color:#888;font-size:12px;margin:12px 0 4px;'>Дополнительные услуги:</p>"
        extras_html += "".join(f"<p style='color:#aaa;margin:2px 0;font-size:13px;'>• {ex}</p>" for ex in extras)

    date_row = f"<p style='color:#888;font-size:13px;margin:4px 0;'>📅 Дата: <span style='color:#fff;'>{date}</span></p>" if date else ""
    place_row = f"<p style='color:#888;font-size:13px;margin:4px 0;'>📍 Место: <span style='color:#fff;'>{place}</span></p>" if place else ""

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#111111;border:1px solid #222;border-radius:6px;overflow:hidden;">
    <div style="background:#161616;padding:28px 32px;border-bottom:2px solid #f59e0b;">
      <p style="color:#f59e0b;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px;">Stage Sound</p>
      <h1 style="color:#fff;font-size:22px;margin:0;font-weight:bold;">Заявка принята в работу</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#ccc;font-size:15px;margin:0 0 20px;">Здравствуйте, <strong style="color:#fff;">{name}</strong>!</p>
      <p style="color:#999;font-size:13px;line-height:1.7;margin:0 0 24px;">
        Ваша заявка успешно получена. Менеджер свяжется с вами в течение 30 минут для подтверждения деталей.
      </p>

      <div style="background:#1a1a1a;border:1px solid rgba(245,158,11,0.2);border-radius:4px;padding:18px 22px;margin-bottom:24px;text-align:center;">
        <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Ваш номер заявки</p>
        <p style="color:#f59e0b;font-size:32px;font-weight:bold;margin:0;letter-spacing:2px;">{order_number}</p>
      </div>

      {date_row}{place_row}

      <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:20px 0 10px;">Состав заказа</p>
      <table style="width:100%;border-collapse:collapse;">
        {items_html}
      </table>
      {extras_html}

      <p style="color:#888;font-size:12px;margin:12px 0 4px;">Доставка: <span style="color:#ccc;">{delivery}</span></p>

      <div style="border-top:1px solid #222;margin:20px 0 0;padding-top:16px;">
        <table style="width:100%;"><tr>
          <td style="color:#888;font-size:14px;">Итого к оплате:</td>
          <td style="color:#f59e0b;font-size:24px;font-weight:bold;text-align:right;">{total:,} ₽</td>
        </tr></table>
      </div>

      <p style="color:#555;font-size:12px;margin:28px 0 0;text-align:center;line-height:1.6;">
        Вопросы? Пишите нам: <a href="mailto:info@global.promo" style="color:#f59e0b;text-decoration:none;">info@global.promo</a>
      </p>
    </div>
  </div>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Заявка {order_number} принята — Stage Sound"
    msg["From"] = f"Stage Sound <{smtp_user}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP("mail.hosting.reg.ru", 587, timeout=15) as server:
        server.ehlo()
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, to_email, msg.as_string())


def handler(event: dict, context) -> dict:
    """Отправка заявки из калькулятора в Telegram + письмо клиенту на email."""
    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors, "body": ""}

    body = json.loads(event.get("body") or "{}")
    name = body.get("name", "").strip()
    phone = body.get("phone", "").strip()
    email = body.get("email", "").strip()
    date = body.get("date", "").strip()
    place = body.get("place", "").strip()
    comment = body.get("comment", "").strip()
    items = body.get("items", [])
    days = body.get("days", 1)
    delivery = body.get("delivery", "Без доставки")
    extras = body.get("extras", [])
    total = body.get("total", 0)

    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {schema}.orders (name, phone, email, date, place, comment, items, days, delivery, extras, total) "
        f"VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
        (name, phone, email, date, place, comment, json.dumps(items), days, delivery, json.dumps(extras), total)
    )
    order_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    order_number = f"SS-{order_id:04d}"

    # Telegram
    lines = [f"🎪 <b>Заявка #{order_number}</b>", ""]
    lines.append(f"👤 <b>Имя:</b> {name}")
    lines.append(f"📞 <b>Телефон:</b> {phone}")
    if email:
        lines.append(f"📧 <b>Email:</b> {email}")
    if date:
        lines.append(f"📅 <b>Дата мероприятия:</b> {date}")
    if place:
        lines.append(f"📍 <b>Место:</b> {place}")
    lines.append("")
    lines.append("🎛 <b>Оборудование:</b>")
    for it in items:
        lines.append(f"  • {it['name']} × {it['qty']} × {days} дн. = {it['subtotal']:,} ₽")
    if extras:
        lines.append("")
        lines.append("➕ <b>Доп. услуги:</b>")
        for ex in extras:
            lines.append(f"  • {ex}")
    lines.append("")
    lines.append(f"🚚 <b>Доставка:</b> {delivery}")
    lines.append(f"💰 <b>Итого: {total:,} ₽</b>")
    if comment:
        lines.append("")
        lines.append(f"💬 <b>Комментарий:</b> {comment}")

    text = "\n".join(lines)
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_id = os.environ["TELEGRAM_CHAT_ID"]
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        resp_data = json.loads(resp.read())

    if not resp_data.get("ok"):
        return {"statusCode": 500, "headers": cors, "body": json.dumps({"error": "Telegram error"})}

    # Email клиенту
    if email:
        try:
            send_confirmation_email(email, order_number, name, total, items, days, date, place, extras, delivery)
        except Exception:
            pass

    return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True, "order_number": order_number})}
