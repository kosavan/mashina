"""Real STDIO subprocess tests, using only an invented local HTTP upstream."""

import asyncio
import json
import os
import sys
import uuid

import pytest

MODERN = "2026-07-28"
LEGACY = "2025-11-25"
META = {
    "io.modelcontextprotocol/protocolVersion": MODERN,
    "io.modelcontextprotocol/clientCapabilities": {},
}
SYNTHETIC = "invented-protocol-test-value"


def request(method, identity=1, **params):
    return {"jsonrpc": "2.0", "id": identity, "method": method, "params": {"_meta": META, **params}}


async def send(process, message):
    process.stdin.write((json.dumps(message) + "\n").encode())
    await process.stdin.drain()


async def receive(process):
    line = await asyncio.wait_for(process.stdout.readline(), 3)
    assert line, await process.stderr.read()
    assert SYNTHETIC.encode() not in line
    return json.loads(line)


async def spawn(url):
    env = {
        **os.environ,
        "MASHINA_SERVER_URL": url,
        "MASHINA_MACHINE_TOKEN": SYNTHETIC,
        "PYTHONUTF8": "1",
    }
    return await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "backend.machine_protocol",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )


async def finish(process):
    process.stdin.close()
    await asyncio.wait_for(process.wait(), 2)
    assert SYNTHETIC.encode() not in await process.stderr.read()


def test_stdio_modern_and_legacy_discovery_tools_errors_and_redaction():
    async def scenario():
        calls = []

        async def upstream(reader, writer):
            header = await reader.readuntil(b"\r\n\r\n")
            calls.append(header)
            body = json.dumps({"items": [], "echo": SYNTHETIC}).encode()
            writer.write(
                b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "
                + str(len(body)).encode()
                + b"\r\n\r\n"
                + body
            )
            await writer.drain()
            writer.close()

        server = await asyncio.start_server(upstream, "127.0.0.1", 0)
        async with server:
            process = await spawn(f"http://127.0.0.1:{server.sockets[0].getsockname()[1]}")
            try:
                await send(process, request("server/discover"))
                result = (await receive(process))["result"]
                assert result["resultType"] == "complete"
                assert result["supportedVersions"] == [MODERN, LEGACY]
                assert result["capabilities"] == {"tools": {}}
                assert result["cacheScope"] == "private" and result["ttlMs"] == 0
                assert result["_meta"]["io.modelcontextprotocol/serverInfo"]["name"] == "MASHINA"
                await send(process, request("tools/list", 2))
                listed = (await receive(process))["result"]
                assert len(listed["tools"]) == 4
                assert all(tool["annotations"]["readOnlyHint"] for tool in listed["tools"])
                assert {tool["name"] for tool in listed["tools"]} == {
                    "mashina_vehicles",
                    "mashina_history",
                    "mashina_reminders",
                    "mashina_analytics",
                }
                await send(
                    process,
                    request(
                        "tools/call",
                        3,
                        name="mashina_history",
                        arguments={"vehicle_id": str(uuid.uuid4()), "limit": 25},
                    ),
                )
                result = (await receive(process))["result"]
                assert not result["isError"] and result["resultType"] == "complete"
                assert result["structuredContent"]["data"]["items"] == []
                assert b"Authorization: Bearer " + SYNTHETIC.encode() in calls[0]
                assert calls[0].startswith(b"GET /api/machine/v1/vehicles/")
                await send(
                    process,
                    request(
                        "tools/call",
                        4,
                        name="mashina_vehicles",
                        arguments={"url": "https://invalid.example"},
                    ),
                )
                assert (await receive(process))["error"]["code"] == -32602
                await send(process, request("tools/call", 5, name="write_expense", arguments={}))
                assert (await receive(process))["error"]["code"] == -32602
                message = request("tools/list", 6)
                message["params"]["_meta"] = {
                    **META,
                    "io.modelcontextprotocol/protocolVersion": "2099-01-01",
                }
                await send(process, message)
                error = (await receive(process))["error"]
                assert error["code"] == -32022 and error["data"]["requested"] == "2099-01-01"
                await send(
                    process, {"jsonrpc": "2.0", "id": 7, "method": "tools/list", "params": {}}
                )
                assert (await receive(process))["error"]["code"] == -32602
                await send(
                    process,
                    {
                        "jsonrpc": "2.0",
                        "id": 8,
                        "method": "initialize",
                        "params": {
                            "protocolVersion": LEGACY,
                            "capabilities": {},
                            "clientInfo": {"name": "Invented", "version": "1"},
                        },
                    },
                )
                assert (await receive(process))["result"]["protocolVersion"] == LEGACY
                await send(process, {"jsonrpc": "2.0", "method": "notifications/initialized"})
                await send(
                    process, {"jsonrpc": "2.0", "id": 9, "method": "tools/list", "params": {}}
                )
                assert "resultType" not in (await receive(process))["result"]
                await send(
                    process,
                    {
                        "jsonrpc": "2.0",
                        "id": 10,
                        "method": "tools/call",
                        "params": {"name": "mashina_vehicles", "arguments": {}},
                    },
                )
                assert "resultType" not in (await receive(process))["result"]
            finally:
                await finish(process)

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "response",
    [
        b"HTTP/1.1 302 Found\r\nLocation: http://invalid.example\r\nContent-Length: 0\r\n\r\n",
        b"HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nbad",
        b"HTTP/1.1 200 OK\r\nContent-Length: 2000000\r\n\r\n",
        b"HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n",
    ],
)
def test_stdio_upstream_failure_is_tool_error_without_leak(response):
    async def scenario():
        async def upstream(reader, writer):
            await reader.readuntil(b"\r\n\r\n")
            writer.write(response)
            await writer.drain()
            writer.close()

        server = await asyncio.start_server(upstream, "127.0.0.1", 0)
        async with server:
            process = await spawn(f"http://127.0.0.1:{server.sockets[0].getsockname()[1]}")
            try:
                await send(process, request("tools/call", name="mashina_vehicles", arguments={}))
                assert (await receive(process))["result"]["isError"]
            finally:
                await finish(process)

    asyncio.run(scenario())


