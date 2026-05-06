"""
Экспорт каталога оборудования в Excel (.xlsx).
GET /?pwd=X — генерирует Excel-файл, сохраняет в S3, возвращает URL для скачивания.
"""
import json, os
from datetime import datetime
import psycopg2
import boto3
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import io

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_s3():
    return boto3.client("s3", endpoint_url="https://bucket.poehali.dev",
                        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"])


def build_excel(rows: list) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Каталог оборудования"

    # Цвета
    header_fill   = PatternFill("solid", fgColor="1E293B")
    cat_fill      = PatternFill("solid", fgColor="F1F5F9")
    row_fill_even = PatternFill("solid", fgColor="FFFFFF")
    row_fill_odd  = PatternFill("solid", fgColor="F8FAFC")

    header_font = Font(bold=True, color="FFFFFF", size=10, name="Calibri")
    cat_font    = Font(bold=True, color="1E293B", size=9, name="Calibri")
    body_font   = Font(color="334155", size=9, name="Calibri")
    price_font  = Font(bold=True, color="166534", size=9, name="Calibri")

    thin = Side(style="thin", color="E2E8F0")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left   = Alignment(horizontal="left",   vertical="center", wrap_text=True)

    # Заголовок документа
    ws.merge_cells("A1:H1")
    title_cell = ws["A1"]
    title_cell.value = f"Каталог оборудования Stage Sound — {datetime.now().strftime('%d.%m.%Y')}"
    title_cell.font = Font(bold=True, color="1E293B", size=14, name="Calibri")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    title_cell.fill = PatternFill("solid", fgColor="FEF3C7")
    ws.row_dimensions[1].height = 30

    ws.merge_cells("A2:H2")

    # Заголовки столбцов
    headers = ["№", "Название", "Категория", "Подкатегория", "Цена (руб./день)", "Единица", "Популярное", "Описание"]
    col_widths = [5, 40, 20, 20, 18, 12, 12, 45]

    for col_idx, (h, w) in enumerate(zip(headers, col_widths), start=1):
        cell = ws.cell(row=3, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center
        cell.border = border
        ws.column_dimensions[get_column_letter(col_idx)].width = w
    ws.row_dimensions[3].height = 20

    # Группируем по категориям
    from itertools import groupby
    rows_sorted = sorted(rows, key=lambda r: (r["category"] or "", r["subcategory"] or "", r["sort_order"] or 0))

    data_row = 4
    global_num = 1

    for cat_name, cat_items in groupby(rows_sorted, key=lambda r: r["category"] or "Без категории"):
        items = list(cat_items)

        # Строка категории
        ws.merge_cells(f"A{data_row}:H{data_row}")
        cat_cell = ws.cell(row=data_row, column=1, value=f"  {cat_name.upper()}  ({len(items)} позиций)")
        cat_cell.font = cat_font
        cat_cell.fill = cat_fill
        cat_cell.alignment = left
        cat_cell.border = border
        ws.row_dimensions[data_row].height = 16
        data_row += 1

        for item in items:
            fill = row_fill_even if global_num % 2 == 0 else row_fill_odd
            row_data = [
                global_num,
                item.get("name") or "",
                item.get("category") or "",
                item.get("subcategory") or "",
                item.get("price") or 0,
                item.get("unit") or "день",
                "Да" if item.get("popular") else "",
                item.get("description") or "",
            ]
            for col_idx, val in enumerate(row_data, start=1):
                cell = ws.cell(row=data_row, column=col_idx, value=val)
                cell.fill = fill
                cell.border = border
                if col_idx == 5:  # Цена
                    cell.font = price_font
                    cell.alignment = center
                elif col_idx in (1, 6, 7):
                    cell.font = body_font
                    cell.alignment = center
                else:
                    cell.font = body_font
                    cell.alignment = left
            ws.row_dimensions[data_row].height = 15
            data_row += 1
            global_num += 1

    # Freeze header
    ws.freeze_panes = "A4"

    # Итоговая строка
    ws.merge_cells(f"A{data_row}:D{data_row}")
    ws.cell(row=data_row, column=1, value=f"Итого позиций: {global_num - 1}").font = Font(bold=True, size=9)
    ws.cell(row=data_row, column=1).alignment = left

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def handler(event: dict, context) -> dict:
    """Генерирует Excel-файл каталога оборудования и возвращает ссылку на скачивание."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qp  = event.get("queryStringParameters") or {}
    pwd = qp.get("pwd", "")
    if pwd.lower() != os.environ.get("ADMIN_PASSWORD", "").lower():
        return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}

    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = get_db()
    cur  = conn.cursor()
    cur.execute(f"""
        SELECT id, name, category, subcategory, price, unit, popular, description,
               tags, specs, rating, is_active, sort_order
        FROM {schema}.equipment
        WHERE is_active = TRUE
        ORDER BY category, subcategory, sort_order, name
    """)
    cols = [d[0] for d in cur.description]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    cur.close(); conn.close()

    xlsx = build_excel(rows)

    fname = f"catalog_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    key   = f"exports/{fname}"
    s3    = get_s3()
    s3.put_object(Bucket="files", Key=key, Body=xlsx,
                  ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    cdn = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    return {"statusCode": 200, "headers": CORS,
            "body": json.dumps({"ok": True, "url": cdn, "count": len(rows)})}
