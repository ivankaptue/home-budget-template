import { existsSync } from "node:fs";

/** Loads `.env` into process.env when the file exists; variables already set (CI) take precedence. */
export function loadEnv(file = ".env"): void {
  if (existsSync(file)) process.loadEnvFile(file);
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set: add it to .env (see .env.example)`);
  return value;
}
