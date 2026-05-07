"""
CRUD оборудования прокатчика + модерация администратором.
GET    /              — список своего оборудования (по токену)
POST   /              — добавить позицию (статус pending)
PUT    /              — обновить позицию
GET    /?admin=1      — ВСЁ оборудование на модерации (для админа)
POST   /?admin=1&action=approve&id=N  — одобрить
POST   /?admin=1&action=reject&id=N   — отклонить
GET    /?public=1     — одобренное оборудование для каталога сайта
"""
import json
import os
import hashlib
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Renter-Token",
    "Content-Type": "application/json",
}

def s():
    return os.environ.get("MAIN_DB_SCHEMA", "public")

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def check_token(cur, token: str):
    cur.execute(
        f"SELECT r.id, r.status FROM {s()}.renter_sessions sess "
        f"JOIN {s()}.renters r ON r.id = sess.renter_id "
        f"WHERE sess.token = %s AND sess.expires_at > now()",
        (token,)
    )
    row = cur.fetchone()
    if not row:
        return None, None
    return row[0], row[1]

def check_admin(pwd: str) -> bool:
    expected = os.environ.get("ADMIN_PASSWORD", "")
    return pwd.lower() == expected.lower()

def row_to_eq(row) -> dict:
    return {
        "id": row[0], "renter_id": row[1], "name": row[2], "category": row[3],
        "subcategory": row[4], "price": row[5], "unit": row[6],
        "description": row[7], "specs": row[8], "tags": row[9],
        "image": row[10], "status": row[11], "is_active": row[12],
        "created_at": str(row[13]),
        "renter_company": row[14] if len(row) > 14 else None,
        "renter_email": row[15] if len(row) > 15 else None,
    }

