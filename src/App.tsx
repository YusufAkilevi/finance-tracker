import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { VIEW_TITLES } from "./constants";
import { NavButton } from "./components/Nav";
import {
  BudgetModal,
  ConfirmDialog,
  DebtModal,
  ExpenseModal,
} from "./components/Modals";
import {
  InvestmentFlowModal,
  InvestmentHistoryModal,
  InvestmentMonthlyRecordModal,
  InvestmentPortfolioManagerModal,
} from "./components/InvestmentModals";
import { BudgetsView } from "./components/views/BudgetsView";
import { DashboardView } from "./components/views/DashboardView";
import { DebtsView } from "./components/views/DebtsView";
import { ExpensesView } from "./components/views/ExpensesView";
import { InvestmentsView } from "./components/views/InvestmentsView";
import { buildMonthRange, currentMonth, longMonth } from "./lib/date";
import { formValue } from "./lib/form";
import {
  expenseCategories,
  filterExpenses,
  fixedBudgetPayments,
  isFixedHousingOrInstallmentExpense,
  isRecurringDebt,
  monthlyDebtDue,
  monthlyExpenses,
  normalizeCategory,
  normalizeCreditCard,
  normalizeDebtPerson,
  remainingDebt,
  sum,
  sumBudgetPaymentAmounts,
  yearlyExpenses,
} from "./lib/finance";
import {
  addBudgetState,
  deleteInvestmentCashFlowState,
  deleteInvestmentSnapshotState,
  deleteBudgetState,
  deleteDebtState,
  deleteExpenseState,
  reorderBudgetPaymentState,
  rolloverBudgetPaymentsState,
  saveDebtState,
  saveExpenseState,
  saveInvestmentFlowState,
  saveInvestmentMonthlyRecordState,
  saveInvestmentPortfolioState,
  setInvestmentPortfolioArchivedState,
  toggleBudgetPaidState,
  updateBudgetAmountState,
} from "./lib/mutations";
import { defaultState } from "./lib/state";
import { useBudgetDrag } from "./hooks/useBudgetDrag";
import { useRemoteSync } from "./hooks/useRemoteSync";
import type {
  AmountKey,
  ExpenseCardFilter,
  FinanceState,
  InvestmentCashFlow,
  InvestmentCurrency,
  InvestmentPortfolio,
  InvestmentSnapshot,
  InvestmentRateSource,
  View,
} from "./types";

