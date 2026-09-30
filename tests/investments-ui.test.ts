import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvestmentChart } from "../src/components/InvestmentChart";
import { InvestmentAllocationChart } from "../src/components/InvestmentAllocationChart";
import { InvestmentMonthlyRecordModal } from "../src/components/InvestmentModals";
import { NavButton } from "../src/components/Nav";
import { InvestmentsView } from "../src/components/views/InvestmentsView";
import { defaultState } from "../src/lib/state";
import { investmentMoney } from "../src/lib/format";
import type { FinanceState, InvestmentCurrency, InvestmentSnapshot } from "../src/types";

describe("investment UI", () => {
  it("renders the fifth navigation destination", () => {
    const markup = renderToStaticMarkup(
      createElement(NavButton, {
        active: true,
        icon: "investments",
        label: "Yatırımlar",
        onClick: () => undefined,
      }),
    );
    expect(markup).toContain("Yatırımlar");
    expect(markup).toContain('aria-current="page"');
  });

  it("shows incomplete monthly coverage and independent portfolio rows", () => {
    const state = { ...defaultState(), selectedMonth: "2026-09" };
    const markup = renderToStaticMarkup(
      createElement(InvestmentsView, {
        activeView: "investments",
        currency: "USD",
        state,
        onAddRecord: () => undefined,
        onCurrencyChange: () => undefined,
        onManage: () => undefined,
        onOpenHistory: () => undefined,
      }),
    );

    expect(markup).toContain("0/5 portföy bu ay güncel");
    expect(markup).toContain("ABD ETF");
    expect(markup).toContain("BES 2");
    expect(markup).toContain("Tüm portföylerin bu ay kaydı gerekli");
  });

  it("adapts monthly-record labels to the portfolio's natural currency", () => {
    const state = defaultState();
    const markup = renderToStaticMarkup(
      createElement(InvestmentMonthlyRecordModal, {
        portfolios: state.investmentPortfolios,
        selectedMonth: state.selectedMonth,
        snapshot: null,
        snapshots: [],
        cashFlows: [],
        onClose: () => undefined,
        onSubmit: () => undefined,
      }),
    );

    expect(markup).toContain("Toplam değer (USD)");
    expect(markup).toContain("Bu dönemde eklenen (USD)");
    expect(markup).toContain('name="usdTryRate"');
    expect(markup).toContain("Aylık kaydı ekle");
  });

  it("blocks a second record for the same portfolio and month", () => {
    const state = defaultState();
    const markup = renderToStaticMarkup(
      createElement(InvestmentMonthlyRecordModal, {
        portfolios: state.investmentPortfolios,
        selectedMonth: state.selectedMonth,
        snapshot: null,
        snapshots: [{
          id: "already-recorded",
          portfolioId: state.investmentPortfolios[0].id,
          date: `${state.selectedMonth}-01`,
          totalValue: 1_000,
          usdTryRate: 40,
          rateDate: `${state.selectedMonth}-01`,
          rateSource: "manual",
        }],
        cashFlows: [],
        onClose: () => undefined,
        onSubmit: () => undefined,
      }),
    );

    expect(markup).toContain("Bu portföyün seçili ayda kaydı var");
  });

  it("plots negative net capital below the zero baseline instead of clamping it", () => {
    const markup = renderToStaticMarkup(
      createElement(InvestmentChart, {
        currency: "USD",
        points: [
          { month: "2026-07", value: 1_000, invested: 800 },
          { month: "2026-08", value: 900, invested: -200 },
        ],
      }),
    );

    expect(markup).not.toContain("NaN");
    expect(markup).toContain("-$200");
  });
});

