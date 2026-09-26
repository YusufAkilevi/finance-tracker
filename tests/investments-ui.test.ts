import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvestmentMonthlyRecordModal } from "../src/components/InvestmentModals";
import { NavButton } from "../src/components/Nav";
import { InvestmentsView } from "../src/components/views/InvestmentsView";
import { defaultState } from "../src/lib/state";

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

    expect(markup).toContain("0/5 portföy güncel");
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

});
