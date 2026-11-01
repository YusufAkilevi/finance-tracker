import { describe, expect, it } from "vitest";
import { historicalExpenseAverage } from "../src/lib/finance";
import type { Expense, FinanceState } from "../src/types";

function expense(date: string, category: string, amount: number): Expense {
  return { id: date + category, date, category, amount, description: category, method: "Nakit", creditCard: "" };
}
const state = (expenses: Expense[]): FinanceState => ({
  selectedMonth: "2026-08", expenses, debts: [], budgets: [], investmentPortfolios: [], investmentSnapshots: [], investmentCashFlows: [], updatedAt: "",
});

describe("historical expense averages", () => {
  it("averages across completed months with data, using the same denominator for every category", () => {
    const data = state([expense("2026-01-01", "Market", 100), expense("2026-03-01", "Market", 200), expense("2026-03-02", "Ulaşım", 60), expense("2026-04-01", "Market", 900)]);
    expect(historicalExpenseAverage(data, "2026-04")).toEqual({ months: ["2026-01", "2026-03"], total: 180, categories: [["Market", 150], ["Ulaşım", 30]] });
    expect(historicalExpenseAverage(data, "2026-05").total).toBe(420);
    expect(historicalExpenseAverage(data, "2026-05").months).toHaveLength(3);
  });
  it("handles no completed months", () => {
    expect(historicalExpenseAverage(state([expense("2026-04-01", "Market", 100)]), "2026-04")).toEqual({ months: [], total: 0, categories: [] });
  });
});
