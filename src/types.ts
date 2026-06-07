export type View = "dashboard" | "expenses" | "debts" | "budgets";
export type CreditCard = "Ziraat" | "Axess" | "Garanti";
export type AmountKey = "currentAmount" | "nextAmount";

export type Expense = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  method: string;
  creditCard: CreditCard | "";
};

export type Debt = {
  id: string;
  name: string;
  monthlyAmount: number;
  total: number;
  totalInstallments: number;
  paidInstallments: number;
  startMonth: string;
  dueDay: number;
  recurring: boolean;
};

export type DebtDue = Debt & {
  dueAmount: number;
};

export type BudgetPayment = {
  id: string;
  month?: string;
  name?: string;
  category?: string;
  currentAmount?: number;
  nextAmount?: number;
  limit?: number;
  paid: boolean;
};

export type FinanceState = {
  selectedMonth: string;
  expenses: Expense[];
  debts: Debt[];
  budgets: BudgetPayment[];
  updatedAt: string;
};
