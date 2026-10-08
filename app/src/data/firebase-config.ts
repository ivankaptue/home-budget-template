import type { FirebaseOptions } from "firebase/app";

// Web config is not a secret; access is enforced by firebase/firestore.rules.
// Values come from .env (see .env.example); app/vite.config.ts refuses to build without them.
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: location.hostname.endsWith("web.app") ? `${projectId}.web.app` : `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: `${projectId}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
