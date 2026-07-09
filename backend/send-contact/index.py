import json
import os
import urllib.request


def handler(event: dict, context) -> dict:
    """Отправка заявки с сайта на email info@global.promo"""

    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return {"statusCode": 400, "headers": cors_headers, "body": json.dumps({"error": "Invalid JSON"})}

    name = body.get("name", "").strip()
    phone = body.get("phone", "").strip()
    email = body.get("email", "").strip()
    event_type = body.get("type", "").strip()
    date = body.get("date", "").strip()
    message = body.get("message", "").strip()

    if not name or not phone:
        return {"statusCode": 400, "headers": cors_headers, "body": json.dumps({"error": "Имя и телефон обязательны"})}


    to_email = "info@global.promo"

    message_html = message.replace("\n", "<br>")
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="background: #ff8c00; padding: 24px 30px;">
          <h1 style="color: #0e1117; margin: 0; font-size: 22px;">Новая заявка с сайта RentPro</h1>
        </div>
        <div style="padding: 30px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #888; width: 40%;">Имя</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">{name}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #888;">Телефон</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">{phone}</td></tr>
            {"<tr><td style='padding: 10px 0; border-bottom: 1px solid #eee; color: #888;'>Email</td><td style='padding: 10px 0; border-bottom: 1px solid #eee;'>" + email + "</td></tr>" if email else ""}
            {"<tr><td style='padding: 10px 0; border-bottom: 1px solid #eee; color: #888;'>Тип мероприятия</td><td style='padding: 10px 0; border-bottom: 1px solid #eee;'>" + event_type + "</td></tr>" if event_type else ""}
            {"<tr><td style='padding: 10px 0; border-bottom: 1px solid #eee; color: #888;'>Дата</td><td style='padding: 10px 0; border-bottom: 1px solid #eee;'>" + date + "</td></tr>" if date else ""}
            {"<tr><td style='padding: 10px 0; color: #888; vertical-align: top;'>Сообщение</td><td style='padding: 10px 0;'>" + message_html + "</td></tr>" if message else ""}
          </table>
        </div>
        <div style="background: #f9f9f9; padding: 16px 30px; font-size: 12px; color: #aaa;">
          Заявка отправлена с сайта rentpro.ru
        </div>
      </div>
    </body>
    </html>
    """

    api_key = os.environ.get("RESEND_API_KEY", "")
    if api_key:
        from_addr = os.environ.get("RESEND_FROM_EMAIL") or "Global Renta <onboarding@resend.dev>"
        data = json.dumps({"from": from_addr, "to": [to_email], "subject": f"Новая заявка: {name} — {phone}", "html": html_body}).encode("utf-8")
        req = urllib.request.Request(
            "https://api.resend.com/emails", data=data, method="POST",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            resp.read()

    return {
        "statusCode": 200,
        "headers": cors_headers,
        "body": json.dumps({"success": True, "message": "Заявка отправлена"}),
    }