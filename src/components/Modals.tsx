import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { monthlyPayment, normalizeCreditCard } from "../lib/finance";
import { todayISO } from "../lib/date";
import type { Debt, Expense } from "../types";

type ModalFrameProps = {
  title: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  tone?: "default" | "danger";
  describedBy?: string;
};

function ModalFrame({ title, titleId, onClose, children, tone = "default", describedBy }: ModalFrameProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled])")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
      restoreFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={panelRef} className={`modal-panel ${tone === "danger" ? "modal-panel-danger" : ""}`} role={tone === "danger" ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby={titleId} aria-describedby={describedBy}>
        <div className="modal-heading">
          <div><p className="modal-kicker">{tone === "danger" ? "Onay gerekli" : "Kayıt ayrıntıları"}</p><h3 id={titleId}>{title}</h3></div>
          <button className="icon-button" type="button" aria-label="Kapat" onClick={onClose}><CloseIcon /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

type ExpenseModalProps = { categories: string[]; expense: Expense | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void };

export function ExpenseModal({ categories, expense, onClose, onSubmit }: ExpenseModalProps) {
  const validation = useOwnedFormValidation(onSubmit, "expenseFormError");
  return (
    <ModalFrame title={expense ? "Harcamayı düzenle" : "Yeni harcama"} titleId="expenseModalTitle" onClose={onClose}>
      <form key={expense?.id || "new-expense"} onSubmit={validation.handleSubmit} onInput={validation.handleInput} noValidate>
        <div className="form-grid">
          <label>Tarih<input name="date" type="date" defaultValue={expense?.date || todayISO()} required /></label>
          <label>Tutar (₺)<input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0,00" defaultValue={expense?.amount || ""} required /></label>
          <label>Kategori<select name="category" defaultValue={expense?.category || ""} required><option value="" disabled>Kategori seçin</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label>Kredi kartı<select name="creditCard" defaultValue={normalizeCreditCard(expense?.creditCard)}><option value="">Kart kullanılmadı</option><option value="Ziraat">Ziraat</option><option value="Axess">Axess</option><option value="Garanti">Garanti</option></select></label>
        </div>
        <FormError id="expenseFormError" message={validation.error} />
        <ModalActions onClose={onClose} submitLabel={expense ? "Değişiklikleri kaydet" : "Harcamayı ekle"} />
      </form>
    </ModalFrame>
  );
}

type DebtModalProps = { debt: Debt | null; recurring: boolean; selectedMonth: string; onClose: () => void; onRecurringChange: (value: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void };

export function DebtModal({ debt, recurring, selectedMonth, onClose, onRecurringChange, onSubmit }: DebtModalProps) {
  const validation = useOwnedFormValidation(onSubmit, "debtFormError");
  return (
    <ModalFrame title={debt ? "Taksidi düzenle" : "Yeni taksit"} titleId="debtModalTitle" onClose={onClose}>
      <form key={debt?.id || "new-debt"} onSubmit={validation.handleSubmit} onInput={validation.handleInput} noValidate>
        <div className="form-grid">
          <label>Taksit adı<input name="name" placeholder="Örn. Bilgisayar" defaultValue={debt?.name || ""} required /></label>
          <label>Aylık tutar (₺)<input name="monthlyAmount" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={debt ? monthlyPayment(debt) : ""} required /></label>
          <label hidden={recurring}>Taksit sayısı<input name="totalInstallments" type="number" inputMode="numeric" min="1" step="1" defaultValue={debt?.totalInstallments || 6} required={!recurring} /></label>
          <label>Başlangıç ayı<input name="startMonth" type="month" defaultValue={debt?.startMonth || selectedMonth} required /></label>
          <label>Ödeme günü<input name="dueDay" type="number" inputMode="numeric" min="1" max="31" step="1" defaultValue={debt?.dueDay || 1} required /></label>
          <label>Kredi kartı<select name="creditCard" defaultValue={normalizeCreditCard(debt?.creditCard)} required><option value="" disabled>Kart seçin</option><option value="Ziraat">Ziraat</option><option value="Axess">Axess</option><option value="Garanti">Garanti</option></select></label>
          <label className="checkbox-field wide"><input name="recurring" type="checkbox" checked={recurring} onChange={(event) => onRecurringChange(event.target.checked)} /><span>Sürekli ödeme<small>Abonelik gibi her ay tekrarlansın</small></span></label>
        </div>
        <FormError id="debtFormError" message={validation.error} />
        <ModalActions onClose={onClose} submitLabel={debt ? "Değişiklikleri kaydet" : "Taksidi ekle"} />
      </form>
    </ModalFrame>
  );
}

type BudgetModalProps = { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void };

export function BudgetModal({ onClose, onSubmit }: BudgetModalProps) {
  const validation = useOwnedFormValidation(onSubmit, "budgetFormError");
  return (
    <ModalFrame title="Ödeme planına ekle" titleId="budgetModalTitle" onClose={onClose}>
      <form onSubmit={validation.handleSubmit} onInput={validation.handleInput} noValidate>
        <div className="form-grid">
          <label className="wide">Ödeme adı<input name="name" placeholder="Örn. Kira veya terapi" required /></label>
          <label>Bu ay (₺)<input name="currentAmount" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" required /></label>
          <label>Gelecek ay (₺)<input name="nextAmount" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" required /></label>
        </div>
        <FormError id="budgetFormError" message={validation.error} />
        <ModalActions onClose={onClose} submitLabel="Ödemeyi ekle" />
      </form>
    </ModalFrame>
  );
}

type ConfirmDialogProps = { title: string; description: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void };

export function ConfirmDialog({ title, description, confirmLabel, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <ModalFrame title={title} titleId="confirmDialogTitle" onClose={onCancel} tone="danger" describedBy="confirmDialogDescription">
      <p className="confirm-description" id="confirmDialogDescription">{description}</p>
      <div className="modal-actions"><button className="button button-ghost" type="button" onClick={onCancel}>Vazgeç</button><button className="button button-danger" type="button" onClick={onConfirm}>{confirmLabel}</button></div>
    </ModalFrame>
  );
}

function ModalActions({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return <div className="modal-actions"><button className="button button-ghost" type="button" onClick={onClose}>Vazgeç</button><button className="button button-primary" type="submit">{submitLabel}</button></div>;
}

function FormError({ id, message }: { id: string; message: string }) {
  return message ? <p className="form-error" id={id} role="alert">{message}</p> : null;
}

function useOwnedFormValidation(onValidSubmit: (event: FormEvent<HTMLFormElement>) => void, errorId: string) {
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (event.currentTarget.checkValidity()) {
      onValidSubmit(event);
      return;
    }
    event.preventDefault();
    const invalid = event.currentTarget.querySelector<HTMLElement>(":invalid");
    invalid?.setAttribute("aria-invalid", "true");
    invalid?.setAttribute("aria-describedby", errorId);
    setError("Zorunlu alanları kontrol edin ve geçerli bir değer girin.");
    window.requestAnimationFrame(() => invalid?.focus());
  }

  function handleInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target as HTMLElement;
    target.removeAttribute("aria-invalid");
    target.removeAttribute("aria-describedby");
    if (error) setError("");
  }

  return { error, handleInput, handleSubmit };
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}
