import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { VIEW_TITLES } from "./constants";
import { NavButton } from "./components/Nav";
import { BudgetModal, DebtModal, ExpenseModal } from "./components/Modals";
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
  sumPayments,
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
  const totalBudgeted = sumPayments(budgets, "currentAmount");
  const totalDebtDue = sum(debtDue, "dueAmount");
  const remaining = sumPayments(
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

    closeExpenseModal();
  }

  function deleteExpense(expenseId: string) {
    updateState((current) => deleteExpenseState(current, expenseId));
  }

  function addDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const recurring = new FormData(form).get("recurring") === "on";
    const totalInstallments = recurring
      ? 0
      : Number(formValue(form, "totalInstallments"));
    const values = {
      name: formValue(form, "name").trim(),
      monthlyAmount: Number(formValue(form, "monthlyAmount")),
      totalInstallments,
      startMonth: formValue(form, "startMonth"),
      recurring,
    };

    updateState((current) => saveDebtState(current, editingDebtId, values));

    closeDebtModal();
  }

  function deleteDebt(debtId: string) {
    updateState((current) => deleteDebtState(current, debtId));
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
    closeBudgetModal();
  }

  function deleteBudget(paymentId: string) {
    updateState((current) => deleteBudgetState(current, paymentId));
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
  }

  function reorderBudgetPayment(draggedId: string, targetId: string) {
    updateState((current) =>
      reorderBudgetPaymentState(current, draggedId, targetId),
    );
  }

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar" aria-label="Application navigation">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              FT
            </span>
            <div>
              <p className="eyebrow">Kişisel Finans</p>
              <h1>Finans Takipçisi</h1>
            </div>
          </div>

          <nav className="nav-tabs" aria-label="Primary">
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
              label="Genel Taksit"
              active={view === "debts"}
              onClick={() => setView("debts")}
            />
            <NavButton
              icon="budgets"
              label="Bütçe"
              active={view === "budgets"}
              onClick={() => setView("budgets")}
            />
          </nav>

          <div className="sidebar-card">
            <label htmlFor="monthPicker">Ay</label>
            <input
              id="monthPicker"
              type="month"
              value={state.selectedMonth}
              onChange={(event) => handleMonthChange(event.target.value)}
            />
          </div>

          <div className="sync-panel">
            <div>
              <span>Sync</span>
              <strong>{syncStatus}</strong>
            </div>
            {isFirebaseSyncConfigured() ? (
              <button
                type="button"
                onClick={() => void pullRemoteState({ manual: true })}
              >
                Sync now
              </button>
            ) : null}
          </div>
        </aside>

        <main className="main-content">
          <section className="page-header">
            <div>
              <p className="eyebrow">{longMonth(state.selectedMonth)}</p>
              <h2>{VIEW_TITLES[view]}</h2>
            </div>
          </section>

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
    </>
  );
}

export default App;
