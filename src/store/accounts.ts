import { create } from 'zustand';
import {
  deleteAccount,
  listAccounts,
  setFavorite,
  upsertAccount,
  type Account,
} from '../db/accounts';

type State = {
  accounts: Account[];
};

type Actions = {
  refresh: () => Promise<void>;
  add: (a: Omit<Account, 'id'> & { id?: string }) => Promise<Account>;
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
