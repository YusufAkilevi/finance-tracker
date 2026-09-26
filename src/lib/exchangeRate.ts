const FRANKFURTER_RATE_URL =
  "https://api.frankfurter.dev/v2/rate/usd/try";

export type ExchangeRateResult = {
  rate: number;
  date: string;
};

export async function fetchUsdTryRate(
  date?: string,
  signal?: AbortSignal,
): Promise<ExchangeRateResult> {
  const url = date
    ? `${FRANKFURTER_RATE_URL}?date=${encodeURIComponent(date)}`
    : FRANKFURTER_RATE_URL;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Kur servisi ${response.status} yanıtını verdi.`);
  }

  const data = (await response.json()) as { rate?: unknown; date?: unknown };
  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Kur servisi geçerli bir kur döndürmedi.");
  }

  return {
    rate,
    date: typeof data.date === "string" && data.date ? data.date : date || todayISO(),
  };
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
