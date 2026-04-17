import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { basicHeader, bearerHeader, fetchClientCredentialsToken } from "../src/oauth.js";

describe("oauth helpers", () => {
  it("basicHeader encodes user:pass", () => {
    expect(basicHeader("a@b.com", "x")).toBe(
      `Basic ${Buffer.from("a@b.com:x").toString("base64")}`,
    );
  });

  it("bearerHeader prefixes Bearer", () => {
    expect(bearerHeader("tkn")).toBe("Bearer tkn");
  });
});

describe("fetchClientCredentialsToken", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts client_credentials and returns access_token", async () => {
    const calls: { url: string; body: string }[] = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      const body = (init as RequestInit | undefined)?.body;
      calls.push({ url: String(url), body: typeof body === "string" ? body : "" });
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () =>
          Promise.resolve({ access_token: "T123", token_type: "bearer", expires_in: 3600 }),
        text: () => Promise.resolve(""),
      } as Response);
    }) as typeof fetch;

    const res = await fetchClientCredentialsToken({
      tokenUrl: "https://auth.example.com/oauth/token",
      clientId: "cid",
      clientSecret: "secret",
    });

    expect(res.access_token).toBe("T123");
    expect(calls[0]?.url).toBe("https://auth.example.com/oauth/token");
    expect(calls[0]?.body).toContain("grant_type=client_credentials");
    expect(calls[0]?.body).toContain("client_id=cid");
  });

  it("throws on non-200", async () => {
    globalThis.fetch = vi.fn(async () =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.resolve({}),
        text: () => Promise.resolve("bad creds"),
      } as Response),
    ) as typeof fetch;
    await expect(
      fetchClientCredentialsToken({
        tokenUrl: "https://x.example/token",
        clientId: "a",
        clientSecret: "b",
      }),
    ).rejects.toThrow(/HTTP 401/);
  });
});
