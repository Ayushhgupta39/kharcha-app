import { create } from 'zustand';
import {
  countPending,
  listPending,
  markConfirmed,
  markIgnored,
  updatePending,
  type PendingSms,
} from '../db/pending';
import { insertTransaction } from '../db/transactions';
import { setMerchantCategory } from '../db/merchantMap';
import { useTransactions } from './transactions';

type State = {
  pending: PendingSms[];
  count: number;
  loading: boolean;
};

type Actions = {
  refresh: () => Promise<void>;
  confirm: (
    id: string,
    overrides?: Partial<Pick<PendingSms, 'amount' | 'merchant' | 'category'>>
  ) => Promise<void>;
  ignore: (id: string) => Promise<void>;
  editPending: (
    id: string,
    patch: Partial<Pick<PendingSms, 'amount' | 'merchant' | 'category'>>
  ) => Promise<void>;
};

export const usePending = create<State & Actions>((set, get) => ({
  pending: [],
  count: 0,
  loading: false,
  async refresh() {
    set({ loading: true });
    const [list, n] = await Promise.all([listPending(), countPending()]);
    set({ pending: list, count: n, loading: false });
  },
  async confirm(id, overrides) {
    const p = get().pending.find((x) => x.id === id);
    if (!p) return;
    const amount = overrides?.amount ?? p.amount;
    const merchant = overrides?.merchant ?? p.merchant;
    const category = overrides?.category ?? p.category;
    await insertTransaction({
      amount,
      merchant,
      category,
      date: p.date,
      source: 'sms',
      bank: p.bank,
      raw_sms: p.raw_sms,
    });
    if (overrides?.category && overrides.category !== p.category) {
      await setMerchantCategory(merchant, overrides.category);
    }
    await markConfirmed(id);
    await get().refresh();
    await useTransactions.getState().refresh();
  },
  async ignore(id) {
    await markIgnored(id);
    await get().refresh();
  },
  async editPending(id, patch) {
    await updatePending(id, patch);
    await get().refresh();
  },
}));
