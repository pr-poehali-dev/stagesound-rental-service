"""
Публичное чтение каталога оборудования и категорий для фронтенда.
"""
import json
import os
import psycopg2


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    try:
        cur.execute(f"SELECT id, name, sort_order FROM {schema}.categories ORDER BY sort_order, name")
        cat_rows = cur.fetchall()
        categories = [r[1] for r in cat_rows]

        cur.execute(f"SELECT id, name, category, sort_order FROM {schema}.subcategories ORDER BY category, sort_order, name")
        sub_rows = cur.fetchall()
        subcategories = [{"name": r[1], "category": r[2]} for r in sub_rows]

        cur.execute(f"""
            SELECT id, name, category, subcategory, price, unit, rating, reviews,
                   popular, specs, description, tags, image, usage, sort_order
            FROM {schema}.equipment
            WHERE is_active = true
            ORDER BY category, sort_order, name
        """)
        eq_rows = cur.fetchall()
        equipment = []
        for r in eq_rows:
            equipment.append({
                "id": r[0], "name": r[1], "category": r[2], "subcategory": r[3],
                "price": r[4], "unit": r[5], "rating": float(r[6]), "reviews": r[7],
                "popular": r[8], "specs": r[9] or {}, "description": r[10],
                "tags": list(r[11]) if r[11] else [], "image": r[12],
                "usage": r[13], "sort_order": r[14],
                "source": "own",
            })

        # Добавляем одобренное оборудование прокатчиков
        cur.execute(f"""
            SELECT e.id, e.name, e.category, e.subcategory, e.price, e.unit,
                   e.description, e.specs, e.tags, e.image, r.company_name
            FROM {schema}.renter_equipment e
            JOIN {schema}.renters r ON r.id = e.renter_id
            WHERE e.status = 'approved' AND e.is_active = true AND r.status = 'active'
            ORDER BY e.created_at DESC
        """)
        renter_rows = cur.fetchall()
        renter_id_offset = 100000
        for r in renter_rows:
            equipment.append({
                "id": renter_id_offset + r[0], "name": r[1], "category": r[2], "subcategory": r[3],
                "price": r[4], "unit": r[5], "rating": 5.0, "reviews": 0,
                "popular": False, "specs": r[7] or {}, "description": r[6],
                "tags": list(r[8]) if r[8] else [], "image": r[9],
                "usage": None, "sort_order": 999,
                "source": "renter", "renter_company": r[10],
                "renter_equipment_id": r[0],
            })

        # Если таблица пустая — отдаём пустой каталог
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "categories": categories,
                "subcategories": subcategories,
                "equipment": equipment,
            }, ensure_ascii=False),
        }

    finally:
        cur.close()
        conn.close()