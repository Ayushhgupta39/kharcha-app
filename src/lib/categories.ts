export type CategoryKey =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'bills'
  | 'groceries'
  | 'fuel'
  | 'entertainment'
  | 'health'
  | 'transfer'
  | 'other'
  | 'salary'
  | 'freelance'
  | 'refund'
  | 'investment'
  | 'rental'
  | 'income_other'
  | 'invest'
  | 'lent';

export type Category = {
  key: string;
  label: string;
  glyph: string;
  builtin: boolean;
};

export const BUILTIN_EXPENSE_CATEGORIES: Category[] = [
  { key: 'food', label: 'Food', glyph: '◔', builtin: true },
  { key: 'transport', label: 'Transport', glyph: '◑', builtin: true },
  { key: 'shopping', label: 'Shopping', glyph: '◕', builtin: true },
  { key: 'bills', label: 'Bills', glyph: '◼', builtin: true },
  { key: 'groceries', label: 'Groceries', glyph: '◆', builtin: true },
  { key: 'fuel', label: 'Fuel', glyph: '▲', builtin: true },
  { key: 'entertainment', label: 'Fun', glyph: '◈', builtin: true },
  { key: 'health', label: 'Health', glyph: '＋', builtin: true },
  { key: 'transfer', label: 'Transfer', glyph: '⇄', builtin: true },
  { key: 'other', label: 'Other', glyph: '○', builtin: true },
];

export const BUILTIN_INCOME_CATEGORIES: Category[] = [
  { key: 'salary', label: 'Salary', glyph: '◈', builtin: true },
  { key: 'freelance', label: 'Freelance', glyph: '◕', builtin: true },
  { key: 'refund', label: 'Refund', glyph: '⇄', builtin: true },
  { key: 'investment', label: 'Investment', glyph: '▲', builtin: true },
  { key: 'rental', label: 'Rental', glyph: '◼', builtin: true },
  { key: 'income_other', label: 'Income', glyph: '○', builtin: true },
];

// Outflow categories tracked via transaction `kind`, not the income arrays.
// Invest deducts from income but is reported separately from expenses; Lent is
// a plain outflow that the user expects back.
export const BUILTIN_SPECIAL_CATEGORIES: Category[] = [
  { key: 'invest', label: 'Invest', glyph: '⬡', builtin: true },
  { key: 'lent', label: 'Lent', glyph: '◇', builtin: true },
];

export const BUILTIN_CATEGORIES: Category[] = [
  ...BUILTIN_EXPENSE_CATEGORIES,
  ...BUILTIN_INCOME_CATEGORIES,
  ...BUILTIN_SPECIAL_CATEGORIES,
];

export const CATEGORY_BY_KEY: Record<string, Category> = Object.fromEntries(
  BUILTIN_CATEGORIES.map((c) => [c.key, c])
);

export function getCategory(key: string, customs: Category[] = []): Category {
  return (
    CATEGORY_BY_KEY[key] ??
    customs.find((c) => c.key === key) ?? {
      key,
      label: key,
      glyph: '○',
      builtin: false,
    }
  );
}
