"""Bounded HTTP request child. No redirects, environment proxies or application context."""

import http.client
import json
import os
import ssl
import sys
from urllib.parse import urlsplit

MAX_RESPONSE = 128 * 1024


def main():
    if sys.platform == "linux":
        import resource

        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        resource.setrlimit(resource.RLIMIT_AS, (384 * 1024 * 1024, 384 * 1024 * 1024))
    raw = sys.stdin.buffer.read(16 * 1024 * 1024 + 1)
    if len(raw) > 16 * 1024 * 1024:
        raise ValueError()
    request = json.loads(raw)
    target = urlsplit(request["url"])
    if target.scheme == "https":
        connection = http.client.HTTPSConnection(
            target.hostname, port=target.port, timeout=30, context=ssl.create_default_context()
        )
    elif target.scheme == "http":
        connection = http.client.HTTPConnection(target.hostname, port=target.port, timeout=30)
    else:
        raise ValueError()
    try:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "identity",
        }
        if request["key"]:
            headers["Authorization"] = "Bearer " + request["key"]
        connection.request(
            "POST", target.path, body=request["body"].encode("utf-8"), headers=headers
        )
        response = connection.getresponse()
        if (
            response.status != 200
            or response.getheader("Content-Encoding", "identity") != "identity"
        ):
            raise ValueError()
        length = response.getheader("Content-Length")
        if length is not None and (not length.isdigit() or int(length) > MAX_RESPONSE):
            raise ValueError()
        content = response.read(MAX_RESPONSE + 1)
        if len(content) > MAX_RESPONSE:
            raise ValueError()
        sys.stdout.buffer.write(content)
    finally:
        connection.close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        os._exit(1)
