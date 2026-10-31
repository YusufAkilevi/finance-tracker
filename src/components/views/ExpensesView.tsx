import { useEffect, useRef, useState } from "react";
import { BarList } from "../BarList";
import { EmptyState } from "../EmptyState";
import { expenseNote, sortedTotals, sum } from "../../lib/finance";
import { formatDate, money } from "../../lib/format";
import type { Expense, ExpenseCardFilter, View } from "../../types";

type ExpensesViewProps = {
  activeView: View;
  categories: string[];
  expenses: Expense[];
  filteredExpenses: Expense[];
  selectedCreditCardFilter: ExpenseCardFilter;
  selectedExpenseFilters: string[];
  onAddExpense: () => void;
  onDeleteExpense: (expenseId: string) => void;
  onEditExpense: (expenseId: string) => void;
  onCreditCardFilterChange: (creditCard: ExpenseCardFilter) => void;
  onFilterChange: (categories: string[]) => void;
};

type CategoryMultiSelectProps = {
  categories: string[];
  selected: string[];
  onChange: (categories: string[]) => void;
};

function categoryFilterLabel(selected: string[]) {
  if (!selected.length) return "Tüm harcama türleri";
  if (selected.length === 1) return selected[0];
  return `${selected.length} tür seçili`;
}

function CategoryMultiSelect({
  categories,
  selected,
  onChange,
}: CategoryMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const toggle = (category: string) =>
    onChange(
      selected.includes(category)
        ? selected.filter((item) => item !== category)
        : [...selected, category],
    );

  return (
    <div className="multi-select" ref={rootRef}>
      <button
        className="multi-select-trigger"
        type="button"
        aria-label="Harcamaları kategoriye göre filtrele"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{categoryFilterLabel(selected)}</span>
      </button>
      {open && (
        <div className="multi-select-menu" role="group" aria-label="Harcama türleri">
          {categories.map((category) => (
            <label key={category} className="multi-select-option">
              <input
                type="checkbox"
                checked={selected.includes(category)}
                onChange={() => toggle(category)}
              />
              <span>{category}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button
              className="multi-select-clear"
              type="button"
              onClick={() => onChange([])}
            >
              Seçimi temizle
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ExpensesView({
  activeView,
  categories,
  expenses,
  filteredExpenses,
  selectedCreditCardFilter,
  selectedExpenseFilters,
  onAddExpense,
  onDeleteExpense,
  onEditExpense,
  onCreditCardFilterChange,
  onFilterChange,
}: ExpensesViewProps) {
  return (
    <section
      id="expensesView"
      className={`view ${activeView === "expenses" ? "active-view" : ""}`}
      aria-labelledby="viewTitle"
    >
      <div className="debt-page-actions">
        <button
          className="primary-action inline-action"
          type="button"
          onClick={onAddExpense}
        >
          Harcama Ekle
        </button>
      </div>
      <div className="dashboard-grid expenses-summary-grid">
        <section className="panel">
          <div className="panel-heading">
            <h3>Kategori Özeti</h3>
          </div>
          <BarList
            entries={sortedTotals(expenses, "category")}
            emptyText="Bu ay henüz harcama yok."
          />
        </section>
      </div>
      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading split-heading">
            <h3>Aylık Harcamalar</h3>
            <div className="expense-filter-controls">
              <CategoryMultiSelect
                categories={categories}
                selected={selectedExpenseFilters}
                onChange={onFilterChange}
              />
              <select
                aria-label="Harcamaları kredi kartına göre filtrele"
                value={selectedCreditCardFilter}
                onChange={(event) =>
                  onCreditCardFilterChange(
                    event.target.value as ExpenseCardFilter,
                  )
                }
              >
                <option value="">Tüm kartlar</option>
                <option value="Ziraat">Ziraat</option>
                <option value="Axess">Axess</option>
                <option value="Garanti">Garanti</option>
                <option value="cardless">Kartsız</option>
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Açıklama</th>
                  <th>Kategori</th>
                  <th>Kart</th>
                  <th className="amount-col">Tutar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length ? (
                  filteredExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td data-label="Tarih">{formatDate(expense.date)}</td>
                      <td
                        data-label="Açıklama"
                        className={expenseNote(expense) ? "expense-note" : "expense-note is-empty"}
                      >
                        {expenseNote(expense) || "-"}
                      </td>
                      <td data-label="Kategori">{expense.category}</td>
                      <td data-label="Kart">
                        {expense.creditCard || expense.method || "-"}
                      </td>
                      <td data-label="Tutar" className="amount-col">
                        {money(expense.amount)}
                      </td>
                      <td>
                        {expense.sourceDebtId ? (
                          <span className="generated-expense-label">Otomatik</span>
                        ) : (
                          <div className="row-actions">
                            <button
                              className="row-action"
                              type="button"
                              onClick={() => onEditExpense(expense.id)}
                            >
                              Düzenle
                            </button>
                            <button
                              className="row-action"
                              type="button"
                              onClick={() => onDeleteExpense(expense.id)}
                            >
                              Sil
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState text="Eşleşen harcama bulunamadı." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div
            className="expense-filter-total"
            role="status"
            aria-live="polite"
          >
            <span>Filtrelenen Toplam</span>
            <strong>{money(sum(filteredExpenses, "amount"))}</strong>
          </div>
        </section>
      </div>
    </section>
  );
}
