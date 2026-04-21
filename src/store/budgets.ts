import { create } from 'zustand';
import {
  deleteBudget,
  listBudgets,
  upsertBudget,
  type Budget,
} from '../db/budgets';

type State = {
  budgets: Budget[];
};

type Actions = {
  refresh: () => Promise<void>;
  save: (b: Omit<Budget, 'id'> & { id?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useBudgets = create<State & Actions>((set) => ({
  budgets: [],
  async refresh() {
    const budgets = await listBudgets();
    set({ budgets });
  },
  async save(b) {
    await upsertBudget(b);
    const budgets = await listBudgets();
    set({ budgets });
  },
  async remove(id) {
    await deleteBudget(id);
    const budgets = await listBudgets();
    set({ budgets });
  },
}));
