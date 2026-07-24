"""
CRUD для договоров займа.
GET    /?pwd=X                       — список всех займов (админ)
GET    /?token=T                     — займ по токену (публичный, без пароля)
POST   /?pwd=X                       — создать займ {amount, interest_rate, issue_date, return_date, doc_number}
PUT    /?pwd=X&id=N                  — обновить условия займа (админ)
DELETE /?pwd=X&id=N                  — удалить займ (админ)
POST   /?action=upload_passport&token=T — заёмщик загружает скан паспорта (base64), вернуть CDN URL
POST   /?action=fill&token=T         — заёмщик заполняет реквизиты → генерируется PDF, вернуть pdf_url
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


def s():
    return os.environ.get("MAIN_DB_SCHEMA", "public")


def check_pwd(event: dict) -> bool:
    qp = event.get("queryStringParameters") or {}
    pwd = qp.get("pwd", "")
    expected = os.environ.get("ADMIN_PASSWORD", "Qwert12345")
    return pwd.lower() == expected.lower()


def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


LOAN_COLS = [
    "id", "token", "amount", "interest_rate", "issue_date", "return_date", "doc_number",
    "borrower_type", "full_name", "passport_series", "passport_number", "passport_issued",
    "passport_date", "birth_date", "address", "company_name", "inn", "kpp", "ogrn",
    "legal_address", "director", "phone", "email", "status", "pdf_url", "filled_at", "created_at",
]


def _row_to_dict(row):
    d = dict(zip(LOAN_COLS, row))
    for k in ("amount", "interest_rate"):
        d[k] = float(d[k]) if d[k] is not None else 0
    for k in ("issue_date", "return_date", "filled_at", "created_at"):
        if d.get(k) is not None:
            d[k] = str(d[k])
    return d


def _select_sql():
    return f"SELECT {', '.join(LOAN_COLS)} FROM {s()}.loans"


def handler(event: dict, context) -> dict:
    """Управление договорами займа: CRUD для админа, заполнение реквизитов заёмщиком."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qp = event.get("queryStringParameters") or {}
    action = qp.get("action", "")
    token = qp.get("token", "")

    conn = db()
    cur = conn.cursor()
    try:
        # ── Публичное чтение по токену ──
        if method == "GET" and token:
            cur.execute(f"{_select_sql()} WHERE token = %s", (token,))
            row = cur.fetchone()
            if not row:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not_found"})}
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(_row_to_dict(row), ensure_ascii=False)}

        # ── Заёмщик загружает паспорт ──
        if method == "POST" and action == "upload_passport" and token:
            cur.execute(f"SELECT id FROM {s()}.loans WHERE token=%s", (token,))
            if not cur.fetchone():
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not_found"})}
            body = json.loads(event.get("body") or "{}")
            file_b64 = body.get("file", "")
            filename = body.get("filename", "passport")
            if "," in file_b64:
                file_b64 = file_b64.split(",", 1)[1]
            data = base64.b64decode(file_b64)
            ext = (filename.rsplit(".", 1)[-1] if "." in filename else "jpg").lower()
            ctype = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
                     "webp": "image/webp", "pdf": "application/pdf"}.get(ext, "application/octet-stream")
            key = f"loans/passport_{uuid.uuid4().hex}.{ext}"
            get_s3().put_object(Bucket="files", Key=key, Body=data, ContentType=ctype)
            cdn = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"url": cdn})}

        # ── Заёмщик заполняет реквизиты → генерируем PDF ──
        if method == "POST" and action == "fill" and token:
            cur.execute(f"SELECT id, status FROM {s()}.loans WHERE token=%s", (token,))
            r = cur.fetchone()
            if not r:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not_found"})}
            loan_id = r[0]
            body = json.loads(event.get("body") or "{}")
            btype = body.get("borrower_type", "individual")
            cur.execute(
                f"""UPDATE {s()}.loans SET
                    borrower_type=%s, full_name=%s, passport_series=%s, passport_number=%s,
                    passport_issued=%s, passport_date=%s, birth_date=%s, address=%s,
                    company_name=%s, inn=%s, kpp=%s, ogrn=%s, legal_address=%s, director=%s,
                    phone=%s, email=%s, status='filled', filled_at=NOW()
                    WHERE id=%s""",
                (
                    btype,
                    body.get("full_name", ""), body.get("passport_series", ""), body.get("passport_number", ""),
                    body.get("passport_issued", ""), body.get("passport_date", ""), body.get("birth_date", ""),
                    body.get("address", ""),
                    body.get("company_name", ""), body.get("inn", ""), body.get("kpp", ""), body.get("ogrn", ""),
                    body.get("legal_address", ""), body.get("director", ""),
                    body.get("phone", ""), body.get("email", ""),
                    loan_id,
                )
            )
            conn.commit()
            # Генерируем PDF
            pdf_url = ""
            try:
                gen_url = os.environ.get("GENERATE_LOAN_URL", "https://functions.poehali.dev/f49b47e6-c3ee-4331-a112-3ab9e7a9f6b2")
                admin_pwd = os.environ.get("ADMIN_PASSWORD", "")
                url = f"{gen_url}?pwd={urllib.parse.quote(admin_pwd)}&loan_id={loan_id}"
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=30) as resp:
                    pdf_url = json.loads(resp.read()).get("pdf_url", "")
            except Exception as e:
                print(f"[PDF ERROR loan] {e}")
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps({"ok": True, "pdf_url": pdf_url}, ensure_ascii=False)}

        # ── Дальше только админ ──
        if not check_pwd(event):
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}

        # ── Список займов ──
        if method == "GET":
            cur.execute(f"{_select_sql()} WHERE status <> 'archived_test' ORDER BY id DESC")
            rows = [_row_to_dict(r) for r in cur.fetchall()]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(rows, ensure_ascii=False)}

        # ── Создать займ ──
        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            new_token = secrets.token_urlsafe(12)
            cur.execute(
                f"""INSERT INTO {s()}.loans (token, amount, interest_rate, issue_date, return_date, doc_number)
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                (
                    new_token,
                    body.get("amount") or 0,
                    body.get("interest_rate") or 0,
                    body.get("issue_date") or None,
                    body.get("return_date") or None,
                    (body.get("doc_number") or "").strip() or None,
                )
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 201, "headers": CORS,
                    "body": json.dumps({"ok": True, "id": new_id, "token": new_token}, ensure_ascii=False)}

        # ── Обновить условия займа ──
        if method == "PUT":
            loan_id = int(qp.get("id") or 0)
            body = json.loads(event.get("body") or "{}")
            cur.execute(
                f"""UPDATE {s()}.loans SET amount=%s, interest_rate=%s, issue_date=%s,
                    return_date=%s, doc_number=%s WHERE id=%s""",
                (
                    body.get("amount") or 0,
                    body.get("interest_rate") or 0,
                    body.get("issue_date") or None,
                    body.get("return_date") or None,
                    (body.get("doc_number") or "").strip() or None,
                    loan_id,
                )
            )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # ── Удалить займ ──
        if method == "DELETE":
            loan_id = int(qp.get("id") or 0)
            cur.execute(f"DELETE FROM {s()}.loans WHERE id=%s", (loan_id,))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}
    finally:
        cur.close()
        conn.close()