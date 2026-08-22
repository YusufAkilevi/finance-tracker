import type { PointerEvent } from "react";
import {
  budgetPaymentAmount,
  editableMoney,
  isCreditCardBudgetPayment,
  sumBudgetPaymentAmounts,
} from "../lib/finance";
import { budgetMoney } from "../lib/format";
import { addMonths, shortMonth } from "../lib/date";
import type { AmountKey, BudgetPayment, FinanceState } from "../types";

type BudgetTableProps = {
  budgets: BudgetPayment[];
  state: FinanceState;
  draggingBudgetId: string | null;
  dropTargetBudgetId: string | null;
  onAmountChange: (paymentId: string, key: AmountKey, value: string) => void;
  onDelete: (paymentId: string) => void;
  onDragStart: (event: PointerEvent<HTMLSpanElement>, id: string) => void;
  onMove: (paymentId: string, direction: -1 | 1) => void;
  onRollover: () => void;
  onTogglePaid: (paymentId: string, paid: boolean) => void;
};

export function BudgetTable({
  budgets,
  state,
  draggingBudgetId,
  dropTargetBudgetId,
  onAmountChange,
  onDelete,
  onDragStart,
  onMove,
  onRollover,
  onTogglePaid,
}: BudgetTableProps) {
  const currentTotal = sumBudgetPaymentAmounts(state, budgets, "currentAmount");
  const paidTotal = sumBudgetPaymentAmounts(
    state,
    budgets.filter((budget) => budget.paid),
    "currentAmount",
  );
  const remainingTotal = currentTotal - paidTotal;
  const nextTotal = sumBudgetPaymentAmounts(state, budgets, "nextAmount");
  const nextPaidTotal = 0;
  const nextRemainingTotal = nextTotal - nextPaidTotal;
  const currentMonthLabel = shortMonth(state.selectedMonth);
  const nextMonthLabel = shortMonth(addMonths(state.selectedMonth, 1));

  return (
    <div className="payment-table-wrap">
      <table className="payment-table budget-sheet">
        <thead>
          <tr>
            <th><span className="payment-column-label">Ödeme</span></th>
            <th className="amount-col">{currentMonthLabel}</th>
            <th>
              <button className="rollover-button" type="button" onClick={onRollover}>
                Ayı Aktar
              </button>
              <span>Durum</span>
            </th>
            <th className="amount-col">{nextMonthLabel}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((payment, index) => {
            const currentAmount = budgetPaymentAmount(
              state,
              payment,
              "currentAmount",
            );
            const nextAmount = budgetPaymentAmount(state, payment, "nextAmount");
            const nextAmountReadonly = isCreditCardBudgetPayment(payment);
            return (
              <tr
                key={payment.id}
                data-budget-row={payment.id}
                className={[
                  draggingBudgetId === payment.id ? "is-dragging" : "",
                  dropTargetBudgetId === payment.id ? "budget-drop-target" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <th>
                  <span className="budget-name-cell">
                    <span
                      className="drag-handle"
                      title="Sırayı değiştir"
                      aria-label="Sırayı değiştir"
                      onPointerDown={(event) => onDragStart(event, payment.id)}
                    ></span>
                    <span className="budget-payment-name">{payment.name || payment.category || "Ödeme"}</span>
                    <span className="budget-reorder-buttons desktop-budget-reorder">
                      <button type="button" aria-label={`${payment.name || "Ödeme"} yukarı taşı`} disabled={index === 0} onClick={() => onMove(payment.id, -1)}>↑</button>
                      <button type="button" aria-label={`${payment.name || "Ödeme"} aşağı taşı`} disabled={index === budgets.length - 1} onClick={() => onMove(payment.id, 1)}>↓</button>
                    </span>
                  </span>
                </th>
                <td data-label={currentMonthLabel} className="amount-col">
                  <span className="money-field">
                    <span aria-hidden="true">₺</span>
                    <input
                      key={`${payment.id}-${currentAmount}`}
                      className="amount-input"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={editableMoney(currentAmount)}
                      onBlur={(event) =>
                        onAmountChange(payment.id, "currentAmount", event.target.value)
                      }
                    />
                  </span>
                </td>
                <td data-label="Durum">
                  <label className="paid-toggle">
                    <input
                      type="checkbox"
                      checked={payment.paid}
                      onChange={(event) => onTogglePaid(payment.id, event.target.checked)}
                    />
                    <span>{payment.paid ? "Ödendi" : "Bekliyor"}</span>
                  </label>
                </td>
                <td data-label={nextMonthLabel} className="amount-col">
                  <span className="money-field">
                    <span aria-hidden="true">₺</span>
                    <input
                      className={`amount-input ${nextAmountReadonly ? "read-only-input" : ""}`}
                      type="number"
                      min="0"
                      step="0.01"
                      readOnly={nextAmountReadonly}
                      aria-readonly={nextAmountReadonly}
                      title={
                        nextAmountReadonly
                          ? "Harcama kart seçimlerinden otomatik hesaplanır"
                          : undefined
                      }
                      value={editableMoney(nextAmount)}
                      onChange={(event) => {
                        if (!nextAmountReadonly) {
                          onAmountChange(payment.id, "nextAmount", event.target.value);
                        }
                      }}
                    />
                  </span>
                </td>
                <td className="budget-row-actions-cell">
                  <span className="mobile-budget-reorder">
                    <button type="button" aria-label={`${payment.name || "Ödeme"} yukarı taşı`} disabled={index === 0} onClick={() => onMove(payment.id, -1)}>↑</button>
                    <button type="button" aria-label={`${payment.name || "Ödeme"} aşağı taşı`} disabled={index === budgets.length - 1} onClick={() => onMove(payment.id, 1)}>↓</button>
                  </span>
                  <button className="row-action" type="button" onClick={() => onDelete(payment.id)}>Sil</button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <th>Aylık toplam</th>
            <td className="amount-col" data-label={currentMonthLabel}>{budgetMoney(currentTotal)}</td>
            <td></td>
            <td className="amount-col" data-label={nextMonthLabel}>{budgetMoney(nextTotal)}</td>
            <td></td>
          </tr>
          <tr className="remaining-row">
            <th>Kalan Borç</th>
            <td className="amount-col" data-label={currentMonthLabel}>
              {budgetMoney(remainingTotal)}
            </td>
            <td></td>
            <td className="amount-col" data-label={nextMonthLabel}>
              {budgetMoney(nextRemainingTotal)}
            </td>
            <td></td>
          </tr>
          <tr className="paid-row">
            <th>Ödenen Borç</th>
            <td className="amount-col" data-label={currentMonthLabel}>
              {budgetMoney(paidTotal)}
            </td>
            <td></td>
            <td className="amount-col" data-label={nextMonthLabel}>
              {budgetMoney(nextPaidTotal)}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
