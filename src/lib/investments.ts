import type {
  FinanceState,
  InvestmentCashFlow,
  InvestmentCurrency,
  InvestmentPortfolio,
  InvestmentSnapshot,
} from "../types";

export type DatedAmount = { date: string; amount: number };

export type InvestmentMetrics = {
  value: number;
  contributed: number;
  withdrawn: number;
  netInvested: number;
  gain: number;
  xirr: number | null;
  historyMonths: number;
  snapshot: InvestmentSnapshot | null;
};

export type CombinedInvestmentSummary = InvestmentMetrics & {
  completePortfolios: number;
  totalPortfolios: number;
};

export function activeInvestmentPortfolios(
  state: FinanceState,
  month = state.selectedMonth,
) {
  const cutoff = monthEndISO(month);
  return state.investmentPortfolios.filter(
    (portfolio) => {
      const firstRecordedMonth = [
        ...state.investmentSnapshots
          .filter((snapshot) => snapshot.portfolioId === portfolio.id)
          .map((snapshot) => snapshot.date.slice(0, 7)),
        ...state.investmentCashFlows
          .filter((flow) => flow.portfolioId === portfolio.id)
          .map((flow) => flow.date.slice(0, 7)),
      ].sort()[0];
      const isStarterPortfolio = STARTER_PORTFOLIO_IDS.has(portfolio.id);
      const firstMonth = isStarterPortfolio
        ? "0000-00"
        : firstRecordedMonth && firstRecordedMonth < portfolio.createdAt.slice(0, 7)
          ? firstRecordedMonth
          : portfolio.createdAt.slice(0, 7);
      return firstMonth <= month && (!portfolio.archivedAt || portfolio.archivedAt > cutoff);
    },
  );
}

const STARTER_PORTFOLIO_IDS = new Set([
  "investment-us-etf",
  "investment-bist",
  "investment-tefas",
  "investment-bes-1",
  "investment-bes-2",
]);

