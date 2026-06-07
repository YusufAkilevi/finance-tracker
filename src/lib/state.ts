import { BUDGET_MONTH } from "../constants";
import type { FinanceState } from "../types";
import { currentMonth, subtractMonths } from "./date";
import { createDebt, createExpense, createPayment } from "./finance";

export function defaultState(withDemoData = false): FinanceState {
  const selectedMonth = currentMonth();
  const demo = withDemoData
    ? buildDemoData(selectedMonth)
    : { expenses: [], debts: [], budgets: [] };
  return {
    selectedMonth,
    expenses: demo.expenses,
    debts: demo.debts,
    budgets: demo.budgets,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeState(value: unknown): FinanceState {
  const fallback = defaultState();
  if (!value || typeof value !== "object") return fallback;
  const source = value as Partial<FinanceState>;
  return {
    ...fallback,
    ...source,
    selectedMonth: source.selectedMonth || fallback.selectedMonth,
    expenses: Array.isArray(source.expenses) ? source.expenses : [],
    debts: Array.isArray(source.debts) ? source.debts : [],
    budgets: Array.isArray(source.budgets) ? source.budgets : [],
    updatedAt: source.updatedAt || fallback.updatedAt,
  };
}

export function isStateNewer(candidate: FinanceState, current: FinanceState) {
  return (
    Date.parse(candidate.updatedAt || "") > Date.parse(current.updatedAt || "")
  );
}

function buildDemoData(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = (day: number) =>
    `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    expenses: [
      createExpense(date(3), "Market alışverişi", "Market", 2850, "Kart", "Ziraat"),
      createExpense(date(5), "Metro kartı", "Ulaşım", 600, "Kart", "Axess"),
      createExpense(
        date(8),
        "Kahve ve yemek",
        "Dışarıda Yemek",
        920,
        "Kart",
        "Garanti",
      ),
      createExpense(date(12), "Ev interneti", "Faturalar", 520, "Havale/EFT"),
    ],
    debts: [
      createDebt("Beyaz eşya", 2000, 12, 4, subtractMonths(month, 4), 15, false),
      createDebt("Yatak", 4200, 10, 2, subtractMonths(month, 2), 22, false),
      createDebt("Bulut depolama", 249, 0, 0, subtractMonths(month, 1), 1, true),
    ],
    budgets: [
      createPayment(BUDGET_MONTH, "Kira", 53000, 53000, true),
      createPayment(BUDGET_MONTH, "Ziraat", 28777.26, 15359.06, true),
      createPayment(BUDGET_MONTH, "Kredi 1", 3625.89, 0, true),
      createPayment(BUDGET_MONTH, "Akbank", 30988.39, 28670, false),
      createPayment(BUDGET_MONTH, "Garanti", 40500, 10500, false),
      createPayment(BUDGET_MONTH, "Terapi", 8000, 8000, false),
    ],
  };
}
