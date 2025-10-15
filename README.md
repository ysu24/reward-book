## Perks Keeper-Yiheng Su

A Web App for keeping credit-card rewards organized. The app helps cardholders track active offers, log spend in real time, and review historical perks without relying on spreadsheets or issuer inbox searches.

---

## Highlights

- **Active Dashboard** – Home groups offers by category, surfaces days-left warnings, and lets you log purchases through a quick slide-over without leaving the page.
- **Offer Management Workspace** – `/offers` handles create/edit/archive with inline validation, Central Time expiry targeting 23:59:59, and automatic status normalization (`active`, `expired`, `maxed`, `archived`).
- **History Archive** – `/history` lists every offer (active, expired, maxed, archived) with search, filters, sort-by-expiry, and permanent delete (offer + spend logs).
- **Local-first Persistence** – Dexie-powered IndexedDB stores offers, cards, spend logs, and lifetime stats entirely in the browser.
- **Timezone Guarantee** – All expiration dates are converted to America/Chicago and stored at 11:59:59 PM CT for the selected day to avoid early cutoffs.

---

## Tech Stack

- [Next.js 15](https://nextjs.org) (App Router) + [React 19](https://react.dev)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Dexie](https://dexie.org/) for IndexedDB access
- [Headless UI](https://headlessui.com/) for the slide-over / dialog transitions

---

## Project Structure

```
perks-keeper/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                # Dashboard (active offers)
│  │  ├─ offers/page.tsx         # Offer management workspace
│  │  ├─ history/page.tsx        # Offer archive + filters
│  │  └─ cards/page.tsx          # Card management
│  ├─ components/
│  │  ├─ home/dashboard.tsx      # Dashboard grouping & quick log
│  │  ├─ offers/offer-manager.tsx# Offer CRUD, filtering, sorting
│  │  ├─ cards/card-manager.tsx  # Card CRUD UI
│  │  └─ spend/quick-log-panel.tsx # Slide-over purchase logger
│  └─ lib/
│     ├─ db.ts                   # Dexie schema + migrations
│     ├─ types.ts                # Shared data contracts
│     ├─ offers.ts               # Status math, helpers, sorting
│     └─ offer-actions.ts        # Archive / delete helpers
└─ …
```

---

## Status & Data Notes

- `Offer.status` can be `active`, `expired`, `maxed`, or `archived`.
- Normalization runs automatically on load so views stay accurate even if the browser reopens offline.
- Expiry dates are stored at the selected day’s 23:59:59 CT using a timezone-aware offset, preventing early expiration due to UTC conversion.
- Deleting an offer anywhere removes associated `SpendLog` records to keep the archive clean.

---

## Getting Started

### Prerequisites

- Node.js 20.11+ (project developed against Node 20 LTS)
- npm 10+

### Install & Run

```bash
npm install           # install dependencies
npm run dev           # start dev server on http://localhost:3000

npm run build         # create production build
npm start             # serve the production build locally

npm run lint          # run ESLint checks
```

> Tip: Dexie stores data per browser profile; clearing site data will reset offers, cards, and spend logs.

---

## Key Flows

1. **Add Cards** – `/cards` lets you capture issuer/name pairs for later linking.
2. **Add Offers** – `/offers` collects rate, cap, expiry, category, notes, and auto-clamps spend/earn figures.
3. **Manage Active Offers** – Dashboard shows only `active` items, grouped by category, with warning accents for ≤3 days left.
4. **Log Spend Quickly** – The slide-over (“Log purchase”) stays open for rapid entry when “Keep open” is checked.
5. **Review History** – `/history` exposes search/filter/sort plus permanent deletion when an offer is no longer relevant.

---

## Deployment

Any static hosting service that supports Next.js App Router works. To deploy on [Vercel](https://vercel.com/):

1. Fork or import the repo into Vercel.
2. Configure a project (defaults are fine – no environment variables required).
3. Link to the production branch; Vercel runs `npm install && npm run build` automatically.

---

## License

This codebase is provided as-is for private/internal use. Adapt licensing as needed before redistribution.
