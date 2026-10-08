import { expect, test } from "vitest";
import { toCsv } from "./csv";

test("CSV has a header, dollars with a dot and escaped notes", () => {
  const csv = toCsv([
    { id: "e1", date: "2026-10-03", month: "2026-10", scope: "monthly", kind: "expense", item: "alimentation", amount: 8450, note: 'Épicerie "Chez Paul", centre', by: "u1" },
    { id: "e2", date: "2026-10-04", month: "2026-10", scope: "monthly", kind: "check", item: "loyer", amount: 180000, note: "", by: "u2" },
  ]);
  expect(csv.split("\n")).toEqual([
    "id,date,month,scope,kind,item,amount,note,by",
    'e1,2026-10-03,2026-10,monthly,expense,alimentation,84.50,"Épicerie ""Chez Paul"", centre",u1',
    "e2,2026-10-04,2026-10,monthly,check,loyer,1800.00,,u2",
  ]);
});
