import { describe, expect, it, vi } from "vitest";

// Mock @stellar/freighter-api before importing freighter.ts
vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  isAllowed: vi.fn(),
  setAllowed: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
  getNetworkDetails: vi.fn(),
  signTransaction: vi.fn(),
}));

import { describeFreighterError, FreighterNotInstalledError, FreighterAccessDeniedError, FreighterNetworkMismatchError } from "./freighter";

describe("describeFreighterError", () => {
  it("returns helpful message for FreighterNotInstalledError", () => {
    const err = new FreighterNotInstalledError();
    const message = describeFreighterError(err);
    expect(message).toContain("isn't installed");
    expect(message).toContain("freighter.app");
  });

  it("returns helpful message for FreighterAccessDeniedError", () => {
    const err = new FreighterAccessDeniedError();
    const message = describeFreighterError(err);
    expect(message).toContain("denied");
    expect(message).toContain("approve the connection");
  });

  it("returns message for FreighterNetworkMismatchError", () => {
    const err = new FreighterNetworkMismatchError("TESTNET", "PUBLIC");
    const message = describeFreighterError(err);
    expect(message).toContain("TESTNET");
    expect(message).toContain("PUBLIC");
  });

  it("handles generic Error with declined message", () => {
    const err = new Error("User declined the transaction");
    const message = describeFreighterError(err);
    expect(message).toContain("rejected in your wallet");
  });

  it("handles generic Error with rejected message", () => {
    const err = new Error("Transaction was rejected by user");
    const message = describeFreighterError(err);
    expect(message).toContain("rejected in your wallet");
  });

  it("handles generic Error with user cancelled message", () => {
    const err = new Error("User cancelled the operation");
    const message = describeFreighterError(err);
    expect(message).toContain("rejected in your wallet");
  });

  it("returns original message for other Errors", () => {
    const err = new Error("Network timeout occurred");
    const message = describeFreighterError(err);
    expect(message).toBe("Network timeout occurred");
  });

  it("returns fallback for unknown error types", () => {
    const message = describeFreighterError("string error");
    expect(message).toBe("An unknown wallet error occurred.");
  });

  it("returns fallback for null", () => {
    const message = describeFreighterError(null);
    expect(message).toBe("An unknown wallet error occurred.");
  });

  it("returns fallback for undefined", () => {
    const message = describeFreighterError(undefined);
    expect(message).toBe("An unknown wallet error occurred.");
  });

  it("returns fallback for plain object", () => {
    const message = describeFreighterError({ code: 123 });
    expect(message).toBe("An unknown wallet error occurred.");
  });
});