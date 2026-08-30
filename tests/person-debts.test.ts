import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DebtModal } from "../src/components/Modals";
import { DebtsView } from "../src/components/views/DebtsView";
import {
  groupDebtSchedulesByPerson,
  monthlyExpenses,
  nextCreditCardBudgetTotals,
} from "../src/lib/finance";
import { saveDebtState } from "../src/lib/mutations";
import { normalizeState } from "../src/lib/state";
import type { Debt } from "../src/types";

describe("person-based installment data", () => {
  beforeAll(() => {
    vi.stubGlobal("window", { crypto: globalThis.crypto });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("assigns a legacy debt without a person to Ben", () => {
    const normalized = normalizeState({
      selectedMonth: "2026-08",
      expenses: [],
      debts: [
        {
          id: "legacy-debt",
          name: "Bilgisayar",
          monthlyAmount: 1_000,
          total: 6_000,
          totalInstallments: 6,
          paidInstallments: 0,
          startMonth: "2026-08",
          dueDay: 1,
          creditCard: "",
          recurring: false,
        },
      ],
      budgets: [],
      updatedAt: "2026-08-30T00:00:00.000Z",
    });

    expect((normalized.debts[0] as { person?: string }).person).toBe("Ben");
  });

  it("builds separate monthly schedules and totals for each person", () => {
    const debts: Debt[] = [
      {
        id: "mine",
        name: "Telefon",
        person: "Ben",
        monthlyAmount: 1_000,
        total: 2_000,
        totalInstallments: 2,
        paidInstallments: 0,
        startMonth: "2026-08",
        dueDay: 1,
        creditCard: "Axess",
        recurring: false,
      },
      {
        id: "mother",
        name: "Beyaz eşya",
        person: "Anne",
        monthlyAmount: 750,
        total: 1_500,
        totalInstallments: 2,
        paidInstallments: 0,
        startMonth: "2026-08",
        dueDay: 1,
        creditCard: "Ziraat",
        recurring: false,
      },
    ];

    const schedules = groupDebtSchedulesByPerson(debts, [
      "2026-08",
      "2026-09",
    ]);

    expect(schedules).toEqual([
      { person: "Ben", debts: [debts[0]], monthTotals: [1_000, 1_000] },
      { person: "Anne", debts: [debts[1]], monthTotals: [750, 750] },
    ]);
  });

  it("stores the selected person when creating an installment", () => {
    const state = normalizeState({
      selectedMonth: "2026-08",
      expenses: [],
      debts: [],
      budgets: [],
      updatedAt: "2026-08-30T00:00:00.000Z",
    });
    const values = {
      name: "Tablet",
      person: "Anne",
      monthlyAmount: 500,
      totalInstallments: 3,
      startMonth: "2026-08",
      dueDay: 1,
      creditCard: "Axess" as const,
      recurring: false,
    };

    const saved = saveDebtState(
      state,
      null,
      values,
    );

    expect(saved.debts[0].person).toBe("Anne");
  });

  it("shows a required person field defaulted to Ben in the installment form", () => {
    const markup = renderToStaticMarkup(
      createElement(DebtModal, {
        debt: null,
        recurring: false,
        selectedMonth: "2026-08",
        onClose: () => undefined,
        onRecurringChange: () => undefined,
        onSubmit: () => undefined,
      }),
    );

    expect(markup).toContain("Kişi");
    expect(markup).toContain('name="person"');
    expect(markup).toContain('value="Ben"');
    expect(markup).toMatch(
      /<input(?=[^>]*name="person")(?=[^>]*required="")[^>]*>/,
    );
  });

  it("renders one installment table and monthly total row per person", () => {
    const debts: Debt[] = [
      {
        id: "mine",
        name: "Telefon",
        person: "Ben",
        monthlyAmount: 1_000,
        total: 2_000,
        totalInstallments: 2,
        paidInstallments: 0,
        startMonth: "2026-08",
        dueDay: 1,
        creditCard: "Axess",
        recurring: false,
      },
      {
        id: "brother",
        name: "Kulaklık",
        person: "Kardeşim",
        monthlyAmount: 400,
        total: 800,
        totalInstallments: 2,
        paidInstallments: 0,
        startMonth: "2026-08",
        dueDay: 1,
        creditCard: "Garanti",
        recurring: false,
      },
    ];
    const markup = renderToStaticMarkup(
      createElement(DebtsView, {
        activeView: "debts",
        activeDebts: debts,
        scheduleMonths: ["2026-08", "2026-09"],
        onAddDebt: () => undefined,
        onDeleteDebt: () => undefined,
        onEditDebt: () => undefined,
      }),
    );

    expect(markup.match(/<table/g)).toHaveLength(2);
    expect(markup.match(/Taksit Toplam/g)).toHaveLength(2);
    expect(markup).toContain("Ben Taksit Tablosu");
    expect(markup).toContain("Kardeşim Taksit Tablosu");
  });

  it("shows the card name below each populated installment amount", () => {
    const debt: Debt = {
      id: "card-backed",
      name: "Telefon",
      person: "Ben",
      monthlyAmount: 1_000,
      total: 1_000,
      totalInstallments: 1,
      paidInstallments: 0,
      startMonth: "2026-08",
      dueDay: 1,
      creditCard: "Axess",
      recurring: false,
    };
    const markup = renderToStaticMarkup(
      createElement(DebtsView, {
        activeView: "debts",
        activeDebts: [debt],
        scheduleMonths: ["2026-08", "2026-09"],
        onAddDebt: () => undefined,
        onDeleteDebt: () => undefined,
        onEditDebt: () => undefined,
      }),
    );

    expect(markup).toContain(
      '<span class="installment-payment"><span>₺1.000</span><small>Axess</small></span>',
    );
    expect(markup.match(/<small>Axess<\/small>/g)).toHaveLength(1);
  });

  it("excludes another person's card installment from expenses and payment-plan totals", () => {
    const state = normalizeState({
      selectedMonth: "2026-08",
      expenses: [],
      debts: [
        {
          id: "mine",
          name: "Telefon",
          person: "Ben",
          monthlyAmount: 1_000,
          total: 2_000,
          totalInstallments: 2,
          paidInstallments: 0,
          startMonth: "2026-08",
          dueDay: 1,
          creditCard: "Axess",
          recurring: false,
        },
        {
          id: "mother",
          name: "Beyaz eşya",
          person: "Anne",
          monthlyAmount: 750,
          total: 1_500,
          totalInstallments: 2,
          paidInstallments: 0,
          startMonth: "2026-08",
          dueDay: 1,
          creditCard: "Axess",
          recurring: false,
        },
      ],
      budgets: [],
      updatedAt: "2026-08-30T00:00:00.000Z",
    });

    expect(
      monthlyExpenses(state, "2026-09").map((expense) => expense.description),
    ).toEqual(["Telefon"]);
    expect(nextCreditCardBudgetTotals(state).Akbank).toBe(1_000);
  });
});
