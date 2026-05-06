"""
AI-ассистент для анализа и улучшения объявлений на Авито.
Принимает данные объявления (название, описание, цена, категория, фото),
анализирует через GPT и возвращает структурированные рекомендации.
"""
import json
import os
import urllib.request
import urllib.error

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}

SYSTEM_PROMPT = """Ты — эксперт по продвижению объявлений на Авито в сфере аренды профессионального оборудования (звук, свет, сцена, видео, конференц-системы). 

Твоя задача — анализировать объявление и давать конкретные рекомендации по его улучшению для повышения конверсии и позиций в поиске.

Отвечай СТРОГО в формате JSON без лишнего текста, по следующей структуре:
{
  "score": <число от 1 до 10 — текущее качество объявления>,
  "title": "<улучшенный заголовок, до 50 символов>",
  "description": "<улучшенное описание, 300-500 символов, живым языком>",
  "price_recommendation": "<рекомендуемая цена или диапазон с обоснованием>",
  "photo_tips": ["<совет 1>", "<совет 2>", "<совет 3>"],
  "strengths": ["<сильная сторона 1>", "<сильная сторона 2>"],
  "weaknesses": ["<слабая сторона 1>", "<слабая сторона 2>"],
  "why": "<краткое объяснение логики изменений, 1-2 предложения>"
}

Правила:
- Не выдумывай факты которых нет в исходных данных
- Заголовок должен содержать ключевое слово + город + главное преимущество
- Описание: выгоды для клиента, потом характеристики, потом призыв к действию
- Цену обосновывай рынком аренды в РФ для данной категории оборудования
- Советы по фото — конкретные и практичные
- Пиши по-русски, живо и без воды"""


def call_ai(messages: list) -> str:
    api_key = os.environ.get("AITUNNEL_API_KEY", "")
    if not api_key:
        raise ValueError("AITUNNEL_API_KEY не задан")

    payload = json.dumps({
        "model": "gpt-4o-mini",
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1500,
        "response_format": {"type": "json_object"},
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.aitunnel.ru/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"]


def handler(event: dict, context) -> dict:
    """AI-ассистент для анализа и улучшения объявлений на Авито."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    body = json.loads(event.get("body") or "{}")

    title = body.get("title", "").strip()
    description = body.get("description", "").strip()
    price = body.get("price", "")
    category = body.get("category", "").strip()
    city = body.get("city", "Санкт-Петербург").strip()
    has_photo = body.get("has_photo", False)
    photo_count = body.get("photo_count", 0)

    if not title and not description:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "Укажите хотя бы название или описание объявления"}, ensure_ascii=False),
        }

    user_content = f"""Проанализируй объявление об аренде оборудования на Авито:

Категория: {category or "не указана"}
Город: {city}
Заголовок: {title or "не указан"}
Описание: {description or "не указано"}
Цена: {price or "не указана"}
Фото: {"есть, " + str(photo_count) + " шт." if has_photo else "нет фото"}

Дай структурированный анализ и улучшенную версию объявления."""

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    ai_raw = call_ai(messages)
    result = json.loads(ai_raw)

    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps(result, ensure_ascii=False),
    }
