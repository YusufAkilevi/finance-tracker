export type View = "dashboard" | "expenses" | "debts" | "budgets" | "investments";
export type CreditCard = "Ziraat" | "Axess" | "Garanti";
export type ExpenseCardFilter = CreditCard | "" | "cardless";
export type AmountKey = "currentAmount" | "nextAmount";
export type InvestmentCurrency = "TRY" | "USD";
export type InvestmentRateSource = "frankfurter" | "manual";
export type InvestmentCashFlowType =
  | "contribution"
  | "withdrawal"
  | "transfer-in"
  | "transfer-out";

export type Expense = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  method: string;
  creditCard: CreditCard | "";
  sourceDebtId?: string;
};

export type Debt = {
  id: string;
  name: string;
  person: string;
  monthlyAmount: number;
  total: number;
  totalInstallments: number;
  paidInstallments: number;
  startMonth: string;
  dueDay: number;
  creditCard: CreditCard | "";
  recurring: boolean;
};

export type DebtDue = Debt & {
  dueAmount: number;
};

export type PersonDebtSchedule = {
  person: string;
  debts: Debt[];
  monthTotals: number[];
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

export type InvestmentPortfolio = {
  id: string;
  name: string;
  purpose: string;
  currency: InvestmentCurrency;
  description: string;
  createdAt: string;
  archivedAt?: string;
};

export type InvestmentSnapshot = {
  id: string;
  portfolioId: string;
  date: string;
  totalValue: number;
  usdTryRate: number;
  rateDate: string;
  rateSource: InvestmentRateSource;
  note?: string;
};

export type InvestmentCashFlow = {
  id: string;
  portfolioId: string;
  date: string;
  type: InvestmentCashFlowType;
  amount: number;
  currency: InvestmentCurrency;
  usdTryRate: number;
  rateDate: string;
  rateSource: InvestmentRateSource;
  snapshotId?: string;
  transferGroupId?: string;
  counterpartyPortfolioId?: string;
  note?: string;
};

export type FinanceState = {
  selectedMonth: string;
  expenses: Expense[];
  debts: Debt[];
  budgets: BudgetPayment[];
  investmentPortfolios: InvestmentPortfolio[];
  investmentSnapshots: InvestmentSnapshot[];
  investmentCashFlows: InvestmentCashFlow[];
  updatedAt: string;
};
