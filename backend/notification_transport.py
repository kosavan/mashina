"""Bounded HTTPS with fixed origins, global-address pinning and no redirects/proxies."""

import base64
from dataclasses import dataclass
import ipaddress
import json
import os
import re
import socket
from urllib.parse import urlsplit

from backend.output_locale import translate

MAX_RESPONSE = 65536


def b64(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]+={0,2}", value):
        raise ValueError("Некорректный ключ подписки")
    try:
        return base64.urlsafe_b64decode(value.rstrip("=") + "=" * (-len(value.rstrip("=")) % 4))
    except ValueError:
        raise ValueError("Некорректный ключ подписки") from None


def provider_url(url, telegram=False):
    if (
        not isinstance(url, str)
        or len(url) > 4096
        or any(ord(ch) < 33 for ch in url)
        or "\\" in url
    ):
        raise ValueError("Недопустимый адрес сервиса уведомлений")
    parsed = urlsplit(url)
    host = parsed.hostname or ""
    try:
        port = parsed.port
    except ValueError:
        raise ValueError("Недопустимый порт сервиса") from None
    allowed = (
        host == "api.telegram.org"
        if telegram
        else (
            host
            in {"fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"}
            or host.endswith(".push.apple.com")
        )
    )
    if (
        not allowed
        or parsed.scheme != "https"
        or port not in {None, 443}
        or parsed.username
        or parsed.password
        or parsed.fragment
    ):
        raise ValueError("Этот сервис уведомлений не разрешён сервером")
    if parsed.netloc.lower() != parsed.netloc or not parsed.path.startswith("/"):
        raise ValueError("Нужен канонический HTTPS-адрес")
    return parsed


def validate_subscription(value):
    from cryptography.hazmat.primitives.asymmetric import ec

    if set(value) - {"endpoint", "keys", "label", "expirationTime"}:
        raise ValueError("Неизвестные поля подписки")
    provider_url(value.get("endpoint"))
    keys = value.get("keys", {})
    if not isinstance(keys, dict) or set(keys) != {"auth", "p256dh"}:
        raise ValueError("Нужны ключи подписки")
    if any(not isinstance(value, str) or len(value) > 128 for value in keys.values()):
        raise ValueError("Ключ подписки слишком большой")
    auth, point = b64(keys["auth"]), b64(keys["p256dh"])
    if len(auth) != 16 or len(point) != 65 or point[0] != 4:
        raise ValueError("Некорректная длина ключей подписки")
    try:
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), point)
    except ValueError:
        raise ValueError("Некорректный публичный ключ устройства") from None
    return {"endpoint": value["endpoint"], "keys": keys}


def global_addresses(host):
    try:
        addresses = list(
            dict.fromkeys(
                item[4][0] for item in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
            )
        )
    except OSError:
        raise ValueError("Не удалось разрешить адрес сервиса") from None
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise ValueError("Сервис разрешился в недопустимый сетевой адрес")
    return addresses


@dataclass
class ProviderResult:
    state: str
    code: str = ""
    retry_after: int = 0


def safe_request(url, *, data=b"", headers=None, telegram=False):
    import certifi
    import urllib3

    parsed = provider_url(url, telegram=telegram)
    addresses = global_addresses(parsed.hostname)
    # No second DNS resolution: TCP host is the validated literal address, while
    # TLS SNI/certificate verification and HTTP Host retain the original origin.
    pool = urllib3.HTTPSConnectionPool(
        addresses[0],
        port=443,
        server_hostname=parsed.hostname,
        assert_hostname=parsed.hostname,
        cert_reqs="CERT_REQUIRED",
        ca_certs=certifi.where(),
        timeout=urllib3.Timeout(connect=3, read=5),
        retries=False,
        maxsize=1,
    )
    response = None
    try:
        response = pool.urlopen(
            "POST",
            parsed.path + ("?" + parsed.query if parsed.query else ""),
            body=data,
            headers={**(headers or {}), "Host": parsed.hostname},
            redirect=False,
            retries=False,
            preload_content=False,
        )
        content = response.read(MAX_RESPONSE + 1)
        if len(content) > MAX_RESPONSE:
            raise ValueError("Ответ сервиса слишком большой")
        return response.status, dict(response.headers), content
    finally:
        if response is not None:
            response.close()
        pool.close()


def classify(status, headers, content, telegram=False):
    if 200 <= status < 300:
        if telegram:
            try:
                if not json.loads(content).get("ok"):
                    return ProviderResult("rejected", "provider_rejected")
            except (ValueError, AttributeError):
                return ProviderResult("uncertain", "invalid_response")
        return ProviderResult("accepted")
    if status == 429:
        delay = str(headers.get("Retry-After", headers.get("retry-after", "300")))
        if telegram:
            try:
                delay = str(json.loads(content).get("parameters", {}).get("retry_after", delay))
            except (ValueError, AttributeError):
                pass
        seconds = int(delay) if delay.isdigit() else 300
        return ProviderResult("delayed", "rate_limited", min(86400, max(60, seconds)))
    return ProviderResult(
        "rejected" if 300 <= status < 500 else "uncertain",
        "expired"
        if status in {404, 410}
        else "provider_rejected"
        if status < 500
        else "provider_error",
    )


class PinnedSession:
    def post(self, url, *, data=b"", headers=None, timeout=None, **kwargs):
        import requests

        status, response_headers, content = safe_request(url, data=data, headers=headers)
        response = requests.Response()
        response.status_code, response.headers, response._content = (
            status,
            response_headers,
            content,
        )
        response.reason = "notification provider response"
        return response


def send_push(subscription, private_key, locale="ru"):
    try:
        from pywebpush import webpush, WebPushException

        validate_subscription(subscription)
        response = webpush(
            subscription,
            data=json.dumps(
                {
                    "title": "MASHINA",
                    "body": translate("Есть напоминание об обслуживании. Откройте свой гараж.", locale),
                },
                ensure_ascii=False,
            ),
            vapid_private_key=private_key,
            vapid_claims={
                "sub": os.getenv("MASHINA_VAPID_SUBJECT")
                or os.getenv("MASHINA_ORIGIN", "https://mashina.local")
            },
            requests_session=PinnedSession(),
            ttl=3600,
            timeout=5,
            verbose=False,
        )
        return classify(response.status_code, response.headers, response.content)
    except WebPushException as exc:
        if exc.response is not None:
            return classify(exc.response.status_code, exc.response.headers, exc.response.content)
        return ProviderResult("uncertain", "transport_error")
    except Exception:
        # URLs contain capability secrets; never expose library/network exception strings.
        return ProviderResult("uncertain", "transport_error")


def telegram_request(token, method, payload):
    if not re.fullmatch(r"[0-9]{5,20}:[A-Za-z0-9_-]{20,100}", token):
        raise ValueError("Бот не настроен")
    if method not in {"sendMessage", "getUpdates"}:
        raise ValueError("Недопустимый метод бота")
    return safe_request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        telegram=True,
    )


def send_telegram(token, chat_id, locale="ru"):
    try:
        status, headers, content = telegram_request(
            token,
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": "MASHINA: " + translate("Есть напоминание об обслуживании. Откройте свой гараж.", locale),
                "link_preview_options": {"is_disabled": True},
            },
        )
        return classify(status, headers, content, telegram=True)
    except Exception:
        return ProviderResult("uncertain", "transport_error")
