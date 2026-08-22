import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { VIEW_TITLES } from "./constants";
import { NavButton } from "./components/Nav";
import {
  BudgetModal,
  ConfirmDialog,
  DebtModal,
  ExpenseModal,
} from "./components/Modals";
import { BudgetsView } from "./components/views/BudgetsView";
import { DashboardView } from "./components/views/DashboardView";
import { DebtsView } from "./components/views/DebtsView";
import { ExpensesView } from "./components/views/ExpensesView";
import { buildMonthRange, currentMonth, longMonth } from "./lib/date";
import { formValue } from "./lib/form";
import {
  expenseCategories,
  fixedBudgetPayments,
  isFixedHousingOrInstallmentExpense,
  isRecurringDebt,
  monthlyDebtDue,
  monthlyExpenses,
  normalizeCategory,
  normalizeCreditCard,
  remainingDebt,
  sum,
  sumBudgetPaymentAmounts,
} from "./lib/finance";
import {
  addBudgetState,
  deleteBudgetState,
  deleteDebtState,
  deleteExpenseState,
  reorderBudgetPaymentState,
  rolloverBudgetPaymentsState,
  saveDebtState,
  saveExpenseState,
  toggleBudgetPaidState,
  updateBudgetAmountState,
} from "./lib/mutations";
import { defaultState } from "./lib/state";
import { useBudgetDrag } from "./hooks/useBudgetDrag";
import { useRemoteSync } from "./hooks/useRemoteSync";
import type { AmountKey, FinanceState, View } from "./types";

