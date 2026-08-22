# Finance Tracker design system

## Product and audience

Finance Tracker is a Turkish-language, local-first monthly money workspace for one person who needs to understand spending, installments, and upcoming payments at a glance. The interface should feel calm enough for frequent use, exact enough for financial decisions, and personal rather than institutional.

## Visual direction: monthly ledger desk

The product borrows from a well-kept paper ledger: an ink-blue navigation rail, paper-white working surfaces, fine rules, tabular figures, and a compact month folio in the page header. It avoids banking gradients, glass effects, oversized promotional metrics, and generic green-finance styling.

### Color tokens

- `--canvas` / Ledger mist: `#F1F4F6`
- `--paper` / Working paper: `#FFFFFF`
- `--ink` / Primary text: `#17212B`
- `--navy` / Navigation ink: `#15283A`
- `--blue` / Action blue: `#2161D1`
- `--coral` / Attention and danger: `#D95548`
- Semantic success, warning, and danger colors are defined once in `styles.css` and never used as the only signal.

### Type

- Display and headings: `Georgia`, used sparingly for the brand and view title.
- UI and prose: `Avenir Next`, `Segoe UI`, system sans-serif.
- Financial figures and compact metadata: `SFMono-Regular`, `Roboto Mono`, monospace fallback with tabular numerals.

### Geometry and layout

- Desktop: 248px navigation rail + fluid content canvas capped at 1480px.
- Tablet: compact horizontal navigation header.
- Mobile: content with a persistent bottom navigation and safe-area spacing.
- Surfaces use 14–18px radii; controls use 10–12px radii. Borders carry most hierarchy; shadows stay restrained.

### Signature

The current month appears as a small two-part folio card in the header. It anchors the app in its core unit—one financial month—without turning the dashboard into a decorative hero.

## Interaction contract

- Primary creation actions use solid action blue. Routine row actions use quiet text/outline treatment. Destructive actions use a danger intent and require the shared confirmation dialog.
- All interactive controls expose hover, focus-visible, active, disabled, and busy states where applicable.
- Tables own horizontal overflow and retain stable scrollbars. Financial values use tabular figures and right alignment.
- Modal forms use an app-owned dialog, close on Escape or backdrop, restore focus, and keep visible Cancel/Save actions.
- Feedback uses the shared bottom-right live-region toast. Inline field errors remain the future canonical correction surface.
- Native month/date/select controls are intentional because this private tool accepts operating-system locale and popup presentation.
- Motion is limited to one short view entrance and control feedback; `prefers-reduced-motion` removes it.

## Runtime ownership

`styles.css :root` is the canonical runtime token implementation. Shared React components own navigation, modal, confirmation, table, feedback, and empty-state behavior. Durable token changes must update this file and this document together.
