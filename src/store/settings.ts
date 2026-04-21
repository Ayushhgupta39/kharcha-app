import { create } from 'zustand';
import { getSetting, setSetting } from '../db/settings';

type State = {
  onboarded: boolean;
  smsEnabled: boolean;
  autoCategorise: boolean;
  scanDepthDays: number;
  lastScanEpoch: number;
};

type Actions = {
  load: () => Promise<void>;
  setOnboarded: (v: boolean) => Promise<void>;
  setSmsEnabled: (v: boolean) => Promise<void>;
  setAutoCategorise: (v: boolean) => Promise<void>;
  setScanDepthDays: (d: number) => Promise<void>;
  setLastScan: (ms: number) => Promise<void>;
};

export const useSettings = create<State & Actions>((set) => ({
  onboarded: false,
  smsEnabled: false,
  autoCategorise: true,
  scanDepthDays: 90,
  lastScanEpoch: 0,
  async load() {
    const [onb, sms, auto, depth, ls] = await Promise.all([
      getSetting('onboarded'),
      getSetting('smsEnabled'),
      getSetting('autoCategorise'),
      getSetting('scanDepthDays'),
      getSetting('lastScanEpoch'),
    ]);
    set({
      onboarded: onb === '1',
      smsEnabled: sms === '1',
      autoCategorise: auto == null ? true : auto === '1',
      scanDepthDays: depth ? Number(depth) : 90,
      lastScanEpoch: ls ? Number(ls) : 0,
    });
  },
  async setOnboarded(v) {
    await setSetting('onboarded', v ? '1' : '0');
    set({ onboarded: v });
  },
  async setSmsEnabled(v) {
    await setSetting('smsEnabled', v ? '1' : '0');
    set({ smsEnabled: v });
  },
  async setAutoCategorise(v) {
    await setSetting('autoCategorise', v ? '1' : '0');
    set({ autoCategorise: v });
  },
  async setScanDepthDays(d) {
    await setSetting('scanDepthDays', String(d));
    set({ scanDepthDays: d });
  },
  async setLastScan(ms) {
    await setSetting('lastScanEpoch', String(ms));
    set({ lastScanEpoch: ms });
  },
}));
