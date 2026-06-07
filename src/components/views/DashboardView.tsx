import { BarList } from "../BarList";
import { YearlySummary } from "../YearlySummary";
import { sortedTotals } from "../../lib/finance";
import { money } from "../../lib/format";
import type { Expense, View } from "../../types";

type DashboardViewProps = {
  activeView: View;
  allExpenses: Expense[];
  debtLeft: number;
  expenses: Expense[];
  flexibleExpenses: Expense[];
  flexibleSpent: number;
  remaining: number;
  totalBudgeted: number;
  totalDebtDue: number;
  totalSpent: number;
};

export function DashboardView({
  activeView,
  allExpenses,
  debtLeft,
  expenses,
  flexibleExpenses,
  flexibleSpent,
  remaining,
  totalBudgeted,
  totalDebtDue,
  totalSpent,
}: DashboardViewProps) {
  return (
    <section
      id="dashboardView"
      className={`view ${activeView === "dashboard" ? "active-view" : ""}`}
      aria-labelledby="viewTitle"
    >
      <div className="summary-grid">
        <article className="metric metric-spent">
          <span>Toplam Harcama</span>
          <strong>{money(totalSpent)}</strong>
          <small>{expenses.length} harcama</small>
        </article>
        <article className="metric metric-flexible-spent">
          <span>Taksit/Kira/Aidat/BES Dışı</span>
          <strong>{money(flexibleSpent)}</strong>
          <small>{flexibleExpenses.length} harcama</small>
        </article>
        <article className="metric metric-remaining">
          <span>Kalan Ödeme</span>
          <strong>{money(remaining)}</strong>
          <small>{money(totalBudgeted)} toplam ödeme</small>
        </article>
        <article className="metric metric-debt-due">
          <span>Ödenecek Taksitler</span>
          <strong>{money(totalDebtDue)}</strong>
          <small>Toplam {money(debtLeft)} planlanan borç</small>
        </article>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <h3>Kategoriye Göre Harcamalar</h3>
          </div>
          <BarList
            entries={sortedTotals(expenses, "category")}
            emptyText="Bu ay henüz harcama yok."
          />
        </section>
        <section className="panel" id="yearlySummaryPanel">
          <div className="panel-heading">
            <h3>Toplam Harcama (Yıllık Özet)</h3>
          </div>
          <YearlySummary expenses={allExpenses} />
        </section>
      </div>
    </section>
  );
}
