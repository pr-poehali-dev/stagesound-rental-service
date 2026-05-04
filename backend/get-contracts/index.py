"""
Получение списка договоров (для менеджера в Admin Panel).
GET /?pwd=X          — все договоры с данными КП
GET /?pwd=X&id=N     — конкретный договор
PUT /?pwd=X&id=N     — изменить статус договора
"""
import json
import os
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qp = event.get("queryStringParameters") or {}
    pwd = qp.get("pwd", "")
    expected = os.environ.get("ADMIN_PASSWORD", "Qwert12345")
    if pwd.lower() != expected.lower():
        return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}

    method = event.get("httpMethod", "GET")
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = db()
    cur = conn.cursor()

    if method == "GET":
        cid = qp.get("id")
        if cid:
            cur.execute(
                f"""SELECT c.id, c.quote_id, c.client_type,
                    c.full_name, c.passport_series, c.passport_number, c.passport_issued, c.passport_date,
                    c.birth_date, c.address,
                    c.company_name, c.inn, c.kpp, c.ogrn, c.legal_address, c.director,
                    c.phone, c.email, c.passport_file_url, c.status, c.created_at,
                    q.title, q.items, q.days, q.delivery, q.delivery_price, q.extras, q.total
                FROM {schema}.contracts c
                JOIN {schema}.quotes q ON q.id = c.quote_id
                WHERE c.id = %s""", (int(cid),)
            )
            row = cur.fetchone()
            if not row:
                cur.close(); conn.close()
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
            keys = ["id","quote_id","client_type","full_name","passport_series","passport_number",
                    "passport_issued","passport_date","birth_date","address",
                    "company_name","inn","kpp","ogrn","legal_address","director",
                    "phone","email","passport_file_url","status","created_at",
                    "quote_title","items","days","delivery","delivery_price","extras","total"]
            result = dict(zip(keys, row))
            result["created_at"] = str(result["created_at"])
            cur.close(); conn.close()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(result)}
        else:
            cur.execute(
                f"""SELECT c.id, c.quote_id, c.client_type, c.full_name, c.company_name,
                    c.phone, c.email, c.status, c.created_at,
                    q.title, q.total, c.passport_file_url
                FROM {schema}.contracts c
                JOIN {schema}.quotes q ON q.id = c.quote_id
                ORDER BY c.created_at DESC"""
            )
            keys = ["id","quote_id","client_type","full_name","company_name",
                    "phone","email","status","created_at","quote_title","total","passport_file_url"]
            rows = [dict(zip(keys, r)) for r in cur.fetchall()]
            for r in rows:
                r["created_at"] = str(r["created_at"])
            cur.close(); conn.close()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(rows)}

    if method == "PUT":
        cid = int(qp.get("id", 0))
        body = json.loads(event.get("body") or "{}")
        new_status = body.get("status", "reviewed")
        cur.execute(f"UPDATE {schema}.contracts SET status=%s WHERE id=%s", (new_status, cid))
        conn.commit(); cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    cur.close(); conn.close()
    return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}
