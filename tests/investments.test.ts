import { describe, expect, it } from "vitest";
import {
  activeInvestmentPortfolios,
  combinedInvestmentDisplaySummary,
  combinedInvestmentSummary,
  investmentMonthlySeries,
  investmentXirr,
  portfolioInvestmentMetrics,
  portfolioInvestmentDisplayMetrics,
  portfolioResidualValue,
  xirr,
} from "../src/lib/investments";
import {
  deleteInvestmentSnapshotState,
  saveInvestmentFlowState,
  saveInvestmentMonthlyRecordState,
  saveInvestmentPortfolioState,
  setInvestmentPortfolioArchivedState,
} from "../src/lib/mutations";
import { normalizeState } from "../src/lib/state";
import type {
  FinanceState,
  InvestmentCashFlow,
  InvestmentPortfolio,
  InvestmentSnapshot,
} from "../src/types";

const portfolio: InvestmentPortfolio = {
  id: "usd-etf",
  name: "ABD ETF",
  purpose: "Uzun vadeli büyüme",
  currency: "USD",
  description: "VOO, QQQM",
  createdAt: "2024-01-01T00:00:00.000Z",
};

function stateWithInvestments(
  portfolios: InvestmentPortfolio[],
  investmentSnapshots: InvestmentSnapshot[],
  investmentCashFlows: InvestmentCashFlow[],
): FinanceState {
  return {
    selectedMonth: "2024-12",
    expenses: [],
    debts: [],
    budgets: [],
    investmentPortfolios: portfolios,
    investmentSnapshots,
    investmentCashFlows,
    updatedAt: "2024-12-31T00:00:00.000Z",
  };
}

describe("investment state migration", () => {
  it("adds the five planned portfolios to legacy state without changing finance data", () => {
    const normalized = normalizeState({
      selectedMonth: "2026-09",
      expenses: [{ id: "expense", date: "2026-09-01", amount: 50 }],
      debts: [],
      budgets: [],
      updatedAt: "2026-09-01T00:00:00.000Z",
    });

    expect(normalized.expenses).toHaveLength(1);
    expect(normalized.investmentPortfolios.map(({ name }) => name)).toEqual([
      "ABD ETF",
      "BIST",
      "TEFAS",
      "BES 1",
      "BES 2",
    ]);
    expect(normalized.investmentSnapshots).toEqual([]);
    expect(normalized.investmentCashFlows).toEqual([]);
  });
});

