"""
CRUD оборудования, категорий и подкатегорий прокатчика + модерация администратором.

Параметр ?resource= определяет ресурс: equipment (по умолчанию) | categories | subcategories

ПРОКАТЧИК (X-Renter-Token):
  GET    /                          — список своего оборудования
  GET    /?resource=categories      — свои категории + все одобренные категории
  GET    /?resource=subcategories   — свои подкатегории + все одобренные подкатегории
  POST   /                          — добавить оборудование
  POST   /?resource=categories      — предложить категорию
  POST   /?resource=subcategories   — предложить подкатегорию
  PUT    /                          — обновить оборудование
  DELETE /?resource=categories&id=N — удалить свою категорию (только pending/rejected)
  DELETE /?resource=subcategories&id=N

ADMIN (?admin=1&pwd=...):
  GET    /?admin=1          — всё оборудование + прокатчики + категории + подкатегории
  POST   /?admin=1&action=approve&id=N
  POST   /?admin=1&action=reject&id=N
  POST   /?admin=1&action=approve_cat&id=N
  POST   /?admin=1&action=reject_cat&id=N
  POST   /?admin=1&action=approve_sub&id=N
  POST   /?admin=1&action=reject_sub&id=N
  POST   /?admin=1&action=approve_renter&renter_id=N
  POST   /?admin=1&action=block_renter&renter_id=N

PUBLIC (?public=1):
  GET    /?public=1         — одобренное оборудование для каталога
"""
import json
import os
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
    return pwd.lower() == os.environ.get("ADMIN_PASSWORD", "").lower()

def row_to_eq(row) -> dict:
    return {
        "id": row[0], "renter_id": row[1], "name": row[2], "category": row[3],
        "subcategory": row[4], "price": row[5], "unit": row[6],
        "description": row[7], "specs": row[8] or {}, "tags": list(row[9]) if row[9] else [],
        "image": row[10], "status": row[11], "is_active": row[12],
        "created_at": str(row[13]),
        "renter_company": row[14] if len(row) > 14 else None,
        "renter_email":   row[15] if len(row) > 15 else None,
    }

