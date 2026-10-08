# Carnet Budget Maison

A small, private, offline-first web app for a couple to run the household budget month after month, on their
phones. Each household deploys its own copy on its own Firebase project (see [SETUP.md](SETUP.md)); the UI is
in French (fr-CA, CAD).

## What it does

- **Envelopes**, each with its own income and allocations — e.g. a main budget and a secondary income; an item
  can send whatever is left at the end of the month to savings. See « The example budget » below.
- **Month view**: tick fixed items when paid (it records the payment automatically), log variable spending
  (« épicerie 84,50 » → Alimentation), add extra expenses to any item; a line turns **red** when it goes over budget.
- **Expense vs savings**: every item is either an expense or a saving, so the yearly report shows how much was
  really saved across all envelopes.
- **Transfers**: an item of one envelope can top up an item of another (e.g. « Courses » tops up « Alimentation »)
  — groceries are entered once and counted once.
- **Annual charges** (insurance, holidays…) tracked per year.
- **Chequing account** (« Compte chèque »): a second view in Month and Annual where each item is ticked once its own
  budget has left the chequing account (e.g. Alimentation from the main budget, Courses from the secondary
  income). Optional, shared, offline, and counted in no total.
- **Yearly report** (« Bilan »): totals, one block per envelope, monthly chart filterable by envelope, detail per
  item.
- **Works offline**: entries made without network are stored on the phone and synced automatically; installable
  as an app (PWA); light / dark / automatic theme.
- **History is never lost**: budgets are versioned by month, items are archived instead of deleted.

## Stack

| Layer | Tech |
|---|---|
| UI | Preact + TypeScript, Vite, `@preact/signals`, hand-drawn SVG chart |
| PWA | `vite-plugin-pwa` (manifest, service worker, offline app shell) |
| Data | Cloud Firestore with persistent local cache (offline writes) |
| Auth | Firebase Auth — Google; access limited to a list of verified emails by the Firestore security rules (the app itself holds no email list) |
| Hosting | Firebase Hosting |
| Tests | Vitest (domain, scripts), Firestore emulator (security rules) |
| CI/CD | GitHub Actions: tests → build → deploy on push to `main` |

All amounts are stored and computed as **integer cents**; display is `fr-CA` / CAD.

## Project layout

```
app/                     the web app (Vite root)
  src/domain/            pure budget logic — types, money, periods, budget versions, summaries, report, chequing outflows (tested)
  src/data/              Firebase init, Firestore mapping and store (signals + fire-and-forget writes)
  src/auth/              Google sign-in
  src/ui/                screens: Month, Annual, Report, expense sheet, item rows, chart, header, theme
budget/YYYY-MM.json      your budget versions (amounts in dollars, git-ignored) — the source of truth for planned amounts
examples/budget/         a made-up budget to start from
scripts/                 budget-file validation, publish-budget, export (JSON/CSV), rules generation, share
firebase/                firestore.template.rules (→ firestore.rules, generated), indexes, rules tests (emulator)
.env.example             your Firebase project, allowed emails, tagline (copy to .env, git-ignored)
SETUP.md                 how to set up your own copy (Firebase project, .env, first deploy)
```

## Getting started

Requirements: Node 24, Java ≥ 11 (Firestore emulator for rules tests).

```bash
npm ci
npm run dev          # http://localhost:5173 (needs .env; sign in with an allowed Google account)
npm test             # unit tests (domain + scripts)
npm run test:rules   # Firestore security rules on the emulator (offline, demo project)
npm run typecheck
npm run build        # outputs app/dist
```

## Changing the budget

Planned amounts live in `budget/YYYY-MM.json` (dollars). A file applies from its month onward; a new month file
creates a new version and past months keep their own budget.

