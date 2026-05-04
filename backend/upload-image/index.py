"""
Загрузка изображения в S3. Принимает base64 файл, возвращает CDN URL.
Доступно только с паролем администратора через query параметр pwd.
"""
import base64
import json
import os
import uuid
import boto3


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    qp = event.get("queryStringParameters") or {}
    password = qp.get("pwd", "")
    expected = os.environ.get("ADMIN_PASSWORD", "Qwert12345")
    if password.lower() != expected.lower():
        return {"statusCode": 401, "headers": CORS_HEADERS, "body": json.dumps({"error": "Unauthorized"})}

    try:
        body = json.loads(event.get("body") or "{}")
        file_data = body.get("file", "")
        file_name = body.get("name", "image.jpg")

        # Убираем data URL prefix если есть (data:image/jpeg;base64,...)
        if "," in file_data:
            file_data = file_data.split(",", 1)[1]

        image_bytes = base64.b64decode(file_data)

        ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else "jpg"
        if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
            ext = "jpg"
        content_type_map = {
            "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "webp": "image/webp", "gif": "image/gif"
        }
        content_type = content_type_map.get(ext, "image/jpeg")

        key = f"equipment/{uuid.uuid4()}.{ext}"

        s3 = boto3.client(
            "s3",
            endpoint_url="https://bucket.poehali.dev",
            aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        )
        s3.put_object(Bucket="files", Key=key, Body=image_bytes, ContentType=content_type)

        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({"url": cdn_url}),
        }

    except Exception as e:
        print(f"ERROR: {e}")
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": str(e)}),
        }
