import { describe, expect, it } from "vitest";
import {
  combinedInvestmentSummary,
  investmentMonthlySeries,
  investmentXirr,
  portfolioInvestmentMetrics,
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
