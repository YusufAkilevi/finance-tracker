# Finance Tracker

A local-first personal finance tracker for monthly spending, monthly payments, and installment debts.

## Tech stack

- React
- TypeScript
- Vite
- Vanilla CSS

## Run

Install dependencies, then start Vite:

```sh
npm install
npm run dev
```

The dev server runs at `http://127.0.0.1:5173/` by default.

Build the production bundle with:

```sh
npm run build
```

## Firebase sync and privacy

Firebase Realtime Database sync is configured in `src/constants.ts`. The current client uses unauthenticated REST requests. If the database rules allow public read or write access, anyone who obtains the database URL and path can read or overwrite the finance data; the URL is included in the browser bundle. A private link does not provide access control. Add authentication and restrictive database rules before hosting real financial data publicly.

The app fetches the Firebase JSON on load, saves changes back to Firebase, and checks for remote updates every 60 seconds while open. To use the app without remote sync, set `FIREBASE_SYNC.enabled` to `false` in `src/constants.ts`.

## Features

- Monthly dashboard with total spending, budget remaining, installment debt due, and projected month total.
- Expense tracking with date, category, payment method, search, and delete.
- Installment debt tracking with monthly installment amount, installment count, and optional recurring payments.
- 12-month installment schedule that works like a spreadsheet: debts as rows, months as columns, and recurring payments repeated from their start month.
- Monthly payment planning for this month and next month, including paid and remaining totals.
- TRY currency formatting with browser local storage.
- Data is synced through Firebase Realtime Database when sync is enabled.
- Purpose-based investment portfolios with monthly valuations, contributions, withdrawals, and portfolio transfers.
- TRY and USD portfolio reporting with stored historical USD/TRY reference rates and money-weighted annualized return (XIRR).
- Combined investment wealth, allocation, capital-versus-value history, and per-portfolio performance without live asset-price tracking.
