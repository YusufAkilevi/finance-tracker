import { PointerEvent, useEffect, useRef, useState } from "react";

type UseBudgetDragOptions = {
  onDrop: (draggedId: string, targetId: string) => void;
};

export function useBudgetDrag({ onDrop }: UseBudgetDragOptions) {
  const [draggingBudgetId, setDraggingBudgetId] = useState<string | null>(null);
  const [dropTargetBudgetId, setDropTargetBudgetId] = useState<string | null>(
    null,
  );
  const onDropRef = useRef(onDrop);

  onDropRef.current = onDrop;

  useEffect(() => {
    if (draggingBudgetId) {
      document.body.classList.add("is-budget-reordering");
    } else {
      document.body.classList.remove("is-budget-reordering");
    }

    return () => document.body.classList.remove("is-budget-reordering");
  }, [draggingBudgetId]);

  useEffect(() => {
    if (!draggingBudgetId) return;

    const onPointerMove = (event: globalThis.PointerEvent) => {
      const targetRow = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-budget-row]") as HTMLElement | null;
      const targetId = targetRow?.dataset.budgetRow || null;
      setDropTargetBudgetId(
        targetId && targetId !== draggingBudgetId ? targetId : null,
      );
    };

    const onPointerUp = (event: globalThis.PointerEvent) => {
      const targetRow = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-budget-row]") as HTMLElement | null;
      const targetId = targetRow?.dataset.budgetRow;
      if (targetId) onDropRef.current(draggingBudgetId, targetId);
      setDraggingBudgetId(null);
      setDropTargetBudgetId(null);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingBudgetId]);

  function startBudgetDrag(event: PointerEvent<HTMLSpanElement>, id: string) {
    event.preventDefault();
    setDraggingBudgetId(id);
  }

  return {
    draggingBudgetId,
    dropTargetBudgetId,
    startBudgetDrag,
  };
}
