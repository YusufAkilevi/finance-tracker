# Finance Tracker UX contract

## Navigation and state

- The four primary views are Özet, Harcamalar, Taksitler, and Ödeme Planı.
- Switching views does not discard finance data or the selected month.
- The month control is global where the selected month affects the view; the current implementation keeps it in the persistent shell.
- On mobile, the four destinations remain available in the bottom navigation.
- View-level create actions remain in normal document flow below the page header; they never use negative positioning or compete with the global month folio.

## Create and edit

- Add and edit open the same shared modal pattern.
- Credit card selection is optional for installments. Only `Ben` installments generate monthly expenses and affect card totals in the payment plan. Other people's installments remain confined to their person table even when a card is selected.
- Every installment belongs to a required person. New records default to `Ben`, and legacy records without a person normalize to `Ben` when loaded.
- Save closes the modal, preserves the active view, updates local state immediately, queues remote sync, and announces completion.
- Cancel, Escape, or backdrop close abandons unsubmitted form changes.
- Forms own validation with `noValidate`; browser-native date/month/select popups are accepted for this private tool.

## Delete

- Deleting an expense, installment, or planned payment always opens the shared confirmation dialog.
- Cancel is the initial safe action. Confirm uses the actual verb “Sil”.
- Success keeps the active view, updates totals, queues sync, and announces what was deleted.

## Tables and direct manipulation

- Local datasets are expected to remain personal-scale. Tables are bounded by their panel and use internal horizontal scrolling rather than pagination.
- The installment view renders one 12-month table per person. Each table owns its monthly total row; there is no combined cross-person total.
- A card-backed installment shows its card name as muted secondary text below each populated monthly amount; cardless and empty cells do not show card metadata.
- A single-year summary always fits its panel without horizontal scrolling. On phones, multi-year summaries become a two-column month/latest-year ledger; wider screens retain scrollable comparison years when the data genuinely needs the space.
- Each yearly-summary month uses the same expense calculation as the selected-month “Toplam Harcama” metric: saved expenses plus automatic card installments belonging to `Ben`. Other people's installments remain excluded.
- For every credit card, the following-month payment-plan amount equals all of that card's expenses in the selected month. For example, August manual expenses plus August automatic `Ben` installments become September's card payment; September installments belong to October's payment. The Akbank payment row maps to the Axess card.
- Empty and filtered-no-result states occupy the table surface.
- The expenses table has independent category and credit-card filters. Active filters combine with AND logic; “Kartsız” matches expenses without a selected credit card. Filtering does not change the monthly category summary.
- The “Filtrelenen Toplam” below the expenses table always sums the currently visible rows; with no active filters it represents all expenses in the selected month, and an empty result shows zero.
- Budget amounts save on blur; checkboxes save immediately.
- On phones, the complete payment plan is one ledger surface—not separate cards. A shared header establishes payment, selected-month, and following-month columns; each divided row keeps both amounts side by side with its status and actions in a compact control line below.
- Monthly total, remaining debt, and paid debt summary rows keep the same selected-month and following-month column alignment.
- Drag reorder is enhanced pointer behavior. Move-up and move-down buttons are the keyboard/touch alternative.

## Sync and resilience

- Local changes render immediately. Firebase save is debounced.
- Sync status is persistently visible and translated into Turkish.
- A sync error never removes local data; the status exposes retry through “Şimdi eşitle”.
- Remote state wins on first load or when its `updatedAt` is newer; otherwise local state is pushed.

## Accessibility

- Target: WCAG 2.2 AA.
- Native landmarks, buttons, inputs, labels, tables, dialogs, live regions, and visible focus are required.
- Dialogs restore focus and keep keyboard focus inside while open.
- Color is accompanied by text or iconography. Reduced motion and forced-colors are supported.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native select | DESIGN.md + this contract | native | keyboard + phone popup |
| Date | Native date/month input | this contract | native | locale + keyboard + phone |
| Form | Shared `useOwnedFormValidation` adapter | this contract | create / edit | invalid-submit browser check |
| Scrollbar | Global rules in `styles.css` | DESIGN.md | stable table gutter | computed layout + phone overflow |
| Toast | Shared live region in `App.tsx` | this contract | success | live-region browser check |
| CRUD | Shared mutation functions + modal flows | this contract | create / edit / confirmed delete | build + browser workflow |