describe("latest investment values for display", () => {
  const tryPortfolio = { ...portfolio, id: "try", currency: "TRY" as const };

  function valuation(
    date: string,
    totalValue: number,
    target: InvestmentPortfolio = tryPortfolio,
    usdTryRate = 40,
  ): InvestmentSnapshot {
    return {
      id: `${target.id}-${date}`,
      portfolioId: target.id,
      date,
      totalValue,
      usdTryRate,
      rateDate: date,
      rateSource: "manual",
    };
  }

  function movement(
    date: string,
    amount: number,
    type: InvestmentCashFlow["type"] = "contribution",
    target: InvestmentPortfolio = tryPortfolio,
    usdTryRate = 40,
  ): InvestmentCashFlow {
    return {
      id: `${target.id}-${date}-${type}`,
      portfolioId: target.id,
      date,
      amount,
      type,
      currency: target.currency,
      usdTryRate,
      rateDate: date,
      rateSource: "manual",
    };
  }

  it.each(["2026-10", "2026-12", "2027-01"])(
    "carries September values into %s without inventing monthly records or returns",
    (month) => {
      const state = stateWithInvestments(
        [tryPortfolio],
        [valuation("2026-09-30", 100_000)],
        [movement("2026-01-01", 90_000)],
      );
      const before = structuredClone(state);
      const metrics = portfolioInvestmentDisplayMetrics(state, tryPortfolio, month, "TRY");
      expect(metrics).toMatchObject({
        value: 100_000, netInvested: 90_000, gain: 10_000,
        isEstimated: true, hasRecords: true, hasCurrentMonthSnapshot: false, xirr: null,
      });
      expect(metrics.snapshot?.date).toBe("2026-09-30");
      expect(combinedInvestmentDisplaySummary(state, month, "TRY")).toMatchObject({
        value: 100_000, netInvested: 90_000, gain: 10_000,
        completePortfolios: 0, totalPortfolios: 1, isEstimated: true, xirr: null,
      });
      expect(investmentMonthlySeries(state, month, "TRY")).toEqual([
        { month: "2026-09", value: 100_000, invested: 90_000 },
      ]);
      expect(state).toEqual(before);
    },
  );

  it("adds subsequent contributions and withdrawals without changing earned gain", () => {
    const state = stateWithInvestments(
      [tryPortfolio],
      [valuation("2026-09-30", 100_000)],
      [
        movement("2026-01-01", 90_000),
        movement("2026-10-01", 5_000),
        movement("2026-10-02", 2_000, "withdrawal"),
        movement("2026-11-01", 20_000),
      ],
    );
    expect(portfolioInvestmentDisplayMetrics(state, tryPortfolio, "2026-10", "TRY"))
      .toMatchObject({ value: 103_000, netInvested: 93_000, gain: 10_000, isEstimated: true });
    expect(combinedInvestmentDisplaySummary(state, "2026-10", "TRY"))
      .toMatchObject({ value: 103_000, netInvested: 93_000, gain: 10_000 });
    expect(combinedInvestmentDisplaySummary(state, "2026-09", "TRY"))
      .toMatchObject({ value: 100_000, netInvested: 90_000, isEstimated: false });
  });

  it("replaces the estimate with a new valuation and never re-adds same-day movements", () => {
    const state = stateWithInvestments(
      [tryPortfolio],
      [valuation("2026-10-20", 110_000), valuation("2026-09-30", 100_000)],
      [
        movement("2026-01-01", 90_000),
        movement("2026-10-01", 5_000),
        movement("2026-10-02", 2_000, "withdrawal"),
        { ...movement("2026-10-20", 4_000), snapshotId: "try-2026-10-20" },
        movement("2026-10-20", 500, "withdrawal"),
        movement("2026-10-21", 1_000, "withdrawal"),
      ],
    );
    const metrics = portfolioInvestmentDisplayMetrics(state, tryPortfolio, "2026-10", "TRY");
    expect(metrics).toMatchObject({
      value: 109_000, netInvested: 95_500, gain: 13_500,
      hasCurrentMonthSnapshot: true, isEstimated: true,
    });
    expect(metrics.snapshot?.date).toBe("2026-10-20");
    expect(metrics.xirr).toBe(investmentXirr(state, tryPortfolio, "2026-10", "TRY"));
    const actualSummary = combinedInvestmentSummary(state, "2026-10", "TRY");
    expect(combinedInvestmentDisplaySummary(state, "2026-10", "TRY")).toMatchObject({
      value: 109_000, completePortfolios: 1, xirr: actualSummary.xirr,
      historyMonths: actualSummary.historyMonths,
    });
    expect(investmentMonthlySeries(state, "2026-10", "TRY").at(-1))
      .toEqual({ month: "2026-10", value: 110_000, invested: 96_500 });

    const withoutLaterWithdrawal = {
      ...state,
      investmentCashFlows: state.investmentCashFlows.filter((flow) => flow.date !== "2026-10-21"),
    };
    expect(portfolioInvestmentDisplayMetrics(withoutLaterWithdrawal, tryPortfolio, "2026-10", "TRY"))
      .toMatchObject({ value: 110_000, isEstimated: false, hasCurrentMonthSnapshot: true });
  });

  it("combines current and carried valuations while counting only actual monthly coverage", () => {
    const second = { ...tryPortfolio, id: "second" };
    const state = stateWithInvestments(
      [tryPortfolio, second],
      [
        valuation("2026-09-30", 100_000),
        valuation("2026-10-15", 110_000),
        valuation("2026-09-30", 50_000, second),
      ],
      [],
    );
    expect(combinedInvestmentDisplaySummary(state, "2026-10", "TRY"))
      .toMatchObject({ value: 160_000, completePortfolios: 1, totalPortfolios: 2, isEstimated: true, xirr: null });
    expect(investmentMonthlySeries(state, "2026-10", "TRY"))
      .toEqual([{ month: "2026-09", value: 150_000, invested: 0 }]);
  });

  it("ignores future valuations and movements when viewing an earlier month", () => {
    const state = stateWithInvestments(
      [tryPortfolio],
      [valuation("2026-11-01", 200_000), valuation("2026-09-30", 100_000)],
      [movement("2026-11-01", 20_000)],
    );
    expect(portfolioInvestmentDisplayMetrics(state, tryPortfolio, "2026-10", "TRY"))
      .toMatchObject({ value: 100_000, netInvested: 0, snapshot: { date: "2026-09-30" } });
    expect(portfolioInvestmentDisplayMetrics(state, tryPortfolio, "2026-08", "TRY"))
      .toMatchObject({ value: 0, hasRecords: false, isEstimated: false, snapshot: null });
  });

  it("uses the fixed rate of each valuation and later movement in either display currency", () => {
    const state = stateWithInvestments(
      [tryPortfolio],
      [valuation("2026-09-30", 100_000, tryPortfolio, 40)],
      [
        movement("2026-01-01", 90_000, "contribution", tryPortfolio, 30),
        movement("2026-10-01", 5_000, "contribution", tryPortfolio, 50),
        movement("2026-10-02", 2_000, "withdrawal", tryPortfolio, 40),
      ],
    );
    expect(combinedInvestmentDisplaySummary(state, "2026-10", "USD"))
      .toMatchObject({ value: 2_550, netInvested: 3_050, gain: -500 });
    expect(combinedInvestmentDisplaySummary(state, "2026-10", "TRY"))
      .toMatchObject({ value: 103_000, netInvested: 93_000, gain: 10_000 });
  });

  it.each(["TRY", "USD"] as const)("applies paired cross-currency transfers without adding external capital in %s", (currency) => {
    const state = stateWithInvestments(
      [portfolio, tryPortfolio],
      [valuation("2026-09-30", 1_000, portfolio), valuation("2026-09-30", 40_000)],
      [
        movement("2026-01-01", 1_000, "contribution", portfolio),
        movement("2026-01-01", 40_000),
      ],
    );
    const transferred = saveInvestmentFlowState(state, null, {
      type: "transfer", portfolioId: portfolio.id, destinationPortfolioId: tryPortfolio.id,
      date: "2026-10-01", amount: 200, destinationAmount: 10_000,
      usdTryRate: 50, rateDate: "2026-10-01", rateSource: "manual", note: "",
    });
    const before = combinedInvestmentDisplaySummary(state, "2026-10", currency);
    const after = combinedInvestmentDisplaySummary(transferred, "2026-10", currency);
    expect(after.value).toBe(before.value);
    expect(after.netInvested).toBe(before.netInvested);
    expect(after.gain).toBe(before.gain);
    expect(portfolioInvestmentDisplayMetrics(transferred, portfolio, "2026-10", "USD").value).toBe(800);
    expect(portfolioInvestmentDisplayMetrics(transferred, tryPortfolio, "2026-10", "TRY").value).toBe(50_000);
  });

  it("moves value between portfolios in the same currency without affecting combined capital", () => {
    const second = { ...tryPortfolio, id: "second" };
    const state = stateWithInvestments(
      [tryPortfolio, second],
      [valuation("2026-09-30", 100_000), valuation("2026-09-30", 50_000, second)],
      [movement("2026-01-01", 150_000)],
    );
    const transferred = saveInvestmentFlowState(state, null, {
      type: "transfer", portfolioId: tryPortfolio.id, destinationPortfolioId: second.id,
      date: "2026-10-01", amount: 10_000, usdTryRate: 40,
      rateDate: "2026-10-01", rateSource: "manual", note: "",
    });
    expect(portfolioInvestmentDisplayMetrics(transferred, tryPortfolio, "2026-10", "TRY").value).toBe(90_000);
    expect(portfolioInvestmentDisplayMetrics(transferred, second, "2026-10", "TRY").value).toBe(60_000);
    expect(combinedInvestmentDisplaySummary(transferred, "2026-10", "TRY"))
      .toMatchObject({ value: 150_000, netInvested: 150_000, gain: 0 });
  });

  it("keeps archived external capital through the archive date but excludes its value", () => {
    const archived = { ...tryPortfolio, id: "closed", archivedAt: "2026-10-10T12:00:00.000Z" };
    const future = { ...tryPortfolio, id: "future", createdAt: "2026-11-01T00:00:00.000Z" };
    const state = stateWithInvestments(
      [tryPortfolio, archived, future],
      [valuation("2026-09-30", 100_000), valuation("2026-09-30", 50_000, archived)],
      [
        movement("2026-01-01", 90_000),
        movement("2026-01-01", 50_000, "contribution", archived),
        movement("2026-10-10", 55_000, "withdrawal", archived),
        movement("2026-10-11", 99_000, "contribution", archived),
        movement("2026-11-01", 99_000, "contribution", future),
      ],
    );
    expect(combinedInvestmentDisplaySummary(state, "2026-10", "TRY"))
      .toMatchObject({ value: 100_000, netInvested: 85_000, gain: 15_000, totalPortfolios: 1 });
    expect(combinedInvestmentDisplaySummary(state, "2026-09", "TRY"))
      .toMatchObject({ value: 150_000, netInvested: 140_000, totalPortfolios: 2 });
  });

  it("estimates movement-only portfolios and distinguishes them from portfolios with no records", () => {
    const state = stateWithInvestments(
      [tryPortfolio], [], [movement("2026-10-01", 5_000), movement("2026-10-02", 2_000, "withdrawal")],
    );
    expect(portfolioInvestmentDisplayMetrics(state, tryPortfolio, "2026-10", "TRY"))
      .toMatchObject({ value: 3_000, netInvested: 3_000, gain: 0, hasRecords: true, isEstimated: true, snapshot: null, xirr: null });
    expect(combinedInvestmentDisplaySummary(state, "2026-10", "TRY"))
      .toMatchObject({ value: 3_000, netInvested: 3_000, completePortfolios: 0 });
    expect(portfolioInvestmentDisplayMetrics(state, tryPortfolio, "2026-09", "TRY"))
      .toMatchObject({ value: 0, hasRecords: false, isEstimated: false });
  });

  it.each([0, -2_000])("preserves a resulting value of %s rather than treating it as missing or clamping it", (value) => {
    const state = stateWithInvestments(
      [tryPortfolio], [valuation("2026-09-30", 1_000)],
      [movement("2026-10-01", 1_000 - value, "withdrawal")],
    );
    expect(portfolioInvestmentDisplayMetrics(state, tryPortfolio, "2026-10", "TRY"))
      .toMatchObject({ value, hasRecords: true, isEstimated: true });
    expect(combinedInvestmentDisplaySummary(state, "2026-10", "TRY").value).toBe(value);
  });

  it("recognizes a zero valuation as a real, current monthly record", () => {
    const state = stateWithInvestments([tryPortfolio], [valuation("2026-10-01", 0)], []);
    expect(portfolioInvestmentDisplayMetrics(state, tryPortfolio, "2026-10", "TRY"))
      .toMatchObject({ value: 0, hasRecords: true, hasCurrentMonthSnapshot: true, isEstimated: false });
    expect(combinedInvestmentDisplaySummary(state, "2026-10", "TRY"))
      .toMatchObject({ value: 0, completePortfolios: 1, isEstimated: false });
  });
});

