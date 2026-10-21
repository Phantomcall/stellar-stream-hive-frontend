import { describe, expect, it } from "vitest";
import {
  countByFilter,
  csvCell,
  csvFilename,
  filterStreams,
  matchesFilter,
  searchStreams,
  sortStreams,
  streamsToCsv,
} from "./streamList";
import type { Stream, StreamStatus } from "@/types";

function stream(id: string, status: StreamStatus, overrides: Partial<Stream> = {}): Stream {
  return {
    id,
    sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    recipient: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
    token: { contractId: "CTOKEN", symbol: "XLM", decimals: 7 },
    totalAmount: "15000000",
    withdrawnAmount: "5000000",
    startLedger: 100,
    endLedger: 200,
    startTime: 0,
    endTime: 0,
    cancellable: true,
    status,
    ...overrides,
  };
}

const all = [
  stream("1", "scheduled"),
  stream("2", "cliff"),
  stream("3", "active"),
  stream("4", "completed"),
  stream("5", "cancelled"),
];

describe("filtering", () => {
  it("'live' covers every state that can still accrue", () => {
    expect(filterStreams(all, "live").map((s) => s.id)).toEqual(["1", "2", "3"]);
  });
  it("'all' returns the same list", () => {
    expect(filterStreams(all, "all")).toBe(all);
  });
  it("selects terminal states exactly", () => {
    expect(filterStreams(all, "completed").map((s) => s.id)).toEqual(["4"]);
    expect(filterStreams(all, "cancelled").map((s) => s.id)).toEqual(["5"]);
    expect(matchesFilter(all[3], "live")).toBe(false);
  });
  it("counts are consistent with the filters", () => {
    expect(countByFilter(all)).toEqual({ all: 5, live: 3, completed: 1, cancelled: 1 });
    expect(countByFilter([])).toEqual({ all: 0, live: 0, completed: 0, cancelled: 0 });
  });
  it("handles empty input for filterStreams", () => {
    expect(filterStreams([], "all")).toEqual([]);
    expect(filterStreams([], "live")).toEqual([]);
    expect(filterStreams([], "completed")).toEqual([]);
    expect(filterStreams([], "cancelled")).toEqual([]);
  });
});

describe("searchStreams", () => {
  const SENDER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
  const RECIPIENT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
  const list = [
    stream("alpha-1", "active"),
    stream("beta-2", "active", { sender: "GDQP2KPQGKIHYJGXNUIYOMHARUARCANHJQ4ZWZ5GFPUCUDR6WZ5ZDZ7Q", recipient: "GCBBBBB" }),
  ];
  const ids = (found: Stream[]) => found.map((s) => s.id);

  it("matches a recipient address regardless of case", () => {
    expect(ids(searchStreams(list, RECIPIENT.slice(0, 10).toLowerCase()))).toEqual(["alpha-1"]);
  });
  it("matches a sender address", () => {
    expect(ids(searchStreams(list, "gdqp2kpq"))).toEqual(["beta-2"]);
  });
  it("matches the stream id", () => {
    expect(ids(searchStreams(list, "ALPHA"))).toEqual(["alpha-1"]);
  });
  it("ignores surrounding whitespace in the query", () => {
    expect(ids(searchStreams(list, `  ${SENDER.slice(0, 8)}  `))).toEqual(["alpha-1"]);
  });
  it("returns no streams when nothing matches", () => {
    expect(searchStreams(list, "zzz-nope")).toEqual([]);
  });
  it("returns the input unchanged for a blank query", () => {
    expect(searchStreams(list, "   ")).toBe(list);
  });
});

