import { BUDGET_MONTH, CREDIT_CARD_BUDGET_NAMES } from "../constants";
import type {
  AmountKey,
  BudgetPayment,
  CreditCard,
  Debt,
  DebtDue,
  Expense,
  FinanceState,
} from "../types";
import { addMonths, monthDiff } from "./date";

export function createExpense(
  date: string,
  description: string,
  category: string,
  amount: number,
  method: string,
  creditCard: CreditCard | "" = "",
): Expense {
  return {
    id: newId(),
    date,
    description,
    category,
    amount,
    method,
    creditCard: normalizeCreditCard(creditCard),
  };
}

export function createDebt(
  name: string,
  monthlyAmount: number,
  totalInstallments: number,
  paidInstallments: number,
  startMonth: string,
  dueDay: number,
  creditCard: CreditCard | "" = "",
  recurring = false,
): Debt {
  return {
    id: newId(),
    name,
    monthlyAmount,
    total: recurring ? 0 : monthlyAmount * totalInstallments,
    totalInstallments,
    paidInstallments,
    startMonth,
    dueDay,
    creditCard: normalizeCreditCard(creditCard),
    recurring,
  };
}

export function createPayment(
  month: string,
  name: string,
  currentAmount: number,
  nextAmount: number,
  paid = false,
): BudgetPayment {
  return {
    id: newId(),
    month,
    name,
    currentAmount,
    nextAmount,
    paid,
  };
}

export function fixedBudgetPayments(state: FinanceState) {
  const fixedPayments = state.budgets.filter(
    (payment) => payment.month === BUDGET_MONTH,
  );
  if (fixedPayments.length > 0) return fixedPayments;
  return state.budgets.filter((payment) => !payment.month);
}

export function isFixedBudgetPayment(
  state: FinanceState,
  payment: BudgetPayment,
) {
  const hasFixedPayments = state.budgets.some(
    (budget) => budget.month === BUDGET_MONTH,
  );
  return hasFixedPayments ? payment.month === BUDGET_MONTH : !payment.month;
}

export function budgetPaymentAmount(
  state: FinanceState,
  payment: BudgetPayment,
  key: AmountKey,
) {
  if (key === "currentAmount") {
    return Math.max(
      paymentAmount(payment, key) - budgetCurrentAmountDeduction(state, payment),
      0,
    );
  }

  const budgetName = matchingCreditCardBudgetName(payment);
  if (!budgetName) return paymentAmount(payment, key);

  return nextCreditCardBudgetTotals(state)[budgetName] || 0;
}

export function budgetCurrentAmountDeduction(
  state: FinanceState,
  payment: BudgetPayment,
) {
  if (!isTherapyBudgetPayment(payment)) return 0;

  return monthlyExpenses(state, state.selectedMonth)
    .filter((expense) => isTherapyName(expense.category))
    .reduce((total, expense) => total + Number(expense.amount || 0), 0);
}

export function isTherapyBudgetPayment(payment: BudgetPayment) {
  return isTherapyName(payment.name || payment.category);
}

function isTherapyName(value: unknown) {
  return ["terapi", "therapy"].includes(normalizeBudgetName(value));
}

export function sumBudgetPaymentAmounts(
  state: FinanceState,
  payments: BudgetPayment[],
  key: AmountKey,
) {
  return payments.reduce(
    (total, payment) => total + budgetPaymentAmount(state, payment, key),
    0,
  );
}

export function isCreditCardBudgetPayment(payment: BudgetPayment) {
  return Boolean(matchingCreditCardBudgetName(payment));
}

export function matchingCreditCardBudgetName(payment: BudgetPayment) {
  const paymentName = normalizeBudgetName(payment.name || payment.category);
  return Object.values(CREDIT_CARD_BUDGET_NAMES).find(
    (budgetName) => normalizeBudgetName(budgetName) === paymentName,
  );
}

export function monthlyCreditCardBudgetTotals(
  state: FinanceState,
  month: string,
) {
  return creditCardBudgetTotals(monthlyExpenses(state, month));
}

export function nextCreditCardBudgetTotals(state: FinanceState) {
  const manuallyAddedThisMonth = state.expenses.filter((expense) =>
    expense.date.startsWith(state.selectedMonth),
  );
  const automaticNextMonthInstallments = monthlyExpenses(
    state,
    addMonths(state.selectedMonth, 1),
  ).filter((expense) => expense.sourceDebtId);

  return creditCardBudgetTotals([
    ...manuallyAddedThisMonth,
    ...automaticNextMonthInstallments,
  ]);
}

