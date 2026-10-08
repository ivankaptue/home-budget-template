import { formatMoney } from "../domain/money";
import type { Cents } from "../domain/types";
import { hideAmounts } from "./state";

export const MASKED_AMOUNT = "•••• $";

/** Amount as displayed: formatted, or masked while the privacy screen is on (reading the signal re-renders on toggle). */
export function money(cents: Cents): string {
  return hideAmounts.value ? MASKED_AMOUNT : formatMoney(cents);
}
