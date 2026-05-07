"""
Заказы прокатчика: список заказов, подтверждение/отклонение позиций.
GET /           — список заказов прокатчика (по токену)
PUT /           — подтвердить или отклонить позицию заказа
"""
import json
import os
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Renter-Token",
    "Content-Type": "application/json",
}

def s():
    return os.environ.get("MAIN_DB_SCHEMA", "public")

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def check_token(cur, token: str):
    cur.execute(
        f"SELECT r.id FROM {s()}.renter_sessions sess "
        f"JOIN {s()}.renters r ON r.id = sess.renter_id "
        f"WHERE sess.token = %s AND sess.expires_at > now()",
        (token,)
    )
    row = cur.fetchone()
    return row[0] if row else None

def handler(event: dict, context) -> dict:
    """Заказы прокатчика: просмотр и подтверждение/отклонение."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    token = (event.get("headers") or {}).get("X-Renter-Token", "")

    if not token:
        return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Требуется авторизация"}, ensure_ascii=False)}

    conn = get_conn()
    cur = conn.cursor()

    try:
        renter_id = check_token(cur, token)
        if not renter_id:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Сессия истекла"}, ensure_ascii=False)}

        # ── СПИСОК ЗАКАЗОВ ──
        if method == "GET":
            cur.execute(
                f"SELECT roi.id, roi.order_id, roi.equipment_name, roi.qty, roi.days, roi.subtotal, roi.status, roi.created_at, "
                f"o.name as client_name, o.phone as client_phone, o.date as event_date, o.place, o.comment "
                f"FROM {s()}.renter_order_items roi "
                f"JOIN {s()}.orders o ON o.id = roi.order_id "
                f"WHERE roi.renter_id = %s "
                f"ORDER BY roi.created_at DESC LIMIT 100",
                (renter_id,)
            )
            rows = cur.fetchall()
            result = []
            for r in rows:
                result.append({
                    "id": r[0], "order_id": r[1], "equipment_name": r[2],
                    "qty": r[3], "days": r[4], "subtotal": r[5], "status": r[6],
                    "created_at": str(r[7]),
                    "client_name": r[8], "client_phone": r[9],
                    "event_date": r[10], "place": r[11], "comment": r[12],
                })
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(result, ensure_ascii=False)}

        # ── ПОДТВЕРДИТЬ / ОТКЛОНИТЬ ──
        if method == "PUT":
            body = json.loads(event.get("body") or "{}")
            item_id = body.get("id")
            new_status = body.get("status", "")
            if not item_id or new_status not in ("confirmed", "declined"):
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Укажите id и статус (confirmed/declined)"}, ensure_ascii=False)}

            cur.execute(
                f"UPDATE {s()}.renter_order_items SET status=%s WHERE id=%s AND renter_id=%s",
                (new_status, item_id, renter_id)
            )
            if cur.rowcount == 0:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Позиция не найдена"}, ensure_ascii=False)}
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True}, ensure_ascii=False)}

        return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"}, ensure_ascii=False)}

    finally:
        cur.close()
        conn.close()
