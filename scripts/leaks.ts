// Safety net for `npm run share`: personal values from .env must not appear in the shared copy.

const list = (raw: string | undefined) => (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export function forbiddenTerms(env: Record<string, string | undefined>): string[] {
  return [
    ...list(env.ALLOWED_EMAILS),
    ...[env.VITE_FIREBASE_PROJECT_ID, env.VITE_FIREBASE_API_KEY, env.VITE_FIREBASE_APP_ID, env.VITE_APP_TAGLINE]
      .map((v) => v?.trim() ?? "").filter(Boolean),
    ...list(env.SHARE_FORBIDDEN),
  ];
}

export type Leak = { path: string; term: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word, case-insensitive matches (« relevé » does not leak « Eve »). */
export function findLeaks(files: { path: string; text: string }[], terms: string[]): Leak[] {
  const patterns = terms.map((term) => [term, new RegExp(`(?<![\\p{L}\\p{N}_])${escape(term)}(?![\\p{L}\\p{N}_])`, "iu")] as const);
  return files.flatMap(({ path, text }) => patterns.filter(([, re]) => re.test(text)).map(([term]) => ({ path, term })));
}