def test_stdio_cancellation_and_eof_abort_inflight():
    async def scenario():
        started = asyncio.Event()

        async def upstream(reader, writer):
            await reader.readuntil(b"\r\n\r\n")
            started.set()
            await reader.read()
            writer.close()

        server = await asyncio.start_server(upstream, "127.0.0.1", 0)
        async with server:
            process = await spawn(f"http://127.0.0.1:{server.sockets[0].getsockname()[1]}")
            await send(process, request("tools/call", 1, name="mashina_vehicles", arguments={}))
            await asyncio.wait_for(started.wait(), 3)
            await send(
                process,
                {"jsonrpc": "2.0", "method": "notifications/cancelled", "params": {"requestId": 1}},
            )
            await send(process, request("ping", 2))
            assert (await receive(process))["id"] == 2
            started.clear()
            await send(process, request("tools/call", 3, name="mashina_vehicles", arguments={}))
            await asyncio.wait_for(started.wait(), 3)
            await finish(process)
            assert await process.stdout.read() == b""

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "url",
    [
        "http://192.0.2.1",
        "http://localhost",
        "https://user:pass@invalid.example",
        "https://invalid.example/path",
        "https://invalid.example?token=private",
        "ftp://invalid.example",
    ],
)
def test_stdio_rejects_unsafe_configuration(url):
    async def scenario():
        process = await spawn(url)
        await asyncio.wait_for(process.wait(), 3)
        assert process.returncode != 0
        assert await process.stdout.read() == b""
        error = await process.stderr.read()
        assert SYNTHETIC.encode() not in error and url.encode() not in error

    asyncio.run(scenario())


