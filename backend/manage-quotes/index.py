"""
CRUD для коммерческих предложений (КП) менеджера.
GET  /?pwd=X              — список всех КП
GET  /?pwd=X&token=T      — КП по токену (публичный, без пароля)
POST /?pwd=X              — создать КП {title, items, days, delivery, delivery_price, extras, total}
PUT  /?pwd=X&id=N         — обновить КП
DELETE /?pwd=X&id=N       — удалить КП
POST /?pwd=X&action=send&id=N — пометить как отправленное (вернуть ссылку)
POST /?action=submit_contract&token=T — клиент отправляет договор (без пароля)
"""
import base64
import json
import os
import secrets
import uuid
import psycopg2
import urllib.request
import urllib.parse
import boto3

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def check_pwd(event: dict) -> bool:
    qp = event.get("queryStringParameters") or {}
    pwd = qp.get("pwd", "")
    expected = os.environ.get("ADMIN_PASSWORD", "Qwert12345")
    return pwd.lower() == expected.lower()


def send_telegram(text: str):
    try:
        token = os.environ["TELEGRAM_BOT_TOKEN"]
        chat_id = os.environ["TELEGRAM_CHAT_ID"]
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        data = urllib.parse.urlencode({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode()
        req = urllib.request.Request(url, data=data, method="POST")
        with urllib.request.urlopen(req, timeout=10):
            pass
    except Exception:
        pass


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qp = event.get("queryStringParameters") or {}
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")

    # === Публичный: получить КП по токену (для страницы клиента) ===
    token = qp.get("token", "")
    if method == "GET" and token:
        conn = db()
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, token, title, items, days, delivery, delivery_price, extras, total, status, created_at, event_date, delivery_address "
            f"FROM {schema}.quotes WHERE token = %s", (token,)
        )
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
        keys = ["id", "token", "title", "items", "days", "delivery", "delivery_price", "extras", "total", "status", "created_at", "event_date", "delivery_address"]
        q = dict(zip(keys, row))
        q["created_at"] = str(q["created_at"])
        return {"statusCode": 200, "headers": CORS, "body": json.dumps(q)}

    # === Публичный: клиент загружает файл паспорта ===
    action = qp.get("action", "")
    if method == "POST" and action == "upload_passport":
        body = json.loads(event.get("body") or "{}")
        file_data = body.get("file", "")
        file_name = body.get("name", "passport.jpg")
        tok = qp.get("token", "")
        if not tok:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "token required"})}
        if "," in file_data:
            file_data = file_data.split(",", 1)[1]
        image_bytes = base64.b64decode(file_data)
        ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else "jpg"
        if ext not in ("jpg", "jpeg", "png", "webp", "pdf"):
            ext = "jpg"
        content_types = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "pdf": "application/pdf"}
        content_type = content_types.get(ext, "image/jpeg")
        key = f"passports/{uuid.uuid4()}.{ext}"
        s3 = boto3.client("s3", endpoint_url="https://bucket.poehali.dev",
                          aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                          aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"])
        s3.put_object(Bucket="files", Key=key, Body=image_bytes, ContentType=content_type)
        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"url": cdn_url})}

    # === Публичный: клиент подтверждает и отправляет договор ===
    if method == "POST" and action == "submit_contract":
        body = json.loads(event.get("body") or "{}")
        tok = qp.get("token", "") or body.get("token", "")
        if not tok:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "token required"})}
        conn = db()
        cur = conn.cursor()
        cur.execute(f"SELECT id, title, total FROM {schema}.quotes WHERE token = %s", (tok,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Quote not found"})}
        quote_id, quote_title, quote_total = row
        client_type = body.get("client_type", "individual")
        cur.execute(
            f"""INSERT INTO {schema}.contracts
                (quote_id, client_type, full_name, passport_series, passport_number,
                 passport_issued, passport_date, birth_date, address,
                 company_name, inn, kpp, ogrn, legal_address, director,
                 phone, email, passport_file_url)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id""",
            (
                quote_id, client_type,
                body.get("full_name", ""), body.get("passport_series", ""), body.get("passport_number", ""),
                body.get("passport_issued", ""), body.get("passport_date", ""), body.get("birth_date", ""), body.get("address", ""),
                body.get("company_name", ""), body.get("inn", ""), body.get("kpp", ""), body.get("ogrn", ""),
                body.get("legal_address", ""), body.get("director", ""),
                body.get("phone", ""), body.get("email", ""),
                body.get("passport_file_url", None),
            )
        )
        contract_id = cur.fetchone()[0]
        cur.execute(f"UPDATE {schema}.quotes SET status = 'contracted' WHERE id = %s", (quote_id,))
        conn.commit()
        cur.close(); conn.close()

        # Уведомление менеджеру
        if client_type == "individual":
            client_label = f"👤 Физ. лицо: {body.get('full_name', '')}"
        else:
            client_label = f"🏢 Юр. лицо: {body.get('company_name', '')} (ИНН: {body.get('inn', '')})"
        tg_text = (
            f"📄 <b>Новый договор #{contract_id}</b>\n\n"
            f"КП: {quote_title}\n"
            f"Итого: {quote_total:,} ₽\n"
            f"{client_label}\n"
            f"📞 {body.get('phone', '')}  📧 {body.get('email', '')}\n\n"
            f"➡️ Просмотр в Admin Panel / Договоры"
        )
        send_telegram(tg_text)

        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "contract_id": contract_id})}

    # === Защищённые операции ===
    if not check_pwd(event):
        return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}

    conn = db()
    cur = conn.cursor()

    if method == "GET":
        cur.execute(
            f"SELECT id, token, title, items, days, delivery, delivery_price, extras, total, status, created_at, sent_at "
            f"FROM {schema}.quotes ORDER BY created_at DESC"
        )
        keys = ["id", "token", "title", "items", "days", "delivery", "delivery_price", "extras", "total", "status", "created_at", "sent_at"]
        rows = [dict(zip(keys, r)) for r in cur.fetchall()]
        for r in rows:
            r["created_at"] = str(r["created_at"])
            r["sent_at"] = str(r["sent_at"]) if r["sent_at"] else None
        cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps(rows)}

    if method == "POST":
        # Пометить как отправленное
        if action == "send":
            qid = int(qp.get("id", 0))
            cur.execute(
                f"UPDATE {schema}.quotes SET status='sent', sent_at=NOW() WHERE id=%s RETURNING token", (qid,)
            )
            row = cur.fetchone()
            conn.commit(); cur.close(); conn.close()
            if not row:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "token": row[0]})}

        # Создать КП
        body = json.loads(event.get("body") or "{}")
        tok = secrets.token_urlsafe(16)
        cur.execute(
            f"INSERT INTO {schema}.quotes (token, title, items, days, delivery, delivery_price, extras, total, status, event_date, delivery_address) "
            f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'draft',%s,%s) RETURNING id",
            (
                tok,
                body.get("title", "КП"),
                json.dumps(body.get("items", [])),
                body.get("days", 1),
                body.get("delivery", ""),
                body.get("delivery_price", 0),
                json.dumps(body.get("extras", [])),
                body.get("total", 0),
                body.get("event_date", ""),
                body.get("delivery_address", ""),
            )
        )
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "id": new_id, "token": tok})}

    if method == "PUT":
        qid = int(qp.get("id", 0))
        body = json.loads(event.get("body") or "{}")
        cur.execute(
            f"UPDATE {schema}.quotes SET title=%s, items=%s, days=%s, delivery=%s, delivery_price=%s, extras=%s, total=%s, event_date=%s, delivery_address=%s "
            f"WHERE id=%s",
            (
                body.get("title", ""), json.dumps(body.get("items", [])),
                body.get("days", 1), body.get("delivery", ""), body.get("delivery_price", 0),
                json.dumps(body.get("extras", [])), body.get("total", 0),
                body.get("event_date", ""), body.get("delivery_address", ""), qid,
            )
        )
        conn.commit(); cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    if method == "DELETE":
        qid = int(qp.get("id", 0))
        cur.execute(f"DELETE FROM {schema}.quotes WHERE id=%s", (qid,))
        conn.commit(); cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    cur.close(); conn.close()
    return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}