import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const TESTNET_CONTRACT_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const PUBLIC_CONTRACT_ID = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
const FUTURENET_CONTRACT_ID = "CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2C2E7UXY2L";

describe("nativeTokenContractId", () => {
  const originalEnv = process.env.NEXT_PUBLIC_STELLAR_NETWORK;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    }
  });

  async function getNativeTokenContractId() {
    const { nativeTokenContractId } = await import("./stellar");
    return nativeTokenContractId;
  }

  async function getNativeXlmContractIds() {
    const { NATIVE_XLM_CONTRACT_IDS } = await import("./stellar");
    return NATIVE_XLM_CONTRACT_IDS;
  }

  it("returns TESTNET contract ID when network is TESTNET", async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "TESTNET";
    const fn = await getNativeTokenContractId();
    expect(fn()).toBe(TESTNET_CONTRACT_ID);
  });

  it("returns PUBLIC contract ID when network is PUBLIC", async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "PUBLIC";
    const fn = await getNativeTokenContractId();
    expect(fn()).toBe(PUBLIC_CONTRACT_ID);
  });

  it("returns FUTURENET contract ID when network is FUTURENET", async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "FUTURENET";
    const fn = await getNativeTokenContractId();
    expect(fn()).toBe(FUTURENET_CONTRACT_ID);
  });

  it("defaults to TESTNET when network is not recognized", async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "UNKNOWN";
    const fn = await getNativeTokenContractId();
    expect(fn()).toBe(TESTNET_CONTRACT_ID);
  });

  it("defaults to TESTNET when env var is not set", async () => {
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    const fn = await getNativeTokenContractId();
    expect(fn()).toBe(TESTNET_CONTRACT_ID);
  });

  it("NATIVE_XLM_CONTRACT_IDS contains correct contract IDs", async () => {
    const ids = await getNativeXlmContractIds();
    expect(ids.TESTNET).toBe(TESTNET_CONTRACT_ID);
    expect(ids.PUBLIC).toBe(PUBLIC_CONTRACT_ID);
    expect(ids.FUTURENET).toBe(FUTURENET_CONTRACT_ID);
  });
});

describe("nativeTokenContractId", () => {
  const NATIVE_XLM_CONTRACT_IDS = {
    TESTNET: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    PUBLIC: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    FUTURENET: "CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2C2E7UXY2L",
  } as const;

  const setNetwork = (network: "TESTNET" | "PUBLIC" | "FUTURENET") => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", network);
    vi.resetModules();
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns TESTNET contract id when NETWORK=TESTNET", async () => {
    setNetwork("TESTNET");
    const { nativeTokenContractId } = await import("./stellar");
    expect(nativeTokenContractId()).toBe(NATIVE_XLM_CONTRACT_IDS.TESTNET);
  });

  it("returns PUBLIC contract id when NETWORK=PUBLIC", async () => {
    setNetwork("PUBLIC");
    const { nativeTokenContractId } = await import("./stellar");
    expect(nativeTokenContractId()).toBe(NATIVE_XLM_CONTRACT_IDS.PUBLIC);
  });

  it("returns FUTURENET contract id when NETWORK=FUTURENET", async () => {
    setNetwork("FUTURENET");
    const { nativeTokenContractId } = await import("./stellar");
    expect(nativeTokenContractId()).toBe(NATIVE_XLM_CONTRACT_IDS.FUTURENET);
  });

  it("falls back to TESTNET when network is unset", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    const { nativeTokenContractId } = await import("./stellar");
    expect(nativeTokenContractId()).toBe(NATIVE_XLM_CONTRACT_IDS.TESTNET);
  });
});
