import { BarList } from "../BarList";
import { EmptyState } from "../EmptyState";
import { sortedTotals, sum } from "../../lib/finance";
import { formatDate, money } from "../../lib/format";
import type { Expense, ExpenseCardFilter, View } from "../../types";

type ExpensesViewProps = {
  activeView: View;
  categories: string[];
  expenses: Expense[];
  filteredExpenses: Expense[];
  selectedCreditCardFilter: ExpenseCardFilter;
  selectedExpenseFilter: string;
  onAddExpense: () => void;
  onDeleteExpense: (expenseId: string) => void;
  onEditExpense: (expenseId: string) => void;
  onCreditCardFilterChange: (creditCard: ExpenseCardFilter) => void;
  onFilterChange: (category: string) => void;
};

export function ExpensesView({
  activeView,
  categories,
  expenses,
  filteredExpenses,
  selectedCreditCardFilter,
  selectedExpenseFilter,
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
              <select
                aria-label="Harcamaları kategoriye göre filtrele"
                value={selectedExpenseFilter}
                onChange={(event) => onFilterChange(event.target.value)}
              >
                <option value="">Tüm harcama türleri</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
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
                      <td data-label="Açıklama">{expense.description}</td>
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