1. Edit or add `budget/YYYY-MM.json`. Never delete an item that existed before — set `"archived": true` instead.
2. `npm test` — the parser validates the file (ids, envelopes, transfers, archiving, no silent removal).
3. Publish (needs the service-account key, see below):

   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=firebase/<service-account-key>.json npm run budget:publish
   ```

Item fields: `id`, `label`, `budget` (dollars or `null` = « à définir »), `type` (`fixed` | `variable`),
`nature` (`expense` | `savings`, default `expense`), `manager` (`I` | `H`), optional `note`, `transferTo`,
`leftoverToSavings`, `archived`. Envelope fields: `id`, `label`, `income`, `categories`, optional `shortLabel`
(tab label, ≤ 20 characters). Optional `annualNote` at the top level: shown next to the annual charges title.

### The example budget

`examples/budget/2026-01.json` is a made-up 2 000 $ budget that shows every feature in a few lines — start from it:

| Feature | In the example | How (JSON) |
|---|---|---|
| Several envelopes, each with its own income | « Budget principal » (1 600 $) and « Revenu secondaire » (400 $) | `envelopes[].income` |
| Fixed and variable items | Loyer is ticked when paid; Alimentation and Loisirs are logged as you spend | `"type": "fixed"` / `"variable"` |
| Savings items | Épargne, Réserve — counted as saved, not spent | `"nature": "savings"` |
| Transfer between envelopes | Courses (secondary income) tops up Alimentation (main budget): 500 $ for groceries, entered once | `"transferTo": "alimentation"` |
| Leftover of the month to savings | what is left of Loisirs at the end of a month counts as saved | `"leftoverToSavings": true` |
| Annual charges, one without an amount yet | Assurance (600 $ / year), Vacances (« à définir »), with a note | `annualItems[]`, `"budget": null`, `annualNote` |
| Short tab labels | « Principal », « Secondaire » | `"shortLabel"` |

Each envelope is balanced: its items add up to its income, so the chequing view ends at 0 $ once everything has
left the account.

## Deploy

- **Automatic**: every push to `main` runs typecheck, unit tests, rules tests, build, then
  `firebase deploy --only hosting,firestore:rules,firestore:indexes` using the repository variables and secrets
  listed in [SETUP.md](SETUP.md). Pull requests run the checks only.
- **Manual**: `npm run build && npx firebase deploy --only hosting,firestore:rules,firestore:indexes`.
- Before deploying the rules, the `predeploy` hook (`firebase.json`) runs `npm run rules`, which writes
  `firebase/firestore.rules` from `firebase/firestore.template.rules` and `ALLOWED_EMAILS`; the build refuses to run
  without the `VITE_FIREBASE_*` values. In CI, a repository without them (fresh fork or template) runs the checks,
  builds with placeholder values and does not deploy.

## Versions and rollback

- Every notable change goes to `CHANGELOG.md` under `[Unreleased]`. The version (`package.json`) and the commit are
  shown in a badge next to the title (« v1.2.1 », commit in its tooltip) — handy to know what a phone actually runs.
- **Release**: move `[Unreleased]` to a dated `[X.Y.Z]` section, set `"version"` in `package.json`, commit, then tag
  and push the tag: `git tag vX.Y.Z && git push origin vX.Y.Z`. Major = breaks backward compatibility (say so in the
  changelog), minor = feature, patch = fix.
- **Rollback without reverting the code** — two ways, hosting only:
  - *Instant*: Firebase console → Hosting → Release history → ⋮ → Roll back (serves an earlier build as is).
  - *From a tag*: GitHub → Actions → **Rollback** → Run workflow → tag `vX.Y.Z`. It checks out the tag, runs the
    tests, builds and deploys hosting only.
  - Phones pick the older version up at the next launch (the service worker auto-updates). It is safe because every
    version must work with data written by newer ones; never roll back below a **major** version.
  - Firestore rules stay as they are by default: older rules may refuse newer collections that phones still use.
    Tick « rules » in the workflow only if the rules themselves are the problem.
  - `main` is untouched: the next push to `main` deploys it again, so fix forward and push.

## Backups

```bash
GOOGLE_APPLICATION_CREDENTIALS=firebase/<service-account-key>.json npm run export
```

Writes `exports/YYYY-MM-DD/` (budgets.json, expenses.json, expenses.csv) — git-ignored.

## Security

- Only the verified emails of `ALLOWED_EMAILS` can read or write, enforced by the generated
  `firebase/firestore.rules`; budgets can only be written by the publish script.
- Service-account keys (`service-account*.json` anywhere, and the owner's `firebase/<project>-*.json`) are
  git-ignored and must never be committed or shared. If one leaks, delete it in Google Cloud → IAM → Service
  accounts → Keys and create a new one.
- The Firebase web config (`VITE_FIREBASE_*`) is public by design: it ends up in the built app.

## Sharing the code

`npm run share -- ../carnet-share` writes a copy of the last commit without the owner-only files (`Budget.md`,
`docs/superpowers/`, `.claude/`, `CHANGELOG.md` replaced by a stub), then fails if anything from `.env` — emails,
Firebase ids, tagline, or the words listed in `SHARE_FORBIDDEN` — is still in it. Push that folder to the shared
repository (to update it later: export again into a new folder and copy it over the shared clone, keeping `.git`).

## License

[MIT](LICENSE) — free to use, copy, modify and share; no warranty.
