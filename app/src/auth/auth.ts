import { signal } from "@preact/signals";
import {
  GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type User,
} from "firebase/auth";
import { auth } from "../data/firebase";

/** undefined = still loading, null = signed out. */
export const authUser = signal<User | null | undefined>(undefined);
export const authError = signal<string | null>(null);

const reportAuthError = () => {
  authError.value = "La connexion avec Google a échoué. Réessaie.";
};

export function startAuthListener(): () => void {
  getRedirectResult(auth).catch(reportAuthError);
  return onAuthStateChanged(auth, (u) => {
    authUser.value = u;
  });
}

export async function signIn(): Promise<void> {
  authError.value = null;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
    } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
      reportAuthError();
    }
  }
}

export const signOut = () => fbSignOut(auth);
