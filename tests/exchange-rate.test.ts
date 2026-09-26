import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchUsdTryRate } from "../src/lib/exchangeRate";

describe("USD/TRY exchange-rate service", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches and normalizes a historical rate", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ date: "2024-01-31", base: "USD", quote: "TRY", rate: 30.25 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchUsdTryRate("2024-01-31")).resolves.toEqual({
      rate: 30.25,
      date: "2024-01-31",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.frankfurter.dev/v2/rate/usd/try?date=2024-01-31",
      expect.objectContaining({ signal: undefined }),
    );
  });

  it("rejects malformed or failed responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rate: 0 }) }),
    );
    await expect(fetchUsdTryRate()).rejects.toThrow("geçerli bir kur");
  });
});
