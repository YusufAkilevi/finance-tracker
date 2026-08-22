import { ALL_MONTH_NUMBERS } from "../constants";
import { money } from "../lib/format";
import type { Expense } from "../types";
import { EmptyState } from "./EmptyState";

type YearlySummaryProps = {
  expenses: Expense[];
};

export function YearlySummary({ expenses }: YearlySummaryProps) {
  if (!expenses.length) {
    return (
      <div className="table-wrap">
        <table className="yearly-summary-table">
          <tbody>
            <tr>
              <td>
                <EmptyState text="Henüz harcama yok." />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const history: Record<string, Record<string, number>> = {};
  const yearsSet = new Set<string>();
  expenses.forEach((expense) => {
    const [year, month] = expense.date.split("-");
    yearsSet.add(year);
    history[year] ||= {};
    history[year][month] = (history[year][month] || 0) + expense.amount;
  });
  // Keep the latest year closest to the month labels. On narrow screens the
  // table intentionally shows that first year and hides older comparison years.
  const years = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));

  return (
    <div className="table-wrap">
      <table className="yearly-summary-table">
        <thead>
          <tr>
            <th>Ay</th>
            {years.map((year) => (
              <th key={year} className="amount-col">
                {year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_MONTH_NUMBERS.map((month) => {
            const monthName = new Intl.DateTimeFormat("tr-TR", {
              month: "long",
            }).format(new Date(`2000-${month}-01T00:00:00`));

            return (
              <tr key={month}>
                <th>{monthName.toLocaleUpperCase("tr-TR")}</th>
                {years.map((year) => {
                  const value = history[year]?.[month] || 0;
                  return (
                    <td key={year} className="amount-col">
                      {value > 0 ? money(value) : "-"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
