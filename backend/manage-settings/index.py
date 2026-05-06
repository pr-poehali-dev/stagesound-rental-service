"""
Управление настройками сайта (контакты, реквизиты).
GET  /?pwd=X        — получить все настройки (публичный GET без пароля тоже разрешён для чтения)
PUT  /?pwd=X        — обновить настройки (body: JSON объект {key: value, ...})
"""
import json, os
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}

def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def handler(event: dict, context) -> dict:
    """Управление настройками сайта — контакты, телефон, email, адрес, соцсети."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    method = event.get("httpMethod", "GET")
    qp = event.get("queryStringParameters") or {}

    # GET — публичное чтение настроек (без пароля)
    if method == "GET":
        conn = get_db()
        cur = conn.cursor()
        cur.execute(f"SELECT key, value, label FROM {schema}.settings ORDER BY key")
        rows = cur.fetchall()
        cur.close(); conn.close()
        result = {row[0]: {"value": row[1], "label": row[2]} for row in rows}
        return {"statusCode": 200, "headers": CORS, "body": json.dumps(result, ensure_ascii=False)}

    # PUT — только с паролем
    if method == "PUT":
        pwd = qp.get("pwd", "")
        if pwd.lower() != os.environ.get("ADMIN_PASSWORD", "").lower():
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}

        body = json.loads(event.get("body") or "{}")
        if not body:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Empty body"})}

        conn = get_db()
        cur = conn.cursor()
        for key, value in body.items():
            cur.execute(
                f"UPDATE {schema}.settings SET value = %s, updated_at = NOW() WHERE key = %s",
                (str(value), str(key))
            )
        conn.commit()
        cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}
