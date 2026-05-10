"""
ПЭП (простая электронная подпись) договора. v2

POST /?action=send_otp&token=T      — отправить OTP-код на email клиента
POST /?action=verify_otp&token=T    — проверить код и подписать договор
GET  /?token=T                      — получить статус подписания (signed_at, pdf_url)
POST /?action=submit&token=T        — создать контракт + сгенерировать PDF + отправить OTP
"""
import json
import os
import random
import smtplib
import string
import ssl
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def s():
    return os.environ.get("MAIN_DB_SCHEMA", "public")


def gen_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def send_email(to_email: str, subject: str, html_body: str):
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASSWORD", "")
    if not smtp_user or not smtp_pass:
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Global Renta <{smtp_user}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.beget.com", 465, context=ctx) as srv:
        srv.login(smtp_user, smtp_pass)
        srv.sendmail(smtp_user, to_email, msg.as_string())


def handler(event: dict, context) -> dict:
    """ПЭП: отправка OTP, проверка, подпись договора."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qp     = event.get("queryStringParameters") or {}
    action = qp.get("action", "")
    token  = qp.get("token", "")
    ip     = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp", "")

    if not token:
        return {"statusCode": 400, "headers": CORS,
                "body": json.dumps({"error": "token required"}, ensure_ascii=False)}

    conn = db()
    cur  = conn.cursor()

    try:
        # ── Получить статус ──────────────────────────────────────────
        if method == "GET":
            cur.execute(
                f"SELECT c.id, c.signed_at, c.contract_pdf_url, c.email, c.full_name, c.company_name, c.client_type "
                f"FROM {s()}.contracts c "
                f"JOIN {s()}.quotes q ON q.id = c.quote_id "
                f"WHERE q.token = %s ORDER BY c.id DESC LIMIT 1",
                (token,)
            )
            row = cur.fetchone()
            if not row:
                return {"statusCode": 404, "headers": CORS,
                        "body": json.dumps({"error": "not_found"}, ensure_ascii=False)}
            cid, signed_at, pdf_url, email, full_name, company_name, client_type = row
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps({
                        "contract_id": cid,
                        "signed": signed_at is not None,
                        "signed_at": str(signed_at) if signed_at else None,
                        "pdf_url": pdf_url,
                        "email": email,
                        "name": full_name if client_type == "individual" else company_name,
                    }, ensure_ascii=False)}

        body = json.loads(event.get("body") or "{}")

        # ── Создать контракт + сгенерировать PDF + отправить OTP ────
        if action == "submit":
            # 1. Получаем quote по токену
            cur.execute(
                f"SELECT id, title, items, days, delivery, delivery_price, extras, total, "
                f"event_date, delivery_address, installation_time, installation_price, "
                f"dismantling_time, dismantling_price "
                f"FROM {s()}.quotes WHERE token = %s",
                (token,)
            )
            q_row = cur.fetchone()
            if not q_row:
                return {"statusCode": 404, "headers": CORS,
                        "body": json.dumps({"error": "quote_not_found"}, ensure_ascii=False)}
            q_id = q_row[0]

            # 2. Проверяем нет ли уже контракта
            cur.execute(f"SELECT id, signed_at FROM {s()}.contracts WHERE quote_id = %s ORDER BY id DESC LIMIT 1", (q_id,))
            existing = cur.fetchone()
            if existing and existing[1] is not None:
                return {"statusCode": 409, "headers": CORS,
                        "body": json.dumps({"error": "already_signed"}, ensure_ascii=False)}

            client_type = body.get("client_type", "individual")
            email       = (body.get("email") or "").strip()
            if not email:
                return {"statusCode": 400, "headers": CORS,
                        "body": json.dumps({"error": "email_required"}, ensure_ascii=False)}

            otp = gen_otp()
            now = datetime.now(timezone.utc)

            if existing:
                # Обновляем существующий контракт
                cur.execute(
                    f"UPDATE {s()}.contracts SET "
                    f"client_type=%s, full_name=%s, passport_series=%s, passport_number=%s, "
                    f"passport_issued=%s, passport_date=%s, birth_date=%s, address=%s, "
                    f"company_name=%s, inn=%s, kpp=%s, ogrn=%s, legal_address=%s, director=%s, "
                    f"phone=%s, email=%s, passport_file_url=%s, "
                    f"otp_code=%s, otp_sent_at=%s, otp_attempts=0, signed_at=NULL "
                    f"WHERE id=%s RETURNING id",
                    (client_type,
                     body.get("full_name",""), body.get("passport_series",""), body.get("passport_number",""),
                     body.get("passport_issued",""), body.get("passport_date",""), body.get("birth_date",""), body.get("address",""),
                     body.get("company_name",""), body.get("inn",""), body.get("kpp",""), body.get("ogrn",""),
                     body.get("legal_address",""), body.get("director",""),
                     body.get("phone",""), email, body.get("passport_file_url"),
                     otp, now, existing[0])
                )
                contract_id = cur.fetchone()[0]
            else:
                cur.execute(
                    f"INSERT INTO {s()}.contracts "
                    f"(quote_id, client_type, full_name, passport_series, passport_number, "
                    f"passport_issued, passport_date, birth_date, address, "
                    f"company_name, inn, kpp, ogrn, legal_address, director, "
                    f"phone, email, passport_file_url, otp_code, otp_sent_at) "
                    f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                    (q_id, client_type,
                     body.get("full_name",""), body.get("passport_series",""), body.get("passport_number",""),
                     body.get("passport_issued",""), body.get("passport_date",""), body.get("birth_date",""), body.get("address",""),
                     body.get("company_name",""), body.get("inn",""), body.get("kpp",""), body.get("ogrn",""),
                     body.get("legal_address",""), body.get("director",""),
                     body.get("phone",""), email, body.get("passport_file_url"),
                     otp, now)
                )
                contract_id = cur.fetchone()[0]

            # Обновляем статус КП
            cur.execute(f"UPDATE {s()}.quotes SET status='contracted' WHERE id=%s", (q_id,))
            conn.commit()

            # 3. Отправляем OTP
            name_for_email = body.get("full_name") or body.get("company_name") or "Клиент"
            send_email(
                email,
                "Код подтверждения подписи договора — Global Renta",
                _otp_email_html(otp, name_for_email)
            )

            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps({"ok": True, "contract_id": contract_id,
                                        "email_sent_to": email}, ensure_ascii=False)}

        # ── Повторно отправить OTP ───────────────────────────────────
        if action == "send_otp":
            cur.execute(
                f"SELECT c.id, c.email, c.otp_sent_at, c.signed_at, c.full_name, c.company_name "
                f"FROM {s()}.contracts c "
                f"JOIN {s()}.quotes q ON q.id = c.quote_id "
                f"WHERE q.token = %s ORDER BY c.id DESC LIMIT 1",
                (token,)
            )
            row = cur.fetchone()
            if not row:
                return {"statusCode": 404, "headers": CORS,
                        "body": json.dumps({"error": "contract_not_found"}, ensure_ascii=False)}
            cid, email, otp_sent_at, signed_at, full_name, company_name = row
            if signed_at:
                return {"statusCode": 409, "headers": CORS,
                        "body": json.dumps({"error": "already_signed"}, ensure_ascii=False)}
            # Cooldown 60 сек
            if otp_sent_at:
                ago = (datetime.now(timezone.utc) - otp_sent_at.replace(tzinfo=timezone.utc)).total_seconds()
                if ago < 60:
                    return {"statusCode": 429, "headers": CORS,
                            "body": json.dumps({"error": "wait", "retry_in": int(60 - ago)}, ensure_ascii=False)}

            otp = gen_otp()
            cur.execute(
                f"UPDATE {s()}.contracts SET otp_code=%s, otp_sent_at=%s, otp_attempts=0 WHERE id=%s",
                (otp, datetime.now(timezone.utc), cid)
            )
            conn.commit()
            name = full_name or company_name or "Клиент"
            send_email(email, "Код подтверждения — Global Renta", _otp_email_html(otp, name))
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps({"ok": True, "email_sent_to": email}, ensure_ascii=False)}

        # ── Проверить OTP и подписать ────────────────────────────────
        if action == "verify_otp":
            code = (body.get("code") or "").strip()
            if not code:
                return {"statusCode": 400, "headers": CORS,
                        "body": json.dumps({"error": "code_required"}, ensure_ascii=False)}

            cur.execute(
                f"SELECT c.id, c.otp_code, c.otp_sent_at, c.otp_attempts, c.signed_at, c.email "
                f"FROM {s()}.contracts c "
                f"JOIN {s()}.quotes q ON q.id = c.quote_id "
                f"WHERE q.token = %s ORDER BY c.id DESC LIMIT 1",
                (token,)
            )
            row = cur.fetchone()
            if not row:
                return {"statusCode": 404, "headers": CORS,
                        "body": json.dumps({"error": "not_found"}, ensure_ascii=False)}
            cid, otp_code, otp_sent_at, attempts, signed_at, email = row

            if signed_at:
                return {"statusCode": 409, "headers": CORS,
                        "body": json.dumps({"error": "already_signed"}, ensure_ascii=False)}

            if attempts >= 5:
                return {"statusCode": 429, "headers": CORS,
                        "body": json.dumps({"error": "too_many_attempts"}, ensure_ascii=False)}

            # Код истекает через 15 минут
            if otp_sent_at:
                age = (datetime.now(timezone.utc) - otp_sent_at.replace(tzinfo=timezone.utc)).total_seconds()
                if age > 900:
                    return {"statusCode": 410, "headers": CORS,
                            "body": json.dumps({"error": "code_expired"}, ensure_ascii=False)}

            if code != otp_code:
                cur.execute(f"UPDATE {s()}.contracts SET otp_attempts = otp_attempts + 1 WHERE id=%s", (cid,))
                conn.commit()
                return {"statusCode": 400, "headers": CORS,
                        "body": json.dumps({"error": "wrong_code", "attempts_left": 5 - attempts - 1},
                                           ensure_ascii=False)}

            # Код верный — подписываем
            now = datetime.now(timezone.utc)
            cur.execute(
                f"UPDATE {s()}.contracts SET signed_at=%s, signature_ip=%s, otp_code=NULL, status='signed' WHERE id=%s",
                (now, ip, cid)
            )
            cur.execute(f"UPDATE {s()}.quotes SET status='signed' WHERE id=(SELECT quote_id FROM {s()}.contracts WHERE id=%s)", (cid,))
            conn.commit()

            # Уведомляем менеджера
            _notify_manager(cid, token, email)

            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps({
                        "ok": True, "contract_id": cid,
                        "signed_at": str(now),
                    }, ensure_ascii=False)}

        return {"statusCode": 400, "headers": CORS,
                "body": json.dumps({"error": "unknown_action"}, ensure_ascii=False)}

    finally:
        cur.close()
        conn.close()


def _otp_email_html(otp: str, name: str) -> str:
    return f"""
