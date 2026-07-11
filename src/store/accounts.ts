import { create } from 'zustand';
import {
  deleteAccount,
  listAccounts,
  setFavorite,
  updateAccount,
  upsertAccount,
  type Account,
  type AccountType,
} from '../db/accounts';

type EditFields = {
  name: string;
  type: AccountType;
  account_no?: string | null;
  notes?: string | null;
  opening_balance?: number;
};

type State = {
  accounts: Account[];
};

type Actions = {
  refresh: () => Promise<void>;
  add: (a: Omit<Account, 'id'> & { id?: string }) => Promise<Account>;
  update: (id: string, fields: EditFields) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setFav: (id: string, favorite: boolean) => Promise<void>;
};

export const useAccounts = create<State & Actions>((set) => ({
  accounts: [],
  async refresh() {
    const accounts = await listAccounts();
    set({ accounts });
  },
  async add(a) {
    const acc = await upsertAccount(a);
    const accounts = await listAccounts();
    set({ accounts });
    return acc;
  },
  async update(id, fields) {
    await updateAccount(id, fields);
    const accounts = await listAccounts();
    set({ accounts });
  },
  async remove(id) {
    await deleteAccount(id);
    const accounts = await listAccounts();
    set({ accounts });
  },
  async setFav(id, favorite) {
    await setFavorite(id, favorite);
    const accounts = await listAccounts();
    set({ accounts });
  },
}));
