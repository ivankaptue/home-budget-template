// Variables read from .env by Vite (envDir = repo root, see app/vite.config.ts and .env.example).
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_APP_TAGLINE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
