"""Owner-configured optional processing. Every upstream here is a synthetic local server."""

import io
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image
import pytest

from backend.recognition_transport import ProcessorConfig, recognize, request_body


def jpeg():
    output = io.BytesIO()
    Image.new("RGB", (5, 5), "white").save(output, "JPEG")
    return output.getvalue()


def config(url="http://127.0.0.1:11434/v1", **kwargs):
    return ProcessorConfig(url=url, model="local-vision", mode="local", **kwargs)


@pytest.mark.parametrize(
    "url",
    [
        "http://example.org/v1",
        "http://169.254.169.254/v1",
        "http://0.0.0.0/v1",
        "http://127.0.0.1/v1?secret=x",
        "http://user:pass@127.0.0.1/v1",
        "ftp://127.0.0.1/v1",
        "http://127.0.0.1/v1#x",
        "http://127.0.0.1/elsewhere",
        "http://127.0.0.1:99999/v1",
        "http://127.0.0.1/v1\\x",
        "http://localhost/v1",
        "http://192.168.0.10/v1",
    ],
)
def test_unsafe_or_unacknowledged_local_destination_rejected(url):
    with pytest.raises(ValueError):
        config(url)


def test_local_lan_requires_ack_remote_requires_https_and_secrets_are_not_in_metadata():
    local = config("http://192.168.0.10:11434/v1", allow_lan_http=True, key="private-token")
    assert "192.168.0.10" in local.label
    assert "private-token" not in local.label
    assert "private-token" not in repr(local)
    remote = ProcessorConfig(url="https://processor.example/v1", model="vision", mode="remote")
    assert remote.label.startswith("Удалённая обработка")
    with pytest.raises(ValueError):
        ProcessorConfig(url="http://127.0.0.1/v1", model="vision", mode="remote")
    with pytest.raises(ValueError):
        ProcessorConfig(url="https://processor.example/v1", model="bad\nmodel", mode="remote")


def test_configuration_revision_changes_with_destination_model_or_secret():
    original = config()
    assert original.revision == config().revision
    assert original.revision != config(key="other").revision
    assert original.revision != config("http://127.0.0.1:9999/v1").revision
    with pytest.raises(ValueError):
        config(key="x\r\nInjected: yes")
    with pytest.raises(ValueError):
        ProcessorConfig(url="http://127.0.0.1/v1", model="vision-cloud", mode="local")


def test_request_has_only_selected_embedded_images_schema_and_fixed_instructions():
    body = json.loads(request_body(config(), [jpeg(), jpeg()]))
    assert body["model"] == "local-vision"
    assert body["stream"] is False
    assert body["response_format"]["type"] == "json_schema"
    assert "tools" not in body
    content = body["messages"][1]["content"]
    assert len(content) == 2
    assert all(v["image_url"]["url"].startswith("data:image/jpeg;base64,") for v in content)
    assert "owner_id" not in json.dumps(body["response_format"])
    for images in [[], [b"not image"], [jpeg()] * 6]:
        with pytest.raises(ValueError):
            request_body(config(), images)


@pytest.fixture
def fake_processor():
    state = {
        "calls": [],
        "status": 200,
        "result": {
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {"role": "assistant", "content": '{"amount":"123.45"}'},
                }
            ],
        },
    }

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            state["calls"].append(
                (
                    self.path,
                    dict(self.headers),
                    json.loads(self.rfile.read(int(self.headers["Content-Length"]))),
                )
            )
            content = state.get("raw", json.dumps(state["result"]).encode())
            self.send_response(state["status"])
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Location", "http://127.0.0.1/private")
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        yield config(f"http://127.0.0.1:{server.server_port}/v1"), state
    finally:
        server.shutdown()
        server.server_close()
        worker.join()


def test_local_fake_response_is_validated_without_inheriting_proxies(fake_processor, monkeypatch):
    processor, state = fake_processor
    monkeypatch.setenv("HTTP_PROXY", "http://127.0.0.1:1")
    result = recognize(processor, [jpeg()])
    assert result.amount == "123.45"
    assert len(state["calls"]) == 1
    assert state["calls"][0][0] == "/v1/chat/completions"
    assert "Authorization" not in state["calls"][0][1]


@pytest.mark.parametrize(
    "status,raw",
    [
        (302, b"PRIVATE REDIRECT"),
        (401, b"PRIVATE KEY"),
        (429, b"PRIVATE LIMIT"),
        (500, b"PRIVATE ERROR"),
        (200, b"PRIVATE INVALID JSON"),
        (200, b"x" * (128 * 1024 + 1)),
        (200, b'{"choices":[{"finish_reason":"length","message":{"content":"{}"}}]}'),
        (
            200,
            b'{"choices":[{"finish_reason":"stop","message":{"content":"{}","tool_calls":[{}]}}]}',
        ),
        (
            200,
            b'{"choices":[{"finish_reason":"stop","message":{"content":"{\\"owner_id\\":\\"foreign\\"}"}}]}',
        ),
    ],
    ids=[
        "redirect",
        "unauthorized",
        "rate-limit",
        "server-error",
        "invalid-json",
        "oversized",
        "truncated",
        "tool-call",
        "forged-authority",
    ],
)
def test_rejected_redirect_truncated_or_hostile_response_is_private_and_never_retried(
    fake_processor, status, raw
):
    processor, state = fake_processor
    state.update(status=status, raw=raw)
    with pytest.raises(ValueError) as error:
        recognize(processor, [jpeg()])
    assert "PRIVATE" not in str(error.value)
    assert len(state["calls"]) == 1


def test_absolute_deadline_keeps_credentials_out_of_arguments_and_environment(monkeypatch):
    import subprocess
    import backend.recognition_transport as transport

    monkeypatch.setenv("MASHINA_PRIVATE_TEST_SECRET", "private-sentinel")
    calls = []

    def expire(args, **kwargs):
        calls.append(args)
        assert kwargs["timeout"] == 120
        assert "private-sentinel" not in repr(args)
        assert "private-sentinel" not in repr(kwargs["env"])
        assert "private-key" not in repr(args)
        assert "private-key" not in repr(kwargs["env"])
        assert json.loads(kwargs["input"])["key"] == "private-key"
        raise subprocess.TimeoutExpired(args, 120, output=b"PRIVATE RESPONSE")

    monkeypatch.setattr(transport.subprocess, "run", expire)
    with pytest.raises(ValueError, match="мог обработать") as error:
        recognize(config(key="private-key"), [jpeg()])
    assert "PRIVATE" not in str(error.value)
    assert len(calls) == 1
