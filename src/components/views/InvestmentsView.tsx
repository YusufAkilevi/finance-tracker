import { InvestmentChart } from "../InvestmentChart";
import { InvestmentAllocationChart } from "../InvestmentAllocationChart";
import { EmptyState } from "../EmptyState";
import {
  activeInvestmentPortfolios,
  combinedInvestmentDisplaySummary,
  investmentMonthlySeries,
  portfolioInvestmentDisplayMetrics,
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
  "#2563eb", // Blue
  "#ea580c", // Orange
  "#16a34a", // Green
  "#9333ea", // Purple
  "#eab308", // Yellow
  "#0891b2", // Cyan
  "#db2777", // Pink
  "#475569", // Slate
  "#92400e", // Brown
  "#84cc16", // Lime
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
    metrics: portfolioInvestmentDisplayMetrics(
      state,
      portfolio,
      state.selectedMonth,
      currency,
    ),
  }));
  const summary = combinedInvestmentDisplaySummary(state, state.selectedMonth, currency);
  const series = investmentMonthlySeries(state, state.selectedMonth, currency);
  const allocation = rows
    .filter(({ metrics }) => metrics.value > 0)
    .map(({ portfolio, metrics }, index) => ({
      portfolio,
      value: metrics.value,
      color: allocationColors[index] ?? `hsl(${(index * 137.508) % 360} 65% 45%)`,
    }));
  const allocationTotal = allocation.reduce((total, item) => total + item.value, 0);
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
              ? `${summary.completePortfolios}/${summary.totalPortfolios} portföy bu ay güncel${summary.isEstimated ? " · Tahmini değer" : ""}`
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
          <small>{summary.isEstimated ? "Tahmini değer üzerinden hesaplanır" : "Ana paranın üzerinde kalan değer"}</small>
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

      {summary.isEstimated ? (
        <div className="investment-status-note" role="status">
          <strong>Tahmini değer</strong>
          <span>Son değerlemeler ve ardından kaydedilen para hareketleri kullanılır. Piyasa değişimleri dahil değildir.</span>
        </div>
      ) : null}

      {!isComplete && summary.totalPortfolios ? (
        <div className="investment-status-note" role="status">
          <strong>Bu ayın değerlemeleri tamamlanmadı.</strong>
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
              <p className="panel-note">{summary.isEstimated ? "Tahmini pozitif portföy değerlerinin ağırlıkları" : "Pozitif portföy değerlerinin ağırlıkları"}</p>
            </div>
          </div>
          {allocation.length ? (
            <>
              <InvestmentAllocationChart allocation={allocation} />
              <div className="investment-allocation-list">
                {allocation.map((item) => {
                  const ratio = allocationTotal ? item.value / allocationTotal : 0;
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
                  <th className="amount-col">Portföy değeri</th>
                  <th className="amount-col">Net ana para</th>
                  <th className="amount-col">Net kazanç</th>
                  <th className="amount-col">{currency} XIRR</th>
                  <th>Son değerleme</th>
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
                    <td data-label="Portföy değeri" className="amount-col">
                      {metrics.hasRecords ? investmentMoney(metrics.value, currency) : "—"}
                      {metrics.isEstimated ? <small className="investment-value-note">Tahmini değer</small> : null}
                    </td>
                    <td data-label="Net ana para" className="amount-col">{investmentMoney(metrics.netInvested, currency)}</td>
                    <td data-label="Net kazanç" className={`amount-col ${metrics.gain >= 0 ? "positive-value" : "negative-value"}`}>{metrics.hasRecords ? investmentMoney(metrics.gain, currency) : "—"}</td>
                    <td data-label={`${currency} XIRR`} className={`amount-col ${metrics.xirr !== null && metrics.xirr >= 0 ? "positive-value" : metrics.xirr !== null ? "negative-value" : ""}`}>{percentage(metrics.xirr)}</td>
                    <td data-label="Son değerleme">{metrics.snapshot ? formatSnapshotDate(metrics.snapshot.date) : metrics.hasRecords ? "Değerleme yok" : "Kayıt yok"}</td>
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

function formatSnapshotDate(date: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}
