import { CSSProperties } from "react";
import { InvestmentChart } from "../InvestmentChart";
import { EmptyState } from "../EmptyState";
import {
  activeInvestmentPortfolios,
  combinedInvestmentSummary,
  investmentMonthlySeries,
  portfolioInvestmentMetrics,
} from "../../lib/investments";
import { investmentMoney, percentage } from "../../lib/format";
import type {
  FinanceState,
  InvestmentCurrency,
  InvestmentPortfolio,
  View,
} from "../../types";

type InvestmentsViewProps = {
  activeView: View;
  currency: InvestmentCurrency;
  state: FinanceState;
  onAddRecord: () => void;
  onCurrencyChange: (currency: InvestmentCurrency) => void;
  onManage: () => void;
  onOpenHistory: (portfolio: InvestmentPortfolio) => void;
};

const allocationColors = [
  "var(--blue)",
  "#5d82c6",
  "#8aa2bc",
  "#65a087",
  "#b19a69",
];

export function InvestmentsView({
  activeView,
  currency,
  state,
  onAddRecord,
  onCurrencyChange,
  onManage,
  onOpenHistory,
}: InvestmentsViewProps) {
  const portfolios = activeInvestmentPortfolios(state);
  const rows = portfolios.map((portfolio) => ({
    portfolio,
    metrics: portfolioInvestmentMetrics(
      state,
      portfolio,
      state.selectedMonth,
      currency,
    ),
  }));
  const summary = combinedInvestmentSummary(state, state.selectedMonth, currency);
  const series = investmentMonthlySeries(state, state.selectedMonth, currency);
  const allocation = rows
    .filter(({ metrics }) => metrics.value > 0)
    .map(({ portfolio, metrics }, index) => ({
      portfolio,
      value: metrics.value,
      color: allocationColors[index % allocationColors.length],
    }));
  const allocationStyle = {
    "--investment-allocation": allocationGradient(allocation),
  } as CSSProperties;
  const isComplete = summary.completePortfolios === summary.totalPortfolios;

  return (
    <section
      id="investmentsView"
      className={`view investments-view ${activeView === "investments" ? "active-view" : ""}`}
      aria-labelledby="viewTitle"
    >
      <div className="investment-page-actions">
        <div className="currency-switch" role="group" aria-label="Yatırım para birimi">
          {(["TRY", "USD"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={currency === option}
              onClick={() => onCurrencyChange(option)}
            >
              {option === "TRY" ? "TL" : "USD"}
            </button>
          ))}
        </div>
        <button className="button button-ghost" type="button" onClick={onManage}>
          Portföyleri yönet
        </button>
        <button className="primary-action" type="button" onClick={onAddRecord} disabled={!state.investmentPortfolios.some((portfolio) => !portfolio.archivedAt)}>
          Aylık kayıt ekle
        </button>
      </div>

      <div className="investment-summary-grid">
        <article className="metric investment-metric-total">
          <span>Toplam yatırım varlığı</span>
          <strong>{investmentMoney(summary.value, currency)}</strong>
          <small>
            {summary.totalPortfolios
              ? `${summary.completePortfolios}/${summary.totalPortfolios} portföy güncel`
              : "Henüz portföy yok"}
          </small>
        </article>
        <article className="metric investment-metric-capital">
          <span>Net yatırılan ana para</span>
          <strong>{investmentMoney(summary.netInvested, currency)}</strong>
          <small>Eklenen para eksi çekilen para</small>
        </article>
        <article className="metric investment-metric-gain">
          <span>Net yatırım kazancı</span>
          <strong className={summary.gain >= 0 ? "positive-value" : "negative-value"}>
            {investmentMoney(summary.gain, currency)}
          </strong>
          <small>Ana paranın üzerinde kalan değer</small>
        </article>
        <article className="metric investment-metric-return">
          <span>{currency} yıllık getiri</span>
          <strong className={summary.xirr !== null && summary.xirr >= 0 ? "positive-value" : summary.xirr !== null ? "negative-value" : ""}>
            {percentage(summary.xirr)}
          </strong>
          <small>
            {!isComplete
              ? "Tüm portföylerin bu ay kaydı gerekli"
              : summary.xirr === null
                ? "Hesaplamak için yeterli veri yok"
                : `XIRR · ${summary.historyMonths} aylık veri`}
          </small>
        </article>
      </div>

      {!isComplete && summary.totalPortfolios ? (
        <div className="investment-status-note" role="status">
          <strong>Bu ayın görünümü tamamlanmadı.</strong>
          <span>Birleşik getiri için {summary.totalPortfolios - summary.completePortfolios} portföyün aylık kaydını ekle.</span>
        </div>
      ) : null}

      <div className="investment-insight-grid">
        <section className="panel investment-chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Varlık gelişimi</h3>
              <p className="panel-note">Portföy değeri ile net ana paranın aylık seyri</p>
            </div>
          </div>
          <InvestmentChart currency={currency} points={series} />
        </section>
        <section className="panel investment-allocation-panel">
          <div className="panel-heading">
            <div>
              <h3>Dağılım</h3>
              <p className="panel-note">Seçili ayın portföy ağırlıkları</p>
            </div>
          </div>
          {allocation.length ? (
            <>
              <div className="investment-donut" style={allocationStyle} role="img" aria-label={allocationLabel(allocation)}>
                <span>{allocation.length}<small>portföy</small></span>
              </div>
              <div className="investment-allocation-list">
                {allocation.map((item) => {
                  const ratio = summary.value ? item.value / summary.value : 0;
                  return (
                    <div className="investment-allocation-row" key={item.portfolio.id}>
                      <i style={{ background: item.color }} aria-hidden="true" />
                      <span>{item.portfolio.name}</span>
                      <strong>{percentage(ratio)}</strong>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState text="Bu ay için dağılım gösterecek portföy değeri yok." />
          )}
        </section>
      </div>

      <section className="panel investment-portfolio-panel">
        <div className="panel-heading">
          <div>
            <h3>Portföyler</h3>
            <p className="panel-note">Her portföyün getirisi kendi para akışlarıyla hesaplanır.</p>
          </div>
        </div>
        {portfolios.length ? (
          <div className="investment-table-wrap">
            <table className="investment-table">
              <thead>
                <tr>
                  <th>Portföy</th>
                  <th className="amount-col">Güncel değer</th>
                  <th className="amount-col">Net ana para</th>
                  <th className="amount-col">Net kazanç</th>
                  <th className="amount-col">{currency} XIRR</th>
                  <th>Son kayıt</th>
                  <th><span className="visually-hidden">İşlem</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ portfolio, metrics }) => (
                  <tr key={portfolio.id}>
                    <td data-label="Portföy">
                      <div className="investment-portfolio-name">
                        <span className="investment-portfolio-mark" aria-hidden="true">{portfolio.name.slice(0, 1)}</span>
                        <span><strong>{portfolio.name}</strong><small>{portfolio.purpose}{portfolio.description ? ` · ${portfolio.description}` : ""}</small></span>
                      </div>
                    </td>
                    <td data-label="Güncel değer" className="amount-col">{metrics.snapshot ? investmentMoney(metrics.value, currency) : "—"}</td>
                    <td data-label="Net ana para" className="amount-col">{investmentMoney(metrics.netInvested, currency)}</td>
                    <td data-label="Net kazanç" className={`amount-col ${metrics.gain >= 0 ? "positive-value" : "negative-value"}`}>{metrics.snapshot ? investmentMoney(metrics.gain, currency) : "—"}</td>
                    <td data-label={`${currency} XIRR`} className={`amount-col ${metrics.xirr !== null && metrics.xirr >= 0 ? "positive-value" : metrics.xirr !== null ? "negative-value" : ""}`}>{percentage(metrics.xirr)}</td>
                    <td data-label="Son kayıt">{metrics.snapshot ? formatSnapshotDate(metrics.snapshot.date) : "Eksik"}</td>
                    <td data-label="İşlem" className="investment-action-cell"><button className="row-action" type="button" onClick={() => onOpenHistory(portfolio)}>Kayıtlar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="Aktif portföy yok. Takibe başlamak için bir portföy oluştur." />
        )}
      </section>
    </section>
  );
}

function allocationGradient(allocation: { value: number; color: string }[]) {
  const total = allocation.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const stops = allocation.map((item) => {
    const start = cursor;
    cursor += total ? (item.value / total) * 100 : 0;
    return `${item.color} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function allocationLabel(allocation: { portfolio: InvestmentPortfolio; value: number }[]) {
  const total = allocation.reduce((sum, item) => sum + item.value, 0);
  return allocation.map((item) => `${item.portfolio.name} yüzde ${Math.round((item.value / total) * 100)}`).join(", ");
}

function formatSnapshotDate(date: string) {
  return new Intl.DateTimeFormat("tr-TR", { month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}
