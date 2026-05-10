"""
CRUD для управления каталогом оборудования и категорий.
Доступен только с паролем администратора.
Пароль и ресурс передаются через query параметры: ?pwd=...&resource=...&id=...
"""
import json
import os
import psycopg2


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ok(data):
    return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps(data, ensure_ascii=False)}


def err(status, msg):
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps({"error": msg})}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    qp = event.get("queryStringParameters") or {}
    password = qp.get("pwd", "")
    expected = os.environ.get("ADMIN_PASSWORD", "Qwert12345")

    if password.lower() != expected.lower():
        return err(401, "Unauthorized")

    method = event.get("httpMethod", "GET")
    resource = qp.get("resource", "")
    resource_id = qp.get("id")
    if resource_id:
        resource_id = int(resource_id)

    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = get_conn()
    cur = conn.cursor()

    try:
        # ── КАТЕГОРИИ ──────────────────────────────────────────────────
        if resource == "categories":
            if method == "GET":
                cur.execute(f"SELECT id, name, sort_order FROM {schema}.categories ORDER BY sort_order, name")
                rows = cur.fetchall()
                return ok({"categories": [{"id": r[0], "name": r[1], "sort_order": r[2]} for r in rows]})

            body = json.loads(event.get("body") or "{}")

            if method == "POST":
                cur.execute(f"INSERT INTO {schema}.categories (name, sort_order) VALUES (%s, %s) RETURNING id",
                            (body.get("name", ""), body.get("sort_order", 0)))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT" and resource_id:
                cur.execute(f"UPDATE {schema}.categories SET name=%s, sort_order=%s WHERE id=%s",
                            (body.get("name", ""), body.get("sort_order", 0), resource_id))
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE" and resource_id:
                cur.execute(f"SELECT name FROM {schema}.categories WHERE id=%s", (resource_id,))
                row = cur.fetchone()
                if row:
                    cur.execute(f"DELETE FROM {schema}.subcategories WHERE category=%s", (row[0],))
                cur.execute(f"DELETE FROM {schema}.categories WHERE id=%s", (resource_id,))
                conn.commit()
                return ok({"ok": True})

        # ── ПОДКАТЕГОРИИ ───────────────────────────────────────────────
        elif resource == "subcategories":
            if method == "GET":
                cur.execute(f"SELECT id, name, category, sort_order FROM {schema}.subcategories ORDER BY category, sort_order, name")
                rows = cur.fetchall()
                return ok({"subcategories": [{"id": r[0], "name": r[1], "category": r[2], "sort_order": r[3]} for r in rows]})

            body = json.loads(event.get("body") or "{}")

            if method == "POST":
                cur.execute(f"INSERT INTO {schema}.subcategories (name, category, sort_order) VALUES (%s, %s, %s) RETURNING id",
                            (body.get("name", ""), body.get("category", ""), body.get("sort_order", 0)))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT" and resource_id:
                cur.execute(f"UPDATE {schema}.subcategories SET name=%s, category=%s, sort_order=%s WHERE id=%s",
                            (body.get("name", ""), body.get("category", ""), body.get("sort_order", 0), resource_id))
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE" and resource_id:
                cur.execute(f"DELETE FROM {schema}.subcategories WHERE id=%s", (resource_id,))
                conn.commit()
                return ok({"ok": True})

        # ── ОБОРУДОВАНИЕ ──────────────────────────────────────────────
        elif resource == "equipment":
            if method == "GET":
                cur.execute(f"""
                    SELECT id, name, category, subcategory, price, unit, rating, reviews,
                           popular, specs, description, tags, image, usage, sort_order, is_active, variants
                    FROM {schema}.equipment ORDER BY category, sort_order, name
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
                        "variants": r[16] if r[16] else [],
                    })
                return ok({"equipment": data})

            body = json.loads(event.get("body") or "{}")

            def fields(b):
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
                    json.dumps(b.get("variants", []), ensure_ascii=False),
                )

            if method == "POST":
                f = fields(body)
                cur.execute(f"""
                    INSERT INTO {schema}.equipment
                    (name,category,subcategory,price,unit,rating,reviews,popular,specs,description,tags,image,usage,sort_order,is_active,variants)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s,%s::jsonb) RETURNING id
                """, f)
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT" and resource_id:
                f = fields(body)
                cur.execute(f"""
                    UPDATE {schema}.equipment
                    SET name=%s,category=%s,subcategory=%s,price=%s,unit=%s,rating=%s,reviews=%s,
                        popular=%s,specs=%s::jsonb,description=%s,tags=%s,image=%s,usage=%s,sort_order=%s,is_active=%s,variants=%s::jsonb
                    WHERE id=%s
                """, f + (resource_id,))
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE" and resource_id:
                cur.execute(f"DELETE FROM {schema}.equipment WHERE id=%s", (resource_id,))
                conn.commit()
                return ok({"ok": True})

        return err(404, "Not found")

    finally:
        cur.close()
        conn.close()