import { describe, expect, it, vi } from "vitest";
import { describeFreighterError } from "./freighter";

// Mock @stellar/freighter-api so importing the module is safe in node.
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

describe("describeFreighterError", () => {
  it("returns install message for FreighterNotInstalledError", () => {
    const err = new Error("not installed");
    err.name = "FreighterNotInstalledError";
    expect(describeFreighterError(err)).toBe(
      "Freighter wallet extension isn't installed. Install it from freighter.app to connect.",
    );
  });

  it("returns deny message for FreighterAccessDeniedError", () => {
    const err = new Error("access denied");
    err.name = "FreighterAccessDeniedError";
    expect(describeFreighterError(err)).toBe(
      "Wallet access was denied. Please approve the connection request in Freighter.",
    );
  });

  it("returns network mismatch message for FreighterNetworkMismatchError", () => {
    const err = new Error("Wrong network selected in Freighter. Expected TESTNET, got PUBLIC.");
    err.name = "FreighterNetworkMismatchError";
    expect(describeFreighterError(err)).toBe(err.message);
  });

  it("returns rejection message for Error containing rejected/declined/cancelled", () => {
    const err = new Error("Transaction was rejected by the user");
    expect(describeFreighterError(err)).toBe(
      "Transaction was rejected in your wallet.",
    );
  });

  it("returns rejection message for Error containing declined", () => {
    const err = new Error("Transaction declined by user");
    expect(describeFreighterError(err)).toBe(
      "Transaction was rejected in your wallet.",
    );
  });

  it("returns error message for generic Error", () => {
    const err = new Error("Something went wrong");
    expect(describeFreighterError(err)).toBe("Something went wrong");
  });

  it("returns unknown message for non-Error value", () => {
    expect(describeFreighterError("not an error")).toBe(
      "An unknown wallet error occurred.",
    );
    expect(describeFreighterError(null)).toBe(
      "An unknown wallet error occurred.",
    );
    expect(describeFreighterError(42)).toBe(
      "An unknown wallet error occurred.",
    );
    expect(describeFreighterError(undefined)).toBe(
      "An unknown wallet error occurred.",
    );
  });
});