describe("investment return calculations", () => {
  it("solves an irregular annual return", () => {
    const result = xirr([
      { date: "2024-01-01", amount: -100_000 },
      { date: "2024-07-01", amount: -50_000 },
      { date: "2024-12-31", amount: 180_000 },
    ]);

    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(0.25, 1);
  });

  it("returns no XIRR without both positive and negative cash flows", () => {
    expect(xirr([{ date: "2024-01-01", amount: -100 }])).toBeNull();
  });

  it("does not invent an annual return for an opening balance recorded on one day", () => {
    expect(xirr([
      { date: "2024-12-31", amount: -1_000 },
      { date: "2024-12-31", amount: 1_000 },
    ])).toBeNull();
  });

  it("annualizes returns for periods shorter than one year", () => {
    const result = xirr([
      { date: "2024-01-01", amount: -1_000 },
      { date: "2024-07-01", amount: 1_100 },
    ]);

    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0.2);
  });

  it("uses each record's fixed exchange rate for USD return", () => {
    const tryPortfolio: InvestmentPortfolio = {
      ...portfolio,
      id: "bist",
      name: "BIST",
      currency: "TRY",
    };
    const state = stateWithInvestments(
      [tryPortfolio],
      [
        {
          id: "snapshot",
          portfolioId: "bist",
          date: "2024-12-31",
          totalValue: 4_000,
          usdTryRate: 40,
          rateDate: "2024-12-31",
          rateSource: "frankfurter",
        },
      ],
      [
        {
          id: "flow",
          portfolioId: "bist",
          date: "2024-01-01",
          type: "contribution",
          amount: 3_000,
          currency: "TRY",
          usdTryRate: 30,
          rateDate: "2024-01-01",
          rateSource: "frankfurter",
        },
      ],
    );

    expect(investmentXirr(state, tryPortfolio, "2024-12", "USD")).toBeCloseTo(
      0,
      5,
    );
  });

  it("calculates portfolio value, net invested and gain", () => {
    const state = stateWithInvestments(
      [portfolio],
      [
        {
          id: "snapshot",
          portfolioId: portfolio.id,
          date: "2024-12-31",
          totalValue: 1_500,
          usdTryRate: 40,
          rateDate: "2024-12-31",
          rateSource: "frankfurter",
        },
      ],
      [
        {
          id: "contribution",
          portfolioId: portfolio.id,
          date: "2024-01-01",
          type: "contribution",
          amount: 1_200,
          currency: "USD",
          usdTryRate: 30,
          rateDate: "2024-01-01",
          rateSource: "frankfurter",
        },
        {
          id: "withdrawal",
          portfolioId: portfolio.id,
          date: "2024-06-01",
          type: "withdrawal",
          amount: 100,
          currency: "USD",
          usdTryRate: 32,
          rateDate: "2024-06-01",
          rateSource: "frankfurter",
        },
      ],
    );

    const metrics = portfolioInvestmentMetrics(
      state,
      portfolio,
      "2024-12",
      "USD",
    );
    expect(metrics.value).toBe(1_500);
    expect(metrics.netInvested).toBe(1_100);
    expect(metrics.gain).toBe(400);
  });

  it("excludes internal transfers from combined invested capital", () => {
    const second = { ...portfolio, id: "bist", name: "BIST", currency: "TRY" as const };
    const snapshots: InvestmentSnapshot[] = [
      {
        id: "usd-snapshot",
        portfolioId: portfolio.id,
        date: "2024-12-30",
        totalValue: 1_000,
        usdTryRate: 40,
        rateDate: "2024-12-30",
        rateSource: "frankfurter",
      },
      {
        id: "try-snapshot",
        portfolioId: second.id,
        date: "2024-12-31",
        totalValue: 40_000,
        usdTryRate: 40,
        rateDate: "2024-12-31",
        rateSource: "frankfurter",
      },
    ];
    const flows: InvestmentCashFlow[] = [
      {
        id: "outside",
        portfolioId: portfolio.id,
        date: "2024-01-01",
        type: "contribution",
        amount: 1_000,
        currency: "USD",
        usdTryRate: 30,
        rateDate: "2024-01-01",
        rateSource: "frankfurter",
      },
      {
        id: "transfer-out",
        portfolioId: portfolio.id,
        date: "2024-06-01",
        type: "transfer-out",
        amount: 200,
        currency: "USD",
        usdTryRate: 35,
        rateDate: "2024-06-01",
        rateSource: "frankfurter",
        transferGroupId: "transfer",
        counterpartyPortfolioId: second.id,
      },
      {
        id: "transfer-in",
        portfolioId: second.id,
        date: "2024-06-01",
        type: "transfer-in",
        amount: 7_000,
        currency: "TRY",
        usdTryRate: 35,
        rateDate: "2024-06-01",
        rateSource: "frankfurter",
        transferGroupId: "transfer",
        counterpartyPortfolioId: portfolio.id,
      },
    ];
    const state = stateWithInvestments([portfolio, second], snapshots, flows);

    const summary = combinedInvestmentSummary(state, "2024-12", "USD");
    expect(summary.netInvested).toBe(1_000);
    expect(summary.value).toBe(2_000);
    expect(summary.completePortfolios).toBe(2);
    expect(summary.totalPortfolios).toBe(2);
    expect(portfolioInvestmentMetrics(state, portfolio, "2024-12", "USD").netInvested).toBe(800);
    expect(portfolioInvestmentMetrics(state, second, "2024-12", "USD").netInvested).toBe(200);
  });

  it("marks the combined return unavailable when a portfolio is missing that month", () => {
    const second = { ...portfolio, id: "bist", name: "BIST" };
    const state = stateWithInvestments(
      [portfolio, second],
      [
        {
          id: "snapshot",
          portfolioId: portfolio.id,
          date: "2024-12-31",
          totalValue: 1_000,
          usdTryRate: 40,
          rateDate: "2024-12-31",
          rateSource: "manual",
        },
      ],
      [{
        id: "missing-portfolio-contribution",
        portfolioId: second.id,
        date: "2024-12-15",
        type: "contribution",
        amount: 500,
        currency: "USD",
        usdTryRate: 40,
        rateDate: "2024-12-15",
        rateSource: "manual",
      }],
    );

    const summary = combinedInvestmentSummary(state, "2024-12", "USD");
    expect(summary.completePortfolios).toBe(1);
    expect(summary.totalPortfolios).toBe(2);
    expect(summary.netInvested).toBe(0);
    expect(summary.xirr).toBeNull();
  });

  it("keeps an earlier complete chart month when a portfolio is created later", () => {
    const laterPortfolio = {
      ...portfolio,
      id: "later",
      createdAt: "2025-01-10T00:00:00.000Z",
    };
    const state = stateWithInvestments(
      [portfolio, laterPortfolio],
      [{
        id: "early-snapshot",
        portfolioId: portfolio.id,
        date: "2024-12-31",
        totalValue: 1_000,
        usdTryRate: 40,
        rateDate: "2024-12-31",
        rateSource: "manual",
      }],
      [],
    );

    expect(investmentMonthlySeries(state, "2025-01", "USD")).toEqual([
      { month: "2024-12", value: 1_000, invested: 0 },
    ]);
  });

  it("keeps archived portfolio contributions in combined invested capital", () => {
    const closedPortfolio = {
      ...portfolio,
      id: "closed",
      archivedAt: "2024-06-30T12:00:00.000Z",
    };
    const state = stateWithInvestments(
      [portfolio, closedPortfolio],
      [{
        id: "open-snapshot",
        portfolioId: portfolio.id,
        date: "2024-12-31",
        totalValue: 1_000,
        usdTryRate: 40,
        rateDate: "2024-12-31",
        rateSource: "manual",
      }],
      [
        { id: "old-capital", portfolioId: closedPortfolio.id, date: "2024-01-01", type: "contribution", amount: 500, currency: "USD", usdTryRate: 30, rateDate: "2024-01-01", rateSource: "manual" },
        { id: "old-withdrawal", portfolioId: closedPortfolio.id, date: "2024-06-30", type: "withdrawal", amount: 550, currency: "USD", usdTryRate: 35, rateDate: "2024-06-30", rateSource: "manual" },
      ],
    );

    const summary = combinedInvestmentSummary(state, "2024-12", "USD");
    expect(summary.netInvested).toBe(-50);
    expect(summary.gain).toBe(1_050);
  });
});