def handler(event: dict, context) -> dict:
    """Управление оборудованием прокатчиков и модерация."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qp = event.get("queryStringParameters") or {}
    token = (event.get("headers") or {}).get("X-Renter-Token", "")
    admin_mode = qp.get("admin") == "1"
    public_mode = qp.get("public") == "1"
    pwd = qp.get("pwd", "")

    conn = get_conn()
    cur = conn.cursor()

    try:
        # ── ПУБЛИЧНЫЙ КАТАЛОГ ──
        if public_mode and method == "GET":
            cur.execute(
                f"SELECT e.id, e.renter_id, e.name, e.category, e.subcategory, e.price, e.unit, "
                f"e.description, e.specs, e.tags, e.image, e.status, e.is_active, e.created_at, "
                f"r.company_name, r.email "
                f"FROM {s()}.renter_equipment e JOIN {s()}.renters r ON r.id = e.renter_id "
                f"WHERE e.status = 'approved' AND e.is_active = true AND r.status = 'active' "
                f"ORDER BY e.created_at DESC"
            )
            rows = cur.fetchall()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps([row_to_eq(r) for r in rows], ensure_ascii=False, default=str)}

        # ── ADMIN РЕЖИМ ──
        if admin_mode:
            if not check_admin(pwd):
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"}, ensure_ascii=False)}

            action = qp.get("action", "")
            eq_id = qp.get("id", "")

            if method == "POST" and action == "approve" and eq_id:
                cur.execute(
                    f"UPDATE {s()}.renter_equipment SET status='approved', is_active=true, reviewed_at=now() WHERE id=%s",
                    (int(eq_id),)
                )
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True}, ensure_ascii=False)}

            if method == "POST" and action == "reject" and eq_id:
                body = json.loads(event.get("body") or "{}")
                cur.execute(
                    f"UPDATE {s()}.renter_equipment SET status='rejected', is_active=false, reviewed_at=now() WHERE id=%s",
                    (int(eq_id),)
                )
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True}, ensure_ascii=False)}

            if method == "POST" and action == "approve_renter":
                renter_id = qp.get("renter_id", "")
                cur.execute(f"UPDATE {s()}.renters SET status='active' WHERE id=%s", (int(renter_id),))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True}, ensure_ascii=False)}

            if method == "POST" and action == "block_renter":
                renter_id = qp.get("renter_id", "")
                cur.execute(f"UPDATE {s()}.renters SET status='blocked' WHERE id=%s", (int(renter_id),))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True}, ensure_ascii=False)}

            # Список всего оборудования на модерации
            cur.execute(
                f"SELECT e.id, e.renter_id, e.name, e.category, e.subcategory, e.price, e.unit, "
                f"e.description, e.specs, e.tags, e.image, e.status, e.is_active, e.created_at, "
                f"r.company_name, r.email "
                f"FROM {s()}.renter_equipment e JOIN {s()}.renters r ON r.id = e.renter_id "
                f"ORDER BY e.created_at DESC"
            )
            rows = cur.fetchall()
            # Список прокатчиков
            cur.execute(f"SELECT id, email, company_name, contact_name, phone, city, telegram, status, created_at FROM {s()}.renters ORDER BY created_at DESC")
            renters = [{"id": r[0], "email": r[1], "company_name": r[2], "contact_name": r[3], "phone": r[4], "city": r[5], "telegram": r[6], "status": r[7], "created_at": str(r[8])} for r in cur.fetchall()]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"equipment": [row_to_eq(r) for r in rows], "renters": renters}, ensure_ascii=False, default=str)}

        # ── ЛИЧНЫЙ КАБИНЕТ ПРОКАТЧИКА ──
        if not token:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Требуется авторизация"}, ensure_ascii=False)}

        renter_id, renter_status = check_token(cur, token)
        if not renter_id:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Сессия истекла"}, ensure_ascii=False)}

        # GET — список своего оборудования
        if method == "GET":
            cur.execute(
                f"SELECT id, renter_id, name, category, subcategory, price, unit, description, specs, tags, image, status, is_active, created_at "
                f"FROM {s()}.renter_equipment WHERE renter_id=%s ORDER BY created_at DESC",
                (renter_id,)
            )
            rows = cur.fetchall()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps([row_to_eq(r) for r in rows], ensure_ascii=False, default=str)}

        # POST — добавить
        if method == "POST":
            if renter_status not in ("active", "pending"):
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Аккаунт не активен"}, ensure_ascii=False)}
            body = json.loads(event.get("body") or "{}")
            name = body.get("name", "").strip()
            category = body.get("category", "").strip()
            if not name or not category:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Название и категория обязательны"}, ensure_ascii=False)}

            cur.execute(
                f"INSERT INTO {s()}.renter_equipment (renter_id, name, category, subcategory, price, unit, description, specs, tags, image) "
                f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (renter_id, name, category, body.get("subcategory"), body.get("price", 0),
                 body.get("unit", "день"), body.get("description", ""),
                 json.dumps(body.get("specs", {})), body.get("tags", []), body.get("image"))
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 201, "headers": CORS, "body": json.dumps({"ok": True, "id": new_id, "message": "Оборудование отправлено на модерацию"}, ensure_ascii=False)}

        # PUT — обновить (только pending/rejected)
        if method == "PUT":
            body = json.loads(event.get("body") or "{}")
            eq_id = body.get("id")
            if not eq_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "id обязателен"}, ensure_ascii=False)}

            cur.execute(f"SELECT status FROM {s()}.renter_equipment WHERE id=%s AND renter_id=%s", (eq_id, renter_id))
            row = cur.fetchone()
            if not row:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Не найдено"}, ensure_ascii=False)}

            cur.execute(
                f"UPDATE {s()}.renter_equipment SET name=%s, category=%s, subcategory=%s, price=%s, unit=%s, description=%s, specs=%s, tags=%s, image=%s, status='pending', is_active=false "
                f"WHERE id=%s AND renter_id=%s",
                (body.get("name"), body.get("category"), body.get("subcategory"), body.get("price", 0),
                 body.get("unit", "день"), body.get("description", ""),
                 json.dumps(body.get("specs", {})), body.get("tags", []), body.get("image"), eq_id, renter_id)
            )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Изменения отправлены на повторную модерацию"}, ensure_ascii=False)}

        return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"}, ensure_ascii=False)}

    finally:
        cur.close()
        conn.close()