function App() {
  const [state, setState] = useState<FinanceState>(() => defaultState());
  const [view, setView] = useState<View>("dashboard");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [debtRecurring, setDebtRecurring] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const stateRef = useRef(state);

  stateRef.current = state;

  const { draggingBudgetId, dropTargetBudgetId, startBudgetDrag } =
    useBudgetDrag({ onDrop: reorderBudgetPayment });
  const {
    isFirebaseSyncConfigured,
    pullRemoteState,
    queueRemoteSave,
    syncStatus,
  } = useRemoteSync({ setState, stateRef });

  const expenses = useMemo(
    () => monthlyExpenses(state, state.selectedMonth),
    [state],
  );
  const budgets = useMemo(() => fixedBudgetPayments(state), [state]);
  const debtDue = useMemo(
    () => monthlyDebtDue(state, state.selectedMonth),
    [state],
  );
  const categories = useMemo(() => expenseCategories(state), [state]);
  const activeDebts = useMemo(
    () =>
      state.debts.filter(
        (debt) => isRecurringDebt(debt) || remainingDebt(debt) > 0,
      ),
    [state.debts],
  );
  const scheduleMonths = useMemo(() => buildMonthRange(currentMonth(), 12), []);
  const selectedExpenseFilter = categories.includes(expenseSearch)
    ? expenseSearch
    : "";
  const filteredExpenses = expenses
    .filter(
      (expense) =>
        !selectedExpenseFilter || expense.category === selectedExpenseFilter,
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalSpent = sum(expenses, "amount");
  const flexibleExpenses = expenses.filter(
    (expense) => !isFixedHousingOrInstallmentExpense(expense),
  );
  const flexibleSpent = sum(flexibleExpenses, "amount");
  const totalBudgeted = sumBudgetPaymentAmounts(
    state,
    budgets,
    "currentAmount",
  );
  const totalDebtDue = sum(debtDue, "dueAmount");
  const remaining = sumBudgetPaymentAmounts(
    state,
    budgets.filter((budget) => !budget.paid),
    "currentAmount",
  );
  const debtLeft = state.debts.reduce((total, debt) => {
    return isRecurringDebt(debt) ? total : total + remainingDebt(debt);
  }, 0);

  const editingExpense = editingExpenseId
    ? state.expenses.find((expense) => expense.id === editingExpenseId)
    : null;
  const editingDebt = editingDebtId
    ? state.debts.find((debt) => debt.id === editingDebtId)
    : null;

  useEffect(() => {
    document.body.dataset.view = view;
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeExpenseModal();
      closeDebtModal();
      closeBudgetModal();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function commitState(nextState: FinanceState, options = { sync: true }) {
    const updatedState = {
      ...nextState,
      updatedAt: new Date().toISOString(),
    };
    stateRef.current = updatedState;
    setState(updatedState);
    if (options.sync) queueRemoteSave(updatedState);
  }

  function updateState(updater: (current: FinanceState) => FinanceState) {
    commitState(updater(stateRef.current));
  }

  function openExpenseModal() {
    setEditingExpenseId(null);
    setExpenseModalOpen(true);
  }

  function openExpenseEditModal(expenseId: string) {
    setEditingExpenseId(expenseId);
    setExpenseModalOpen(true);
  }

  function closeExpenseModal() {
    setEditingExpenseId(null);
    setExpenseModalOpen(false);
  }

  function openDebtModal() {
    setEditingDebtId(null);
    setDebtRecurring(false);
    setDebtModalOpen(true);
  }

  function openDebtEditModal(debtId: string) {
    const debt = stateRef.current.debts.find((item) => item.id === debtId);
    setEditingDebtId(debtId);
    setDebtRecurring(debt ? isRecurringDebt(debt) : false);
    setDebtModalOpen(true);
  }

  function closeDebtModal() {
    setEditingDebtId(null);
    setDebtRecurring(false);
    setDebtModalOpen(false);
  }

  function openBudgetModal() {
    setBudgetModalOpen(true);
  }

  function closeBudgetModal() {
    setBudgetModalOpen(false);
  }

  function handleMonthChange(value: string) {
    updateState((current) => ({
      ...current,
      selectedMonth: value || currentMonth(),
    }));
  }

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const category = normalizeCategory(formValue(form, "category"));
    const creditCard = normalizeCreditCard(formValue(form, "creditCard"));
    const values = {
      date: formValue(form, "date"),
      description: category,
      category,
      amount: Number(formValue(form, "amount")),
      creditCard,
      method: creditCard ? "Kart" : "-",
    };

    updateState((current) =>
      saveExpenseState(current, editingExpenseId, values),
    );

    setToast(editingExpenseId ? "Harcama güncellendi." : "Harcama eklendi.");
    closeExpenseModal();
  }

  function deleteExpense(expenseId: string) {
    const expense = stateRef.current.expenses.find((item) => item.id === expenseId);
    setConfirmation({
      title: "Harcamayı sil?",
      description: `${expense?.category || "Bu harcama"} kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmLabel: "Harcamayı sil",
      onConfirm: () => {
        updateState((current) => deleteExpenseState(current, expenseId));
        setConfirmation(null);
        setToast("Harcama silindi.");
      },
    });
  }

  function addDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const recurring = new FormData(form).get("recurring") === "on";
    const totalInstallments = recurring
      ? 0
      : Number(formValue(form, "totalInstallments"));
    const values = {
      creditCard: normalizeCreditCard(formValue(form, "creditCard")),
      dueDay: Number(formValue(form, "dueDay")),
      name: formValue(form, "name").trim(),
      monthlyAmount: Number(formValue(form, "monthlyAmount")),
      totalInstallments,
      startMonth: formValue(form, "startMonth"),
      recurring,
    };

    updateState((current) => saveDebtState(current, editingDebtId, values));

    setToast(editingDebtId ? "Taksit güncellendi." : "Taksit eklendi.");
    closeDebtModal();
  }

  function deleteDebt(debtId: string) {
    const debt = stateRef.current.debts.find((item) => item.id === debtId);
    setConfirmation({
      title: "Taksidi sil?",
      description: `${debt?.name || "Bu taksit"} ve otomatik oluşturduğu gelecek kayıtlar kalıcı olarak silinecek.`,
      confirmLabel: "Taksidi sil",
      onConfirm: () => {
        updateState((current) => deleteDebtState(current, debtId));
        setConfirmation(null);
        setToast("Taksit silindi.");
      },
    });
  }

  function addBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    updateState((current) =>
      addBudgetState(
        current,
        formValue(form, "name").trim(),
        Number(formValue(form, "currentAmount")),
        Number(formValue(form, "nextAmount")),
      ),
    );
    setToast("Ödeme plana eklendi.");
    closeBudgetModal();
  }

  function deleteBudget(paymentId: string) {
    const payment = stateRef.current.budgets.find((item) => item.id === paymentId);
    setConfirmation({
      title: "Ödemeyi sil?",
      description: `${payment?.name || payment?.category || "Bu ödeme"} ödeme planından kalıcı olarak kaldırılacak.`,
      confirmLabel: "Ödemeyi sil",
      onConfirm: () => {
        updateState((current) => deleteBudgetState(current, paymentId));
        setConfirmation(null);
        setToast("Ödeme plandan silindi.");
      },
    });
  }

  function updateBudgetAmount(paymentId: string, key: AmountKey, value: string) {
    updateState((current) =>
      updateBudgetAmountState(current, paymentId, key, value),
    );
  }

  function toggleBudgetPaid(paymentId: string, paid: boolean) {
    updateState((current) => toggleBudgetPaidState(current, paymentId, paid));
  }

  function rolloverBudgetPayments() {
    updateState(rolloverBudgetPaymentsState);
    setToast("Gelecek ay tutarları bu aya aktarıldı.");
  }

  function reorderBudgetPayment(draggedId: string, targetId: string) {
    updateState((current) =>
      reorderBudgetPaymentState(current, draggedId, targetId),
    );
  }

  function moveBudgetPayment(paymentId: string, direction: -1 | 1) {
    const index = budgets.findIndex((payment) => payment.id === paymentId);
    const target = budgets[index + direction];
    if (!target) return;
    reorderBudgetPayment(paymentId, target.id);
  }

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar" aria-label="Uygulama gezinmesi">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <span>₺</span>
            </span>
            <div>
              <p className="eyebrow">Aylık defter</p>
              <h1>Finans Takip</h1>
            </div>
          </div>

          <nav className="nav-tabs" aria-label="Ana gezinme">
            <NavButton
              icon="dashboard"
              label="Özet"
              active={view === "dashboard"}
              onClick={() => setView("dashboard")}
            />
            <NavButton
              icon="expenses"
              label="Harcamalar"
              active={view === "expenses"}
              onClick={() => setView("expenses")}
            />
            <NavButton
              icon="debts"
              label="Taksitler"
              active={view === "debts"}
              onClick={() => setView("debts")}
            />
            <NavButton
              icon="budgets"
              label="Ödeme Planı"
              active={view === "budgets"}
              onClick={() => setView("budgets")}
            />
          </nav>

          <div className="sidebar-card">
            <label htmlFor="monthPicker">Çalışma ayı</label>
            <input
              id="monthPicker"
              type="month"
              value={state.selectedMonth}
              onChange={(event) => handleMonthChange(event.target.value)}
            />
          </div>

          <div className="sync-panel">
            <div>
              <span>Eşitleme</span>
              <strong>{syncStatusLabel(syncStatus)}</strong>
            </div>
            {isFirebaseSyncConfigured() ? (
              <button
                type="button"
                onClick={() => void pullRemoteState({ manual: true })}
              >
                Şimdi eşitle
              </button>
            ) : null}
          </div>
        </aside>

        <main className="main-content">
          <header className="page-header">
            <div>
              <p className="eyebrow">Kişisel finans görünümü</p>
              <h2 id="viewTitle">{VIEW_TITLES[view]}</h2>
            </div>
            <div className="month-folio" aria-label={`Seçili ay: ${longMonth(state.selectedMonth)}`}>
              <span>Çalışma ayı</span>
              <strong>{longMonth(state.selectedMonth)}</strong>
            </div>
          </header>

          <DashboardView
            activeView={view}
            allExpenses={state.expenses}
            debtLeft={debtLeft}
            expenses={expenses}
            flexibleExpenses={flexibleExpenses}
            flexibleSpent={flexibleSpent}
            remaining={remaining}
            totalBudgeted={totalBudgeted}
            totalDebtDue={totalDebtDue}
            totalSpent={totalSpent}
          />

          <ExpensesView
            activeView={view}
            categories={categories}
            expenses={expenses}
            filteredExpenses={filteredExpenses}
            selectedExpenseFilter={selectedExpenseFilter}
            onAddExpense={openExpenseModal}
            onDeleteExpense={deleteExpense}
            onEditExpense={openExpenseEditModal}
            onFilterChange={setExpenseSearch}
          />

          <DebtsView
            activeView={view}
            activeDebts={activeDebts}
            scheduleMonths={scheduleMonths}
            state={state}
            onAddDebt={openDebtModal}
            onDeleteDebt={deleteDebt}
            onEditDebt={openDebtEditModal}
          />

          <BudgetsView
            activeView={view}
            budgets={budgets}
            draggingBudgetId={draggingBudgetId}
            dropTargetBudgetId={dropTargetBudgetId}
            state={state}
            onAddBudget={openBudgetModal}
            onAmountChange={updateBudgetAmount}
            onDeleteBudget={deleteBudget}
            onDragStart={startBudgetDrag}
            onMoveBudget={moveBudgetPayment}
            onRollover={rolloverBudgetPayments}
            onTogglePaid={toggleBudgetPaid}
          />
        </main>
      </div>

      {expenseModalOpen ? (
        <ExpenseModal
          categories={categories}
          expense={editingExpense || null}
          onClose={closeExpenseModal}
          onSubmit={addExpense}
        />
      ) : null}

      {debtModalOpen ? (
        <DebtModal
          debt={editingDebt || null}
          recurring={debtRecurring}
          selectedMonth={state.selectedMonth}
          onClose={closeDebtModal}
          onRecurringChange={setDebtRecurring}
          onSubmit={addDebt}
        />
      ) : null}

      {budgetModalOpen ? (
        <BudgetModal onClose={closeBudgetModal} onSubmit={addBudget} />
      ) : null}

      {confirmation ? (
        <ConfirmDialog
          title={confirmation.title}
          description={confirmation.description}
          confirmLabel={confirmation.confirmLabel}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmation.onConfirm}
        />
      ) : null}

      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast ? <div className="toast"><span aria-hidden="true">✓</span>{toast}</div> : null}
      </div>
    </>
  );
}

export default App;

function syncStatusLabel(status: string) {
  const labels: Record<string, string> = {
    "Local only": "Yalnızca yerel",
    Syncing: "Eşitleniyor…",
    Checking: "Kontrol ediliyor…",
    Saving: "Kaydediliyor…",
    Synced: "Güncel",
    "Sync error": "Eşitleme hatası",
  };
  return labels[status] || status;
}
