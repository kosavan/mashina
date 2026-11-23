import { afterEach, describe, expect, it, vi } from "vitest";
import { api, APIError, createApiClient } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("MASHINA API transport", () => {
  it("uses the same-origin web session and the versioned API path", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: "garage" }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      api<{ id: string }>("/session", { credentials: "include" }),
    ).resolves.toEqual({ id: "garage" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/session",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("passes the original mutation, CSRF token and custom headers to the transport", async () => {
    const body = JSON.stringify({
      operation_id: "4e7a2d1b-ba39-4505-9f20-c795d47a86b5",
      data: { unit_price: "1.234" },
    });
    const transport = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const client = createApiClient(transport);

    await client.json(
      "/mutate",
      { method: "POST", body, headers: { "X-Client": "test" } },
      "session-csrf",
    );

    const [path, request] = transport.mock.calls[0];
    expect(path).toBe("/mutate");
    expect(request.method).toBe("POST");
    expect(request.body).toBe(body);
    expect(request.headers.get("Content-Type")).toBe("application/json");
    expect(request.headers.get("X-CSRF-Token")).toBe("session-csrf");
    expect(request.headers.get("X-Client")).toBe("test");
  });

  it("leaves the multipart boundary to the transport", async () => {
    const data = new FormData();
    data.set("file", new Blob(["receipt"]), "receipt.png");
    const transport = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const client = createApiClient(transport);

    await client.json("/attachments", { method: "POST", body: data });

    const [, request] = transport.mock.calls[0];
    expect(request.body).toBe(data);
    expect(request.headers.has("Content-Type")).toBe(false);
  });

  it("returns downloads as binary responses", async () => {
    const response = new Response("%PDF", {
      headers: { "Content-Type": "application/pdf" },
    });
    const client = createApiClient(vi.fn().mockResolvedValue(response));

    const result = await client.request("/vehicles/garage/sale-report");
    expect(result.headers.get("Content-Type")).toBe("application/pdf");
    await expect(result.text()).resolves.toBe("%PDF");
  });

  it("keeps server conflicts distinct from network errors", async () => {
    const networkError = new TypeError("Connection lost");
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ detail: "Version conflict" }, { status: 409 }),
      )
      .mockRejectedValueOnce(networkError);
    const client = createApiClient(transport);

    await expect(client.json("/mutate")).rejects.toEqual(
      new APIError(409, "Version conflict"),
    );
    await expect(client.json("/mutate")).rejects.toBe(networkError);
  });
});