describe("investment mutations", () => {
  it("creates a monthly snapshot with linked contribution and withdrawal flows", () => {
    const state = stateWithInvestments([portfolio], [], []);
    const next = saveInvestmentMonthlyRecordState(state, null, {
      portfolioId: portfolio.id,
      date: "2024-12-31",
      totalValue: 1_500,
      contributed: 300,
      withdrawn: 50,
      usdTryRate: 40,
      rateDate: "2024-12-31",
      rateSource: "frankfurter",
      note: "Yıl sonu",
    });

    expect(next.investmentSnapshots).toHaveLength(1);
    expect(next.investmentCashFlows.map(({ type, amount }) => ({ type, amount }))).toEqual([
      { type: "contribution", amount: 300 },
      { type: "withdrawal", amount: 50 },
    ]);
    expect(next.investmentCashFlows.every((flow) => flow.snapshotId === next.investmentSnapshots[0].id)).toBe(true);
  });

  it("replaces a second monthly valuation and its linked flows", () => {
    const state = stateWithInvestments([portfolio], [], []);
    const first = saveInvestmentMonthlyRecordState(state, null, {
      portfolioId: portfolio.id,
      date: "2024-12-20",
      totalValue: 1_500,
      contributed: 300,
      withdrawn: 0,
      usdTryRate: 40,
      rateDate: "2024-12-20",
      rateSource: "manual",
      note: "",
    });
    const second = saveInvestmentMonthlyRecordState(first, null, {
      portfolioId: portfolio.id,
      date: "2024-12-31",
      totalValue: 1_600,
      contributed: 400,
      withdrawn: 0,
      usdTryRate: 41,
      rateDate: "2024-12-31",
      rateSource: "manual",
      note: "",
    });

    expect(second.investmentSnapshots).toHaveLength(1);
    expect(second.investmentSnapshots[0].date).toBe("2024-12-31");
    expect(second.investmentCashFlows.map((flow) => flow.amount)).toEqual([400]);
  });

  it("removes only flows linked to a deleted monthly snapshot", () => {
    const state = stateWithInvestments(
      [portfolio],
      [{
        id: "snapshot",
        portfolioId: portfolio.id,
        date: "2024-12-31",
        totalValue: 1_500,
        usdTryRate: 40,
        rateDate: "2024-12-31",
        rateSource: "manual",
      }],
      [{
        id: "linked",
        snapshotId: "snapshot",
        portfolioId: portfolio.id,
        date: "2024-12-31",
        type: "contribution",
        amount: 100,
        currency: "USD",
        usdTryRate: 40,
        rateDate: "2024-12-31",
        rateSource: "manual",
      }, {
        id: "independent",
        portfolioId: portfolio.id,
        date: "2024-12-15",
        type: "contribution",
        amount: 25,
        currency: "USD",
        usdTryRate: 40,
        rateDate: "2024-12-15",
        rateSource: "manual",
      }],
    );

    const next = deleteInvestmentSnapshotState(state, "snapshot");
    expect(next.investmentSnapshots).toEqual([]);
    expect(next.investmentCashFlows.map(({ id }) => id)).toEqual(["independent"]);
  });

  it("creates paired cross-currency transfer flows", () => {
    const second = { ...portfolio, id: "bist", name: "BIST", currency: "TRY" as const };
    const state = stateWithInvestments([portfolio, second], [], []);
    const next = saveInvestmentFlowState(state, null, {
      type: "transfer",
      portfolioId: portfolio.id,
      destinationPortfolioId: second.id,
      date: "2024-06-01",
      amount: 200,
      destinationAmount: 7_000,
      usdTryRate: 35,
      rateDate: "2024-06-01",
      rateSource: "manual",
      note: "Dağılım değişikliği",
    });

    expect(next.investmentCashFlows).toHaveLength(2);
    expect(next.investmentCashFlows.map(({ type, currency, amount }) => ({ type, currency, amount }))).toEqual([
      { type: "transfer-out", currency: "USD", amount: 200 },
      { type: "transfer-in", currency: "TRY", amount: 7_000 },
    ]);
    expect(next.investmentCashFlows[0].transferGroupId).toBe(next.investmentCashFlows[1].transferGroupId);
  });

  it("creates, edits and archives a portfolio without deleting its history", () => {
    const state = stateWithInvestments([], [], []);
    const created = saveInvestmentPortfolioState(state, null, {
      name: "Yeni fon",
      purpose: "Uzun vadeli büyüme",
      currency: "TRY",
      description: "Deneme",
    });
    const id = created.investmentPortfolios[0].id;
    const edited = saveInvestmentPortfolioState(created, id, {
      name: "Fon sepeti",
      purpose: "Uzun vadeli büyüme",
      currency: "TRY",
      description: "TEFAS",
    });
    const archived = setInvestmentPortfolioArchivedState(edited, id, true);

    expect(edited.investmentPortfolios[0].name).toBe("Fon sepeti");
    expect(archived.investmentPortfolios[0].archivedAt).toBeTruthy();
  });

  it("keeps the natural currency fixed after investment history exists", () => {
    const state = stateWithInvestments([portfolio], [{
      id: "snapshot",
      portfolioId: portfolio.id,
      date: "2024-12-31",
      totalValue: 1_000,
      usdTryRate: 40,
      rateDate: "2024-12-31",
      rateSource: "manual",
    }], []);
    const edited = saveInvestmentPortfolioState(state, portfolio.id, {
      name: "Renamed",
      purpose: portfolio.purpose,
      currency: "TRY",
      description: portfolio.description,
    });

    expect(edited.investmentPortfolios[0].name).toBe("Renamed");
    expect(edited.investmentPortfolios[0].currency).toBe("USD");
  });
});

