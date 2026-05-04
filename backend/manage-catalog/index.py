"""
CRUD для управления каталогом оборудования и категорий.
Доступен только с паролем администратора.
"""
import json
import os
import psycopg2


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    "Content-Type": "application/json",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def check_auth(event):
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    password = headers.get("x-admin-password", "")
    return password == os.environ.get("ADMIN_PASSWORD", "")


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    if not check_auth(event):
        return {"statusCode": 401, "headers": CORS_HEADERS, "body": json.dumps({"error": "Unauthorized"})}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")

    # Определяем ресурс из пути: /categories, /subcategories, /equipment
    parts = [p for p in path.split("/") if p]
    resource = parts[-1] if parts else ""
    # Если последний сегмент — число, это id
    resource_id = None
    if resource.isdigit():
        resource_id = int(resource)
        resource = parts[-2] if len(parts) >= 2 else ""

    conn = get_conn()
    cur = conn.cursor()

    try:
        # ── КАТЕГОРИИ ──────────────────────────────────────────────────
        if resource == "categories":
            if method == "GET":
                cur.execute(f"SELECT id, name, sort_order FROM {schema}.categories ORDER BY sort_order, name")
                rows = cur.fetchall()
                data = [{"id": r[0], "name": r[1], "sort_order": r[2]} for r in rows]
                return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"categories": data})}

            body = json.loads(event.get("body") or "{}")

            if method == "POST":
                name = body.get("name", "").strip()
                sort_order = body.get("sort_order", 0)
                cur.execute(f"INSERT INTO {schema}.categories (name, sort_order) VALUES (%s, %s) RETURNING id", (name, sort_order))
                new_id = cur.fetchone()[0]
                conn.commit()
                return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"id": new_id, "name": name})}

            if method == "PUT" and resource_id:
                name = body.get("name", "").strip()
                sort_order = body.get("sort_order", 0)
                cur.execute(f"UPDATE {schema}.categories SET name=%s, sort_order=%s WHERE id=%s", (name, sort_order, resource_id))
                conn.commit()
                return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"ok": True})}

            if method == "DELETE" and resource_id:
                cur.execute(f"SELECT name FROM {schema}.categories WHERE id=%s", (resource_id,))
                row = cur.fetchone()
                if row:
                    cur.execute(f"DELETE FROM {schema}.subcategories WHERE category=%s", (row[0],))
                cur.execute(f"DELETE FROM {schema}.categories WHERE id=%s", (resource_id,))
                conn.commit()
                return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"ok": True})}

        # ── ПОДКАТЕГОРИИ ───────────────────────────────────────────────
        elif resource == "subcategories":
            if method == "GET":
                cur.execute(f"SELECT id, name, category, sort_order FROM {schema}.subcategories ORDER BY category, sort_order, name")
                rows = cur.fetchall()
                data = [{"id": r[0], "name": r[1], "category": r[2], "sort_order": r[3]} for r in rows]
                return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"subcategories": data})}

            body = json.loads(event.get("body") or "{}")

            if method == "POST":
                name = body.get("name", "").strip()
                category = body.get("category", "").strip()
                sort_order = body.get("sort_order", 0)
                cur.execute(f"INSERT INTO {schema}.subcategories (name, category, sort_order) VALUES (%s, %s, %s) RETURNING id", (name, category, sort_order))
                new_id = cur.fetchone()[0]
                conn.commit()
                return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"id": new_id})}

            if method == "PUT" and resource_id:
                name = body.get("name", "").strip()
                category = body.get("category", "").strip()
                sort_order = body.get("sort_order", 0)
                cur.execute(f"UPDATE {schema}.subcategories SET name=%s, category=%s, sort_order=%s WHERE id=%s", (name, category, sort_order, resource_id))
                conn.commit()
                return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"ok": True})}

            if method == "DELETE" and resource_id:
                cur.execute(f"DELETE FROM {schema}.subcategories WHERE id=%s", (resource_id,))
                conn.commit()
                return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"ok": True})}

        # ── ОБОРУДОВАНИЕ ──────────────────────────────────────────────
        elif resource == "equipment":
            if method == "GET":
                cur.execute(f"""
                    SELECT id, name, category, subcategory, price, unit, rating, reviews,
                           popular, specs, description, tags, image, usage, sort_order, is_active
                    FROM {schema}.equipment
                    ORDER BY category, sort_order, name
                """)
                rows = cur.fetchall()
                data = []
                for r in rows:
                    data.append({
                        "id": r[0], "name": r[1], "category": r[2], "subcategory": r[3],
                        "price": r[4], "unit": r[5], "rating": float(r[6]), "reviews": r[7],
                        "popular": r[8], "specs": r[9] or {}, "description": r[10],
                        "tags": list(r[11]) if r[11] else [], "image": r[12],
                        "usage": r[13], "sort_order": r[14], "is_active": r[15],
                    })
                return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"equipment": data})}

            body = json.loads(event.get("body") or "{}")

            def upsert_fields(b):
                return (
                    b.get("name", ""), b.get("category", ""), b.get("subcategory") or None,
                    int(b.get("price", 0)), b.get("unit", "день"),
                    float(b.get("rating", 5)), int(b.get("reviews", 0)),
                    bool(b.get("popular", False)),
                    json.dumps(b.get("specs", {}), ensure_ascii=False),
                    b.get("description", ""),
                    b.get("tags", []),
                    b.get("image") or None,
                    b.get("usage") or None,
                    int(b.get("sort_order", 0)),
                    bool(b.get("is_active", True)),
                )

            if method == "POST":
                f = upsert_fields(body)
                cur.execute(f"""
                    INSERT INTO {schema}.equipment
                    (name, category, subcategory, price, unit, rating, reviews, popular, specs, description, tags, image, usage, sort_order, is_active)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s)
                    RETURNING id
                """, f)
                new_id = cur.fetchone()[0]
                conn.commit()
                return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"id": new_id})}

            if method == "PUT" and resource_id:
                f = upsert_fields(body)
                cur.execute(f"""
                    UPDATE {schema}.equipment
                    SET name=%s, category=%s, subcategory=%s, price=%s, unit=%s, rating=%s, reviews=%s,
                        popular=%s, specs=%s::jsonb, description=%s, tags=%s, image=%s, usage=%s, sort_order=%s, is_active=%s
                    WHERE id=%s
                """, f + (resource_id,))
                conn.commit()
                return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"ok": True})}

            if method == "DELETE" and resource_id:
                cur.execute(f"DELETE FROM {schema}.equipment WHERE id=%s", (resource_id,))
                conn.commit()
                return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"ok": True})}

        return {"statusCode": 404, "headers": CORS_HEADERS, "body": json.dumps({"error": "Not found"})}

    finally:
        cur.close()
        conn.close()