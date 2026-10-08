import type { Budget, Item } from "./types";

export const P = (id: string, budget: number | null, extra: Partial<Item> = {}): Item => ({
  id, label: id, budget, type: "variable", nature: "expense", ...extra,
});

/** v2 budget shape (three envelopes, a transfer, leftover to savings) with made-up round numbers (cents). */
export const v2Budget = (effectiveFrom: string, alim = 60000): Budget => ({
  effectiveFrom,
  envelopes: [
    {
      id: "principal", label: "Budget principal", income: 400000, categories: [
        { id: "maison", label: "Maison", items: [P("loyer", 180000, { type: "fixed" })] },
        { id: "courant", label: "Vie courante", items: [P("alimentation", alim)] },
        { id: "epargne", label: "Épargne", items: [P("epargne", 25000, { type: "fixed", nature: "savings" })] },
      ],
    },
    {
      id: "secondaire", label: "Revenu secondaire", income: 100000, categories: [
        {
          id: "secondaire", label: "Répartition", items: [
            P("reserve", 40000, { type: "fixed", nature: "savings" }),
            P("transport", 35000, { type: "fixed" }),
            P("courses", 15000, { type: "fixed", transferTo: "alimentation" }),
            P("projets", 10000, { type: "fixed", nature: "savings" }),
          ],
        },
      ],
    },
    {
      id: "appoint", label: "Revenu d’appoint", income: 50000, categories: [
        { id: "loisirs", label: "Loisirs", items: [P("loisirs", 50000, { leftoverToSavings: true })] },
      ],
    },
  ],
  annualItems: [P("assurance", 12000, { type: "fixed" }), P("vacances", null), P("placement", 40000, { nature: "savings" })],
});