describe("portfolio activity across months", () => {
  it("does not let an archived, never-used starter portfolio block earlier months", () => {
    const base = normalizeState({ selectedMonth: "2026-08" });
    const recorded = ["investment-us-etf", "investment-bist", "investment-tefas", "investment-bes-1"];
    const state: FinanceState = {
      ...base,
      investmentPortfolios: base.investmentPortfolios.map((item) =>
        item.id === "investment-bes-2" ? { ...item, archivedAt: "2026-09-27T20:00:00.000Z" } : item,
      ),
      investmentSnapshots: recorded.map((portfolioId) => ({
        id: `${portfolioId}-aug`,
        portfolioId,
        date: "2026-08-31",
        totalValue: 1_000,
        usdTryRate: 40,
        rateDate: "2026-08-31",
        rateSource: "manual",
      })),
    };

    expect(activeInvestmentPortfolios(state, "2026-08").map(({ id }) => id)).toEqual(recorded);
    const summary = combinedInvestmentSummary(state, "2026-08", "USD");
    expect(summary.completePortfolios).toBe(4);
    expect(summary.totalPortfolios).toBe(4);
    expect(investmentMonthlySeries(state, "2026-09", "USD")).toHaveLength(1);
  });

  it("keeps an archived starter portfolio active for months where it has records", () => {
    const base = normalizeState({ selectedMonth: "2026-08" });
    const state: FinanceState = {
      ...base,
      investmentPortfolios: base.investmentPortfolios.map((item) =>
        item.id === "investment-bes-2" ? { ...item, archivedAt: "2026-09-27T20:00:00.000Z" } : item,
      ),
      investmentSnapshots: [{
        id: "bes-2-jul",
        portfolioId: "investment-bes-2",
        date: "2026-07-31",
        totalValue: 1_000,
        usdTryRate: 40,
        rateDate: "2026-07-31",
        rateSource: "manual",
      }],
    };

    expect(activeInvestmentPortfolios(state, "2026-08").map(({ id }) => id)).toContain("investment-bes-2");
  });

  it("treats a portfolio archived on the last day of a month as inactive for that month", () => {
    const archived: InvestmentPortfolio = {
      ...portfolio,
      id: "closing",
      archivedAt: "2026-09-30T10:00:00.000Z",
    };
    const state = stateWithInvestments([archived], [{
      id: "closing-snapshot",
      portfolioId: "closing",
      date: "2026-06-30",
      totalValue: 1_000,
      usdTryRate: 40,
      rateDate: "2026-06-30",
      rateSource: "manual",
    }], []);

    expect(activeInvestmentPortfolios(state, "2026-09")).toEqual([]);
    expect(activeInvestmentPortfolios(state, "2026-08").map(({ id }) => id)).toEqual(["closing"]);
  });

  it("reports the value a portfolio still holds before archiving", () => {
    const state = stateWithInvestments([portfolio], [{
      id: "snapshot",
      portfolioId: portfolio.id,
      date: "2024-12-31",
      totalValue: 1_000,
      usdTryRate: 40,
      rateDate: "2024-12-31",
      rateSource: "manual",
    }], [{
      id: "later-withdrawal",
      portfolioId: portfolio.id,
      date: "2025-01-10",
      type: "withdrawal",
      amount: 400,
      currency: "USD",
      usdTryRate: 40,
      rateDate: "2025-01-10",
      rateSource: "manual",
    }]);

    expect(portfolioResidualValue(state, portfolio.id)).toBe(600);
    expect(portfolioResidualValue(state, "unknown")).toBe(0);
  });

  it("returns a total loss instead of no data when nothing ever came back", () => {
    expect(xirr([
      { date: "2024-01-01", amount: -1_000 },
      { date: "2025-01-01", amount: 0 },
    ])).toBe(-1);
  });
});
