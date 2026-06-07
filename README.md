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

## Optional Firebase sync

The app can sync the same JSON state to Firebase Realtime Database without adding a backend.

1. Create a Firebase project.
2. Create a Realtime Database.
3. Set simple public rules if this is only for your private link:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

4. In `src/App.tsx`, update `FIREBASE_SYNC`:

```ts
const FIREBASE_SYNC = {
  enabled: true,
  databaseUrl: "https://YOUR-PROJECT-default-rtdb.firebaseio.com",
  path: "finance-tracker-state-v1"
};
```

The app fetches the Firebase JSON on load, saves changes back to Firebase, and checks for remote updates every 60 seconds while open.

## Features

- Monthly dashboard with total spending, budget remaining, installment debt due, and projected month total.
- Expense tracking with date, category, payment method, search, and delete.
- Installment debt tracking with monthly installment amount, installment count, and optional recurring payments.
- 12-month installment schedule that works like a spreadsheet: debts as rows, months as columns, and recurring payments repeated from their start month.
- Monthly payment planning for this month and next month, including paid and remaining totals.
- TRY currency formatting with browser local storage.
- Data is synced through Firebase Realtime Database when sync is enabled.
