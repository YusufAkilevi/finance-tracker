const FIREBASE_SYNC = {
  enabled: true,
  databaseUrl:
    "https://finance-tracker-631b9-default-rtdb.europe-west1.firebasedatabase.app/",
  path: "finance-tracker-state-v1",
};
const SYNC_DEBOUNCE_MS = 600;
const SYNC_POLL_MS = 60 * 1000;

const monthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
});
const state = defaultState();
let draggedBudgetId = null;
let syncTimer = null;
let syncPoller = null;
let lastSyncedState = "";
let hasLoadedRemoteState = false;

const elements = {
  monthPicker: document.querySelector("#monthPicker"),
  monthLabel: document.querySelector("#monthLabel"),
  viewTitle: document.querySelector("#viewTitle"),
  metricSpent: document.querySelector("#metricSpent"),
  metricSpentCount: document.querySelector("#metricSpentCount"),
  metricFlexibleSpent: document.querySelector("#metricFlexibleSpent"),
  metricFlexibleSpentCount: document.querySelector("#metricFlexibleSpentCount"),
  metricRemaining: document.querySelector("#metricRemaining"),
  metricBudgeted: document.querySelector("#metricBudgeted"),
  metricDebtDue: document.querySelector("#metricDebtDue"),
  metricDebtLeft: document.querySelector("#metricDebtLeft"),
  categoryChart: document.querySelector("#categoryChart"),
  expenseForm: document.querySelector("#expenseForm"),
  expenseModal: document.querySelector("#expenseModal"),
  openExpenseModal: document.querySelector("#openExpenseModal"),
  closeExpenseModal: document.querySelector("#closeExpenseModal"),
  expenseTable: document.querySelector("#expenseTable"),
  expenseSearch: document.querySelector("#expenseSearch"),
  expenseCategorySummary: document.querySelector("#expenseCategorySummary"),
  debtForm: document.querySelector("#debtForm"),
  debtModal: document.querySelector("#debtModal"),
  installmentCountField: document.querySelector("#installmentCountField"),
  openDebtModal: document.querySelector("#openDebtModal"),
  closeDebtModal: document.querySelector("#closeDebtModal"),
  budgetForm: document.querySelector("#budgetForm"),
  budgetModal: document.querySelector("#budgetModal"),
  openBudgetModal: document.querySelector("#openBudgetModal"),
  closeBudgetModal: document.querySelector("#closeBudgetModal"),
  budgetTable: document.querySelector("#budgetTable"),
  categoryOptions: document.querySelector("#categoryOptions"),
  resetData: document.querySelector("#resetData"),
  syncStatus: document.querySelector("#syncStatus"),
  syncNow: document.querySelector("#syncNow"),
};

init();

function init() {
  document.body.dataset.view = "dashboard";
  elements.monthPicker.value = state.selectedMonth;
  elements.expenseForm.date.value = todayISO();
  elements.debtForm.startMonth.value = state.selectedMonth;

  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  elements.monthPicker.addEventListener("change", () => {
    state.selectedMonth = elements.monthPicker.value || currentMonth();
    elements.debtForm.startMonth.value = state.selectedMonth;
    saveAndRender();
  });

  elements.expenseSearch.addEventListener("input", render);
  elements.expenseForm.addEventListener("submit", addExpense);
  elements.openExpenseModal.addEventListener("click", openExpenseModal);
  elements.closeExpenseModal.addEventListener("click", closeExpenseModal);
  elements.expenseModal.addEventListener("click", (event) => {
    if (event.target === elements.expenseModal) closeExpenseModal();
  });
  elements.debtForm.addEventListener("submit", addDebt);
  elements.debtForm.recurring.addEventListener("change", syncDebtForm);
  elements.openDebtModal.addEventListener("click", openDebtModal);
  elements.closeDebtModal.addEventListener("click", closeDebtModal);
  elements.debtModal.addEventListener("click", (event) => {
    if (event.target === elements.debtModal) closeDebtModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.expenseModal.hidden)
      closeExpenseModal();
    if (event.key === "Escape" && !elements.debtModal.hidden) closeDebtModal();
    if (event.key === "Escape" && !elements.budgetModal.hidden)
      closeBudgetModal();
  });
  elements.budgetForm.addEventListener("submit", addBudget);
  elements.openBudgetModal.addEventListener("click", openBudgetModal);
  elements.closeBudgetModal.addEventListener("click", closeBudgetModal);
  elements.budgetModal.addEventListener("click", (event) => {
    if (event.target === elements.budgetModal) closeBudgetModal();
  });
  elements.resetData?.addEventListener("click", resetDemoData);
  elements.syncNow?.addEventListener("click", () =>
    pullRemoteState({ manual: true }),
  );

  render();
  initializeSync();
}

