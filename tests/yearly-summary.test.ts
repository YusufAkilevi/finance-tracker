import { describe, expect, it } from "vitest";
import * as finance from "../src/lib/finance";
import type { Expense, FinanceState } from "../src/types";

describe("yearly expense summary", () => {
  it("combines saved expenses with Ben's automatic installments", () => {
    const state: FinanceState = {
      selectedMonth: "2026-08",
      expenses: [
        {
          id: "saved-market",
          date: "2026-08-10",
          description: "Market",
          category: "Market",
          amount: 100,
          method: "Nakit",
          creditCard: "",
        },
      ],
      debts: [
        {
          id: "mine",
          name: "Telefon",
          person: "Ben",
          monthlyAmount: 50,
          total: 100,
          totalInstallments: 2,
          paidInstallments: 0,
          startMonth: "2026-08",
          dueDay: 5,
          creditCard: "Axess",
          recurring: false,
        },
        {
          id: "mother",
          name: "Tablet",
          person: "Anne",
          monthlyAmount: 70,
          total: 140,
          totalInstallments: 2,
          paidInstallments: 0,
          startMonth: "2026-08",
          dueDay: 5,
          creditCard: "Axess",
          recurring: false,
        },
      ],
      budgets: [],
      updatedAt: "2026-08-31T00:00:00.000Z",
    };
    const yearlyExpenses = (
      finance as typeof finance & {
        yearlyExpenses: (state: FinanceState) => Expense[];
      }
    ).yearlyExpenses;

    expect(yearlyExpenses).toBeTypeOf("function");
    const augustExpenses = yearlyExpenses(state).filter((expense) =>
      expense.date.startsWith("2026-08"),
    );

    expect(augustExpenses.map(({ description }) => description)).toEqual([
      "Market",
      "Telefon",
    ]);
    expect(finance.sum(augustExpenses, "amount")).toBe(150);
  });
});