describe("allocation chart percentages", () => {
  function renderAllocation(values: number[]) {
    return renderToStaticMarkup(createElement(InvestmentAllocationChart, {
      allocation: values.map((value, index) => ({
        portfolio: { id: `portfolio-${index}`, name: `Portföy ${index + 1}` },
        value,
        color: "#2563eb",
      })),
    }));
  }

  it("labels every slice outside with a leader in a seven-portfolio distribution", () => {
    const markup = renderAllocation([46, 119, 168, 176, 107, 18, 366]);
    const labels = [...markup.matchAll(/<text class="investment-donut-percentage[^\"]*"[^>]*>([^<]+)<\/text>/g)]
      .map((match) => match[1]);
    expect(labels).toEqual(["%4,6", "%11,9", "%16,8", "%17,6", "%10,7", "%1,8", "%36,6"]);
    expect(markup.match(/class="investment-donut-leader"/g)).toHaveLength(7);
    expect(markup).toContain("Portföy 1: %4,6");
    expect(markup).not.toContain("NaN");
  });

  it("keeps a single portfolio's 100 percent label and center count visible", () => {
    const markup = renderAllocation([1_000]);
    expect(markup).toMatch(/class="investment-donut-percentage"[^>]*>%100,0<\/text>/);
    expect(markup).toMatch(/class="investment-donut-count"[^>]*>1<\/text>/);
    expect(markup).toContain("investment-donut-leader");
  });

  it("separates crowded small-slice labels and keeps every label within the chart", () => {
    const markup = renderAllocation([...Array(20).fill(1), 80]);
    const height = Number(markup.match(/viewBox="0 0 280 ([^\"]+)"/)![1]);
    const labels = [...markup.matchAll(/class="investment-donut-percentage" x="([^\"]+)" y="([^\"]+)"/g)];
    expect(labels).toHaveLength(21);
    for (const x of ["45", "235"]) {
      const positions = labels.filter((match) => match[1] === x).map((match) => Number(match[2])).sort((a, b) => a - b);
      positions.forEach((y, index) => {
        expect(y).toBeGreaterThanOrEqual(12);
        expect(y).toBeLessThanOrEqual(height - 12);
        if (index) expect(y - positions[index - 1]).toBeGreaterThanOrEqual(19.99);
      });
    }
  });
});

