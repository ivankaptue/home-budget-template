/** Short chip label for an envelope (budget JSON `shortLabel`), shared between MonthView and ReportView. */
export function chipLabel(env: { label: string; shortLabel?: string }): string {
  return env.shortLabel ?? env.label;
}
