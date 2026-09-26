import { BUDGET_MONTH } from "../constants";
import type {
  AmountKey,
  BudgetPayment,
  CreditCard,
  FinanceState,
  InvestmentCurrency,
  InvestmentRateSource,
} from "../types";
import {
  budgetCurrentAmountDeduction,
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
  creditCard: CreditCard | "";
  dueDay: number;
  monthlyAmount: number;
  name: string;
  person: string;
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
        values.dueDay,
        values.creditCard,
        values.recurring,
        values.person,
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
  const payment = current.budgets.find((item) => item.id === paymentId);
  const enteredAmount = Number(value || 0);
  const storedAmount =
    key === "currentAmount" && payment
      ? enteredAmount + budgetCurrentAmountDeduction(current, payment)
      : enteredAmount;

  if (
    payment &&
    budgetPaymentAmount(current, payment, key) === enteredAmount
  ) {
    return current;
  }

  return {
    ...current,
    budgets: current.budgets.map((payment) =>
      payment.id === paymentId
        ? { ...payment, [key]: storedAmount }
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

export type InvestmentPortfolioValues = {
  name: string;
  purpose: string;
  currency: InvestmentCurrency;
  description: string;
};

export function saveInvestmentPortfolioState(
  current: FinanceState,
  editingPortfolioId: string | null,
  values: InvestmentPortfolioValues,
): FinanceState {
  if (editingPortfolioId) {
    const hasHistory = current.investmentSnapshots.some(
      (snapshot) => snapshot.portfolioId === editingPortfolioId,
    ) || current.investmentCashFlows.some(
      (flow) => flow.portfolioId === editingPortfolioId,
    );
    return {
      ...current,
      investmentPortfolios: current.investmentPortfolios.map((portfolio) =>
        portfolio.id === editingPortfolioId
          ? { ...portfolio, ...values, currency: hasHistory ? portfolio.currency : values.currency }
          : portfolio,
      ),
    };
  }
  return {
    ...current,
    investmentPortfolios: [
      ...current.investmentPortfolios,
      {
        id: investmentId(),
        ...values,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export function setInvestmentPortfolioArchivedState(
  current: FinanceState,
  portfolioId: string,
  archived: boolean,
): FinanceState {
  return {
    ...current,
    investmentPortfolios: current.investmentPortfolios.map((portfolio) =>
      portfolio.id === portfolioId
        ? {
            ...portfolio,
            archivedAt: archived ? new Date().toISOString() : undefined,
          }
        : portfolio,
    ),
  };
}

export type InvestmentMonthlyRecordValues = {
  portfolioId: string;
  date: string;
  totalValue: number;
  contributed: number;
  withdrawn: number;
  usdTryRate: number;
  rateDate: string;
  rateSource: InvestmentRateSource;
  note: string;
};

export function saveInvestmentMonthlyRecordState(
  current: FinanceState,
  editingSnapshotId: string | null,
  values: InvestmentMonthlyRecordValues,
): FinanceState {
  const portfolio = current.investmentPortfolios.find(
    (item) => item.id === values.portfolioId,
  );
  if (!portfolio) return current;
  const sameMonthSnapshots = current.investmentSnapshots.filter(
    (item) =>
      item.portfolioId === values.portfolioId &&
      item.date.slice(0, 7) === values.date.slice(0, 7),
  );
  const snapshotId = editingSnapshotId || sameMonthSnapshots[0]?.id || investmentId();
  const replacedIds = new Set([
    ...sameMonthSnapshots.map((item) => item.id),
    ...(editingSnapshotId ? [editingSnapshotId] : []),
  ]);

  const snapshot = {
    id: snapshotId,
    portfolioId: values.portfolioId,
    date: values.date,
    totalValue: values.totalValue,
    usdTryRate: values.usdTryRate,
    rateDate: values.rateDate,
    rateSource: values.rateSource,
    note: values.note || undefined,
  };
  const investmentSnapshots = [
    ...current.investmentSnapshots.filter((item) => !replacedIds.has(item.id)),
    snapshot,
  ];
  const retainedFlows = current.investmentCashFlows.filter(
    (flow) => !flow.snapshotId || !replacedIds.has(flow.snapshotId),
  );
  const linkedFlows = [
    values.contributed > 0
      ? {
          id: investmentId(),
          portfolioId: portfolio.id,
          date: values.date,
          type: "contribution" as const,
          amount: values.contributed,
          currency: portfolio.currency,
          usdTryRate: values.usdTryRate,
          rateDate: values.rateDate,
          rateSource: values.rateSource,
          snapshotId,
          note: values.note || undefined,
        }
      : null,
    values.withdrawn > 0
      ? {
          id: investmentId(),
          portfolioId: portfolio.id,
          date: values.date,
          type: "withdrawal" as const,
          amount: values.withdrawn,
          currency: portfolio.currency,
          usdTryRate: values.usdTryRate,
          rateDate: values.rateDate,
          rateSource: values.rateSource,
          snapshotId,
          note: values.note || undefined,
        }
      : null,
  ].filter((flow) => flow !== null);

  return {
    ...current,
    investmentSnapshots,
    investmentCashFlows: [...retainedFlows, ...linkedFlows],
  };
}

export function deleteInvestmentSnapshotState(
  current: FinanceState,
  snapshotId: string,
): FinanceState {
  return {
    ...current,
    investmentSnapshots: current.investmentSnapshots.filter(
      (snapshot) => snapshot.id !== snapshotId,
    ),
    investmentCashFlows: current.investmentCashFlows.filter(
      (flow) => flow.snapshotId !== snapshotId,
    ),
  };
}

export type InvestmentFlowValues = {
  type: "contribution" | "withdrawal" | "transfer";
  portfolioId: string;
  destinationPortfolioId?: string;
  date: string;
  amount: number;
  destinationAmount?: number;
  usdTryRate: number;
  rateDate: string;
  rateSource: InvestmentRateSource;
  note: string;
};

export function saveInvestmentFlowState(
  current: FinanceState,
  editingFlowId: string | null,
  values: InvestmentFlowValues,
): FinanceState {
  const source = current.investmentPortfolios.find(
    (portfolio) => portfolio.id === values.portfolioId,
  );
  if (!source) return current;
  const editingFlow = editingFlowId
    ? current.investmentCashFlows.find((flow) => flow.id === editingFlowId)
    : undefined;
  const retainedFlows = current.investmentCashFlows.filter((flow) => {
    if (editingFlow?.transferGroupId) {
      return flow.transferGroupId !== editingFlow.transferGroupId;
    }
    return flow.id !== editingFlowId;
  });

  if (values.type !== "transfer") {
    return {
      ...current,
      investmentCashFlows: [
        ...retainedFlows,
        {
          id: editingFlowId || investmentId(),
          portfolioId: source.id,
          date: values.date,
          type: values.type,
          amount: values.amount,
          currency: source.currency,
          usdTryRate: values.usdTryRate,
          rateDate: values.rateDate,
          rateSource: values.rateSource,
          note: values.note || undefined,
        },
      ],
    };
  }

  const destination = current.investmentPortfolios.find(
    (portfolio) => portfolio.id === values.destinationPortfolioId,
  );
  if (!destination || destination.id === source.id) return current;
  const transferGroupId = editingFlow?.transferGroupId || investmentId();
  return {
    ...current,
    investmentCashFlows: [
      ...retainedFlows,
      {
        id: investmentId(),
        portfolioId: source.id,
        date: values.date,
        type: "transfer-out",
        amount: values.amount,
        currency: source.currency,
        usdTryRate: values.usdTryRate,
        rateDate: values.rateDate,
        rateSource: values.rateSource,
        transferGroupId,
        counterpartyPortfolioId: destination.id,
        note: values.note || undefined,
      },
      {
        id: investmentId(),
        portfolioId: destination.id,
        date: values.date,
        type: "transfer-in",
        amount: Number(values.destinationAmount || values.amount),
        currency: destination.currency,
        usdTryRate: values.usdTryRate,
        rateDate: values.rateDate,
        rateSource: values.rateSource,
        transferGroupId,
        counterpartyPortfolioId: source.id,
        note: values.note || undefined,
      },
    ],
  };
}

export function deleteInvestmentCashFlowState(
  current: FinanceState,
  flowId: string,
): FinanceState {
  const flow = current.investmentCashFlows.find((item) => item.id === flowId);
  return {
    ...current,
    investmentCashFlows: current.investmentCashFlows.filter((item) =>
      flow?.transferGroupId
        ? item.transferGroupId !== flow.transferGroupId
        : item.id !== flowId,
    ),
  };
}

function investmentId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
