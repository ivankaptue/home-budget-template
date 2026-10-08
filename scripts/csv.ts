export interface ExportRow {
  id: string; date: string; month: string; scope: string; kind: string;
  item: string; amount: number; note: string; by: string;
}

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(rows: ExportRow[]): string {
  const header = "id,date,month,scope,kind,item,amount,note,by";
  const lines = rows.map((r) =>
    [r.id, r.date, r.month, r.scope, r.kind, r.item, (r.amount / 100).toFixed(2), r.note, r.by].map(cell).join(","),
  );
  return [header, ...lines].join("\n");
}
