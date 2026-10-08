import type { User } from "firebase/auth";
import { useEffect, useState } from "preact/hooks";
import { signOut } from "../auth/auth";
import { monthLabel } from "../domain/period";
import { cycleTheme, hideAmounts, navigate, selectTab, tab, theme, toggleHideAmounts, year, ym, type Tab } from "./state";

const TABS: [Tab, string][] = [["month", "Mois"], ["annual", "Annuel"], ["report", "Bilan"]];
const THEME_LABEL = { auto: "◐ Auto", light: "☀ Clair", dark: "☾ Sombre" } as const;

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <line x1="3" y1="3" x2="21" y2="21" /> : null}
    </svg>
  );
}

export function Header({ user }: { user: User }) {
  const title = tab.value === "month" ? monthLabel(ym.value) : tab.value === "annual" ? `Charges annuelles ${year.value}` : `Bilan ${year.value}`;
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);
  return (
    <header class="top">
      <div class="brand">
        <h1>
          Carnet Budget Maison
          <span class="ver" title={`Version ${__APP_VERSION__} · commit ${__APP_COMMIT__}`}>v{__APP_VERSION__}</span>
        </h1>
        <div class="brand-actions">
          <button class="theme-btn eye-btn" onClick={toggleHideAmounts} aria-pressed={hideAmounts.value}
            aria-label={hideAmounts.value ? "Afficher les montants" : "Masquer les montants"}
            title={hideAmounts.value ? "Afficher les montants" : "Masquer les montants"}>
            <EyeIcon off={hideAmounts.value} />
          </button>
          <button class="theme-btn" onClick={cycleTheme} aria-label={`Thème : ${THEME_LABEL[theme.value]}. Changer`}>{THEME_LABEL[theme.value]}</button>
          <button class="me" onClick={() => (confirming ? signOut() : setConfirming(true))} title="Se déconnecter">
            {user.photoURL ? <img class="av" src={user.photoURL} alt="" referrerpolicy="no-referrer" /> : null}
            {confirming ? "Confirmer la déconnexion" : `${user.displayName?.split(" ")[0] ?? "Compte"} · Déconnexion`}
          </button>
        </div>
      </div>
      <div class="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab.value === id} onClick={() => selectTab(id)}>{label}</button>
        ))}
      </div>
      <div class="period">
        <h2>{title}</h2>
        <div class="nav">
          <button class="iconbtn" aria-label="Période précédente" onClick={() => navigate(-1)}>‹</button>
          <button class="iconbtn" aria-label="Période suivante" onClick={() => navigate(1)}>›</button>
        </div>
      </div>
    </header>
  );
}
