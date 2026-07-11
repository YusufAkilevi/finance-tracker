import type { PointerEvent } from "react";
import {
  budgetPaymentAmount,
  editableMoney,
  isCreditCardBudgetPayment,
  sumBudgetPaymentAmounts,
} from "../lib/finance";
import { budgetMoney } from "../lib/format";
import type { AmountKey, BudgetPayment, FinanceState } from "../types";

type BudgetTableProps = {
  budgets: BudgetPayment[];
  state: FinanceState;
  draggingBudgetId: string | null;
  dropTargetBudgetId: string | null;
  onAmountChange: (paymentId: string, key: AmountKey, value: string) => void;
  onDelete: (paymentId: string) => void;
  onDragStart: (event: PointerEvent<HTMLSpanElement>, id: string) => void;
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

  return (
    <div className="payment-table-wrap">
      <table className="payment-table budget-sheet">
        <thead>
          <tr>
            <th></th>
            <th className="amount-col">Bu ay</th>
            <th>
              <button className="rollover-button" type="button" onClick={onRollover}>
                Ayı Aktar
              </button>
              <span>Durum</span>
            </th>
            <th className="amount-col">Gelecek ay</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((payment) => {
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
                    <span>{payment.name || payment.category || "Ödeme"}</span>
                  </span>
                </th>
                <td data-label="Bu ay" className="amount-col">
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
                <td data-label="Gelecek ay" className="amount-col">
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
                <td>
                  <button className="row-action" type="button" onClick={() => onDelete(payment.id)}>
                    Sil
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <th>Bu Ay Toplam Borç</th>
            <td className="amount-col">{budgetMoney(currentTotal)}</td>
            <td></td>
            <td className="amount-col">{budgetMoney(nextTotal)}</td>
            <td></td>
          </tr>
          <tr className="remaining-row">
            <th>Kalan Borç</th>
            <td className="amount-col">{budgetMoney(remainingTotal)}</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr className="paid-row">
            <th>Ödenen Borç</th>
            <td className="amount-col">{budgetMoney(paidTotal)}</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
