import { describe, expect, it } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";
import { isValidRecipientAddress, isValidStellarAddress } from "./stellar";

const ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

describe("isValidStellarAddress", () => {
  it("accepts valid account and contract StrKeys for their matching kinds", () => {
    expect(isValidStellarAddress(ACCOUNT, "account")).toBe(true);
    expect(isValidStellarAddress(CONTRACT, "contract")).toBe(true);
    expect(isValidStellarAddress(ACCOUNT)).toBe(true);
    expect(isValidStellarAddress(CONTRACT)).toBe(true);
  });

  it("rejects a one-character account typo with an invalid checksum", () => {
    const typo = `${ACCOUNT.slice(0, -1)}6`;

    expect(typo).toHaveLength(ACCOUNT.length);
    expect(isValidStellarAddress(typo, "account")).toBe(false);
    expect(isValidRecipientAddress(typo)).toBe(false);
  });

  it("rejects a valid muxed M-address where a G-account address is required", () => {
    const muxedPayload = Uint8Array.from([
      ...StrKey.decodeEd25519PublicKey(ACCOUNT),
      ...new Uint8Array(8),
    ]);
    const muxedAddress = StrKey.encodeMed25519PublicKey(muxedPayload);

    expect(muxedAddress.startsWith("M")).toBe(true);
    expect(StrKey.isValidMed25519PublicKey(muxedAddress)).toBe(true);
    expect(isValidStellarAddress(muxedAddress)).toBe(false);
    expect(isValidRecipientAddress(muxedAddress)).toBe(false);
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
