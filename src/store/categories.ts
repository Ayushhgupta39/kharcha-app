import { create } from 'zustand';
import { deleteCustomCategory, insertCustomCategory, listCustomCategories } from '../db/categories';
import { BUILTIN_CATEGORIES, type Category } from '../lib/categories';

type State = {
  customs: Category[];
  all: Category[];
};

type Actions = {
  refresh: () => Promise<void>;
  add: (c: { key: string; label: string; glyph: string }) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

export const useCategories = create<State & Actions>((set) => ({
  customs: [],
  all: BUILTIN_CATEGORIES,
  async refresh() {
    const customs = await listCustomCategories();
    set({ customs, all: [...BUILTIN_CATEGORIES, ...customs] });
  },
  async add(c) {
    await insertCustomCategory(c);
    const customs = await listCustomCategories();
    set({ customs, all: [...BUILTIN_CATEGORIES, ...customs] });
  },
  async remove(key) {
    await deleteCustomCategory(key);
    const customs = await listCustomCategories();
    set({ customs, all: [...BUILTIN_CATEGORIES, ...customs] });
  },
}));
