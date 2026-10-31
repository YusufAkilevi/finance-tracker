import { describe, expect, it } from "vitest";
import { expenseCategories } from "../src/lib/finance";
import type { FinanceState } from "../src/types";

describe("expense categories", () => {
  it("offers food delivery separately from eating out", () => {
    const categories = expenseCategories({ expenses: [] } as unknown as FinanceState);

    expect(categories).toContain("Dışarıda Yemek");
    expect(categories).toContain("Yemek Siparişi");
  });
});
