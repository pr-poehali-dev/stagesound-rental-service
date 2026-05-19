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
import psycopg2

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
