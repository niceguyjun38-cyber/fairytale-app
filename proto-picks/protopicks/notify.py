"""텔레그램 알림(선택). TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 설정 시 동작."""
from __future__ import annotations

import requests

from .config import settings


def send_telegram(text: str) -> bool:
    if not (settings.telegram_bot_token and settings.telegram_chat_id):
        return False
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    ok = True
    for i in range(0, len(text), 3800):  # 텔레그램 4096자 제한
        r = requests.post(url, data={"chat_id": settings.telegram_chat_id, "text": text[i:i + 3800]}, timeout=20)
        ok = ok and r.ok
    return ok