def test_stdio_malformed_json_batch_null_id_and_oversize():
    async def scenario():
        process = await spawn("http://127.0.0.1:9")
        try:
            process.stdin.write(b"not-json\n")
            await process.stdin.drain()
            assert (await receive(process))["error"]["code"] == -32700
            await send(process, [])
            assert (await receive(process))["error"]["code"] == -32600
            await send(process, request("ping", None))
            assert (await receive(process))["error"]["code"] == -32600
            await send(process, {"jsonrpc": "2.0", "method": "unknown/notification"})
            await send(process, request("ping", 2))
            assert (await receive(process))["id"] == 2
            process.stdin.write(b" " * (1024 * 1024 + 1))
            await process.stdin.drain()
            assert (await receive(process))["error"]["code"] == -32600
            await asyncio.wait_for(process.wait(), 2)
        finally:
            if process.returncode is None:
                await finish(process)

    asyncio.run(scenario())


def test_http_deadline_and_tls_verification(monkeypatch, tmp_path):
    from backend import machine_protocol as protocol
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import NameOID
    from datetime import datetime, timedelta, timezone
    import ssl

    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=1))
        .sign(key, hashes.SHA256())
    )
    cert_path, key_path = tmp_path / "cert.pem", tmp_path / "key.pem"
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert_path, key_path)

    async def scenario():
        async def delayed(reader, writer):
            await reader.read()
            writer.close()

        server = await asyncio.start_server(delayed, "127.0.0.1", 0)
        async with server:
            monkeypatch.setattr(protocol, "DEADLINE", 0.05)
            upstream = protocol.Upstream(
                f"http://127.0.0.1:{server.sockets[0].getsockname()[1]}", SYNTHETIC
            )
            with pytest.raises(protocol.UpstreamError):
                await upstream.get("/vehicles")
        server = await asyncio.start_server(delayed, "127.0.0.1", 0, ssl=context)
        async with server:
            monkeypatch.setattr(protocol, "DEADLINE", 2)
            upstream = protocol.Upstream(
                f"https://127.0.0.1:{server.sockets[0].getsockname()[1]}", SYNTHETIC
            )
            with pytest.raises(protocol.UpstreamError):
                await upstream.get("/vehicles")

    asyncio.run(scenario())


def test_stdio_numeric_ids_legacy_negotiation_and_four_request_bound():
    async def scenario():
        all_started = asyncio.Event()
        active = 0

        async def delayed(reader, writer):
            nonlocal active
            await reader.readuntil(b"\r\n\r\n")
            active += 1
            if active == 4:
                all_started.set()
            await reader.read()
            writer.close()

        server = await asyncio.start_server(delayed, "127.0.0.1", 0)
        async with server:
            process = await spawn(f"http://127.0.0.1:{server.sockets[0].getsockname()[1]}")
            try:
                await send(process, request("ping", 1.5))
                assert (await receive(process))["id"] == 1.5
                await send(process, {"jsonrpc": "2.0", "id": 0.5, "method": "ping"})
                assert (await receive(process))["result"] == {}
                await send(
                    process,
                    {
                        "jsonrpc": "2.0",
                        "id": 2,
                        "method": "initialize",
                        "params": {
                            "protocolVersion": "2024-11-05",
                            "capabilities": {},
                            "clientInfo": {},
                        },
                    },
                )
                assert (await receive(process))["error"]["code"] == -32602
                await send(
                    process,
                    {
                        "jsonrpc": "2.0",
                        "id": 3,
                        "method": "initialize",
                        "params": {
                            "protocolVersion": "2024-11-05",
                            "capabilities": {},
                            "clientInfo": {"name": "Invented", "version": "1"},
                        },
                    },
                )
                assert (await receive(process))["result"]["protocolVersion"] == LEGACY
                for identity in (10, 11, 12, 13):
                    await send(
                        process,
                        request("tools/call", identity, name="mashina_vehicles", arguments={}),
                    )
                await asyncio.wait_for(all_started.wait(), 3)
                await send(process, request("ping", 14))
                error = await receive(process)
                assert error["id"] == 14 and error["error"]["code"] == -32600
                await finish(process)
                assert await process.stdout.read() == b""
            finally:
                if process.returncode is None:
                    await finish(process)

    asyncio.run(scenario())