function App() {
  const [state, setState] = useState<FinanceState>(() => defaultState());
  const [view, setView] = useState<View>("dashboard");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCardFilter, setExpenseCardFilter] =
    useState<ExpenseCardFilter>("");
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [investmentRecordModalOpen, setInvestmentRecordModalOpen] = useState(false);
  const [investmentManagerOpen, setInvestmentManagerOpen] = useState(false);
  const [investmentCurrency, setInvestmentCurrency] = useState<InvestmentCurrency>("USD");
  const [investmentHistoryPortfolioId, setInvestmentHistoryPortfolioId] = useState<string | null>(null);
  const [editingInvestmentSnapshotId, setEditingInvestmentSnapshotId] = useState<string | null>(null);
  const [investmentFlowModalOpen, setInvestmentFlowModalOpen] = useState(false);
  const [editingInvestmentFlowId, setEditingInvestmentFlowId] = useState<string | null>(null);
  const [investmentFlowPortfolioId, setInvestmentFlowPortfolioId] = useState<string | null>(null);
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
  const yearExpenses = useMemo(() => yearlyExpenses(state), [state]);
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
  const filteredExpenses = filterExpenses(
    expenses,
    selectedExpenseFilter,
    expenseCardFilter,
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
    document.title = `${VIEW_TITLES[view]} | Finans Takip`;
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
      closeInvestmentRecordModal();
      setInvestmentManagerOpen(false);
      setInvestmentHistoryPortfolioId(null);
      closeInvestmentFlowModal();
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

  function openInvestmentRecordModal() {
    setEditingInvestmentSnapshotId(null);
    setInvestmentRecordModalOpen(true);
  }

  function editInvestmentRecord(snapshot: InvestmentSnapshot) {
    setInvestmentHistoryPortfolioId(null);
    setEditingInvestmentSnapshotId(snapshot.id);
    setInvestmentRecordModalOpen(true);
  }

  function closeInvestmentRecordModal() {
    setEditingInvestmentSnapshotId(null);
    setInvestmentRecordModalOpen(false);
  }

  function openInvestmentHistory(portfolio: InvestmentPortfolio) {
    setInvestmentHistoryPortfolioId(portfolio.id);
  }

  function openInvestmentFlowModal(flow: InvestmentCashFlow | null = null) {
    const canonicalFlow = flow?.type === "transfer-in" && flow.transferGroupId
      ? stateRef.current.investmentCashFlows.find(
          (item) => item.transferGroupId === flow.transferGroupId && item.type === "transfer-out",
        ) || flow
      : flow;
    setEditingInvestmentFlowId(canonicalFlow?.id || null);
    setInvestmentFlowPortfolioId(
      canonicalFlow?.portfolioId || investmentHistoryPortfolioId,
    );
    setInvestmentHistoryPortfolioId(null);
    setInvestmentFlowModalOpen(true);
  }

  function closeInvestmentFlowModal() {
    setEditingInvestmentFlowId(null);
    setInvestmentFlowPortfolioId(null);
    setInvestmentFlowModalOpen(false);
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
      person: normalizeDebtPerson(formValue(form, "person")),
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

  function saveInvestmentRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = {
      portfolioId: formValue(form, "portfolioId"),
      date: formValue(form, "date"),
      totalValue: Number(formValue(form, "totalValue")),
      contributed: Number(formValue(form, "contributed") || 0),
      withdrawn: Number(formValue(form, "withdrawn") || 0),
      usdTryRate: Number(formValue(form, "usdTryRate")),
      rateDate: formValue(form, "rateDate"),
      rateSource: formValue(form, "rateSource") as InvestmentRateSource,
      note: formValue(form, "note").trim(),
    };
    updateState((current) =>
      saveInvestmentMonthlyRecordState(
        current,
        editingInvestmentSnapshotId,
        values,
      ),
    );
    setToast(editingInvestmentSnapshotId ? "Aylık yatırım kaydı güncellendi." : "Aylık yatırım kaydı eklendi.");
    closeInvestmentRecordModal();
  }

  function saveInvestmentPortfolio(
    event: FormEvent<HTMLFormElement>,
    editingId: string | null,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    updateState((current) =>
      saveInvestmentPortfolioState(current, editingId, {
        name: formValue(form, "name").trim(),
        purpose: formValue(form, "purpose").trim(),
        currency: formValue(form, "currency") as InvestmentCurrency,
        description: formValue(form, "description").trim(),
      }),
    );
    form.reset();
    setToast(editingId ? "Portföy güncellendi." : "Portföy oluşturuldu.");
  }

  function setInvestmentPortfolioArchived(portfolioId: string, archived: boolean) {
    updateState((current) =>
      setInvestmentPortfolioArchivedState(current, portfolioId, archived),
    );
    setToast(archived ? "Portföy arşivlendi." : "Portföy yeniden etkinleştirildi.");
  }

  function saveInvestmentFlow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    updateState((current) =>
      saveInvestmentFlowState(current, editingInvestmentFlowId, {
        type: formValue(form, "type") as "contribution" | "withdrawal" | "transfer",
        portfolioId: formValue(form, "portfolioId"),
        destinationPortfolioId: formValue(form, "destinationPortfolioId") || undefined,
        date: formValue(form, "date"),
        amount: Number(formValue(form, "amount")),
        destinationAmount: Number(formValue(form, "destinationAmount") || 0),
        usdTryRate: Number(formValue(form, "usdTryRate")),
        rateDate: formValue(form, "rateDate"),
        rateSource: formValue(form, "rateSource") as InvestmentRateSource,
        note: formValue(form, "note").trim(),
      }),
    );
    setToast(editingInvestmentFlowId ? "Yatırım hareketi güncellendi." : "Yatırım hareketi eklendi.");
    closeInvestmentFlowModal();
  }

  function deleteInvestmentSnapshot(snapshot: InvestmentSnapshot) {
    setConfirmation({
      title: "Aylık yatırım kaydını sil?",
      description: `${snapshot.date} tarihli değerleme ve bu kayda bağlı para hareketleri kalıcı olarak silinecek.`,
      confirmLabel: "Kaydı sil",
      onConfirm: () => {
        updateState((current) => deleteInvestmentSnapshotState(current, snapshot.id));
        setConfirmation(null);
        setToast("Aylık yatırım kaydı silindi.");
      },
    });
  }

  function deleteInvestmentFlow(flow: InvestmentCashFlow) {
    setConfirmation({
      title: "Yatırım hareketini sil?",
      description: flow.transferGroupId
        ? "Transferin her iki portföydeki karşılığı kalıcı olarak silinecek."
        : `${flow.date} tarihli hareket kalıcı olarak silinecek.`,
      confirmLabel: "Hareketi sil",
      onConfirm: () => {
        updateState((current) => deleteInvestmentCashFlowState(current, flow.id));
        setConfirmation(null);
        setToast("Yatırım hareketi silindi.");
      },
    });
  }

  const historyPortfolio = investmentHistoryPortfolioId
    ? state.investmentPortfolios.find((portfolio) => portfolio.id === investmentHistoryPortfolioId) || null
    : null;
  const editingInvestmentSnapshot = editingInvestmentSnapshotId
    ? state.investmentSnapshots.find((snapshot) => snapshot.id === editingInvestmentSnapshotId) || null
    : null;
  const editingInvestmentFlow = editingInvestmentFlowId
    ? state.investmentCashFlows.find((flow) => flow.id === editingInvestmentFlowId) || null
    : null;
  const pairedInvestmentFlow = editingInvestmentFlow?.transferGroupId
    ? state.investmentCashFlows.find(
        (flow) => flow.transferGroupId === editingInvestmentFlow.transferGroupId && flow.type === "transfer-in",
      ) || null
    : null;
  const flowPortfolio = editingInvestmentFlow
    ? state.investmentPortfolios.find((portfolio) => portfolio.id === editingInvestmentFlow.portfolioId) || null
    : state.investmentPortfolios.find((portfolio) => portfolio.id === investmentFlowPortfolioId) || null;

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
            <NavButton
              icon="investments"
              label="Yatırımlar"
              active={view === "investments"}
              onClick={() => setView("investments")}
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
            allExpenses={yearExpenses}
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
            selectedCreditCardFilter={expenseCardFilter}
            selectedExpenseFilter={selectedExpenseFilter}
            onAddExpense={openExpenseModal}
            onDeleteExpense={deleteExpense}
            onEditExpense={openExpenseEditModal}
            onCreditCardFilterChange={setExpenseCardFilter}
            onFilterChange={setExpenseSearch}
          />

          <DebtsView
            activeView={view}
            activeDebts={activeDebts}
            scheduleMonths={scheduleMonths}
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

          <InvestmentsView
            activeView={view}
            currency={investmentCurrency}
            state={state}
            onAddRecord={openInvestmentRecordModal}
            onCurrencyChange={setInvestmentCurrency}
            onManage={() => setInvestmentManagerOpen(true)}
            onOpenHistory={openInvestmentHistory}
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

      {investmentRecordModalOpen ? (
        <InvestmentMonthlyRecordModal
          portfolios={state.investmentPortfolios.filter(
            (portfolio) => !portfolio.archivedAt || portfolio.id === editingInvestmentSnapshot?.portfolioId,
          )}
          selectedMonth={state.selectedMonth}
          snapshot={editingInvestmentSnapshot}
          snapshots={state.investmentSnapshots}
          cashFlows={state.investmentCashFlows}
          onClose={closeInvestmentRecordModal}
          onSubmit={saveInvestmentRecord}
        />
      ) : null}

      {investmentManagerOpen ? (
        <InvestmentPortfolioManagerModal
          portfolios={state.investmentPortfolios}
          snapshots={state.investmentSnapshots}
          cashFlows={state.investmentCashFlows}
          onArchive={setInvestmentPortfolioArchived}
          onClose={() => setInvestmentManagerOpen(false)}
          onSave={saveInvestmentPortfolio}
        />
      ) : null}

      {historyPortfolio ? (
        <InvestmentHistoryModal
          portfolio={historyPortfolio}
          portfolios={state.investmentPortfolios}
          snapshots={state.investmentSnapshots.filter((snapshot) => snapshot.portfolioId === historyPortfolio.id)}
          cashFlows={state.investmentCashFlows.filter((flow) => flow.portfolioId === historyPortfolio.id)}
          onAddFlow={() => openInvestmentFlowModal()}
          onClose={() => setInvestmentHistoryPortfolioId(null)}
          onDeleteFlow={deleteInvestmentFlow}
          onDeleteSnapshot={deleteInvestmentSnapshot}
          onEditFlow={openInvestmentFlowModal}
          onEditSnapshot={editInvestmentRecord}
        />
      ) : null}

      {investmentFlowModalOpen && flowPortfolio ? (
        <InvestmentFlowModal
          portfolio={flowPortfolio}
          portfolios={state.investmentPortfolios}
          flow={editingInvestmentFlow}
          pairedFlow={pairedInvestmentFlow}
          onClose={closeInvestmentFlowModal}
          onSubmit={saveInvestmentFlow}
        />
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