function defaultState(withDemoData = false) {
  const selectedMonth = currentMonth();
  const demo = withDemoData
    ? buildDemoData(selectedMonth)
    : { expenses: [], debts: [], budgets: [] };
  return {
    selectedMonth,
    expenses: demo.expenses,
    debts: demo.debts,
    budgets: demo.budgets,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(value) {
  const fallback = defaultState();
  if (!value || typeof value !== "object") return fallback;
  return {
    ...fallback,
    ...value,
    selectedMonth: value.selectedMonth || fallback.selectedMonth,
    expenses: Array.isArray(value.expenses) ? value.expenses : [],
    debts: Array.isArray(value.debts) ? value.debts : [],
    budgets: Array.isArray(value.budgets) ? value.budgets : [],
    updatedAt: value.updatedAt || fallback.updatedAt,
  };
}

function buildDemoData(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = (day) =>
    `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    expenses: [
      createExpense(date(3), "Market alışverişi", "Market", 2850, "Kart"),
      createExpense(date(5), "Metro kartı", "Ulaşım", 600, "Kart"),
      createExpense(date(8), "Kahve ve yemek", "Dışarıda Yemek", 920, "Kart"),
      createExpense(date(12), "Ev interneti", "Faturalar", 520, "Havale/EFT"),
    ],
    debts: [
      createDebt(
        "Beyaz eşya",
        2000,
        12,
        4,
        subtractMonths(month, 4),
        15,
        false,
      ),
      createDebt("Yatak", 4200, 10, 2, subtractMonths(month, 2), 22, false),
      createDebt(
        "Bulut depolama",
        249,
        0,
        0,
        subtractMonths(month, 1),
        1,
        true,
      ),
    ],
    budgets: [
      createPayment(month, "Kira", 53000, 53000, true),
      createPayment(month, "Ziraat", 28777.26, 15359.06, true),
      createPayment(month, "Kredi 1", 3625.89, 0, true),
      createPayment(month, "Akbank", 30988.39, 28670, false),
      createPayment(month, "Garanti", 40500, 10500, false),
      createPayment(month, "Terapi", 8000, 8000, false),
    ],
  };
}

function setView(view) {
  document.body.dataset.view = view;
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active-view", section.id === `${view}View`);
  });
  elements.viewTitle.textContent = {
    dashboard: "Özet",
    expenses: "Harcamalar",
    debts: "Genel Taksit",
    budgets: "Bütçe",
  }[view];
}

function addExpense(event) {
  event.preventDefault();
  const form = new FormData(elements.expenseForm);
  const category = normalizeCategory(form.get("category"));
  state.expenses.push(
    createExpense(
      form.get("date"),
      category,
      category,
      Number(form.get("amount")),
      "-",
    ),
  );
  closeExpenseModal();
  saveAndRender();
}

function openExpenseModal() {
  resetExpenseForm();
  elements.expenseModal.hidden = false;
  elements.expenseModal.querySelector(".modal-panel").focus();
}

function closeExpenseModal() {
  resetExpenseForm();
  elements.expenseModal.hidden = true;
}

function resetExpenseForm() {
  elements.expenseForm.reset();
  elements.expenseForm.date.value = todayISO();
  elements.expenseForm.category.value = "";
}

function addDebt(event) {
  event.preventDefault();
  const form = new FormData(elements.debtForm);
  const recurring = form.get("recurring") === "on";
  const totalInstallments = recurring
    ? 0
    : Number(form.get("totalInstallments"));
  state.debts.push(
    createDebt(
      form.get("name").trim(),
      Number(form.get("monthlyAmount")),
      totalInstallments,
      0,
      form.get("startMonth"),
      1,
      recurring,
    ),
  );
  closeDebtModal();
  saveAndRender();
}

function openDebtModal() {
  resetDebtForm();
  elements.debtModal.hidden = false;
  elements.debtForm.name.focus();
}

function closeDebtModal() {
  resetDebtForm();
  elements.debtModal.hidden = true;
}

function resetDebtForm() {
  elements.debtForm.reset();
  elements.debtForm.totalInstallments.value = 6;
  elements.debtForm.startMonth.value = state.selectedMonth;
  syncDebtForm();
}

function syncDebtForm() {
  const recurring = elements.debtForm.recurring.checked;
  elements.installmentCountField.hidden = recurring;
  elements.debtForm.totalInstallments.required = !recurring;
}

function addBudget(event) {
  event.preventDefault();
  const form = new FormData(elements.budgetForm);
  state.budgets.push(
    createPayment(
      state.selectedMonth,
      form.get("name").trim(),
      Number(form.get("currentAmount")),
      Number(form.get("nextAmount")),
      false,
    ),
  );
  closeBudgetModal();
  saveAndRender();
}

function openBudgetModal() {
  resetBudgetForm();
  elements.budgetModal.hidden = false;
  elements.budgetForm.name.focus();
}

function closeBudgetModal() {
  resetBudgetForm();
  elements.budgetModal.hidden = true;
}

function resetBudgetForm() {
  elements.budgetForm.reset();
}

function render() {
  const month = state.selectedMonth;
  const monthDate = new Date(`${month}-01T00:00:00`);
  const expenses = monthlyExpenses(month);
  const budgets = state.budgets.filter((budget) => budget.month === month);
  const debtDue = monthlyDebtDue(month);
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

  elements.monthLabel.textContent = monthFormatter.format(monthDate);
  elements.metricSpent.textContent = money(totalSpent);
  elements.metricSpentCount.textContent = `${expenses.length} harcama`;
  elements.metricFlexibleSpent.textContent = money(flexibleSpent);
  elements.metricFlexibleSpentCount.textContent = `${flexibleExpenses.length} harcama`;
  elements.metricRemaining.textContent = money(remaining);
  elements.metricBudgeted.textContent = `${money(totalBudgeted)} toplam ödeme`;
  elements.metricDebtDue.textContent = money(totalDebtDue);
  elements.metricDebtLeft.textContent = `Toplam ${money(debtLeft)} planlanan borç`;
  renderCategories(expenses);
  renderYearlySummary();
  renderExpenseCategorySummary(expenses);
  renderExpenseTable(expenses);
  renderDebtSchedule();
  renderBudgetTable(budgets);
  renderCategoryOptions();
}

function renderCategories(expenses) {
  const totals = groupTotals(expenses, "category");
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((entry) => entry[1]), 1);

  elements.categoryChart.innerHTML = entries.length
    ? entries
        .map(([category, amount]) => {
          const width = Math.max((amount / max) * 100, 4);
          return `
            <div class="bar-row">
              <div class="bar-meta"><strong>${escapeHTML(category)}</strong><span>${money(amount)}</span></div>
              <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
            </div>
          `;
        })
        .join("")
    : emptyState("Bu ay henüz harcama yok.");
}

function renderYearlySummary() {
  const head = document.getElementById("yearlySummaryHead");
  const body = document.getElementById("yearlySummaryBody");
  if (!head || !body) return;

  if (state.expenses.length === 0) {
    head.innerHTML = "";
    body.innerHTML = `<tr><td>${emptyState("Henüz harcama yok.")}</td></tr>`;
    return;
  }

  const history = {};
  const yearsSet = new Set();
  state.expenses.forEach((e) => {
    const [y, m] = e.date.split("-");
    yearsSet.add(y);
    if (!history[y]) history[y] = {};
    history[y][m] = (history[y][m] || 0) + e.amount;
  });

  const years = Array.from(yearsSet).sort();

  head.innerHTML = `<tr><th>Ay</th>${years.map((y) => `<th class="amount-col">${y}</th>`).join("")}</tr>`;

  const allMonths = [
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
    "11",
    "12",
  ];

  body.innerHTML = allMonths
    .map((m) => {
      const monthName = new Intl.DateTimeFormat("tr-TR", {
        month: "long",
      }).format(new Date(`2000-${m}-01T00:00:00`));
      const yearCols = years
        .map((y) => {
          const val = history[y] && history[y][m] ? history[y][m] : 0;
          return `<td class="amount-col">${val > 0 ? money(val) : "-"}</td>`;
        })
        .join("");

      return `<tr>
      <th>${monthName.toUpperCase()}</th>
      ${yearCols}
    </tr>`;
    })
    .join("");
}

function renderExpenseCategorySummary(expenses) {
  if (!elements.expenseCategorySummary) return;
  const totals = groupTotals(expenses, "category");
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((entry) => entry[1]), 1);

  elements.expenseCategorySummary.innerHTML = entries.length
    ? entries
        .map(([category, amount]) => {
          const width = Math.max((amount / max) * 100, 4);
          return `
            <div class="bar-row">
              <div class="bar-meta"><strong>${escapeHTML(category)}</strong><span>${money(amount)}</span></div>
              <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
            </div>
          `;
        })
        .join("")
    : emptyState("Bu ay henüz harcama yok.");
}

function renderExpenseTable(expenses) {
  const query = elements.expenseSearch.value.trim().toLowerCase();
  const filtered = expenses
    .filter((expense) => {
      const value =
        `${expense.description} ${expense.category} ${expense.method}`.toLowerCase();
      return value.includes(query);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  elements.expenseTable.innerHTML = filtered.length
    ? filtered
        .map(
          (expense) => `
          <tr>
            <td data-label="Tarih">${formatDate(expense.date)}</td>
            <td data-label="Açıklama">${escapeHTML(expense.description)}</td>
            <td data-label="Kategori">${escapeHTML(expense.category)}</td>
            <td data-label="Yöntem">${escapeHTML(expense.method)}</td>
            <td data-label="Tutar" class="amount-col">${money(expense.amount)}</td>
            <td><button class="row-action" data-delete-expense="${expense.id}" type="button">Sil</button></td>
          </tr>
        `,
        )
        .join("")
    : `<tr><td colspan="6">${emptyState("Eşleşen harcama bulunamadı.")}</td></tr>`;

  document.querySelectorAll("[data-delete-expense]").forEach((button) => {
    button.addEventListener("click", () => {
      state.expenses = state.expenses.filter(
        (expense) => expense.id !== button.dataset.deleteExpense,
      );
      saveAndRender();
    });
  });
}

function renderDebtSchedule() {
  const months = buildMonthRange(currentMonth(), 12);
  const activeDebts = state.debts.filter(
    (debt) => isRecurringDebt(debt) || remainingDebt(debt) > 0,
  );
  const monthTotals = months.map((month) =>
    sum(monthlyDebtDue(month), "dueAmount"),
  );

  const head = document.getElementById("scheduleGridHead");
  const body = document.getElementById("scheduleGridBody");
  const foot = document.getElementById("scheduleGridFoot");

  if (!head || !body || !foot) return;

  if (activeDebts.length === 0) {
    head.innerHTML = "";
    foot.innerHTML = "";
    body.innerHTML = `<tr><td>${emptyState("Henüz taksitli borç eklenmedi.")}</td></tr>`;
    return;
  }

  head.innerHTML = `<tr><th>Taksit</th>${months.map((m) => `<th class="amount-col">${shortMonth(m)}</th>`).join("")}<th></th></tr>`;

  body.innerHTML = activeDebts
    .map((debt) => {
      const payments = months
        .map((m) => {
          const p = scheduledDebtPayment(debt, m);
          return `<td class="amount-col">${p > 0 ? money(p) : ""}</td>`;
        })
        .join("");

      return `<tr>
      <th>${escapeHTML(debt.name)}</th>
      ${payments}
      <td><button class="row-action" data-delete-debt="${debt.id}" type="button">Sil</button></td>
    </tr>`;
    })
    .join("");

  foot.innerHTML = `<tr class="total-row">
    <th>Taksit Toplam</th>
    ${monthTotals.map((t) => `<td class="amount-col">${money(t)}</td>`).join("")}
    <td></td>
  </tr>`;

  document.querySelectorAll("[data-delete-debt]").forEach((button) => {
    button.addEventListener("click", () => {
      state.debts = state.debts.filter(
        (debt) => debt.id !== button.dataset.deleteDebt,
      );
      saveAndRender();
    });
  });
}

function renderBudgetTable(budgets) {
  const currentTotal = sumPayments(budgets, "currentAmount");
  const paidTotal = sumPayments(
    budgets.filter((budget) => budget.paid),
    "currentAmount",
  );
  const remainingTotal = currentTotal - paidTotal;
  const nextTotal = sumPayments(budgets, "nextAmount");

  elements.budgetTable.innerHTML = budgets.length
    ? `
      <div class="payment-table-wrap">
        <table class="payment-table budget-sheet">
          <thead>
            <tr>
              <th></th>
              <th class="amount-col">Bu ay</th>
              <th>
                <button class="rollover-button" data-rollover-budget type="button">Ayı Aktar</button>
                <span>Durum</span>
              </th>
              <th class="amount-col">Gelecek ay</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${budgets
              .map(
                (payment) => `
                  <tr data-budget-row="${payment.id}">
                    <th>
                      <span class="budget-name-cell">
                        <span class="drag-handle" title="Sırayı değiştir" aria-label="Sırayı değiştir"></span>
                        <span>${escapeHTML(payment.name || payment.category || "Ödeme")}</span>
                      </span>
                    </th>
                    <td data-label="Bu ay" class="amount-col">
                      <span class="money-field">
                        <span aria-hidden="true">₺</span>
                        <input class="amount-input" data-payment-amount="${payment.id}" data-payment-field="currentAmount" type="number" min="0" step="0.01" value="${editableMoney(paymentAmount(payment, "currentAmount"))}" />
                      </span>
                    </td>
                    <td data-label="Durum">
                      <label class="paid-toggle">
                        <input data-toggle-payment="${payment.id}" type="checkbox" ${payment.paid ? "checked" : ""} />
                        <span>${payment.paid ? "Ödendi" : "Bekliyor"}</span>
                      </label>
                    </td>
                    <td data-label="Gelecek ay" class="amount-col">
                      <span class="money-field">
                        <span aria-hidden="true">₺</span>
                        <input class="amount-input" data-payment-amount="${payment.id}" data-payment-field="nextAmount" type="number" min="0" step="0.01" value="${editableMoney(paymentAmount(payment, "nextAmount"))}" />
                      </span>
                    </td>
                    <td><button class="row-action" data-delete-budget="${payment.id}" type="button">Sil</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <th>Bu Ay Toplam Borç</th>
              <td class="amount-col">${budgetMoney(currentTotal)}</td>
              <td></td>
              <td class="amount-col">${budgetMoney(nextTotal)}</td>
              <td></td>
            </tr>
            <tr class="remaining-row">
              <th>Kalan Borç</th>
              <td class="amount-col">${budgetMoney(remainingTotal)}</td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
            <tr class="paid-row">
              <th>Ödenen Borç</th>
              <td class="amount-col">${budgetMoney(paidTotal)}</td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `
    : emptyState("Bu ay ve gelecek ay için ödeme ekleyin.");

  document.querySelectorAll("[data-toggle-payment]").forEach((input) => {
    input.addEventListener("change", () => {
      const payment = state.budgets.find(
        (budget) => budget.id === input.dataset.togglePayment,
      );
      if (payment) payment.paid = input.checked;
      saveAndRender();
    });
  });

  document.querySelectorAll("[data-payment-amount]").forEach((input) => {
    input.addEventListener("change", () => {
      const payment = state.budgets.find(
        (budget) => budget.id === input.dataset.paymentAmount,
      );
      if (payment)
        payment[input.dataset.paymentField] = Number(input.value || 0);
      saveAndRender();
    });
  });

  document.querySelectorAll("[data-delete-budget]").forEach((button) => {
    button.addEventListener("click", () => {
      state.budgets = state.budgets.filter(
        (budget) => budget.id !== button.dataset.deleteBudget,
      );
      saveAndRender();
    });
  });

  document.querySelectorAll("[data-rollover-budget]").forEach((button) => {
    button.addEventListener("click", rolloverBudgetPayments);
  });

  document.querySelectorAll(".drag-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      const row = handle.closest("[data-budget-row]");
      if (!row) return;

      event.preventDefault();
      draggedBudgetId = row.dataset.budgetRow;
      row.classList.add("is-dragging");
      document.body.classList.add("is-budget-reordering");
      handle.setPointerCapture(event.pointerId);

      const moveDraggedPayment = (moveEvent) => {
        document
          .querySelectorAll(".budget-drop-target")
          .forEach((target) => target.classList.remove("budget-drop-target"));
        const targetRow = document
          .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
          ?.closest("[data-budget-row]");
        if (targetRow && targetRow.dataset.budgetRow !== draggedBudgetId) {
          targetRow.classList.add("budget-drop-target");
        }
      };

      const finishDraggedPayment = (upEvent) => {
        const targetRow = document
          .elementFromPoint(upEvent.clientX, upEvent.clientY)
          ?.closest("[data-budget-row]");
        document.removeEventListener("pointermove", moveDraggedPayment);
        document.removeEventListener("pointerup", finishDraggedPayment);
        document
          .querySelectorAll(".budget-drop-target")
          .forEach((target) => target.classList.remove("budget-drop-target"));
        row.classList.remove("is-dragging");
        document.body.classList.remove("is-budget-reordering");
        handle.releasePointerCapture(event.pointerId);

        if (targetRow)
          reorderBudgetPayment(draggedBudgetId, targetRow.dataset.budgetRow);
        draggedBudgetId = null;
      };

      document.addEventListener("pointermove", moveDraggedPayment);
      document.addEventListener("pointerup", finishDraggedPayment);
    });
  });
}

function rolloverBudgetPayments() {
  const month = state.selectedMonth;
  state.budgets.forEach((payment) => {
    if (payment.month !== month) return;
    payment.currentAmount = paymentAmount(payment, "nextAmount");
    payment.nextAmount = 0;
    payment.paid = false;
  });
  saveAndRender();
}

function reorderBudgetPayment(draggedId, targetId) {
  if (!draggedId || !targetId || draggedId === targetId) return;

  const month = state.selectedMonth;
  const monthPayments = state.budgets.filter(
    (budget) => budget.month === month,
  );
  const fromIndex = monthPayments.findIndex(
    (payment) => payment.id === draggedId,
  );
  const toIndex = monthPayments.findIndex((payment) => payment.id === targetId);
  if (fromIndex < 0 || toIndex < 0) return;

  const [movedPayment] = monthPayments.splice(fromIndex, 1);
  monthPayments.splice(toIndex, 0, movedPayment);

  let nextMonthPaymentIndex = 0;
  state.budgets = state.budgets.map((payment) => {
    if (payment.month !== month) return payment;
    return monthPayments[nextMonthPaymentIndex++];
  });

  saveAndRender();
}

function renderCategoryOptions() {
  const categories = new Set([
    "Market",
    "Ulaşım",
    "Dışarıda Yemek",
    "Faturalar",
    "Kira",
    "Alışveriş",
    "Sağlık",
    "Eğlence",
    "Diğer",
    ...state.expenses.map((expense) => expense.category),
  ]);
  elements.categoryOptions.innerHTML = `
    <option value="" disabled selected>Kategori seçin</option>
    ${[...categories]
      .sort()
      .map(
        (category) =>
          `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`,
      )
      .join("")}
  `;
}

function monthlyExpenses(month) {
  return state.expenses.filter((expense) => expense.date.startsWith(month));
}

function isFixedHousingOrInstallmentExpense(expense) {
  const searchableText =
    `${expense.category || ""} ${expense.description || ""}`.toLocaleLowerCase(
      "tr-TR",
    );
  return ["taksit", "kira", "rent", "aidat"].some((term) =>
    searchableText.includes(term),
  );
}

function monthlyDebtDue(month) {
  return state.debts
    .filter((debt) => {
      return scheduledDebtPayment(debt, month) > 0;
    })
    .map((debt) => ({ ...debt, dueAmount: monthlyPayment(debt) }));
}

function scheduledDebtPayment(debt, month) {
  const dueIndex = monthDiff(debt.startMonth, month);
  if (dueIndex < 0) return 0;
  if (isRecurringDebt(debt)) return monthlyPayment(debt);
  if (dueIndex >= debt.totalInstallments || dueIndex < debt.paidInstallments)
    return 0;
  return monthlyPayment(debt);
}

function monthlyPayment(debt) {
  if (Number(debt.monthlyAmount) > 0) return Number(debt.monthlyAmount);
  return debt.totalInstallments ? debt.total / debt.totalInstallments : 0;
}

function remainingDebt(debt) {
  if (isRecurringDebt(debt)) return 0;
  const total = Number(
    debt.total ?? monthlyPayment(debt) * debt.totalInstallments,
  );
  return Math.max(total - monthlyPayment(debt) * debt.paidInstallments, 0);
}

function isRecurringDebt(debt) {
  return debt.recurring === true;
}

function createExpense(date, description, category, amount, method) {
  return {
    id: newId(),
    date,
    description,
    category,
    amount,
    method,
  };
}

function createDebt(
  name,
  monthlyAmount,
  totalInstallments,
  paidInstallments,
  startMonth,
  dueDay,
  recurring = false,
) {
  return {
    id: newId(),
    name,
    monthlyAmount,
    total: recurring ? 0 : monthlyAmount * totalInstallments,
    totalInstallments,
    paidInstallments,
    startMonth,
    dueDay,
    recurring,
  };
}

function createPayment(month, name, currentAmount, nextAmount, paid = false) {
  return {
    id: newId(),
    month,
    name,
    currentAmount,
    nextAmount,
    paid,
  };
}

function saveAndRender() {
  state.updatedAt = new Date().toISOString();
  render();
  queueRemoteSave();
}

function initializeSync() {
  if (!isFirebaseSyncConfigured()) {
    updateSyncStatus("Local only");
    elements.syncNow.hidden = true;
    return;
  }

  elements.syncNow.hidden = false;
  updateSyncStatus("Syncing");
  pullRemoteState();
  syncPoller = window.setInterval(() => pullRemoteState(), SYNC_POLL_MS);
}

function isFirebaseSyncConfigured() {
  return (
    FIREBASE_SYNC.enabled &&
    FIREBASE_SYNC.databaseUrl.trim() &&
    FIREBASE_SYNC.path.trim()
  );
}

function remoteStateUrl() {
  const baseUrl = FIREBASE_SYNC.databaseUrl.trim().replace(/\/$/, "");
  const path = FIREBASE_SYNC.path.trim().replace(/^\/|\.json$/g, "");
  return `${baseUrl}/${path}.json`;
}

async function pullRemoteState(options = {}) {
  if (!isFirebaseSyncConfigured()) return;

  try {
    updateSyncStatus(options.manual ? "Syncing" : "Checking");
    const response = await fetch(remoteStateUrl(), { cache: "no-store" });
    if (!response.ok) throw new Error(`Firebase returned ${response.status}`);

    const remote = await response.json();
    if (remote) {
      const normalizedRemote = normalizeState(remote);
      const remoteSnapshot = JSON.stringify(normalizedRemote);
      const localSnapshot = JSON.stringify(state);

      if (remoteSnapshot === localSnapshot) {
        lastSyncedState = remoteSnapshot;
        hasLoadedRemoteState = true;
        updateSyncStatus("Synced");
        return;
      }

      if (!hasLoadedRemoteState || isStateNewer(normalizedRemote, state)) {
        Object.assign(state, normalizedRemote);
        elements.monthPicker.value = state.selectedMonth;
        render();
        lastSyncedState = remoteSnapshot;
        hasLoadedRemoteState = true;
        updateSyncStatus("Synced");
        return;
      }

      await pushRemoteState();
      return;
    }

    hasLoadedRemoteState = true;
    await pushRemoteState();
  } catch (error) {
    console.error(error);
    updateSyncStatus("Sync error");
  }
}

function queueRemoteSave() {
  if (!isFirebaseSyncConfigured()) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(pushRemoteState, SYNC_DEBOUNCE_MS);
}

async function pushRemoteState() {
  if (!isFirebaseSyncConfigured()) return;

  const snapshot = JSON.stringify(state);
  if (snapshot === lastSyncedState) {
    updateSyncStatus("Synced");
    return;
  }

  try {
    updateSyncStatus("Saving");
    const response = await fetch(remoteStateUrl(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: snapshot,
    });
    if (!response.ok) throw new Error(`Firebase returned ${response.status}`);

    lastSyncedState = snapshot;
    hasLoadedRemoteState = true;
    updateSyncStatus("Synced");
  } catch (error) {
    console.error(error);
    updateSyncStatus("Sync error");
  }
}

function updateSyncStatus(text) {
  if (elements.syncStatus) elements.syncStatus.textContent = text;
}

function isStateNewer(candidate, current) {
  return (
    Date.parse(candidate.updatedAt || "") > Date.parse(current.updatedAt || "")
  );
}

function resetDemoData() {
  if (!confirm("Mevcut verileriniz silinip demo veriler yüklensin mi?")) return;
  Object.assign(state, defaultState(true));
  elements.monthPicker.value = state.selectedMonth;
  saveAndRender();
}

function groupTotals(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + item.amount;
    return acc;
  }, {});
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function paymentAmount(payment, key) {
  if (key === "currentAmount")
    return Number(payment.currentAmount ?? payment.limit ?? 0);
  return Number(payment.nextAmount ?? 0);
}

function editableMoney(value) {
  return Number(value || 0).toFixed(2);
}

function sumPayments(payments, key) {
  return payments.reduce(
    (total, payment) => total + paymentAmount(payment, key),
    0,
  );
}

function budgetMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function money(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function normalizeCategory(value) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^\w/, (letter) => letter.toLocaleUpperCase("tr-TR"));
}

function emptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char];
  });
}

function newId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function subtractMonths(month, count) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 - count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthRange(startMonth, count) {
  return Array.from({ length: count }, (_, index) =>
    addMonths(startMonth, index),
  );
}

function addMonths(month, count) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shortMonth(month) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "short",
    year: "2-digit",
  }).format(new Date(`${month}-01T00:00:00`));
}

function longMonth(month) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00`));
}

function monthDiff(start, end) {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return (endYear - startYear) * 12 + (endMonth - startMonth);
}
