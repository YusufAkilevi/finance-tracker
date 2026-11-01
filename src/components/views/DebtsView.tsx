import { EmptyState } from "../EmptyState";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  groupDebtSchedulesByPerson,
  scheduledDebtPayment,
} from "../../lib/finance";
import { shortMonth } from "../../lib/date";
import { money } from "../../lib/format";
import type { Debt, View } from "../../types";

type DebtsViewProps = {
  activeView: View;
  activeDebts: Debt[];
  scheduleMonths: string[];
  onAddDebt: () => void;
  onDeleteDebt: (debtId: string) => void;
  onEditDebt: (debtId: string) => void;
  onReorderDebt: (draggedId: string, targetId: string) => void;
};

export function DebtsView({
  activeView,
  activeDebts,
  scheduleMonths,
  onAddDebt,
  onDeleteDebt,
  onEditDebt,
  onReorderDebt,
}: DebtsViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const reorderRef = useRef(onReorderDebt);
  reorderRef.current = onReorderDebt;
  useEffect(() => {
    if (!draggedId) return;
    const findTarget = (event: globalThis.PointerEvent) => {
      const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-debt-row]");
      const source = [...document.querySelectorAll<HTMLElement>("[data-debt-row]")].find((item) => item.dataset.debtRow === draggedId);
      return row && source && row.closest(".installment-schedule-panel") === source.closest(".installment-schedule-panel")
        ? row.dataset.debtRow || null : null;
    };
    const move = (event: globalThis.PointerEvent) => setTargetId(findTarget(event));
    const finish = (event: globalThis.PointerEvent) => {
      const target = findTarget(event);
      if (target) reorderRef.current(draggedId, target);
      setDraggedId(null);
      setTargetId(null);
    };
    const cancel = () => { setDraggedId(null); setTargetId(null); };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", cancel);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", cancel);
    };
  }, [draggedId]);
  const personSchedules = groupDebtSchedulesByPerson(
    activeDebts,
    scheduleMonths,
  );

  return (
    <section
      id="debtsView"
      className={`view ${activeView === "debts" ? "active-view" : ""}`}
      aria-labelledby="viewTitle"
    >
      <div className="debt-page-actions">
        <button
          className="primary-action inline-action"
          type="button"
          onClick={onAddDebt}
        >
          Taksit Ekle
        </button>
      </div>
      <div className="content-grid debt-content-grid">
        {personSchedules.length ? (
          personSchedules.map((schedule) => (
            <section
              className="panel installment-schedule-panel"
              key={schedule.person}
            >
              <div className="panel-heading">
                <div>
                  <h3>{schedule.person} Taksit Tablosu</h3>
                  <p className="panel-note">
                    Seçili aydan itibaren 12 aylık plan
                  </p>
                </div>
              </div>
              <ScheduleScrollArea person={schedule.person}>
                <table
                  className="schedule-grid-table"
                  aria-label={`${schedule.person} için seçili aydan itibaren 12 aylık taksit planı`}
                >
                  <thead>
                    <tr>
                      <th>Taksit</th>
                      {scheduleMonths.map((month) => (
                        <th key={month} className="amount-col">
                          {shortMonth(month)}
                        </th>
                      ))}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.debts.map((debt, index) => (
                      <tr key={debt.id} data-debt-row={debt.id} className={`${draggedId === debt.id ? "is-dragging" : ""} ${targetId === debt.id && targetId !== draggedId ? "debt-drop-target" : ""}`}>
                        <th><span className="debt-name-cell">
                          <span className="drag-handle" aria-hidden="true" title="Sırayı değiştirmek için sürükle" onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); setDraggedId(debt.id); }} />
                          <span>{debt.name}</span>
                          <span className="budget-reorder-buttons debt-reorder-buttons">
                            <button type="button" aria-label={`${debt.name} yukarı taşı`} disabled={index === 0} onClick={() => onReorderDebt(debt.id, schedule.debts[index - 1].id)}>↑</button>
                            <button type="button" aria-label={`${debt.name} aşağı taşı`} disabled={index === schedule.debts.length - 1} onClick={() => onReorderDebt(debt.id, schedule.debts[index + 1].id)}>↓</button>
                          </span>
                        </span></th>
                        {scheduleMonths.map((month) => {
                          const payment = scheduledDebtPayment(debt, month);
                          return (
                            <td key={month} className="amount-col">
                              {payment > 0 ? (
                                <span className="installment-payment">
                                  <span>{money(payment)}</span>
                                  {debt.creditCard ? (
                                    <small>{debt.creditCard}</small>
                                  ) : null}
                                </span>
                              ) : (
                                ""
                              )}
                            </td>
                          );
                        })}
                        <td>
                          <div className="row-actions">
                            <button
                              className="row-action"
                              type="button"
                              onClick={() => onEditDebt(debt.id)}
                            >
                              Düzenle
                            </button>
                            <button
                              className="row-action"
                              type="button"
                              onClick={() => onDeleteDebt(debt.id)}
                            >
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <th>Taksit Toplam</th>
                      {schedule.monthTotals.map((total, index) => (
                        <td key={scheduleMonths[index]} className="amount-col">
                          {money(total)}
                        </td>
                      ))}
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </ScheduleScrollArea>
            </section>
          ))
        ) : (
          <section className="panel installment-schedule-panel">
            <EmptyState text="Bu dönem için devam eden taksit bulunmuyor." />
          </section>
        )}
      </div>
    </section>
  );
}

function ScheduleScrollArea({ person, children }: { person: string; children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => {
      setMaxScroll(Math.max(0, element.scrollWidth - element.clientWidth));
      setPosition(element.scrollLeft);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    update();
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="table-wrap" ref={scrollRef} role="region" aria-label={`${person} taksit tablosu`} tabIndex={0} onScroll={(event) => setPosition(event.currentTarget.scrollLeft)}>
        {children}
      </div>
      {maxScroll > 0 ? (
        <input
          className="schedule-scrollbar"
          type="range"
          min={0}
          max={maxScroll}
          value={Math.min(position, maxScroll)}
          aria-label={`${person} taksit tablosunu yatay kaydır`}
          onChange={(event) => {
            if (scrollRef.current) scrollRef.current.scrollLeft = Number(event.currentTarget.value);
          }}
        />
      ) : null}
    </>
  );
}
