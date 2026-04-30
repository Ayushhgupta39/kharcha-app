import { create } from 'zustand';
import {
  deleteTransaction,
  insertTransaction,
  listTransactions,
  updateTransaction,
  type Transaction,
  type TxSource,
} from '../db/transactions';
import { setMerchantCategory } from '../db/merchantMap';

type Filters = {
  from?: string;
  to?: string;
  category?: string;
  source?: TxSource;
  bank?: string;
  search?: string;
};

type State = {
  transactions: Transaction[];
  loading: boolean;
  filters: Filters;
};

type Actions = {
  refresh: (filters?: Filters) => Promise<void>;
  setFilters: (patch: Partial<Filters>) => Promise<void>;
  clearFilters: () => Promise<void>;
  add: (
    tx: Omit<Transaction, 'id'> & { id?: string }
  ) => Promise<Transaction | null>;
  update: (
    id: string,
    patch: Partial<Omit<Transaction, 'id'>>,
    opts?: { rememberMerchantCategory?: boolean }
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useTransactions = create<State & Actions>((set, get) => ({
  transactions: [],
  loading: false,
  filters: {},
  async refresh(filters) {
    set({ loading: true });
    const fs = filters ?? get().filters;
    const list = await listTransactions(fs);
    set({ transactions: list, loading: false, filters: fs });
  },
  async setFilters(patch) {
    const next = { ...get().filters, ...patch };
    await get().refresh(next);
  },
  async clearFilters() {
    await get().refresh({});
  },
  async add(tx) {
    const inserted = await insertTransaction(tx);
    await get().refresh();
    return inserted;
  },
  async update(id, patch, opts) {
    await updateTransaction(id, patch);
    if (opts?.rememberMerchantCategory && patch.category) {
      const cur = get().transactions.find((t) => t.id === id);
      if (cur?.merchant) {
        await setMerchantCategory(cur.merchant, patch.category);
      }
    }
    await get().refresh();
  },
  async remove(id) {
    await deleteTransaction(id);
    await get().refresh();
  },
}));
