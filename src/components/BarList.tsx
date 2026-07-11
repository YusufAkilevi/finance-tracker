import { money } from "../lib/format";
import { EmptyState } from "./EmptyState";

type BarListProps = {
  entries: [string, number][];
  emptyText: string;
};

export function BarList({ entries, emptyText }: BarListProps) {
  const max = Math.max(...entries.map((entry) => entry[1]), 1);
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);

  if (!entries.length) {
    return (
      <div className="bar-list">
        <EmptyState text={emptyText} />
      </div>
    );
  }

  return (
    <div className="bar-list">
      {entries.map(([category, amount]) => {
        const width = Math.max((amount / max) * 100, 4);
        const percentage = total > 0 ? (amount / total) * 100 : 0;
        return (
          <div className="bar-row" key={category}>
            <div className="bar-meta">
              <strong>{category}</strong>
              <span>
                {money(amount)} · %{percentage.toLocaleString("tr-TR", {
                  maximumFractionDigits: 1,
                })}
              </span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${width}%` }}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