describe("latest investment values in the UI", () => {
  function renderInvestments(state: FinanceState, currency: InvestmentCurrency = "TRY") {
    return renderToStaticMarkup(createElement(InvestmentsView, {
      activeView: "investments",
      currency,
      state,
      onAddRecord: () => undefined,
      onCurrencyChange: () => undefined,
      onManage: () => undefined,
      onOpenHistory: () => undefined,
    }));
  }

  function displayState(values: number[], date = "2026-09-30"): FinanceState {
    const state = defaultState();
    const investmentPortfolios = state.investmentPortfolios.slice(1, 1 + values.length);
    const investmentSnapshots: InvestmentSnapshot[] = investmentPortfolios.map((portfolio, index) => ({
      id: `${portfolio.id}-snapshot`, portfolioId: portfolio.id, date,
      totalValue: values[index], usdTryRate: 40, rateDate: date, rateSource: "manual",
    }));
    return { ...state, selectedMonth: "2026-10", investmentPortfolios, investmentSnapshots };
  }

  function rowFor(markup: string, name: string) {
    return markup.match(/<tr>[\s\S]*?<\/tr>/g)!.find((row) => row.includes(name))!;
  }

  it("keeps carried values in the total, table and donut with their valuation date and estimate labels", () => {
    const markup = renderInvestments(displayState([100_000, 50_000]));
    expect(markup).toContain(`Toplam yatırım varlığı</span><strong>${investmentMoney(150_000, "TRY")}`);
    expect(markup).toContain("0/2 portföy bu ay güncel · Tahmini değer");
    expect(markup).toContain("Piyasa değişimleri dahil değildir.");
    expect(markup).toContain("30 Eyl 2026");
    expect(markup).toContain('class="investment-donut"');
    expect(markup).toContain("BIST yüzde 67, TEFAS yüzde 33");
    expect(markup).toContain("%66,7");
    expect(markup).toContain("%33,3");
    expect(rowFor(markup, "BIST")).toContain(investmentMoney(100_000, "TRY"));
    expect(rowFor(markup, "TEFAS")).toContain(investmentMoney(50_000, "TRY"));
    expect(rowFor(markup, "BIST")).toContain("Tahmini değer");
    expect(markup).toContain("Tüm portföylerin bu ay kaydı gerekli");
    expect(markup).not.toContain("NaN");
  });

  it("shows later contributions and withdrawals consistently in the summary and row", () => {
    const state = displayState([100_000]);
    state.investmentCashFlows = [
      { id: "opening", portfolioId: state.investmentPortfolios[0].id, date: "2026-01-01", type: "contribution", amount: 90_000, currency: "TRY", usdTryRate: 40, rateDate: "2026-01-01", rateSource: "manual" },
      { id: "add", portfolioId: state.investmentPortfolios[0].id, date: "2026-10-01", type: "contribution", amount: 5_000, currency: "TRY", usdTryRate: 40, rateDate: "2026-10-01", rateSource: "manual" },
      { id: "take", portfolioId: state.investmentPortfolios[0].id, date: "2026-10-02", type: "withdrawal", amount: 2_000, currency: "TRY", usdTryRate: 40, rateDate: "2026-10-02", rateSource: "manual" },
    ];
    const markup = renderInvestments(state);
    expect(markup).toContain(`Toplam yatırım varlığı</span><strong>${investmentMoney(103_000, "TRY")}`);
    const row = rowFor(markup, "BIST");
    expect(row).toContain(investmentMoney(103_000, "TRY"));
    expect(row).toContain(investmentMoney(93_000, "TRY"));
    expect(row).toContain(investmentMoney(10_000, "TRY"));
    expect(row).toContain("Tahmini değer");
  });

  it("counts actual monthly coverage separately from carried estimates", () => {
    const state = displayState([110_000, 50_000]);
    state.investmentSnapshots[0] = { ...state.investmentSnapshots[0], date: "2026-10-15" };
    const markup = renderInvestments(state);
    expect(markup).toContain("1/2 portföy bu ay güncel · Tahmini değer");
    expect(rowFor(markup, "BIST")).not.toContain("Tahmini değer");
    expect(rowFor(markup, "BIST")).toContain("15 Eki 2026");
    expect(rowFor(markup, "TEFAS")).toContain("Tahmini değer");
    expect(markup).toContain("Birleşik getiri için 1 portföyün aylık kaydını ekle.");
  });

  it("normalizes the donut by positive values while preserving negative and zero table values", () => {
    const state = displayState([100_000, 50_000, 0, 0]);
    state.investmentCashFlows = [{
      id: "withdrawal", portfolioId: state.investmentPortfolios[2].id,
      date: "2026-10-01", type: "withdrawal", amount: 50_000,
      currency: "TRY", usdTryRate: 40, rateDate: "2026-10-01", rateSource: "manual",
    }];
    const markup = renderInvestments(state);
    expect(markup).toContain(`Toplam yatırım varlığı</span><strong>${investmentMoney(100_000, "TRY")}`);
    expect(markup).toContain("%66,7");
    expect(markup).toContain("%33,3");
    expect(markup).toContain("BIST yüzde 67, TEFAS yüzde 33");
    expect(rowFor(markup, "BES 1")).toContain(investmentMoney(-50_000, "TRY"));
    expect(rowFor(markup, "BES 2")).toContain(investmentMoney(0, "TRY"));
    expect(rowFor(markup, "BES 2")).not.toContain("Kayıt yok");
    expect(markup).not.toContain("NaN");
  });

  it("distinguishes movement-only estimates from portfolios with no records", () => {
    const state = displayState([0, 0]);
    state.investmentSnapshots = [];
    state.investmentCashFlows = [{
      id: "contribution", portfolioId: state.investmentPortfolios[0].id,
      date: "2026-10-01", type: "contribution", amount: 5_000,
      currency: "TRY", usdTryRate: 40, rateDate: "2026-10-01", rateSource: "manual",
    }];
    const markup = renderInvestments(state);
    expect(rowFor(markup, "BIST")).toContain(investmentMoney(5_000, "TRY"));
    expect(rowFor(markup, "BIST")).toContain("Tahmini değer");
    expect(rowFor(markup, "BIST")).toContain("Değerleme yok");
    expect(rowFor(markup, "TEFAS")).toContain("Kayıt yok");
    expect(markup).toContain('class="investment-donut"');
  });

  it("renders current zero valuations as recorded and removes estimate notices after an update", () => {
    const markup = renderInvestments(displayState([0], "2026-10-15"));
    expect(markup).toContain("1/1 portföy bu ay güncel");
    expect(markup).not.toContain("Tahmini değer");
    expect(rowFor(markup, "BIST")).toContain(investmentMoney(0, "TRY"));
    expect(markup).toContain("15 Eki 2026");
    expect(markup).not.toContain('class="investment-donut"');
    expect(markup).toContain("Bu ay için dağılım gösterecek portföy değeri yok.");
  });
});
