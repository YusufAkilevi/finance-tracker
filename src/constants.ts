import type { CreditCard, View } from "./types";

export const FIREBASE_SYNC = {
  enabled: true,
  databaseUrl:
    "https://finance-tracker-631b9-default-rtdb.europe-west1.firebasedatabase.app/",
  path: "finance-tracker-state-v1",
};

export const SYNC_DEBOUNCE_MS = 600;
export const SYNC_POLL_MS = 60 * 1000;
export const BUDGET_MONTH = "2026-05";

export const CREDIT_CARD_BUDGET_NAMES: Record<CreditCard, string> = {
  Ziraat: "Ziraat",
  Axess: "Akbank",
  Garanti: "Garanti",
};

export const VIEW_TITLES: Record<View, string> = {
  dashboard: "Özet",
  expenses: "Harcamalar",
  debts: "Genel Taksit",
  budgets: "Bütçe",
};

export const ALL_MONTH_NUMBERS = [
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