def handler(event: dict, context) -> dict:
    """Управление оборудованием, категориями и подкатегориями прокатчиков."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qp     = event.get("queryStringParameters") or {}
    token  = (event.get("headers") or {}).get("X-Renter-Token", "")
    resource    = qp.get("resource", "equipment")
    admin_mode  = qp.get("admin") == "1"
    public_mode = qp.get("public") == "1"
    pwd    = qp.get("pwd", "")
    action = qp.get("action", "")
    item_id = qp.get("id", "")

    conn = get_conn()
    cur  = conn.cursor()

    try:
        # ══════════════════════════════════════════════════════════════
        # ПУБЛИЧНЫЙ КАТАЛОГ
        # ══════════════════════════════════════════════════════════════
        if public_mode and method == "GET":
            cur.execute(
                f"SELECT e.id, e.renter_id, e.name, e.category, e.subcategory, e.price, e.unit, "
                f"e.description, e.specs, e.tags, e.image, e.status, e.is_active, e.created_at, "
                f"r.company_name, r.email "
                f"FROM {s()}.renter_equipment e JOIN {s()}.renters r ON r.id = e.renter_id "
                f"WHERE e.status='approved' AND e.is_active=true AND r.status='active' "
                f"ORDER BY e.created_at DESC"
            )
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps([row_to_eq(r) for r in cur.fetchall()], ensure_ascii=False, default=str)}

        # ══════════════════════════════════════════════════════════════
        # ADMIN РЕЖИМ
        # ══════════════════════════════════════════════════════════════
        if admin_mode:
            if not check_admin(pwd):
                return {"statusCode": 401, "headers": CORS,
                        "body": json.dumps({"error": "Unauthorized"}, ensure_ascii=False)}

            # ── одобрить/отклонить оборудование ──
            if action == "approve" and item_id:
                cur.execute(f"UPDATE {s()}.renter_equipment SET status='approved', is_active=true, reviewed_at=now() WHERE id=%s", (int(item_id),))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            if action == "reject" and item_id:
                cur.execute(f"UPDATE {s()}.renter_equipment SET status='rejected', is_active=false, reviewed_at=now() WHERE id=%s", (int(item_id),))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            # ── одобрить/отклонить категорию ──
            if action == "approve_cat" and item_id:
                # Одобряем — добавляем в основной каталог если ещё нет
                cur.execute(f"SELECT name FROM {s()}.renter_categories WHERE id=%s", (int(item_id),))
                row = cur.fetchone()
                if row:
                    cat_name = row[0]
                    cur.execute(f"SELECT id FROM {s()}.categories WHERE name=%s", (cat_name,))
                    if not cur.fetchone():
                        cur.execute(f"INSERT INTO {s()}.categories (name, sort_order) VALUES (%s, (SELECT COALESCE(MAX(sort_order),0)+1 FROM {s()}.categories))", (cat_name,))
                    cur.execute(f"UPDATE {s()}.renter_categories SET status='approved', reviewed_at=now() WHERE id=%s", (int(item_id),))
                    conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            if action == "reject_cat" and item_id:
                cur.execute(f"UPDATE {s()}.renter_categories SET status='rejected', reviewed_at=now() WHERE id=%s", (int(item_id),))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            # ── одобрить/отклонить подкатегорию ──
            if action == "approve_sub" and item_id:
                cur.execute(f"SELECT name, category FROM {s()}.renter_subcategories WHERE id=%s", (int(item_id),))
                row = cur.fetchone()
                if row:
                    sub_name, sub_cat = row
                    cur.execute(f"SELECT id FROM {s()}.subcategories WHERE name=%s AND category=%s", (sub_name, sub_cat))
                    if not cur.fetchone():
                        cur.execute(f"INSERT INTO {s()}.subcategories (name, category, sort_order) VALUES (%s, %s, 0)", (sub_name, sub_cat))
                    cur.execute(f"UPDATE {s()}.renter_subcategories SET status='approved', reviewed_at=now() WHERE id=%s", (int(item_id),))
                    conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            if action == "reject_sub" and item_id:
                cur.execute(f"UPDATE {s()}.renter_subcategories SET status='rejected', reviewed_at=now() WHERE id=%s", (int(item_id),))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            # ── управление прокатчиками ──
            if action == "approve_renter":
                cur.execute(f"UPDATE {s()}.renters SET status='active' WHERE id=%s", (int(qp.get("renter_id", 0)),))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            if action == "block_renter":
                cur.execute(f"UPDATE {s()}.renters SET status='blocked' WHERE id=%s", (int(qp.get("renter_id", 0)),))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            # GET — весь список для модерации
            cur.execute(
                f"SELECT e.id, e.renter_id, e.name, e.category, e.subcategory, e.price, e.unit, "
                f"e.description, e.specs, e.tags, e.image, e.status, e.is_active, e.created_at, "
                f"r.company_name, r.email "
                f"FROM {s()}.renter_equipment e JOIN {s()}.renters r ON r.id=e.renter_id ORDER BY e.created_at DESC"
            )
            equipment = [row_to_eq(r) for r in cur.fetchall()]

            cur.execute(f"SELECT id, email, company_name, contact_name, phone, city, telegram, status, created_at FROM {s()}.renters ORDER BY created_at DESC")
            renters = [{"id": r[0], "email": r[1], "company_name": r[2], "contact_name": r[3],
                        "phone": r[4], "city": r[5], "telegram": r[6], "status": r[7], "created_at": str(r[8])} for r in cur.fetchall()]

            cur.execute(f"SELECT rc.id, rc.renter_id, rc.name, rc.status, rc.created_at, r.company_name FROM {s()}.renter_categories rc JOIN {s()}.renters r ON r.id=rc.renter_id ORDER BY rc.created_at DESC")
            categories = [{"id": r[0], "renter_id": r[1], "name": r[2], "status": r[3], "created_at": str(r[4]), "renter_company": r[5]} for r in cur.fetchall()]

            cur.execute(f"SELECT rs.id, rs.renter_id, rs.name, rs.category, rs.status, rs.created_at, r.company_name FROM {s()}.renter_subcategories rs JOIN {s()}.renters r ON r.id=rs.renter_id ORDER BY rs.created_at DESC")
            subcategories = [{"id": r[0], "renter_id": r[1], "name": r[2], "category": r[3], "status": r[4], "created_at": str(r[5]), "renter_company": r[6]} for r in cur.fetchall()]

            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps({"equipment": equipment, "renters": renters,
                                        "categories": categories, "subcategories": subcategories},
                                       ensure_ascii=False, default=str)}

        # ══════════════════════════════════════════════════════════════
        # КАБИНЕТ ПРОКАТЧИКА
        # ══════════════════════════════════════════════════════════════
        if not token:
            return {"statusCode": 401, "headers": CORS,
                    "body": json.dumps({"error": "Требуется авторизация"}, ensure_ascii=False)}

        renter_id, renter_status = check_token(cur, token)
        if not renter_id:
            return {"statusCode": 401, "headers": CORS,
                    "body": json.dumps({"error": "Сессия истекла"}, ensure_ascii=False)}

        # ── КАТЕГОРИИ ──────────────────────────────────────────────────
        if resource == "categories":
            if method == "GET":
                # Свои категории
                cur.execute(f"SELECT id, name, status, created_at FROM {s()}.renter_categories WHERE renter_id=%s ORDER BY created_at DESC", (renter_id,))
                mine = [{"id": r[0], "name": r[1], "status": r[2], "created_at": str(r[3]), "mine": True} for r in cur.fetchall()]
                # Все одобренные из основного каталога
                cur.execute(f"SELECT id, name FROM {s()}.categories ORDER BY sort_order, name")
                approved = [{"id": r[0], "name": r[1], "status": "approved", "mine": False} for r in cur.fetchall()]
                return {"statusCode": 200, "headers": CORS,
                        "body": json.dumps({"mine": mine, "all": approved}, ensure_ascii=False)}

            if method == "POST":
                body = json.loads(event.get("body") or "{}")
                name = body.get("name", "").strip()
                if not name:
                    return {"statusCode": 400, "headers": CORS,
                            "body": json.dumps({"error": "Укажите название раздела"}, ensure_ascii=False)}
                # Проверяем — нет ли уже такого
                cur.execute(f"SELECT id FROM {s()}.categories WHERE LOWER(name)=LOWER(%s)", (name,))
                if cur.fetchone():
                    return {"statusCode": 409, "headers": CORS,
                            "body": json.dumps({"error": "Такой раздел уже существует в каталоге"}, ensure_ascii=False)}
                cur.execute(f"SELECT id FROM {s()}.renter_categories WHERE renter_id=%s AND LOWER(name)=LOWER(%s) AND status!='rejected'", (renter_id, name))
                if cur.fetchone():
                    return {"statusCode": 409, "headers": CORS,
                            "body": json.dumps({"error": "Вы уже предложили этот раздел"}, ensure_ascii=False)}
                cur.execute(f"INSERT INTO {s()}.renter_categories (renter_id, name) VALUES (%s,%s) RETURNING id", (renter_id, name))
                new_id = cur.fetchone()[0]
                conn.commit()
                return {"statusCode": 201, "headers": CORS,
                        "body": json.dumps({"ok": True, "id": new_id, "message": "Раздел отправлен на согласование"}, ensure_ascii=False)}

            if method == "DELETE" and item_id:
                cur.execute(f"DELETE FROM {s()}.renter_categories WHERE id=%s AND renter_id=%s AND status!='approved'", (int(item_id), renter_id))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # ── ПОДКАТЕГОРИИ ───────────────────────────────────────────────
        if resource == "subcategories":
            if method == "GET":
                cur.execute(f"SELECT id, name, category, status, created_at FROM {s()}.renter_subcategories WHERE renter_id=%s ORDER BY created_at DESC", (renter_id,))
                mine = [{"id": r[0], "name": r[1], "category": r[2], "status": r[3], "created_at": str(r[4]), "mine": True} for r in cur.fetchall()]
                cur.execute(f"SELECT id, name, category FROM {s()}.subcategories ORDER BY category, sort_order, name")
                approved = [{"id": r[0], "name": r[1], "category": r[2], "status": "approved", "mine": False} for r in cur.fetchall()]
                return {"statusCode": 200, "headers": CORS,
                        "body": json.dumps({"mine": mine, "all": approved}, ensure_ascii=False)}

            if method == "POST":
                body = json.loads(event.get("body") or "{}")
                name     = body.get("name", "").strip()
                category = body.get("category", "").strip()
                if not name or not category:
                    return {"statusCode": 400, "headers": CORS,
                            "body": json.dumps({"error": "Укажите название и раздел"}, ensure_ascii=False)}
                cur.execute(f"SELECT id FROM {s()}.subcategories WHERE LOWER(name)=LOWER(%s) AND LOWER(category)=LOWER(%s)", (name, category))
                if cur.fetchone():
                    return {"statusCode": 409, "headers": CORS,
                            "body": json.dumps({"error": "Такой подраздел уже существует"}, ensure_ascii=False)}
                cur.execute(f"SELECT id FROM {s()}.renter_subcategories WHERE renter_id=%s AND LOWER(name)=LOWER(%s) AND LOWER(category)=LOWER(%s) AND status!='rejected'", (renter_id, name, category))
                if cur.fetchone():
                    return {"statusCode": 409, "headers": CORS,
                            "body": json.dumps({"error": "Вы уже предложили этот подраздел"}, ensure_ascii=False)}
                cur.execute(f"INSERT INTO {s()}.renter_subcategories (renter_id, name, category) VALUES (%s,%s,%s) RETURNING id", (renter_id, name, category))
                new_id = cur.fetchone()[0]
                conn.commit()
                return {"statusCode": 201, "headers": CORS,
                        "body": json.dumps({"ok": True, "id": new_id, "message": "Подраздел отправлен на согласование"}, ensure_ascii=False)}

            if method == "DELETE" and item_id:
                cur.execute(f"DELETE FROM {s()}.renter_subcategories WHERE id=%s AND renter_id=%s AND status!='approved'", (int(item_id), renter_id))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # ── ОБОРУДОВАНИЕ ───────────────────────────────────────────────
        if method == "GET":
            cur.execute(
                f"SELECT id, renter_id, name, category, subcategory, price, unit, description, specs, tags, image, status, is_active, created_at "
                f"FROM {s()}.renter_equipment WHERE renter_id=%s ORDER BY created_at DESC",
                (renter_id,)
            )
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps([row_to_eq(r) for r in cur.fetchall()], ensure_ascii=False, default=str)}

        if method == "POST":
            body    = json.loads(event.get("body") or "{}")
            name    = body.get("name", "").strip()
            category = body.get("category", "").strip()
            if not name or not category:
                return {"statusCode": 400, "headers": CORS,
                        "body": json.dumps({"error": "Название и категория обязательны"}, ensure_ascii=False)}
            cur.execute(
                f"INSERT INTO {s()}.renter_equipment (renter_id,name,category,subcategory,price,unit,description,specs,tags,image) "
                f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (renter_id, name, category, body.get("subcategory") or None, body.get("price", 0),
                 body.get("unit", "день"), body.get("description", ""),
                 json.dumps(body.get("specs", {})), body.get("tags", []), body.get("image") or None)
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 201, "headers": CORS,
                    "body": json.dumps({"ok": True, "id": new_id, "message": "Оборудование отправлено на модерацию"}, ensure_ascii=False)}

        if method == "PUT":
            body   = json.loads(event.get("body") or "{}")
            eq_id  = body.get("id")
            if not eq_id:
                return {"statusCode": 400, "headers": CORS,
                        "body": json.dumps({"error": "id обязателен"}, ensure_ascii=False)}
            cur.execute(f"SELECT id FROM {s()}.renter_equipment WHERE id=%s AND renter_id=%s", (eq_id, renter_id))
            if not cur.fetchone():
                return {"statusCode": 404, "headers": CORS,
                        "body": json.dumps({"error": "Не найдено"}, ensure_ascii=False)}
            cur.execute(
                f"UPDATE {s()}.renter_equipment SET name=%s,category=%s,subcategory=%s,price=%s,unit=%s,"
                f"description=%s,specs=%s,tags=%s,image=%s,status='pending',is_active=false "
                f"WHERE id=%s AND renter_id=%s",
                (body.get("name"), body.get("category"), body.get("subcategory") or None,
                 body.get("price", 0), body.get("unit", "день"), body.get("description", ""),
                 json.dumps(body.get("specs", {})), body.get("tags", []),
                 body.get("image") or None, eq_id, renter_id)
            )
            conn.commit()
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps({"ok": True, "message": "Изменения отправлены на модерацию"}, ensure_ascii=False)}

        return {"statusCode": 405, "headers": CORS,
                "body": json.dumps({"error": "Method not allowed"}, ensure_ascii=False)}

    finally:
        cur.close()
        conn.close()
