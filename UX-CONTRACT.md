# Finance Tracker UX contract

## Navigation and state

- The four primary views are Özet, Harcamalar, Taksitler, and Ödeme Planı.
- Switching views does not discard finance data or the selected month.
- The month control is global where the selected month affects the view; the current implementation keeps it in the persistent shell.
- On mobile, the four destinations remain available in the bottom navigation.
- View-level create actions remain in normal document flow below the page header; they never use negative positioning or compete with the global month folio.

## Create and edit

- Add and edit open the same shared modal pattern.
- Save closes the modal, preserves the active view, updates local state immediately, queues remote sync, and announces completion.
- Cancel, Escape, or backdrop close abandons unsubmitted form changes.
- Forms own validation with `noValidate`; browser-native date/month/select popups are accepted for this private tool.

## Delete

- Deleting an expense, installment, or planned payment always opens the shared confirmation dialog.
- Cancel is the initial safe action. Confirm uses the actual verb “Sil”.
- Success keeps the active view, updates totals, queues sync, and announces what was deleted.

## Tables and direct manipulation

- Local datasets are expected to remain personal-scale. Tables are bounded by their panel and use internal horizontal scrolling rather than pagination.
- The yearly summary becomes a two-column month/amount ledger on phones; it shows the newest year without horizontal scrolling while wider screens retain comparison years.
- Empty and filtered-no-result states occupy the table surface.
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
