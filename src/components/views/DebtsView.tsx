import { EmptyState } from "../EmptyState";
import {
  monthlyDebtDue,
  scheduledDebtPayment,
  sum,
} from "../../lib/finance";
import { shortMonth } from "../../lib/date";
import { money } from "../../lib/format";
import type { Debt, FinanceState, View } from "../../types";

type DebtsViewProps = {
  activeView: View;
  activeDebts: Debt[];
  scheduleMonths: string[];
  state: FinanceState;
  onAddDebt: () => void;
  onDeleteDebt: (debtId: string) => void;
  onEditDebt: (debtId: string) => void;
};

export function DebtsView({
  activeView,
  activeDebts,
  scheduleMonths,
  state,
  onAddDebt,
  onDeleteDebt,
  onEditDebt,
}: DebtsViewProps) {
  const scheduleMonthTotals = scheduleMonths.map((month) =>
    sum(monthlyDebtDue(state, month), "dueAmount"),
  );

  return (
    <section
      id="debtsView"
      className={`view ${activeView === "debts" ? "active-view" : ""}`}
      aria-labelledby="viewTitle"
    >
      <div className="debt-page-actions">
        <button
          className="primary-action inline-action"
          type="button"
          onClick={onAddDebt}
        >
          Taksit Ekle
        </button>
      </div>
      <div className="content-grid debt-content-grid">
        <section className="panel installment-schedule-panel">
          <div className="panel-heading">
            <div>
              <h3>Genel Taksit Tablosu</h3>
              <p className="panel-note">Seçili aydan itibaren 12 aylık plan</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="schedule-grid-table">
              {activeDebts.length ? (
                <>
                  <thead>
                    <tr>
                      <th>Taksit</th>
                      {scheduleMonths.map((month) => (
                        <th key={month} className="amount-col">
                          {shortMonth(month)}
                        </th>
                      ))}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDebts.map((debt) => (
                      <tr key={debt.id}>
                        <th>{debt.name}</th>
                        {scheduleMonths.map((month) => {
                          const payment = scheduledDebtPayment(debt, month);
                          return (
                            <td key={month} className="amount-col">
                              {payment > 0 ? money(payment) : ""}
                            </td>
                          );
                        })}
                        <td>
                          <div className="row-actions">
                            <button
                              className="row-action"
                              type="button"
                              onClick={() => onEditDebt(debt.id)}
                            >
                              Düzenle
                            </button>
                            <button
                              className="row-action"
                              type="button"
                              onClick={() => onDeleteDebt(debt.id)}
                            >
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <th>Taksit Toplam</th>
                      {scheduleMonthTotals.map((total, index) => (
                        <td key={scheduleMonths[index]} className="amount-col">
                          {money(total)}
                        </td>
                      ))}
                      <td></td>
                    </tr>
                  </tfoot>
                </>
              ) : (
                <tbody>
                  <tr>
                    <td>
                      <EmptyState text="Henüz taksitli borç eklenmedi." />
                    </td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