<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #333;border-radius:4px;overflow:hidden">
      <tr>
        <td style="background:#111;padding:28px 36px;border-bottom:1px solid #222">
          <p style="margin:0;color:#f59e0b;font-size:11px;text-transform:uppercase;letter-spacing:3px">Global Renta</p>
          <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:700">Подписание договора</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 36px">
          <p style="color:#aaa;font-size:14px;margin:0 0 20px">Здравствуйте, <strong style="color:#fff">{name}</strong>!</p>
          <p style="color:#aaa;font-size:14px;margin:0 0 24px">Для подтверждения электронной подписи договора аренды оборудования введите код:</p>
          <div style="background:#0a0a0a;border:2px solid #f59e0b;border-radius:4px;padding:20px;text-align:center;margin:0 0 24px">
            <span style="font-size:40px;font-weight:700;color:#f59e0b;letter-spacing:12px">{otp}</span>
          </div>
          <p style="color:#666;font-size:12px;margin:0 0 4px">⏱ Код действует 15 минут</p>
          <p style="color:#666;font-size:12px;margin:0">🔒 Не передавайте код третьим лицам</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 36px;border-top:1px solid #222;background:#0d0d0d">
          <p style="margin:0;color:#555;font-size:11px">Если вы не запрашивали этот код — проигнорируйте письмо.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def _notify_manager(contract_id: int, token: str, client_email: str):
    import urllib.request
    import urllib.parse
    try:
        tg_token  = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        tg_chat   = os.environ.get("TELEGRAM_CHAT_ID", "")
        if not tg_token or not tg_chat:
            return
        text = (
            f"✅ <b>Договор #{contract_id} подписан ПЭП</b>\n\n"
            f"Клиент: {client_email}\n"
            f"КП: {token}\n\n"
            f"➡️ Просмотр: /admin → Договоры"
        )
        data = urllib.parse.urlencode({"chat_id": tg_chat, "text": text, "parse_mode": "HTML"}).encode()
        req  = urllib.request.Request(
            f"https://api.telegram.org/bot{tg_token}/sendMessage",
            data=data, method="POST"
        )
        urllib.request.urlopen(req, timeout=8)
    except Exception:
        pass