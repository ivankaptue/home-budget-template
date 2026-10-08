import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "./env";
import { parseEmails, renderRules } from "./rules";

loadEnv();
const emails = parseEmails(process.env.ALLOWED_EMAILS);
const template = readFileSync("firebase/firestore.template.rules", "utf8");
writeFileSync("firebase/firestore.rules", renderRules(template, emails));
console.log(`✓ firebase/firestore.rules (${emails.length} allowed emails)`);
