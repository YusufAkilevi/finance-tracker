import type { PointerEvent } from "react";
import { BudgetTable } from "../BudgetTable";
import { EmptyState } from "../EmptyState";
import type {
  AmountKey,
  BudgetPayment,
  FinanceState,
  View,
} from "../../types";

type BudgetsViewProps = {
  activeView: View;
  budgets: BudgetPayment[];
  draggingBudgetId: string | null;
  dropTargetBudgetId: string | null;
  state: FinanceState;
  onAddBudget: () => void;
  onAmountChange: (paymentId: string, key: AmountKey, value: string) => void;
  onDeleteBudget: (paymentId: string) => void;
  onDragStart: (event: PointerEvent<HTMLSpanElement>, id: string) => void;
  onRollover: () => void;
  onTogglePaid: (paymentId: string, paid: boolean) => void;
};

export function BudgetsView({
  activeView,
  budgets,
  draggingBudgetId,
  dropTargetBudgetId,
  state,
  onAddBudget,
  onAmountChange,
  onDeleteBudget,
  onDragStart,
  onRollover,
  onTogglePaid,
}: BudgetsViewProps) {
  return (
    <section
      id="budgetsView"
      className={`view ${activeView === "budgets" ? "active-view" : ""}`}
      aria-labelledby="viewTitle"
    >
      <div className="debt-page-actions">
        <button
          className="primary-action inline-action"
          type="button"
          onClick={onAddBudget}
        >
          Ödeme Ekle
        </button>
      </div>
      <div className="content-grid debt-content-grid">
        <section className="panel installment-schedule-panel">
          <div className="panel-heading">
            <div>
              <h3>Aylık Ödemeler</h3>
              <p className="panel-note">Bu ay ve gelecek ay ödeme planı</p>
            </div>
          </div>
          <div className="payment-plan">
            {budgets.length ? (
              <BudgetTable
                budgets={budgets}
                state={state}
                draggingBudgetId={draggingBudgetId}
                dropTargetBudgetId={dropTargetBudgetId}
                onAmountChange={onAmountChange}
                onDelete={onDeleteBudget}
                onDragStart={onDragStart}
                onRollover={onRollover}
                onTogglePaid={onTogglePaid}
              />
            ) : (
              <EmptyState text="Bu ay ve gelecek ay için ödeme ekleyin." />
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
