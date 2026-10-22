import { describe, expect, it } from "vitest";
import {
  defaultTokenResolver,
  deriveOnChainStatus,
  makeTokenResolver,
  mapApiStats,
  mapApiStatus,
  mapApiStream,
  mapRawStream,
  type ApiStreamView,
  type RawStreamRecord,
} from "./streamMapping";

const SENDER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const RECIPIENT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const reference = { ledger: 1_000, timestampMs: 1_700_000_000_000 };

// A payload shaped exactly like the API's `StreamView` JSON.
const apiView: ApiStreamView = {
  id: "7",
  sender: SENDER,
  recipient: RECIPIENT,
  token: TOKEN,
  total_amount: "30000000000",
  withdrawn: "5000000000",
  start_ledger: 900,
  end_ledger: 1_900,
  cliff_ledger: 950,
  cancellable: true,
  status: "active",
  created_at: 1_735_689_600,
  streamed_amount: "3000000000",
  withdrawable_amount: "0",
  progress_percent: 10,
};

describe("mapApiStream", () => {
  it("maps snake_case API fields to the app Stream", () => {
    const s = mapApiStream(apiView, reference);
    expect(s).toMatchObject({
      id: "7",
      sender: SENDER,
      recipient: RECIPIENT,
      totalAmount: "30000000000",
      withdrawnAmount: "5000000000",
      startLedger: 900,
      endLedger: 1_900,
      cliffLedger: 950,
      cancellable: true,
      status: "active",
    });
    expect(s.token).toEqual({ contractId: TOKEN, symbol: "TOKEN", decimals: 7 });
  });

  it("keeps amounts as strings so BigInt round-trips exactly", () => {
    const s = mapApiStream({ ...apiView, total_amount: "170141183460469231731687303715884105727" }, reference);
    expect(BigInt(s.totalAmount)).toBe(2n ** 127n - 1n);
  });

  it("estimates wall-clock times from the ledger reference (5s per ledger)", () => {
    const s = mapApiStream(apiView, reference);
    expect(s.startTime).toBe(reference.timestampMs - 100 * 5_000);
    expect(s.endTime).toBe(reference.timestampMs + 900 * 5_000);
    expect(s.cliffTime).toBe(reference.timestampMs - 50 * 5_000);
  });

  it("uses zero times, not garbage, when the ledger is unknown", () => {
    const s = mapApiStream(apiView, null);
    expect(s.startTime).toBe(0);
    expect(s.endTime).toBe(0);
  });

  it("treats cliff == start as 'no cliff'", () => {
    const s = mapApiStream({ ...apiView, cliff_ledger: 900 }, reference);
    expect(s.cliffLedger).toBeUndefined();
    expect(s.cliffTime).toBeUndefined();
  });

  it("uses the supplied token resolver", () => {
    const s = mapApiStream(apiView, reference, makeTokenResolver(TOKEN));
    expect(s.token).toEqual({ contractId: TOKEN, symbol: "XLM", decimals: 7 });
  });
});

describe("mapApiStatus", () => {
  const v = { start_ledger: 900, cliff_ledger: 950 };
  it("renames pending to scheduled and passes terminal states through", () => {
    expect(mapApiStatus({ ...v, status: "pending" })).toBe("scheduled");
    expect(mapApiStatus({ ...v, status: "cancelled" })).toBe("cancelled");
    expect(mapApiStatus({ ...v, status: "completed" })).toBe("completed");
  });
  it("shows 'cliff' while active but before the cliff ledger", () => {
    expect(mapApiStatus({ ...v, status: "active" }, 920)).toBe("cliff");
    expect(mapApiStatus({ ...v, status: "active" }, 950)).toBe("active");
    expect(mapApiStatus({ ...v, status: "active" })).toBe("active");
  });
  it("never reports 'cliff' for a stream without one", () => {
    expect(mapApiStatus({ status: "active", start_ledger: 900, cliff_ledger: 900 }, 901)).toBe("active");
  });
  it("passes completed through regardless of current ledger", () => {
    expect(mapApiStatus({ ...v, status: "completed" }, 800)).toBe("completed");
    expect(mapApiStatus({ ...v, status: "completed" }, 950)).toBe("completed");
    expect(mapApiStatus({ ...v, status: "completed" }, 1_500)).toBe("completed");
  });
  it("passes cancelled through regardless of current ledger, even with a future cliff", () => {
    expect(mapApiStatus({ ...v, status: "cancelled" }, 900)).toBe("cancelled");
    expect(mapApiStatus({ ...v, status: "cancelled" }, 930)).toBe("cancelled");
    expect(mapApiStatus({ ...v, status: "cancelled" }, 960)).toBe("cancelled");
  });
});