describe("sortStreams", () => {
  const ids = (list: Stream[]) => list.map((s) => s.id);

  it("orders newest first by start ledger", () => {
    const list = [
      stream("a", "active", { startLedger: 100 }),
      stream("b", "active", { startLedger: 300 }),
      stream("c", "active", { startLedger: 200 }),
    ];
    expect(ids(sortStreams(list, "newest"))).toEqual(["b", "c", "a"]);
  });
  it("orders ending soonest first by end ledger", () => {
    const list = [
      stream("a", "active", { endLedger: 900 }),
      stream("b", "active", { endLedger: 300 }),
      stream("c", "active", { endLedger: 600 }),
    ];
    expect(ids(sortStreams(list, "ending"))).toEqual(["b", "c", "a"]);
  });
  it("orders largest first by total amount without losing precision above 2^53", () => {
    const list = [
      stream("a", "active", { totalAmount: "9007199254740992" }),
      stream("b", "active", { totalAmount: "9007199254740993" }),
      stream("c", "active", { totalAmount: "100" }),
    ];
    expect(ids(sortStreams(list, "largest"))).toEqual(["b", "a", "c"]);
  });
  it("keeps the API order for 'default'", () => {
    expect(ids(sortStreams(all, "default"))).toEqual(["1", "2", "3", "4", "5"]);
  });
  it("returns a new array and leaves the input untouched", () => {
    const list = [stream("a", "active", { startLedger: 1 }), stream("b", "active", { startLedger: 2 })];
    const sorted = sortStreams(list, "newest");
    expect(sorted).not.toBe(list);
    expect(ids(list)).toEqual(["a", "b"]);
  });
});

describe("csvCell", () => {
  it("passes plain values through", () => {
    expect(csvCell("abc")).toBe("abc");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(true)).toBe("true");
    expect(csvCell(undefined)).toBe("");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });
  it("escapes leading whitespace that could trigger formula injection", () => {
    expect(csvCell("\tvalue")).toBe("'\tvalue");
    expect(csvCell("\rvalue")).toBe("'\rvalue");
  });
  it("handles fields with both quotes and newlines", () => {
    expect(csvCell('line 1\nsay "hi"\nline 3')).toBe('"line 1\nsay ""hi""\nline 3"');
  });
});

describe("csvFilename", () => {
  it("appends the local date as YYYY-MM-DD", () => {
    expect(csvFilename("stellar-stream-hive-sending-streams", new Date(2026, 9, 18, 23, 30))).toBe(
      "stellar-stream-hive-sending-streams-2026-10-18.csv"
    );
  });
  it("zero-pads single-digit months and days", () => {
    expect(csvFilename("x", new Date(2026, 0, 5))).toBe("x-2026-01-05.csv");
  });
});

describe("streamsToCsv", () => {
  it("emits a header and one row per stream with human-readable amounts", () => {
    const csv = streamsToCsv([stream("9", "active", { cliffLedger: 120 })]);
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toBe(
      "id,status,sender,recipient,token,total_amount,withdrawn,start_ledger,end_ledger,cliff_ledger,cancellable"
    );
    expect(row).toBe(
      "9,active,GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7,GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H,XLM,1.5,0.5,100,200,120,true"
    );
  });
  it("leaves the cliff column empty when there is none", () => {
    expect(streamsToCsv([stream("1", "active")]).trim().split("\r\n")[1]).toMatch(/,200,,true$/);
  });
  it("is header-only for an empty list", () => {
    expect(streamsToCsv([]).trim().split("\r\n")).toHaveLength(1);
  });
  it("writes a cancelled stream with its partial withdrawal and no cancel right", () => {
    const [, row] = streamsToCsv([
      stream("7", "cancelled", { withdrawnAmount: "2500000", cancellable: false }),
    ])
      .trim()
      .split("\r\n");
    const cells = row.split(",");
    expect(cells[1]).toBe("cancelled");
    expect(cells[5]).toBe("1.5");
    expect(cells[6]).toBe("0.25");
    expect(cells[10]).toBe("false");
  });
  it("writes whole-unit amounts without a decimal point for a 0-decimal token", () => {
    const [, row] = streamsToCsv([
      stream("8", "active", {
        token: { contractId: "CTOKEN0", symbol: "NFT", decimals: 0 },
        totalAmount: "1234567",
        withdrawnAmount: "1000",
      }),
    ])
      .trim()
      .split("\r\n");
    const cells = row.split(",");
    expect(cells[4]).toBe("NFT");
    expect(cells[5]).toBe("1234567");
    expect(cells[6]).toBe("1000");
  });
});
