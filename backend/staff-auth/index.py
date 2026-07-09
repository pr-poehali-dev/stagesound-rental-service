"""
Авторизация сотрудников (менеджеров).
POST /?action=login                     — вход по email+password
GET  /                                  — профиль по токену (X-Staff-Token)
POST /?action=create&pwd=ADMIN          — создать сотрудника (только админ)
GET  /?admin=1&pwd=ADMIN                — список сотрудников
PUT  /?admin=1&pwd=ADMIN&id=N           — изменить сотрудника (имя, пароль, активность)
"""
import hashlib
import json
import os
import secrets
import urllib.request
import psycopg2


def _resend_send(to_email: str, subject: str, html: str):
    """Отправка письма через Resend HTTP API (порт 443, не блокируется облаком)."""
    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key:
        return
    from_addr = os.environ.get("RESEND_FROM_EMAIL") or "Global Renta <info@global.promo>"
    data = json.dumps({"from": from_addr, "to": [to_email], "subject": subject, "html": html}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=data, method="POST",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        resp.read()

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Staff-Token",
    "Content-Type": "application/json",
}


def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def s():
    return os.environ.get("MAIN_DB_SCHEMA", "public")


def h(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()


def check_admin(pwd: str) -> bool:
    return pwd.lower() == os.environ.get("ADMIN_PASSWORD", "").lower()


def send_staff_welcome(to_email: str, name: str, password: str):
    site_url = os.environ.get("SITE_URL", "https://global.promo")
    html = f"""<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#111;border:1px solid #222;border-radius:6px;overflow:hidden;">
    <div style="background:#161616;padding:24px 32px;border-bottom:2px solid #f59e0b;">
      <p style="color:#f59e0b;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">Global Renta</p>
      <h1 style="color:#fff;font-size:20px;margin:0;font-weight:bold;">Добро пожаловать в команду!</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#ccc;font-size:15px;margin:0 0 16px;">Здравствуйте, <strong style="color:#fff;">{name}</strong>!</p>
      <p style="color:#999;font-size:13px;line-height:1.7;margin:0 0 20px;">
        Для вас создан аккаунт сотрудника в системе Global Renta. Используйте данные ниже для входа.
      </p>
      <div style="background:#1a1a1a;border:1px solid rgba(245,158,11,0.25);border-radius:4px;padding:18px 22px;margin-bottom:24px;">
        <p style="color:#f59e0b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Данные для входа</p>
        <p style="color:#ccc;font-size:13px;margin:0 0 6px;">📧 <strong style="color:#fff;">Email:</strong> {to_email}</p>
        <p style="color:#ccc;font-size:13px;margin:0;">🔑 <strong style="color:#fff;">Пароль:</strong> {password}</p>
      </div>
      <div style="text-align:center;margin-top:4px;">
        <a href="{site_url}/staff"
           style="display:inline-block;background:#f59e0b;color:#000;font-weight:bold;font-size:14px;padding:12px 32px;border-radius:4px;text-decoration:none;">
          Войти в личный кабинет
        </a>
      </div>
      <p style="color:#555;font-size:11px;margin:24px 0 0;text-align:center;">
        Вопросы? Пишите: <a href="mailto:info@global.promo" style="color:#f59e0b;">info@global.promo</a>
      </p>
    </div>
  </div>
</body></html>"""
    _resend_send(to_email, "Добро пожаловать в Global Renta — данные для входа", html)


def get_staff_by_token(cur, token: str):
    cur.execute(
        f"SELECT s.id, s.name, s.email, s.role, s.is_active "
        f"FROM {s()}.staff_sessions ss "
        f"JOIN {s()}.staff s ON s.id = ss.staff_id "
        f"WHERE ss.token = %s AND ss.expires_at > now() AND s.is_active = true",
        (token,)
    )
    row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "name": row[1], "email": row[2], "role": row[3], "is_active": row[4]}