function creditCardBudgetTotals(expenses: Expense[]) {
  const totals = Object.values(CREDIT_CARD_BUDGET_NAMES).reduce<
    Record<string, number>
  >((acc, budgetName) => {
    acc[budgetName] = 0;
    return acc;
  }, {});

  expenses.forEach((expense) => {
    const budgetName = expense.creditCard
      ? CREDIT_CARD_BUDGET_NAMES[expense.creditCard]
      : undefined;
    if (budgetName) totals[budgetName] += Number(expense.amount || 0);
  });

  return totals;
}

export function expenseCategories(state: FinanceState) {
  return [
    ...new Set([
      "Market",
      "Ulaşım",
      "Dışarıda Yemek",
      "Faturalar",
      "Kira",
      "Taksit",
      "Alışveriş",
      "BES",
      "Sağlık",
      "Terapi",
      "Eğlence",
      "Diğer",
      ...state.expenses.map((expense) => expense.category),
    ]),
  ].sort();
}

export function monthlyExpenses(state: FinanceState, month: string) {
  const savedExpenses = state.expenses.filter((expense) =>
    expense.date.startsWith(month),
  );
  const generatedInstallments = state.debts
    .filter(
      (debt) => debt.creditCard && scheduledDebtPayment(debt, month) > 0,
    )
    .map((debt): Expense => ({
      id: `installment:${debt.id}:${month}`,
      date: installmentDate(month, debt.dueDay),
      description: debt.name,
      category: "Taksit",
      amount: scheduledDebtPayment(debt, month),
      method: "Kart",
      creditCard: normalizeCreditCard(debt.creditCard),
      sourceDebtId: debt.id,
    }));

  return [...savedExpenses, ...generatedInstallments];
}

function installmentDate(month: string, dueDay: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const day = Math.min(Math.max(Number(dueDay) || 1, 1), lastDay);
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function isFixedHousingOrInstallmentExpense(expense: Expense) {
  const searchableText =
    `${expense.category || ""} ${expense.description || ""}`.toLocaleLowerCase(
      "tr-TR",
    );
  return ["taksit", "kira", "rent", "aidat", "bes"].some((term) =>
    searchableText.includes(term),
  );
}

export function monthlyDebtDue(state: FinanceState, month: string): DebtDue[] {
  return state.debts
    .filter((debt) => scheduledDebtPayment(debt, month) > 0)
    .map((debt) => ({ ...debt, dueAmount: monthlyPayment(debt) }));
}

export function scheduledDebtPayment(debt: Debt, month: string) {
  const dueIndex = monthDiff(debt.startMonth, month);
  if (dueIndex < 0) return 0;
  if (isRecurringDebt(debt)) return monthlyPayment(debt);
  if (dueIndex >= debt.totalInstallments || dueIndex < debt.paidInstallments) {
    return 0;
  }
  return monthlyPayment(debt);
}

export function monthlyPayment(debt: Debt) {
  if (Number(debt.monthlyAmount) > 0) return Number(debt.monthlyAmount);
  return debt.totalInstallments ? debt.total / debt.totalInstallments : 0;
}

export function remainingDebt(debt: Debt) {
  if (isRecurringDebt(debt)) return 0;
  const total = Number(
    debt.total ?? monthlyPayment(debt) * debt.totalInstallments,
  );
  return Math.max(total - monthlyPayment(debt) * debt.paidInstallments, 0);
}

export function isRecurringDebt(debt: Debt) {
  return debt.recurring === true;
}

export function sortedTotals<T extends { amount: number }>(
  items: T[],
  key: keyof T,
): [string, number][] {
  return Object.entries(groupTotals(items, key)).sort((a, b) => b[1] - a[1]);
}

export function groupTotals<T extends { amount: number }>(
  items: T[],
  key: keyof T,
) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const groupKey = String(item[key] || "");
    acc[groupKey] = (acc[groupKey] || 0) + item.amount;
    return acc;
  }, {});
}

export function sum<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

export function paymentAmount(payment: BudgetPayment, key: AmountKey) {
  if (key === "currentAmount") {
    return Number(payment.currentAmount ?? payment.limit ?? 0);
  }
  return Number(payment.nextAmount ?? 0);
}

export function editableMoney(value: number) {
  return Number(value || 0).toFixed(2);
}

export function sumPayments(payments: BudgetPayment[], key: AmountKey) {
  return payments.reduce(
    (total, payment) => total + paymentAmount(payment, key),
    0,
  );
}

export function normalizeCategory(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^\w/, (letter) => letter.toLocaleUpperCase("tr-TR"));
}

export function normalizeCreditCard(value: unknown): CreditCard | "" {
  const card = String(value || "").trim();
  if (card === "Akbank") return "Axess";
  if (card in CREDIT_CARD_BUDGET_NAMES) return card as CreditCard;
  return "";
}

export function normalizeBudgetName(value: unknown) {
  return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

function newId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
