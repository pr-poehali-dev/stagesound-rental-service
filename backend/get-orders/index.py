import json
import os
import psycopg2

def handler(event: dict, context) -> dict:
    """Получение списка заявок для страницы администратора."""
    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors, "body": ""}

    raw_headers = event.get("headers") or {}
    headers = {k.lower(): v for k, v in raw_headers.items()}
    password = headers.get("x-admin-password", "")
    if password != os.environ.get("ADMIN_PASSWORD", ""):
        return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Unauthorized"})}

    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        f"SELECT id, name, phone, date, place, comment, items, days, delivery, extras, total, created_at "
        f"FROM {schema}.orders ORDER BY id DESC LIMIT 200"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    orders = []
    for row in rows:
        orders.append({
            "id": row[0],
            "order_number": f"SS-{row[0]:04d}",
            "name": row[1],
            "phone": row[2],
            "date": row[3],
            "place": row[4],
            "comment": row[5],
            "items": row[6],
            "days": row[7],
            "delivery": row[8],
            "extras": row[9],
            "total": row[10],
            "created_at": row[11].isoformat() if row[11] else None,
        })

    return {"statusCode": 200, "headers": cors, "body": json.dumps({"orders": orders})}