"""
Управление шаблоном договора и подписью менеджера.
GET  /?pwd=X                     — получить шаблон (все секции)
PUT  /?pwd=X                     — сохранить секции шаблона
POST /?action=manager_sign&pwd=X — менеджер подписывает договор со своей стороны
"""
import json
import os
from datetime import datetime, timezone
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def s():
    return os.environ.get("MAIN_DB_SCHEMA", "public")


def check_pwd(qp: dict) -> bool:
    return (qp.get("pwd", "").lower() == os.environ.get("ADMIN_PASSWORD", "").lower())


def handler(event: dict, context) -> dict:
    """Шаблон договора: чтение, редактирование секций, подпись менеджера."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qp     = event.get("queryStringParameters") or {}
    action = qp.get("action", "")

    # ── Менеджер подписывает со своей стороны ──────────────────────────────
    if method == "POST" and action == "manager_sign":
        if not check_pwd(qp):
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}
        body = json.loads(event.get("body") or "{}")
        contract_id  = int(body.get("contract_id", 0))
        manager_name = (body.get("manager_name") or "").strip()
        if not contract_id:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "contract_id required"})}
        conn = db(); cur = conn.cursor()
        cur.execute(
            f"UPDATE {s()}.contracts SET manager_signed_at=%s, manager_name=%s WHERE id=%s",
            (datetime.now(timezone.utc), manager_name or "Менеджер", contract_id)
        )
        conn.commit(); cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    # ── GET шаблона (публичное чтение для generate-contract) ───────────────
    if method == "GET":
        conn = db(); cur = conn.cursor()
        cur.execute(f"SELECT section, content FROM {s()}.contract_template ORDER BY section")
        rows = {r[0]: r[1] for r in cur.fetchall()}
        cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps(rows, ensure_ascii=False)}

    # ── PUT: сохранить секции ──────────────────────────────────────────────
    if method == "PUT":
        if not check_pwd(qp):
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}
        body = json.loads(event.get("body") or "{}")
        conn = db(); cur = conn.cursor()
        for section, content in body.items():
            cur.execute(
                f"INSERT INTO {s()}.contract_template (section, content) VALUES (%s, %s) "
                f"ON CONFLICT (section) DO UPDATE SET content=%s, updated_at=NOW()",
                (section, content, content)
            )
        conn.commit(); cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}
