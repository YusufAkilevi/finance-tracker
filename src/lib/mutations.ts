import { BUDGET_MONTH } from "../constants";
import type { AmountKey, BudgetPayment, CreditCard, FinanceState } from "../types";
import {
  budgetPaymentAmount,
  createDebt,
  createExpense,
  createPayment,
  fixedBudgetPayments,
  isFixedBudgetPayment,
} from "./finance";

export type ExpenseValues = {
  amount: number;
  category: string;
  creditCard: CreditCard | "";
  date: string;
  description: string;
  method: string;
};

export type DebtValues = {
  monthlyAmount: number;
  name: string;
  recurring: boolean;
  startMonth: string;
  totalInstallments: number;
};

export function saveExpenseState(
  current: FinanceState,
  editingExpenseId: string | null,
  values: ExpenseValues,
): FinanceState {
  if (editingExpenseId) {
    return {
      ...current,
      expenses: current.expenses.map((expense) =>
        expense.id === editingExpenseId ? { ...expense, ...values } : expense,
      ),
    };
  }

  return {
    ...current,
    expenses: [
      ...current.expenses,
      createExpense(
        values.date,
        values.description,
        values.category,
        values.amount,
        values.method,
        values.creditCard,
      ),
    ],
  };
}

export function deleteExpenseState(
  current: FinanceState,
  expenseId: string,
): FinanceState {
  return {
    ...current,
    expenses: current.expenses.filter((expense) => expense.id !== expenseId),
  };
}

export function saveDebtState(
  current: FinanceState,
  editingDebtId: string | null,
  values: DebtValues,
): FinanceState {
  if (editingDebtId) {
    return {
      ...current,
      debts: current.debts.map((debt) => {
        if (debt.id !== editingDebtId) return debt;
        const paidInstallments = values.recurring
          ? 0
          : Math.min(
              Number(debt.paidInstallments || 0),
              values.totalInstallments,
            );

        return {
          ...debt,
          ...values,
          paidInstallments,
          total: values.recurring
            ? 0
            : values.monthlyAmount * values.totalInstallments,
        };
      }),
    };
  }

  return {
    ...current,
    debts: [
      ...current.debts,
      createDebt(
        values.name,
        values.monthlyAmount,
        values.totalInstallments,
        0,
        values.startMonth,
        1,
        values.recurring,
      ),
    ],
  };
}

export function deleteDebtState(current: FinanceState, debtId: string) {
  return {
    ...current,
    debts: current.debts.filter((debt) => debt.id !== debtId),
  };
}

export function addBudgetState(
  current: FinanceState,
  name: string,
  currentAmount: number,
  nextAmount: number,
) {
  return {
    ...current,
    budgets: [
      ...current.budgets,
      createPayment(BUDGET_MONTH, name, currentAmount, nextAmount, false),
    ],
  };
}

export function deleteBudgetState(current: FinanceState, paymentId: string) {
  return {
    ...current,
    budgets: current.budgets.filter((budget) => budget.id !== paymentId),
  };
}

export function updateBudgetAmountState(
  current: FinanceState,
  paymentId: string,
  key: AmountKey,
  value: string,
) {
  return {
    ...current,
    budgets: current.budgets.map((payment) =>
      payment.id === paymentId
        ? { ...payment, [key]: Number(value || 0) }
        : payment,
    ),
  };
}

export function toggleBudgetPaidState(
  current: FinanceState,
  paymentId: string,
  paid: boolean,
) {
  return {
    ...current,
    budgets: current.budgets.map((payment) =>
      payment.id === paymentId ? { ...payment, paid } : payment,
    ),
  };
}

export function rolloverBudgetPaymentsState(current: FinanceState) {
  return {
    ...current,
    budgets: current.budgets.map((payment) => {
      if (!isFixedBudgetPayment(current, payment)) return payment;
      return {
        ...payment,
        currentAmount: budgetPaymentAmount(current, payment, "nextAmount"),
        nextAmount: 0,
        paid: false,
      };
    }),
  };
}

export function reorderBudgetPaymentState(
  current: FinanceState,
  draggedId: string,
  targetId: string,
) {
  if (!draggedId || !targetId || draggedId === targetId) return current;

  const payments = [...fixedBudgetPayments(current)];
  const fromIndex = payments.findIndex((payment) => payment.id === draggedId);
  const toIndex = payments.findIndex((payment) => payment.id === targetId);
  if (fromIndex < 0 || toIndex < 0) return current;

  const [movedPayment] = payments.splice(fromIndex, 1);
  payments.splice(toIndex, 0, movedPayment);

  let nextPaymentIndex = 0;
  return {
    ...current,
    budgets: current.budgets.map((payment) => {
      if (!isFixedBudgetPayment(current, payment)) return payment;
      return payments[nextPaymentIndex++] as BudgetPayment;
    }),
  };
}