describe("mapApiStats", () => {
  it("renames fields and defaults TVL when the API predates it", () => {
    const stats = mapApiStats({ total_streams: 4, active_streams: 2, total_streamed: "100", total_withdrawn: "40" });
    expect(stats).toEqual({
      totalStreams: 4,
      totalActiveStreams: 2,
      totalStreamedBaseUnits: "100",
      totalValueLockedBaseUnits: "0",
    });
  });
  it("passes through total_value_locked when present", () => {
    expect(
      mapApiStats({ total_streams: 1, active_streams: 1, total_streamed: "1", total_withdrawn: "0", total_value_locked: "9" })
        .totalValueLockedBaseUnits
    ).toBe("9");
  });
});

describe("token resolvers", () => {
  it("falls back to 7-decimal TOKEN for unknown contracts", () => {
    expect(defaultTokenResolver("CXYZ")).toEqual({ contractId: "CXYZ", symbol: "TOKEN", decimals: 7 });
  });
  it("recognises only the native contract as XLM", () => {
    const r = makeTokenResolver("CNATIVE");
    expect(r("CNATIVE").symbol).toBe("XLM");
    expect(r("COTHER").symbol).toBe("TOKEN");
  });
});

// Shaped like the contract's `Stream` struct after scValToNative.
const raw: RawStreamRecord = {
  sender: SENDER,
  recipient: RECIPIENT,
  token: TOKEN,
  total_amount: 1_000_000n,
  withdrawn: 250_000n,
  start_ledger: 100,
  end_ledger: 200,
  cliff_ledger: 120,
  cancellable: true,
  status: ["Active"],
};

describe("deriveOnChainStatus", () => {
  it("is scheduled, cliff, active, completed as ledgers pass", () => {
    expect(deriveOnChainStatus(raw, 50)).toBe("scheduled");
    expect(deriveOnChainStatus(raw, 110)).toBe("cliff");
    expect(deriveOnChainStatus(raw, 150)).toBe("active");
    expect(deriveOnChainStatus(raw, 200)).toBe("completed");
  });
  it("reads a cancelled unit-variant whether decoded as an array or a string", () => {
    expect(deriveOnChainStatus({ ...raw, status: ["Cancelled"] }, 150)).toBe("cancelled");
    expect(deriveOnChainStatus({ ...raw, status: "Cancelled" }, 150)).toBe("cancelled");
  });
  it("assumes active when the current ledger is unknown", () => {
    expect(deriveOnChainStatus(raw)).toBe("active");
  });
});

describe("mapRawStream", () => {
  it("reads the contract's field names (total_amount, not amount)", () => {
    const s = mapRawStream("3", raw, 150, { ledger: 150, timestampMs: 0 });
    expect(s.id).toBe("3");
    expect(s.totalAmount).toBe("1000000");
    expect(s.withdrawnAmount).toBe("250000");
    expect(s.cliffLedger).toBe(120);
    expect(s.status).toBe("active");
  });
  it("accepts string amounts too", () => {
    const s = mapRawStream("3", { ...raw, total_amount: "5", withdrawn: "1" });
    expect(s.totalAmount).toBe("5");
    expect(s.withdrawnAmount).toBe("1");
  });
  it.each<[string | string[], "completed" | "cancelled"]>([
    ["Completed", "completed"],
    [["Completed"], "completed"],
    ["Cancelled", "cancelled"],
    [["Cancelled"], "cancelled"],
  ])("maps contract status variant %#", (status, expected) => {
    const s = mapRawStream("3", { ...raw, status });
    expect(s.status).toBe(expected);
  });
});
