import json
import os
import urllib.request
import urllib.parse

def handler(event: dict, context) -> dict:
    """Отправка заявки из калькулятора в Telegram."""
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
    date = body.get("date", "").strip()
    place = body.get("place", "").strip()
    items = body.get("items", [])
    days = body.get("days", 1)
    delivery = body.get("delivery", "Без доставки")
    extras = body.get("extras", [])
    total = body.get("total", 0)

    lines = ["🎪 <b>Новая заявка с калькулятора</b>", ""]
    lines.append(f"👤 <b>Имя:</b> {name}")
    lines.append(f"📞 <b>Телефон:</b> {phone}")
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

    text = "\n".join(lines)

    token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_id = os.environ["TELEGRAM_CHAT_ID"]
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }).encode()

    req = urllib.request.Request(url, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        resp_data = json.loads(resp.read())

    if not resp_data.get("ok"):
        return {"statusCode": 500, "headers": cors, "body": json.dumps({"error": "Telegram error"})}

    return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True})}