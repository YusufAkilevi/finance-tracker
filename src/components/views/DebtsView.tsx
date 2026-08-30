import { EmptyState } from "../EmptyState";
import {
  groupDebtSchedulesByPerson,
  scheduledDebtPayment,
} from "../../lib/finance";
import { shortMonth } from "../../lib/date";
import { money } from "../../lib/format";
import type { Debt, View } from "../../types";

type DebtsViewProps = {
  activeView: View;
  activeDebts: Debt[];
  scheduleMonths: string[];
  onAddDebt: () => void;
  onDeleteDebt: (debtId: string) => void;
  onEditDebt: (debtId: string) => void;
};

export function DebtsView({
  activeView,
  activeDebts,
  scheduleMonths,
  onAddDebt,
  onDeleteDebt,
  onEditDebt,
}: DebtsViewProps) {
  const personSchedules = groupDebtSchedulesByPerson(
    activeDebts,
    scheduleMonths,
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
        {personSchedules.length ? (
          personSchedules.map((schedule) => (
            <section
              className="panel installment-schedule-panel"
              key={schedule.person}
            >
              <div className="panel-heading">
                <div>
                  <h3>{schedule.person} Taksit Tablosu</h3>
                  <p className="panel-note">
                    Seçili aydan itibaren 12 aylık plan
                    <span className="mobile-scroll-hint">
                      Tüm aylar için yatay kaydırın
                    </span>
                  </p>
                </div>
              </div>
              <div className="table-wrap">
                <table
                  className="schedule-grid-table"
                  aria-label={`${schedule.person} için seçili aydan itibaren 12 aylık taksit planı`}
                >
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
                    {schedule.debts.map((debt) => (
                      <tr key={debt.id}>
                        <th>{debt.name}</th>
                        {scheduleMonths.map((month) => {
                          const payment = scheduledDebtPayment(debt, month);
                          return (
                            <td key={month} className="amount-col">
                              {payment > 0 ? (
                                <span className="installment-payment">
                                  <span>{money(payment)}</span>
                                  {debt.creditCard ? (
                                    <small>{debt.creditCard}</small>
                                  ) : null}
                                </span>
                              ) : (
                                ""
                              )}
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
                      {schedule.monthTotals.map((total, index) => (
                        <td key={scheduleMonths[index]} className="amount-col">
                          {money(total)}
                        </td>
                      ))}
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ))
        ) : (
          <section className="panel installment-schedule-panel">
            <EmptyState text="Henüz taksitli borç eklenmedi." />
          </section>
        )}
      </div>
    </section>
  );
}
