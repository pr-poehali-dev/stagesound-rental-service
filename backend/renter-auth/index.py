"""
Аутентификация прокатчиков: регистрация, вход, профиль, выход.
POST /register — регистрация новой компании
POST /login    — вход, возвращает токен
GET  /         — профиль по токену (заголовок X-Renter-Token)
PUT  /         — обновить профиль
"""
import hashlib
import json
import os
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Renter-Token",
    "Content-Type": "application/json",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def schema():
    return os.environ.get("MAIN_DB_SCHEMA", "public")

def hash_pwd(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()


def send_welcome_email(to_email: str, company_name: str, contact_name: str):
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASSWORD", "")
    if not smtp_user or not smtp_pass:
        return
    html = f"""<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#111;border:1px solid #222;border-radius:6px;overflow:hidden;">
    <div style="background:#161616;padding:24px 32px;border-bottom:2px solid #f59e0b;">
      <p style="color:#f59e0b;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">Global Renta — Партнёрский кабинет</p>
      <h1 style="color:#fff;font-size:20px;margin:0;font-weight:bold;">Заявка на регистрацию принята</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#ccc;font-size:15px;margin:0 0 16px;">Здравствуйте, <strong style="color:#fff;">{contact_name}</strong>!</p>
      <p style="color:#999;font-size:13px;line-height:1.7;margin:0 0 20px;">
        Ваша компания <strong style="color:#fff;">{company_name}</strong> успешно зарегистрирована в партнёрской программе Global Renta.
      </p>
      <div style="background:#1a1a1a;border:1px solid rgba(245,158,11,0.2);border-radius:4px;padding:16px 20px;margin-bottom:20px;">
        <p style="color:#f59e0b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Что дальше?</p>
        <p style="color:#ccc;font-size:13px;margin:0 0 6px;">⏳ Ваш аккаунт ожидает проверки администратором.</p>
        <p style="color:#ccc;font-size:13px;margin:0;">📧 После одобрения вы получите уведомление на этот email.</p>
      </div>
      <div style="text-align:center;margin-top:24px;">
        <a href="https://global.promo/renter/login"
           style="display:inline-block;background:#f59e0b;color:#000;font-weight:bold;font-size:14px;padding:12px 28px;border-radius:4px;text-decoration:none;">
          Войти в кабинет
        </a>
      </div>
      <p style="color:#555;font-size:11px;margin:24px 0 0;text-align:center;">
        Вопросы? Пишите: <a href="mailto:info@global.promo" style="color:#f59e0b;">info@global.promo</a>
      </p>
    </div>
  </div>
</body></html>"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Регистрация в партнёрской программе Global Renta"
    msg["From"] = f"Global Renta <{smtp_user}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP("mail.hosting.reg.ru", 587, timeout=15) as srv:
        srv.ehlo(); srv.starttls(); srv.login(smtp_user, smtp_pass)
        srv.sendmail(smtp_user, to_email, msg.as_string())

def get_renter_by_token(cur, token: str):
    cur.execute(
        f"SELECT r.id, r.email, r.company_name, r.contact_name, r.phone, r.city, r.telegram, r.description, r.status "
        f"FROM {schema()}.renter_sessions s JOIN {schema()}.renters r ON r.id = s.renter_id "
        f"WHERE s.token = %s AND s.expires_at > now()",
        (token,)
    )
    row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "company_name": row[2], "contact_name": row[3],
            "phone": row[4], "city": row[5], "telegram": row[6], "description": row[7], "status": row[8]}

def handler(event: dict, context) -> dict:
    """Авторизация прокатчиков: регистрация, вход, профиль."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qp = event.get("queryStringParameters") or {}
    action = qp.get("action", "")
    token = (event.get("headers") or {}).get("X-Renter-Token", "")

    conn = get_conn()
    cur = conn.cursor()

    try:
        # ── РЕГИСТРАЦИЯ ──
        if method == "POST" and action == "register":
            body = json.loads(event.get("body") or "{}")
            email = body.get("email", "").strip().lower()
            password = body.get("password", "").strip()
            company_name = body.get("company_name", "").strip()
            contact_name = body.get("contact_name", "").strip()
            phone = body.get("phone", "").strip()
            city = body.get("city", "Санкт-Петербург").strip()
            telegram = body.get("telegram", "").strip() or None

            if not all([email, password, company_name, contact_name, phone]):
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заполните все обязательные поля"}, ensure_ascii=False)}

            if len(password) < 6:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Пароль должен быть не менее 6 символов"}, ensure_ascii=False)}

            cur.execute(f"SELECT id FROM {schema()}.renters WHERE email = %s", (email,))
            if cur.fetchone():
                return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "Email уже зарегистрирован"}, ensure_ascii=False)}

            cur.execute(
                f"INSERT INTO {schema()}.renters (email, password_hash, company_name, contact_name, phone, city, telegram) "
                f"VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (email, hash_pwd(password), company_name, contact_name, phone, city, telegram)
            )
            renter_id = cur.fetchone()[0]
            conn.commit()
            try:
                send_welcome_email(email, company_name, contact_name)
            except Exception as e:
                print(f"[SMTP register] {e}")
            return {"statusCode": 201, "headers": CORS, "body": json.dumps({"ok": True, "renter_id": renter_id, "message": "Регистрация прошла успешно. Ожидайте одобрения аккаунта администратором."}, ensure_ascii=False)}

        # ── ВХОД ──
        if method == "POST" and action == "login":
            body = json.loads(event.get("body") or "{}")
            email = body.get("email", "").strip().lower()
            password = body.get("password", "").strip()

            cur.execute(f"SELECT id, status FROM {schema()}.renters WHERE email = %s AND password_hash = %s", (email, hash_pwd(password)))
            row = cur.fetchone()
            if not row:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Неверный email или пароль"}, ensure_ascii=False)}

            renter_id, status = row
            if status == "blocked":
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Аккаунт заблокирован"}, ensure_ascii=False)}

            tok = secrets.token_hex(32)
            cur.execute(f"INSERT INTO {schema()}.renter_sessions (renter_id, token) VALUES (%s, %s)", (renter_id, tok))
            conn.commit()

            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "token": tok, "status": status}, ensure_ascii=False)}

        # ── ПРОФИЛЬ (GET) ──
        if method == "GET":
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Токен не передан"}, ensure_ascii=False)}
            renter = get_renter_by_token(cur, token)
            if not renter:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Сессия истекла, войдите снова"}, ensure_ascii=False)}
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(renter, ensure_ascii=False)}

        # ── ОБНОВЛЕНИЕ ПРОФИЛЯ (PUT) ──
        if method == "PUT":
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Токен не передан"}, ensure_ascii=False)}
            renter = get_renter_by_token(cur, token)
            if not renter:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Сессия истекла"}, ensure_ascii=False)}

            body = json.loads(event.get("body") or "{}")
            company_name = body.get("company_name", renter["company_name"]).strip()
            contact_name = body.get("contact_name", renter["contact_name"]).strip()
            phone = body.get("phone", renter["phone"]).strip()
            city = body.get("city", renter["city"]).strip()
            telegram = body.get("telegram", renter["telegram"])
            description = body.get("description", renter["description"]).strip()

            cur.execute(
                f"UPDATE {schema()}.renters SET company_name=%s, contact_name=%s, phone=%s, city=%s, telegram=%s, description=%s WHERE id=%s",
                (company_name, contact_name, phone, city, telegram, description, renter["id"])
            )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True}, ensure_ascii=False)}

        return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"}, ensure_ascii=False)}

    finally:
        cur.close()
        conn.close()