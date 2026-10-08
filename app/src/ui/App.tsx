import type { User } from "firebase/auth";
import { useEffect } from "preact/hooks";
import { authError, authUser, signIn, signOut, startAuthListener } from "../auth/auth";
import { toISODate } from "../domain/period";
import {
  accessDenied, budgetsReady, registerMember, resetSession, watchBudgets, watchMembers, watchOutflows, watchYear,
} from "../data/store";
import { ErrorBanner, OfflineBanner } from "./Banners";
import { Header } from "./Header";
import { activeYear, ledger, sheet, tab, today } from "./state";
import { AnnualView } from "./AnnualView";
import { MonthView } from "./MonthView";
import { ReportView } from "./ReportView";
import { ExpenseSheet } from "./ExpenseSheet";

export function App() {
  useEffect(() => startAuthListener(), []);
  const u = authUser.value;
  const uid = u?.uid;
  useEffect(() => resetSession(), [uid]);
  if (u === undefined) return <p class="loading">Chargement…</p>;
  if (u === null) return <SignIn />;
  if (accessDenied.value) return <Private email={u.email} />;
  return <Carnet user={u} />;
}

function SignIn() {
  return (
    <div class="gate">
      <div class="box">
        <h1>Carnet Budget Maison</h1>
        <p>{import.meta.env.VITE_APP_TAGLINE}</p>
        <button onClick={() => signIn()}>Se connecter avec Google</button>
        {authError.value ? <p class="err" role="alert">{authError.value}</p> : null}
      </div>
    </div>
  );
}

function Private({ email }: { email: string | null }) {
  return (
    <div class="gate">
      <div class="box">
        <h1>Ce carnet est privé</h1>
        <p>Le compte {email ?? "utilisé"} n’a pas accès. Connecte-toi avec un compte autorisé.</p>
        <button onClick={() => signOut()}>Changer de compte</button>
      </div>
    </div>
  );
}

function Carnet({ user }: { user: User }) {
  useEffect(() => {
    const stopBudgets = watchBudgets();
    const stopMembers = watchMembers();
    const tick = setInterval(() => {
      const t = toISODate(new Date());
      if (t !== today.value) today.value = t;
    }, 60_000);
    return () => {
      stopBudgets();
      stopMembers();
      clearInterval(tick);
    };
  }, [user.uid]);

  // Register the profile only once Firestore has accepted this account.
  const ready = budgetsReady.value;
  useEffect(() => {
    if (ready && !accessDenied.value) registerMember(user);
  }, [ready, user.uid]);

  const y = activeYear.value;
  useEffect(() => watchYear(y), [y]);
  useEffect(() => watchOutflows(y), [y]);

  return (
    <div class="wrap">
      <Header user={user} />
      <OfflineBanner />
      <ErrorBanner />
      <main>{!budgetsReady.value ? <p class="loading">Chargement du budget…</p> : <View />}</main>
      {tab.value !== "report" && ledger.value !== "chequing" ? (
        <div class="fab">
          <button onClick={() => (sheet.value = { mode: "add", scope: tab.value === "annual" ? "annual" : "monthly" })}>+ Ajouter une dépense</button>
        </div>
      ) : null}
      <ExpenseSheet />
    </div>
  );
}

function View() {
  if (tab.value === "month") return <MonthView />;
  if (tab.value === "annual") return <AnnualView />;
  return <ReportView />;
}