def handler(event: dict, context) -> dict:
    """Авторизация сотрудников: вход, профиль, управление (только для админа)."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qp = event.get("queryStringParameters") or {}
    action = qp.get("action", "")
    pwd = qp.get("pwd", "")
    token = (event.get("headers") or {}).get("X-Staff-Token", "")

    conn = db()
    cur = conn.cursor()

    try:
        # ── Вход ──
        if method == "POST" and action == "login":
            body = json.loads(event.get("body") or "{}")
            email = body.get("email", "").strip().lower()
            password = body.get("password", "").strip()
            cur.execute(
                f"SELECT id, is_active FROM {s()}.staff WHERE email=%s AND password_hash=%s",
                (email, h(password))
            )
            row = cur.fetchone()
            if not row:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Неверный email или пароль"}, ensure_ascii=False)}
            staff_id, is_active = row
            if not is_active:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Аккаунт деактивирован"}, ensure_ascii=False)}
            tok = secrets.token_hex(32)
            cur.execute(f"INSERT INTO {s()}.staff_sessions (staff_id, token) VALUES (%s, %s)", (staff_id, tok))
            conn.commit()
            cur.execute(f"SELECT id, name, email, role FROM {s()}.staff WHERE id=%s", (staff_id,))
            r = cur.fetchone()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "token": tok, "id": r[0], "name": r[1], "email": r[2], "role": r[3]}, ensure_ascii=False)}

        # ── Профиль (GET) ──
        if method == "GET" and not qp.get("admin"):
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Токен не передан"}, ensure_ascii=False)}
            staff = get_staff_by_token(cur, token)
            if not staff:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Сессия истекла"}, ensure_ascii=False)}
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(staff, ensure_ascii=False)}

        # ── Создать сотрудника ──
        if method == "POST" and action == "create":
            if not check_admin(pwd):
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"}, ensure_ascii=False)}
            body = json.loads(event.get("body") or "{}")
            name = body.get("name", "").strip()
            email = body.get("email", "").strip().lower()
            password = body.get("password", "").strip()
            if not all([name, email, password]):
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заполните все поля"}, ensure_ascii=False)}
            if len(password) < 6:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Пароль минимум 6 символов"}, ensure_ascii=False)}
            cur.execute(f"SELECT id FROM {s()}.staff WHERE email=%s", (email,))
            if cur.fetchone():
                return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "Email уже используется"}, ensure_ascii=False)}
            cur.execute(
                f"INSERT INTO {s()}.staff (name, email, password_hash) VALUES (%s, %s, %s) RETURNING id",
                (name, email, h(password))
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            try:
                send_staff_welcome(email, name, password)
            except Exception:
                pass  # email не критичен — аккаунт уже создан
            return {"statusCode": 201, "headers": CORS, "body": json.dumps({"ok": True, "id": new_id}, ensure_ascii=False)}

        # ── Список сотрудников (admin) ──
        if method == "GET" and qp.get("admin") == "1":
            if not check_admin(pwd):
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"}, ensure_ascii=False)}
            cur.execute(f"SELECT id, name, email, role, is_active, created_at FROM {s()}.staff ORDER BY created_at DESC")
            rows = [{"id": r[0], "name": r[1], "email": r[2], "role": r[3], "is_active": r[4], "created_at": str(r[5])} for r in cur.fetchall()]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(rows, ensure_ascii=False)}

        # ── Изменить сотрудника (admin) ──
        if method == "PUT":
            if not check_admin(pwd):
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"}, ensure_ascii=False)}
            sid = int(qp.get("id", 0))
            body = json.loads(event.get("body") or "{}")
            if "is_active" in body:
                cur.execute(f"UPDATE {s()}.staff SET is_active=%s WHERE id=%s", (bool(body["is_active"]), sid))
            if "name" in body:
                cur.execute(f"UPDATE {s()}.staff SET name=%s WHERE id=%s", (body["name"].strip(), sid))
            if "password" in body and len(body["password"]) >= 6:
                cur.execute(f"UPDATE {s()}.staff SET password_hash=%s WHERE id=%s", (h(body["password"]), sid))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True}, ensure_ascii=False)}

        return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"}, ensure_ascii=False)}

    finally:
        cur.close()
        conn.close()