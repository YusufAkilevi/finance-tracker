import { FormEvent, useEffect, useRef, useState } from "react";
import { fetchUsdTryRate } from "../lib/exchangeRate";
import { monthEndISO } from "../lib/investments";
import { currentMonth, todayISO } from "../lib/date";
import type { InvestmentFlowValues } from "../lib/mutations";
import { formatDate, investmentMoney } from "../lib/format";
import type {
  InvestmentCashFlow,
  InvestmentPortfolio,
  InvestmentSnapshot,
} from "../types";
import {
  FormError,
  ModalActions,
  ModalFrame,
  useOwnedFormValidation,
} from "./Modals";

type MonthlyRecordModalProps = {
  portfolios: InvestmentPortfolio[];
  selectedMonth: string;
  snapshot: InvestmentSnapshot | null;
  snapshots: InvestmentSnapshot[];
  cashFlows: InvestmentCashFlow[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function InvestmentMonthlyRecordModal({
  portfolios,
  selectedMonth,
  snapshot,
  snapshots,
  cashFlows,
  onClose,
  onSubmit,
}: MonthlyRecordModalProps) {
  const initialPortfolio =
    portfolios.find((portfolio) => portfolio.id === snapshot?.portfolioId) ||
    portfolios[0];
  const [portfolioId, setPortfolioId] = useState(initialPortfolio?.id || "");
  const [date, setDate] = useState(
    snapshot?.date ||
      (selectedMonth === currentMonth() ? todayISO() : monthEndISO(selectedMonth)),
  );
  const recordMonth = snapshot?.date.slice(0, 7) || selectedMonth;
  const [rate, setRate] = useState(snapshot?.usdTryRate ? String(snapshot.usdTryRate) : "");
  const [rateDate, setRateDate] = useState(snapshot?.rateDate || "");
  const [rateSource, setRateSource] = useState<"frankfurter" | "manual">(
    snapshot?.rateSource || "frankfurter",
  );
  const [rateStatus, setRateStatus] = useState<"idle" | "loading" | "ready" | "error">(
    snapshot ? "ready" : "idle",
  );
  const firstEffect = useRef(true);
  const portfolio = portfolios.find((item) => item.id === portfolioId);
  const existingRecord = !snapshot && snapshots.some(
    (item) => item.portfolioId === portfolioId && item.date.startsWith(selectedMonth),
  );
  const linkedFlows = cashFlows.filter((flow) => flow.snapshotId === snapshot?.id);
  const contribution = linkedFlows.find((flow) => flow.type === "contribution");
  const withdrawal = linkedFlows.find((flow) => flow.type === "withdrawal");
  const validation = useOwnedFormValidation(onSubmit, "investmentRecordFormError");

  useEffect(() => {
    if (firstEffect.current && snapshot) {
      firstEffect.current = false;
      return undefined;
    }
    firstEffect.current = false;
    const controller = new AbortController();
    setRate("");
    setRateDate("");
    setRateStatus("loading");
    void fetchUsdTryRate(date, controller.signal)
      .then((result) => {
        setRate(String(result.rate));
        setRateDate(result.date);
        setRateSource("frankfurter");
        setRateStatus("ready");
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") return;
        setRateStatus("error");
      });
    return () => controller.abort();
  }, [date, snapshot]);

  if (!initialPortfolio) return null;

  return (
    <ModalFrame
      title={snapshot ? "Aylık kaydı düzenle" : "Aylık yatırım kaydı"}
      titleId="investmentRecordModalTitle"
      onClose={onClose}
    >
      <form
        key={snapshot?.id || "new-investment-record"}
        onSubmit={validation.handleSubmit}
        onInput={validation.handleInput}
        noValidate
      >
        <div className="form-grid">
          <label className="wide">
            Portföy
            <select
              name={snapshot ? undefined : "portfolioId"}
              value={portfolioId}
              onChange={(event) => setPortfolioId(event.target.value)}
              required
              disabled={Boolean(snapshot)}
            >
              {portfolios.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            {snapshot ? <input name="portfolioId" type="hidden" value={snapshot.portfolioId} /> : null}
          </label>
          {existingRecord ? (
            <p className="investment-existing-record-note" role="status">
              Bu portföyün seçili ayda kaydı var. Düzenlemek için portföy satırındaki Kayıtlar bölümünü aç.
            </p>
          ) : null}
          <label>
            Değerleme tarihi
            <input
              name="date"
              type="date"
              value={date}
              min={`${recordMonth}-01`}
              max={monthEndISO(recordMonth)}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label>
            Toplam değer ({portfolio?.currency})
            <input name="totalValue" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={snapshot?.totalValue ?? ""} required />
          </label>
          <label>
            Bu dönemde eklenen ({portfolio?.currency})
            <input name="contributed" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={contribution?.amount || 0} />
          </label>
          <label>
            Bu dönemde çekilen ({portfolio?.currency})
            <input name="withdrawn" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={withdrawal?.amount || 0} />
          </label>
          <label>
            USD/TRY kuru
            <input
              name="usdTryRate"
              type="number"
              inputMode="decimal"
              min="0.0001"
              step="0.0001"
              value={rate}
              readOnly={rateStatus === "loading"}
              aria-busy={rateStatus === "loading"}
              onChange={(event) => {
                setRate(event.target.value);
                setRateSource("manual");
                setRateDate(date);
                setRateStatus("ready");
              }}
              required
            />
          </label>
          <div className={`investment-rate-status ${rateStatus === "error" ? "is-error" : ""}`} aria-live="polite">
            {rateStatus === "loading" ? "Tarihli kur alınıyor…" : null}
            {rateStatus === "ready" && rateSource === "frankfurter" ? `Kur ${rateDate} tarihli referans değeriyle sabitlendi.` : null}
            {rateStatus === "error" ? "Kur alınamadı. Kaydı tamamlamak için kuru elle gir." : null}
            {rateSource === "manual" && rate ? "Manuel kur kullanılacak." : null}
          </div>
          <label className="wide">
            Not <span className="optional-label">İsteğe bağlı</span>
            <input name="note" defaultValue={snapshot?.note || ""} placeholder="Örn. Eylül ay sonu değerlemesi" />
          </label>
          <input name="rateDate" type="hidden" value={rateDate || date} />
          <input name="rateSource" type="hidden" value={rateSource} />
        </div>
        <FormError id="investmentRecordFormError" message={validation.error} />
        <ModalActions onClose={onClose} submitLabel={snapshot ? "Değişiklikleri kaydet" : "Aylık kaydı ekle"} disabled={existingRecord || rateStatus === "loading" || !rate || Number(rate) <= 0} />
      </form>
    </ModalFrame>
  );
}

type PortfolioManagerModalProps = {
  portfolios: InvestmentPortfolio[];
  snapshots: InvestmentSnapshot[];
  cashFlows: InvestmentCashFlow[];
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>, editingId: string | null) => void;
  onArchive: (portfolioId: string, archived: boolean) => void;
};

export function InvestmentPortfolioManagerModal({
  portfolios,
  snapshots,
  cashFlows,
  onClose,
  onSave,
  onArchive,
}: PortfolioManagerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = portfolios.find((portfolio) => portfolio.id === editingId);
  const currencyLocked = Boolean(editing && (
    snapshots.some((snapshot) => snapshot.portfolioId === editing.id) ||
    cashFlows.some((flow) => flow.portfolioId === editing.id)
  ));
  const validation = useOwnedFormValidation(
    (event) => onSave(event, editingId),
    "investmentPortfolioFormError",
  );

  return (
    <ModalFrame title="Portföyleri yönet" titleId="investmentPortfolioManagerTitle" onClose={onClose}>
      <form key={editing?.id || "new-portfolio"} onSubmit={validation.handleSubmit} onInput={validation.handleInput} noValidate>
        <div className="form-grid">
          <label>Portföy adı<input name="name" defaultValue={editing?.name || ""} placeholder="Örn. Yabancı teknoloji" required /></label>
          <label>Amaç<input name="purpose" defaultValue={editing?.purpose || "Uzun vadeli büyüme"} required /></label>
          <label>Doğal para birimi<select name={currencyLocked ? undefined : "currency"} defaultValue={editing?.currency || "TRY"} disabled={currencyLocked}><option value="TRY">Türk lirası</option><option value="USD">ABD doları</option></select>{currencyLocked ? <><input name="currency" type="hidden" value={editing!.currency} /><small>Kayıt bulunan portföyün para birimi değiştirilemez.</small></> : null}</label>
          <label>Açıklama<input name="description" defaultValue={editing?.description || ""} placeholder="Örn. VOO, QQQM" /></label>
        </div>
        <FormError id="investmentPortfolioFormError" message={validation.error} />
        <div className="portfolio-form-actions">
          {editing ? <button className="button button-ghost" type="button" onClick={() => setEditingId(null)}>Yeni portföye dön</button> : <span />}
          <button className="button button-primary" type="submit">{editing ? "Portföyü güncelle" : "Portföy oluştur"}</button>
        </div>
      </form>
      <div className="portfolio-manager-list" aria-label="Portföy listesi">
        {portfolios.map((portfolio) => (
          <div className="portfolio-manager-row" key={portfolio.id}>
            <span><strong>{portfolio.name}</strong><small>{portfolio.purpose} · {portfolio.currency}{portfolio.archivedAt ? " · Arşivde" : ""}</small></span>
            <span className="row-actions">
              <button className="row-action" type="button" onClick={() => setEditingId(portfolio.id)}>Düzenle</button>
              <button className="row-action" type="button" onClick={() => onArchive(portfolio.id, !portfolio.archivedAt)}>{portfolio.archivedAt ? "Geri al" : "Arşivle"}</button>
            </span>
          </div>
        ))}
      </div>
    </ModalFrame>
  );
}

type HistoryModalProps = {
  portfolio: InvestmentPortfolio;
  snapshots: InvestmentSnapshot[];
  cashFlows: InvestmentCashFlow[];
  portfolios: InvestmentPortfolio[];
  onAddFlow: () => void;
  onClose: () => void;
  onDeleteFlow: (flow: InvestmentCashFlow) => void;
  onDeleteSnapshot: (snapshot: InvestmentSnapshot) => void;
  onEditFlow: (flow: InvestmentCashFlow) => void;
  onEditSnapshot: (snapshot: InvestmentSnapshot) => void;
};

export function InvestmentHistoryModal({
  portfolio,
  snapshots,
  cashFlows,
  portfolios,
  onAddFlow,
  onClose,
  onDeleteFlow,
  onDeleteSnapshot,
  onEditFlow,
  onEditSnapshot,
}: HistoryModalProps) {
  const sortedSnapshots = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));
  const independentFlows = cashFlows
    .filter((flow) => !flow.snapshotId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const portfolioName = (id?: string) => portfolios.find((item) => item.id === id)?.name || "Portföy";

  return (
    <ModalFrame title={`${portfolio.name} kayıtları`} titleId="investmentHistoryTitle" onClose={onClose}>
      <div className="history-heading-row">
        <p className="panel-note">Aylık değerlemeler ve ayrıca girilen nakit hareketleri.</p>
        <button className="button button-ghost" type="button" onClick={onAddFlow}>Ek hareket ekle</button>
      </div>
      <section className="investment-history-section">
        <h4>Aylık değerlemeler</h4>
        {sortedSnapshots.length ? sortedSnapshots.map((snapshot) => {
          const linked = cashFlows.filter((flow) => flow.snapshotId === snapshot.id);
          return (
            <div className="investment-history-row" key={snapshot.id}>
              <span><strong>{formatDate(snapshot.date)}</strong><small>{snapshot.note || `${snapshot.rateDate} kuru`}</small></span>
              <span className="history-value">{investmentMoney(snapshot.totalValue, portfolio.currency)}<small>{linked.map(flowLabel).join(" · ") || "Nakit hareketi yok"}</small></span>
              <span className="row-actions"><button className="row-action" type="button" onClick={() => onEditSnapshot(snapshot)}>Düzenle</button><button className="row-action" type="button" onClick={() => onDeleteSnapshot(snapshot)}>Sil</button></span>
            </div>
          );
        }) : <p className="empty-state">Henüz aylık değerleme yok.</p>}
      </section>
      <section className="investment-history-section">
        <h4>Ek hareketler</h4>
        {independentFlows.length ? independentFlows.map((flow) => (
          <div className="investment-history-row" key={flow.id}>
            <span><strong>{formatDate(flow.date)}</strong><small>{flow.note || flowTypeLabel(flow.type)}</small></span>
            <span className="history-value">{investmentMoney(flow.amount, flow.currency)}<small>{flow.counterpartyPortfolioId ? portfolioName(flow.counterpartyPortfolioId) : flowTypeLabel(flow.type)}</small></span>
            <span className="row-actions"><button className="row-action" type="button" onClick={() => onEditFlow(flow)}>Düzenle</button><button className="row-action" type="button" onClick={() => onDeleteFlow(flow)}>Sil</button></span>
          </div>
        )) : <p className="empty-state">Ayrı tarihli ek hareket yok.</p>}
      </section>
    </ModalFrame>
  );
}

type FlowModalProps = {
  portfolio: InvestmentPortfolio;
  portfolios: InvestmentPortfolio[];
  flow: InvestmentCashFlow | null;
  pairedFlow: InvestmentCashFlow | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function InvestmentFlowModal({ portfolio, portfolios, flow, pairedFlow, onClose, onSubmit }: FlowModalProps) {
  const counterpart = flow?.counterpartyPortfolioId
    ? portfolios.find((item) => item.id === flow.counterpartyPortfolioId)
    : undefined;
  const editingTransfer = Boolean(flow?.transferGroupId);
  const [type, setType] = useState<InvestmentFlowValues["type"]>(
    editingTransfer ? "transfer" : flow?.type === "withdrawal" ? "withdrawal" : "contribution",
  );
  const [destinationId, setDestinationId] = useState(counterpart?.id || portfolios.find((item) => item.id !== portfolio.id && !item.archivedAt)?.id || "");
  const [date, setDate] = useState(flow?.date || todayISO());
  const [rate, setRate] = useState(flow?.usdTryRate ? String(flow.usdTryRate) : "");
  const [rateDate, setRateDate] = useState(flow?.rateDate || "");
  const [rateSource, setRateSource] = useState<"frankfurter" | "manual">(flow?.rateSource || "frankfurter");
  const [rateStatus, setRateStatus] = useState<"idle" | "loading" | "ready" | "error">(
    flow ? "ready" : "idle",
  );
  const firstEffect = useRef(true);
  const destination = portfolios.find((item) => item.id === destinationId);
  const validation = useOwnedFormValidation(onSubmit, "investmentFlowFormError");

  useEffect(() => {
    if (firstEffect.current && flow) {
      firstEffect.current = false;
      return undefined;
    }
    firstEffect.current = false;
    const controller = new AbortController();
    setRate("");
    setRateDate("");
    setRateStatus("loading");
    void fetchUsdTryRate(date, controller.signal)
      .then((result) => {
        setRate(String(result.rate));
        setRateDate(result.date);
        setRateSource("frankfurter");
        setRateStatus("ready");
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setRateStatus("error");
      });
    return () => controller.abort();
  }, [date, flow]);

  return (
    <ModalFrame title={flow ? "Hareketi düzenle" : "Ek yatırım hareketi"} titleId="investmentFlowTitle" onClose={onClose}>
      <form key={flow?.id || "new-flow"} onSubmit={validation.handleSubmit} onInput={validation.handleInput} noValidate>
        <div className="form-grid">
          <label>Hareket türü<select name="type" value={type} onChange={(event) => setType(event.target.value as InvestmentFlowValues["type"])}><option value="contribution">Para ekleme</option><option value="withdrawal">Para çekme</option><option value="transfer">Portföyler arası transfer</option></select></label>
          <label>Tarih<input name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <input name="portfolioId" type="hidden" value={portfolio.id} />
          <label>{type === "transfer" ? "Çıkan" : "Tutar"} ({portfolio.currency})<input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={flow?.amount || ""} required /></label>
          {type === "transfer" ? (
            <>
              <label>Hedef portföy<select name="destinationPortfolioId" value={destinationId} onChange={(event) => setDestinationId(event.target.value)} required>{portfolios.filter((item) => item.id !== portfolio.id && (!item.archivedAt || item.id === destinationId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Hedefe giren ({destination?.currency})<input name="destinationAmount" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={pairedFlow?.amount || ""} required /></label>
            </>
          ) : null}
          <label>USD/TRY kuru<input name="usdTryRate" type="number" inputMode="decimal" min="0.0001" step="0.0001" value={rate} readOnly={rateStatus === "loading"} aria-busy={rateStatus === "loading"} onChange={(event) => { setRate(event.target.value); setRateSource("manual"); setRateDate(date); setRateStatus("ready"); }} required /></label>
          <label className="wide">Not <span className="optional-label">İsteğe bağlı</span><input name="note" defaultValue={flow?.note || ""} /></label>
          <input name="rateDate" type="hidden" value={rateDate || date} />
          <input name="rateSource" type="hidden" value={rateSource} />
        </div>
        <div className={`investment-rate-status ${rateStatus === "error" ? "is-error" : ""}`} aria-live="polite">
          {rateStatus === "loading" ? "Tarihli kur alınıyor…" : null}
          {rateStatus === "ready" && rateSource === "frankfurter" ? `Kur ${rateDate} tarihli referans değeriyle sabitlendi.` : null}
          {rateStatus === "error" ? "Kur alınamadı. Kuru elle girerek devam edebilirsin." : null}
          {rateStatus === "ready" && rateSource === "manual" && rate ? "Manuel kur kullanılacak." : null}
        </div>
        <FormError id="investmentFlowFormError" message={validation.error} />
        <ModalActions onClose={onClose} submitLabel={flow ? "Hareketi güncelle" : "Hareketi ekle"} disabled={rateStatus === "loading" || !rate || Number(rate) <= 0} />
      </form>
    </ModalFrame>
  );
}

function flowLabel(flow: InvestmentCashFlow) {
  const prefix = flow.type === "contribution" ? "Eklenen" : "Çekilen";
  return `${prefix} ${investmentMoney(flow.amount, flow.currency)}`;
}

function flowTypeLabel(type: InvestmentCashFlow["type"]) {
  const labels: Record<InvestmentCashFlow["type"], string> = {
    contribution: "Para ekleme",
    withdrawal: "Para çekme",
    "transfer-in": "Transfer girişi",
    "transfer-out": "Transfer çıkışı",
  };
  return labels[type];
}
