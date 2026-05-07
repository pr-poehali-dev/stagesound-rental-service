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
