// The allowed emails are not committed: firebase/firestore.template.rules holds a placeholder that
// scripts/build-rules.ts replaces with ALLOWED_EMAILS before each deploy (firebase.json predeploy).

export const EMAILS_PLACEHOLDER = "__ALLOWED_EMAILS__";

// Strict on purpose: the value is pasted inside a rules string literal, so no quotes, spaces or brackets.
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/** Parses ALLOWED_EMAILS ("a@x.com, b@y.com"); throws when empty or when an entry is not a plain email. */
export function parseEmails(raw: string | undefined): string[] {
  const emails = [...new Set((raw ?? "").split(/[\s,]+/).filter(Boolean))];
  if (emails.length === 0) throw new Error("ALLOWED_EMAILS is empty: set it in .env (see .env.example)");
  const bad = emails.filter((e) => !EMAIL.test(e));
  if (bad.length > 0) throw new Error(`ALLOWED_EMAILS: not an email: ${bad.join(", ")}`);
  return emails;
}

export function renderRules(template: string, emails: string[]): string {
  const parts = template.split(EMAILS_PLACEHOLDER);
  if (parts.length !== 2) throw new Error(`the rules template must contain ${EMAILS_PLACEHOLDER} exactly once`);
  return parts.join(emails.map((e) => `'${e}'`).join(", "));
}