export function monthEndISO(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const day = new Date(year, monthNumber, 0).getDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function snapshotInMonth(
  state: FinanceState,
  portfolioId: string,
  month: string,
) {
  return (
    state.investmentSnapshots
      .filter(
        (snapshot) =>
          snapshot.portfolioId === portfolioId && snapshot.date.startsWith(month),
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null
  );
}

export function convertInvestmentAmount(
  amount: number,
  from: InvestmentCurrency,
  to: InvestmentCurrency,
  usdTryRate: number,
) {
  if (from === to) return Number(amount || 0);
  if (!Number.isFinite(usdTryRate) || usdTryRate <= 0) return 0;
  return from === "USD" ? amount * usdTryRate : amount / usdTryRate;
}

export function portfolioInvestmentMetrics(
  state: FinanceState,
  portfolio: InvestmentPortfolio,
  month: string,
  currency: InvestmentCurrency,
): InvestmentMetrics {
  const snapshot = snapshotInMonth(state, portfolio.id, month);
  const cutoff = snapshot?.date || monthEndISO(month);
  const flows = state.investmentCashFlows.filter(
    (flow) => flow.portfolioId === portfolio.id && flow.date <= cutoff,
  );
  const contributed = sumFlows(flows, ["contribution", "transfer-in"], currency);
  const withdrawn = sumFlows(flows, ["withdrawal", "transfer-out"], currency);
  const value = snapshot
    ? convertInvestmentAmount(
        snapshot.totalValue,
        portfolio.currency,
        currency,
        snapshot.usdTryRate,
      )
    : 0;

  return {
    value,
    contributed,
    withdrawn,
    netInvested: contributed - withdrawn,
    gain: value + withdrawn - contributed,
    xirr: snapshot
      ? investmentXirr(state, portfolio, month, currency)
      : null,
    historyMonths: snapshot ? investmentHistoryMonths(flows, snapshot.date) : 0,
    snapshot,
  };
}

export function combinedInvestmentSummary(
  state: FinanceState,
  month: string,
  currency: InvestmentCurrency,
): CombinedInvestmentSummary {
  const portfolios = activeInvestmentPortfolios(state, month);
  const metrics = portfolios.map((portfolio) =>
    portfolioInvestmentMetrics(state, portfolio, month, currency),
  );
  const snapshots = metrics.flatMap((metric) =>
    metric.snapshot ? [metric.snapshot] : [],
  );
  const snapshotCutoffs = new Map(
    snapshots.map((snapshot) => [snapshot.portfolioId, snapshot.date]),
  );
  const archivedCutoffs = new Map(
    state.investmentPortfolios
      .filter((portfolio) => portfolio.archivedAt && portfolio.archivedAt.slice(0, 10) <= monthEndISO(month))
      .map((portfolio) => [portfolio.id, portfolio.archivedAt!.slice(0, 10)]),
  );
  const externalFlows = state.investmentCashFlows.filter(
    (flow) => {
      const flowCutoff = snapshotCutoffs.get(flow.portfolioId) || archivedCutoffs.get(flow.portfolioId);
      return Boolean(
        flowCutoff &&
          flow.date <= flowCutoff &&
          (flow.type === "contribution" || flow.type === "withdrawal"),
      );
    },
  );
  const contributed = sumFlows(externalFlows, ["contribution"], currency);
  const withdrawn = sumFlows(externalFlows, ["withdrawal"], currency);
  const value = metrics.reduce((total, metric) => total + metric.value, 0);
  const isComplete = snapshots.length === portfolios.length && portfolios.length > 0;
  const cashFlows: DatedAmount[] = externalFlows.map((flow) => ({
    date: flow.date,
    amount:
      flowSign(flow) *
      convertInvestmentAmount(
        flow.amount,
        flow.currency,
        currency,
        flow.usdTryRate,
      ),
  }));
  if (isComplete) {
    portfolios.forEach((portfolio, index) => {
      const snapshot = metrics[index].snapshot!;
      cashFlows.push({ date: snapshot.date, amount: metrics[index].value });
    });
  }

  return {
    value,
    contributed,
    withdrawn,
    netInvested: contributed - withdrawn,
    gain: value + withdrawn - contributed,
    xirr: isComplete ? xirr(cashFlows) : null,
    historyMonths: isComplete
      ? investmentHistoryMonths(externalFlows, latestDate(snapshots))
      : 0,
    snapshot: null,
    completePortfolios: snapshots.length,
    totalPortfolios: portfolios.length,
  };
}

export function investmentXirr(
  state: FinanceState,
  portfolio: InvestmentPortfolio,
  month: string,
  currency: InvestmentCurrency,
) {
  const snapshot = snapshotInMonth(state, portfolio.id, month);
  if (!snapshot) return null;
  const flows = state.investmentCashFlows.filter(
    (flow) => flow.portfolioId === portfolio.id && flow.date <= snapshot.date,
  );
  const amounts = flows.map((flow) => ({
    date: flow.date,
    amount:
      flowSign(flow) *
      convertInvestmentAmount(
        flow.amount,
        flow.currency,
        currency,
        flow.usdTryRate,
      ),
  }));
  amounts.push({
    date: snapshot.date,
    amount: convertInvestmentAmount(
      snapshot.totalValue,
      portfolio.currency,
      currency,
      snapshot.usdTryRate,
    ),
  });
  return xirr(amounts);
}

export function investmentMonthlySeries(
  state: FinanceState,
  month: string,
  currency: InvestmentCurrency,
) {
  const snapshots = state.investmentSnapshots.filter(
    (snapshot) => snapshot.date <= monthEndISO(month),
  );
  const months = [...new Set(snapshots.map((snapshot) => snapshot.date.slice(0, 7)))].sort();
  return months.flatMap((entryMonth) => {
    const summary = combinedInvestmentSummary(state, entryMonth, currency);
    if (summary.completePortfolios !== summary.totalPortfolios) return [];
    return [{ month: entryMonth, value: summary.value, invested: summary.netInvested }];
  });
}

export function xirr(cashFlows: DatedAmount[]) {
  const flows = cashFlows
    .filter((flow) => Number.isFinite(flow.amount) && validDate(flow.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (
    flows.length < 2 ||
    flows[0].date === flows[flows.length - 1].date ||
    !flows.some((flow) => flow.amount < 0) ||
    !flows.some((flow) => flow.amount > 0)
  ) {
    return null;
  }

  const rates = [
    -0.9999, -0.99, -0.9, -0.75, -0.5, -0.25, 0, 0.1, 0.25, 0.5, 1,
    2, 5, 10, 20, 50, 100, 500, 1_000,
  ];
  let lower = rates[0];
  let lowerValue = npv(flows, lower);
  let upper = rates[1];
  let upperValue = npv(flows, upper);

  for (let index = 1; index < rates.length; index += 1) {
    upper = rates[index];
    upperValue = npv(flows, upper);
    if (Number.isFinite(lowerValue) && Number.isFinite(upperValue)) {
      if (Math.abs(lowerValue) < 1e-9) return lower;
      if (lowerValue * upperValue <= 0) break;
    }
    lower = upper;
    lowerValue = upperValue;
  }

  if (!Number.isFinite(lowerValue) || !Number.isFinite(upperValue) || lowerValue * upperValue > 0) {
    return null;
  }

  for (let iteration = 0; iteration < 200; iteration += 1) {
    const middle = (lower + upper) / 2;
    const middleValue = npv(flows, middle);
    if (!Number.isFinite(middleValue)) return null;
    if (Math.abs(middleValue) < 1e-8 || Math.abs(upper - lower) < 1e-10) {
      return middle;
    }
    if (lowerValue * middleValue <= 0) {
      upper = middle;
      upperValue = middleValue;
    } else {
      lower = middle;
      lowerValue = middleValue;
    }
  }
  return (lower + upper) / 2;
}

function npv(flows: DatedAmount[], rate: number) {
  const start = Date.parse(`${flows[0].date}T00:00:00Z`);
  return flows.reduce((total, flow) => {
    const days = (Date.parse(`${flow.date}T00:00:00Z`) - start) / 86_400_000;
    return total + flow.amount / Math.pow(1 + rate, days / 365);
  }, 0);
}

function sumFlows(
  flows: InvestmentCashFlow[],
  types: InvestmentCashFlow["type"][],
  currency: InvestmentCurrency,
) {
  return flows
    .filter((flow) => types.includes(flow.type))
    .reduce(
      (total, flow) =>
        total +
        convertInvestmentAmount(
          flow.amount,
          flow.currency,
          currency,
          flow.usdTryRate,
        ),
      0,
    );
}

function flowSign(flow: InvestmentCashFlow) {
  return flow.type === "contribution" || flow.type === "transfer-in" ? -1 : 1;
}

function investmentHistoryMonths(
  flows: InvestmentCashFlow[],
  terminalDate: string,
) {
  const earliest = flows.map((flow) => flow.date).sort()[0];
  if (!earliest) return 0;
  const days =
    (Date.parse(`${terminalDate}T00:00:00Z`) -
      Date.parse(`${earliest}T00:00:00Z`)) /
    86_400_000;
  return Math.max(1, Math.round(days / 30.4375));
}

function latestDate(snapshots: InvestmentSnapshot[]) {
  return snapshots.map((snapshot) => snapshot.date).sort().at(-1) || "";
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
}
