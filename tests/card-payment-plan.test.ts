import { describe, expect, it } from "vitest";
import {
  nextCreditCardBudgetTotals,
} from "../src/lib/finance";
import type { CreditCard, Debt, Expense, FinanceState } from "../src/types";

describe("next-month credit-card payment plan", () => {
  it.each([
    ["Axess", "Akbank", 100, 50],
    ["Ziraat", "Ziraat", 200, 60],
    ["Garanti", "Garanti", 300, 70],
  ] as const)(
    "uses all selected-month %s expenses for the %s payment",
    (creditCard, budgetName, manualAmount, installmentAmount) => {
      const expense: Expense = {
        id: `expense-${creditCard}`,
        date: "2026-08-10",
        description: `${creditCard} harcaması`,
        category: "Alışveriş",
        amount: manualAmount,
        method: "Kredi Kartı",
        creditCard,
      };
      const debt: Debt = {
        id: `debt-${creditCard}`,
        name: `${creditCard} taksidi`,
        person: "Ben",
        monthlyAmount: installmentAmount,
        total: installmentAmount,
        totalInstallments: 1,
        paidInstallments: 0,
        startMonth: "2026-08",
        dueDay: 5,
        creditCard: creditCard as CreditCard,
        recurring: false,
      };
      const state: FinanceState = {
        selectedMonth: "2026-08",
        expenses: [expense],
        debts: [debt],
        budgets: [],
        updatedAt: "2026-08-31T00:00:00.000Z",
      };

      expect(nextCreditCardBudgetTotals(state)[budgetName]).toBe(
        manualAmount + installmentAmount,
      );
    },
  );
});
