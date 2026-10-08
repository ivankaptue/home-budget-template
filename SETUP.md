# Set up your own copy

Carnet Budget Maison runs on **your own Firebase project**: your data, your accounts, your budget. Nothing personal
is committed — the Firebase project, the allowed emails and the budget live in git-ignored files (`.env`,
`.firebaserc`, `budget/*.json`).

Requirements: Node 24, a Google account, Java ≥ 11 only to run the security-rules tests (`npm run test:rules`).

## 1. Firebase project

In the [Firebase console](https://console.firebase.google.com):

1. Create a project (Google Analytics is not needed).
2. Build → **Authentication** → Get started → Sign-in method → enable **Google**.
3. Build → **Firestore Database** → Create database → production mode, a region close to you.
4. Project settings → General → Your apps → **Add app → Web** (no need for Firebase Hosting setup here) → keep the
   `firebaseConfig` values at hand.

Hosting is enabled by the first deploy.

## 2. Local config

```bash
npm ci
cp .env.example .env
npx firebase login
npx firebase use --add      # pick your project (writes .firebaserc)
```

Fill in `.env`:

| Variable | Value |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | from the web app config (step 1.4); public by design, they end up in the built app |
| `VITE_APP_TAGLINE` | optional subtitle on the sign-in screen, e.g. « Le budget des Tremblay » |
| `ALLOWED_EMAILS` | the Google accounts of the household, comma-separated — the only ones allowed to read and write |

## 3. Budget

```bash
mkdir budget
cp examples/budget/2026-01.json budget/2026-01.json   # name it after the first month you track: YYYY-MM.json
```

Adapt envelopes, items and amounts (dollars) — see « Changing the budget » in the README for the fields. Then
`npm test`: the parser validates the file.

## 4. First deploy

```bash
npm run build
npx firebase deploy --only hosting,firestore:rules,firestore:indexes
```

The `predeploy` hook writes `firebase/firestore.rules` with your `ALLOWED_EMAILS` just before the rules go live.
Open `https://<project-id>.web.app` and sign in with one of the allowed accounts. On a phone: « Ajouter à l’écran
d’accueil » installs it as an app.

## 5. Publish the budget

The app reads the budget from Firestore; only a service-account key can write it.

1. Project settings → **Service accounts** → Generate new private key.
2. Save it as `firebase/service-account-<anything>.json` (git-ignored). **Never commit or share it.**
3. Publish (again after every budget change):

   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=firebase/service-account-<anything>.json npm run budget:publish
   ```

## 6. Optional — deploy from GitHub Actions

`.github/workflows/deploy.yml` tests, builds and deploys on every push to `main`. In your repository settings →
Secrets and variables → Actions, add:

- **variables**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
  `VITE_FIREBASE_APP_ID`, and optionally `VITE_APP_TAGLINE`;
- **secrets**: `ALLOWED_EMAILS`, and `FIREBASE_SERVICE_ACCOUNT` (the content of a service-account key allowed to
  deploy Hosting, Firestore rules and indexes).

Without them the build or the rules step fails before anything is deployed.

## Troubleshooting

- **« Ce carnet est privé » after signing in**: the account is not in `ALLOWED_EMAILS`, or the rules were not deployed
  since you changed it — redeploy with `firestore:rules`.
- **« Aucun budget pour … »**: the budget was not published (step 5), or its file month is after the month shown.
- **Build error « Missing VITE_FIREBASE_… »**: `.env` is missing or incomplete (step 2).
