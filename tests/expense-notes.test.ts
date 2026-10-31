import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExpenseModal } from "../src/components/Modals";
import { ExpensesView } from "../src/components/views/ExpensesView";
import { expenseNote } from "../src/lib/finance";
import type { Expense } from "../src/types";

const withNote: Expense = {
  id: "gift",
  date: "2026-10-12",
  description: "Ayşe'nin doğum günü hediyesi",
  category: "Diğer",
  amount: 450,
  method: "-",
  creditCard: "",
};

const withoutNote: Expense = {
  ...withNote,
  id: "market",
  description: "Market",
  category: "Market",
};

describe("expense notes", () => {
  it("treats a description equal to the category as no note", () => {
    expect(expenseNote(withNote)).toBe("Ayşe'nin doğum günü hediyesi");
    expect(expenseNote(withoutNote)).toBe("");
  });

  it("offers an optional note field prefilled with the existing note", () => {
    const markup = renderToStaticMarkup(
      createElement(ExpenseModal, {
        categories: ["Diğer", "Market"],
        expense: withNote,
        onClose: () => undefined,
        onSubmit: () => undefined,
      }),
    );

    const input = markup.match(/<input[^>]*name="description"[^>]*>/)?.[0];
    expect(input).toBeDefined();
    expect(input).not.toContain("required");
    expect(input).toContain('value="Ayşe&#x27;nin doğum günü hediyesi"');
  });

  it("shows the note in the table and a dash when there is none", () => {
    const markup = renderToStaticMarkup(
      createElement(ExpensesView, {
        activeView: "expenses",
        categories: ["Diğer", "Market"],
        expenses: [withNote, withoutNote],
        filteredExpenses: [withNote, withoutNote],
        selectedCreditCardFilter: "",
        selectedExpenseFilters: [],
        onAddExpense: () => undefined,
        onDeleteExpense: () => undefined,
        onEditExpense: () => undefined,
        onCreditCardFilterChange: () => undefined,
        onFilterChange: () => undefined,
      }),
    );

    expect(markup).toContain(
      '<td data-label="Açıklama" class="expense-note">Ayşe&#x27;nin doğum günü hediyesi</td>',
    );
    expect(markup).toContain(
      '<td data-label="Açıklama" class="expense-note is-empty">-</td>',
    );
  });
});
