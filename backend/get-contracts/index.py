"""
Договоры (Admin Panel).
GET  /?pwd=X                  — список всех
GET  /?pwd=X&id=N             — конкретный
GET  /?pwd=X&report=1&month=YYYY-MM  — отчёт CSV (только оплаченные)
PUT  /?pwd=X&id=N             — изменить статус / paid / expenses
DELETE /?pwd=X&id=N           — удалить подписанный договор (с подтверждением)
"""
import csv
import io
import json
import os
from datetime import datetime, timezone
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def s():
    return os.environ.get("MAIN_DB_SCHEMA", "public")


def auth(pwd: str) -> bool:
    return pwd.lower() == os.environ.get("ADMIN_PASSWORD", "Qwert12345").lower()


def handler(event: dict, context) -> dict:
    """Управление договорами: список, детали, оплата, расходы, удаление, отчёт."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qp = event.get("queryStringParameters") or {}
    pwd = qp.get("pwd", "")
    if not auth(pwd):
        return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}

    method = event.get("httpMethod", "GET")
    schema = s()
    conn = db()
    cur = conn.cursor()

    try:
        # ── ОТЧЁТ CSV ──────────────────────────────────────────────────
        if method == "GET" and qp.get("report") == "1":
            month = qp.get("month", "")  # формат YYYY-MM
            where = f"c.paid = true AND c.signed_at IS NOT NULL"
            params = []
            if month:
                where += f" AND to_char(c.paid_at, 'YYYY-MM') = %s"
                params.append(month)

            cur.execute(
                f"""SELECT c.id, c.full_name, c.company_name, c.client_type,
                    c.phone, c.email, c.signed_at, c.paid_at,
                    q.title, q.total, q.event_date,
                    c.expenses, c.expenses_total, c.payment_method
                FROM {schema}.contracts c
                JOIN {schema}.quotes q ON q.id = c.quote_id
                WHERE {where}
                ORDER BY c.paid_at DESC""",
                params
            )
            rows = cur.fetchall()

            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow([
                "№", "Клиент", "Телефон", "Email",
                "КП", "Дата мероприятия", "Дата подписания", "Дата оплаты",
                "Способ оплаты", "Сумма договора", "Расходы", "Прибыль"
            ])
            for r in rows:
                cid, full_name, company_name, client_type, phone, email, signed_at, paid_at, \
                    title, total, event_date, expenses_json, expenses_total, payment_method = r
                client = full_name if client_type == "individual" else company_name
                total_val = float(total or 0)
                exp_val = float(expenses_total or 0)
                profit = total_val - exp_val
                pay_label = "Безнал (счёт)" if payment_method == "invoice" else "Наличные"
                writer.writerow([
                    cid, client, phone or "", email or "",
                    title or "", str(event_date or ""), str(signed_at or ""), str(paid_at or ""),
                    pay_label,
                    f"{total_val:.2f}", f"{exp_val:.2f}", f"{profit:.2f}"
                ])

            csv_body = "\ufeff" + buf.getvalue()  # BOM для Excel
            return {
                "statusCode": 200,
                "headers": {
                    **CORS,
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": f'attachment; filename="report_{month or "all"}.csv"',
                },
                "body": csv_body,
            }

        # ── GET список / детали ────────────────────────────────────────
        if method == "GET":
            cid = qp.get("id")
            if cid:
                cur.execute(
                    f"""SELECT c.id, c.quote_id, c.client_type,
                        c.full_name, c.passport_series, c.passport_number, c.passport_issued, c.passport_date,
                        c.birth_date, c.address,
                        c.company_name, c.inn, c.kpp, c.ogrn, c.legal_address, c.director,
                        c.phone, c.email, c.passport_file_url, c.status, c.created_at,
                        q.title, q.items, q.days, q.delivery, q.delivery_price, q.extras, q.total,
                        q.event_date, q.delivery_address
                    FROM {schema}.contracts c
                    JOIN {schema}.quotes q ON q.id = c.quote_id
                    WHERE c.id = %s""", (int(cid),)
                )
                row = cur.fetchone()
                if not row:
                    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
                keys = ["id","quote_id","client_type","full_name","passport_series","passport_number",
                        "passport_issued","passport_date","birth_date","address",
                        "company_name","inn","kpp","ogrn","legal_address","director",
                        "phone","email","passport_file_url","status","created_at",
                        "quote_title","items","days","delivery","delivery_price","extras","total",
                        "event_date","delivery_address"]
                result = dict(zip(keys, row))
                result["created_at"] = str(result["created_at"])
                return {"statusCode": 200, "headers": CORS, "body": json.dumps(result, default=str)}
            else:
                cur.execute(
                    f"""SELECT c.id, c.quote_id, c.client_type, c.full_name, c.company_name,
                        c.phone, c.email, c.status, c.created_at,
                        q.title, q.total, c.passport_file_url,
                        q.event_date, q.delivery_address,
                        c.signed_at, c.contract_pdf_url,
                        c.payment_method, c.invoice_pdf_url, c.invoice_total,
                        c.paid, c.paid_at, c.expenses, c.expenses_total
                    FROM {schema}.contracts c
                    JOIN {schema}.quotes q ON q.id = c.quote_id
                    ORDER BY c.created_at DESC"""
                )
                keys = ["id","quote_id","client_type","full_name","company_name",
                        "phone","email","status","created_at","quote_title","total","passport_file_url",
                        "event_date","delivery_address","signed_at","contract_pdf_url",
                        "payment_method","invoice_pdf_url","invoice_total",
                        "paid","paid_at","expenses","expenses_total"]
                rows = [dict(zip(keys, r)) for r in cur.fetchall()]
                for r in rows:
                    r["created_at"] = str(r["created_at"])
                    r["signed_at"]  = str(r["signed_at"]) if r["signed_at"] else None
                    r["paid_at"]    = str(r["paid_at"])   if r["paid_at"]   else None
                    r["expenses"]   = r["expenses"] if isinstance(r["expenses"], list) else []
                    r["expenses_total"] = float(r["expenses_total"] or 0)
                return {"statusCode": 200, "headers": CORS, "body": json.dumps(rows, default=str)}

        # ── PUT: статус / paid / расходы ───────────────────────────────
        if method == "PUT":
            cid = int(qp.get("id", 0))
            body = json.loads(event.get("body") or "{}")

            # Отметить оплачено
            if "paid" in body:
                paid_val = bool(body["paid"])
                paid_at  = datetime.now(timezone.utc) if paid_val else None
                cur.execute(
                    f"UPDATE {schema}.contracts SET paid=%s, paid_at=%s WHERE id=%s",
                    (paid_val, paid_at, cid)
                )
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            # Обновить расходы
            if "expenses" in body:
                expenses = body["expenses"]  # list of {label, amount}
                total_exp = sum(float(e.get("amount", 0)) for e in expenses)
                cur.execute(
                    f"UPDATE {schema}.contracts SET expenses=%s, expenses_total=%s WHERE id=%s",
                    (json.dumps(expenses, ensure_ascii=False), total_exp, cid)
                )
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "expenses_total": total_exp})}

            # Статус
            new_status = body.get("status", "reviewed")
            cur.execute(f"UPDATE {schema}.contracts SET status=%s WHERE id=%s", (new_status, cid))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # ── DELETE: удалить договор (только подписанный) ───────────────
        if method == "DELETE":
            cid = int(qp.get("id", 0))
            confirm = qp.get("confirm", "")
            if confirm != "yes":
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Передайте confirm=yes"})}
            cur.execute(f"SELECT signed_at FROM {schema}.contracts WHERE id=%s", (cid,))
            row = cur.fetchone()
            if not row:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Не найден"})}
            if not row[0]:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Можно удалять только подписанные договоры"})}
            cur.execute(f"DELETE FROM {schema}.contracts WHERE id=%s", (cid,))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}

    finally:
        cur.close()
        conn.close()
