import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchStreamsBySender } from "./api";

const BASE = "https://api.test.local";

function makeView(id: string) {
  return {
    id,
    sender: "GSENDER",
    recipient: "GRECIPIENT",
    token: "CTOKEN",
    total_amount: "1000",
    claimed_amount: "0",
    start_ledger: 1,
    end_ledger: 100,
    status: "active",
  };
}

function jsonResponse(body: unknown, total?: number): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (total !== undefined) headers.set("x-total-count", String(total));
  return new Response(JSON.stringify(body), { status: 200, headers });
}

describe("fetchStreamsBySender pagination", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = BASE;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
    vi.restoreAllMocks();
  });

  it("concatenates pages and stops once X-Total-Count is reached", async () => {
    const page1 = Array.from({ length: 200 }, (_, i) => makeView(`s${i}`));
    const page2 = Array.from({ length: 50 }, (_, i) => makeView(`s${200 + i}`));
    const total = 250;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get("offset"));
      if (offset === 0) return jsonResponse(page1, total);
      if (offset === 200) return jsonResponse(page2, total);
      throw new Error(`unexpected offset ${offset}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const streams = await fetchStreamsBySender("GSENDER");

    expect(streams).toHaveLength(total);
    expect(streams.map((s) => s.id)).toEqual([...page1, ...page2].map((v) => v.id));

    const listCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes("/senders/"));
    expect(listCalls).toHaveLength(2);
    expect(String(listCalls[0][0])).toContain("limit=200&offset=0");
    expect(String(listCalls[1][0])).toContain("limit=200&offset=200");
  });

  it("rejects instead of returning a partial list when a later page fails", async () => {
    const page1 = Array.from({ length: 200 }, (_, i) => makeView(`s${i}`));
    const total = 250;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get("offset"));
      if (offset === 0) return jsonResponse(page1, total);
      if (offset === 200) {
        return new Response(JSON.stringify({ error: "boom" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected offset ${offset}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchStreamsBySender("GSENDER")).rejects.toThrow();

    const listCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes("/senders/"));
    expect(listCalls).toHaveLength(2);
    expect(String(listCalls[0][0])).toContain("limit=200&offset=0");
    expect(String(listCalls[1][0])).toContain("limit=200&offset=200");
  });

  it("stops on a short page even without X-Total-Count", async () => {
    const page1 = Array.from({ length: 200 }, (_, i) => makeView(`s${i}`));
    const page2 = Array.from({ length: 10 }, (_, i) => makeView(`s${200 + i}`));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get("offset"));
      if (offset === 0) return jsonResponse(page1);
      if (offset === 200) return jsonResponse(page2);
      throw new Error(`unexpected offset ${offset}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const streams = await fetchStreamsBySender("GSENDER");

    expect(streams).toHaveLength(210);
    const listCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes("/senders/"));
    expect(listCalls).toHaveLength(2);
  });
});
