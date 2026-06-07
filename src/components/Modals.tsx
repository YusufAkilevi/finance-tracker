import type { FormEvent } from "react";
import { monthlyPayment, normalizeCreditCard } from "../lib/finance";
import { todayISO } from "../lib/date";
import type { Debt, Expense } from "../types";

type ExpenseModalProps = {
  categories: string[];
  expense: Expense | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ExpenseModal({
  categories,
  expense,
  onClose,
  onSubmit,
}: ExpenseModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expenseModalTitle"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <h3 id="expenseModalTitle">
            {expense ? "Harcama Düzenle" : "Harcama Ekle"}
          </h3>
          <button
            className="icon-button"
            type="button"
            aria-label="Kapat"
            onClick={onClose}
          >
            x
          </button>
        </div>
        <form key={expense?.id || "new-expense"} onSubmit={onSubmit}>
          <div className="form-grid">
            <label>
              Tarih
              <input
                name="date"
                type="date"
                defaultValue={expense?.date || todayISO()}
                required
              />
            </label>
            <label>
              Tutar
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                defaultValue={expense?.amount || ""}
                required
              />
            </label>
            <label>
              Kategori
              <select name="category" defaultValue={expense?.category || ""} required>
                <option value="" disabled>
                  Kategori seçin
                </option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kredi Kartı
              <select
                name="creditCard"
                defaultValue={normalizeCreditCard(expense?.creditCard)}
              >
                <option value="" disabled>
                  Kart seçin
                </option>
                <option value="Ziraat">Ziraat</option>
                <option value="Axess">Axess</option>
                <option value="Garanti">Garanti</option>
              </select>
            </label>
          </div>
          <button className="primary-action" type="submit">
            {expense ? "Harcamayı Kaydet" : "Harcama Ekle"}
          </button>
        </form>
      </div>
    </div>
  );
}

type DebtModalProps = {
  debt: Debt | null;
  recurring: boolean;
  selectedMonth: string;
  onClose: () => void;
  onRecurringChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function DebtModal({
  debt,
  recurring,
  selectedMonth,
  onClose,
  onRecurringChange,
  onSubmit,
}: DebtModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debtModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <h3 id="debtModalTitle">
            {debt ? "Taksit Düzenle" : "Taksitli Borç Ekle"}
          </h3>
          <button
            className="icon-button"
            type="button"
            aria-label="Kapat"
            onClick={onClose}
          >
            x
          </button>
        </div>
        <form key={debt?.id || "new-debt"} onSubmit={onSubmit}>
          <div className="form-grid">
            <label>
              İsim
              <input
                name="name"
                placeholder="Bilgisayar, telefon, kredi kartı..."
                defaultValue={debt?.name || ""}
                required
              />
            </label>
            <label>
              Aylık Taksit Tutarı
              <input
                name="monthlyAmount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={debt ? monthlyPayment(debt) : ""}
                required
              />
            </label>
            <label hidden={recurring}>
              Taksit Sayısı
              <input
                name="totalInstallments"
                type="number"
                min="1"
                step="1"
                defaultValue={debt?.totalInstallments || 6}
                required={!recurring}
              />
            </label>
            <label>
              Başlangıç Ayı
              <input
                name="startMonth"
                type="month"
                defaultValue={debt?.startMonth || selectedMonth}
                required
              />
            </label>
            <label className="checkbox-field wide">
              <input
                name="recurring"
                type="checkbox"
                checked={recurring}
                onChange={(event) => onRecurringChange(event.target.checked)}
              />
              <span>Sürekli Ödeme (Abonelik vb.)</span>
            </label>
          </div>
          <button className="primary-action" type="submit">
            {debt ? "Taksidi Güncelle" : "Taksidi Kaydet"}
          </button>
        </form>
      </div>
    </div>
  );
}

type BudgetModalProps = {
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function BudgetModal({ onClose, onSubmit }: BudgetModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="budgetModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <h3 id="budgetModalTitle">Ödeme Ekle</h3>
          <button
            className="icon-button"
            type="button"
            aria-label="Kapat"
            onClick={onClose}
          >
            x
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <label>
              İsim
              <input name="name" placeholder="Kira, kredi, terapi..." required />
            </label>
            <label>
              Bu Ayki Tutar
              <input name="currentAmount" type="number" min="0" step="0.01" required />
            </label>
            <label>
              Gelecek Ayki Tutar
              <input name="nextAmount" type="number" min="0" step="0.01" required />
            </label>
          </div>
          <button className="primary-action" type="submit">
            Ödemeyi Kaydet
          </button>
        </form>
      </div>
    </div>
  );
}
