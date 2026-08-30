import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExpensesView } from "../src/components/views/ExpensesView";
import * as finance from "../src/lib/finance";
import type { Expense } from "../src/types";

const expenses: Expense[] = [
  {
    id: "axess-market",
    date: "2026-08-10",
    description: "Market alışverişi",
    category: "Market",
    amount: 800,
    method: "Kredi Kartı",
    creditCard: "Axess",
  },
  {
    id: "ziraat-market",
    date: "2026-08-11",
    description: "Haftalık market",
    category: "Market",
    amount: 600,
    method: "Kredi Kartı",
    creditCard: "Ziraat",
  },
  {
    id: "cash-transport",
    date: "2026-08-12",
    description: "Taksi",
    category: "Ulaşım",
    amount: 250,
    method: "Nakit",
    creditCard: "",
  },
];

describe("expense filters", () => {
  it("requires both the selected category and credit card to match", () => {
    const filterExpenses = (
      finance as typeof finance & {
        filterExpenses: (
          expenses: Expense[],
          category: string,
          creditCard: string,
        ) => Expense[];
      }
    ).filterExpenses;

    expect(filterExpenses).toBeTypeOf("function");
    expect(filterExpenses(expenses, "Market", "Axess").map(({ id }) => id)).toEqual([
      "axess-market",
    ]);
  });

  it("shows expenses without a credit card in the cardless filter", () => {
    const filterExpenses = finance.filterExpenses;

    expect(filterExpenses(expenses, "", "cardless").map(({ id }) => id)).toEqual([
      "cash-transport",
    ]);
  });

  it("offers a separate credit-card filter beside the category filter", () => {
    const markup = renderToStaticMarkup(
      createElement(ExpensesView, {
        activeView: "expenses",
        categories: ["Market", "Ulaşım"],
        expenses,
        filteredExpenses: expenses,
        selectedCreditCardFilter: "",
        selectedExpenseFilter: "",
        onAddExpense: () => undefined,
        onDeleteExpense: () => undefined,
        onEditExpense: () => undefined,
        onCreditCardFilterChange: () => undefined,
        onFilterChange: () => undefined,
      }),
    );

    expect(markup).toContain(
      'aria-label="Harcamaları kredi kartına göre filtrele"',
    );
    expect(markup).toContain("Tüm kartlar");
    expect(markup).toContain("Kartsız");
  });

  it("totals only the expenses that match the active filters", () => {
    const markup = renderToStaticMarkup(
      createElement(ExpensesView, {
        activeView: "expenses",
        categories: ["Market", "Ulaşım"],
        expenses,
        filteredExpenses: [expenses[0]],
        selectedCreditCardFilter: "Axess",
        selectedExpenseFilter: "Market",
        onAddExpense: () => undefined,
        onDeleteExpense: () => undefined,
        onEditExpense: () => undefined,
        onCreditCardFilterChange: () => undefined,
        onFilterChange: () => undefined,
      }),
    );

    expect(markup).toMatch(
      /<div class="expense-filter-total"[^>]*>.*Filtrelenen Toplam.*₺800.*<\/div>/,
    );
  });
});
