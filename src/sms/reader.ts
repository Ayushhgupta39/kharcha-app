import { Platform, PermissionsAndroid } from 'react-native';

export const SMS_SUPPORTED = Platform.OS === 'android';

export type RawSms = {
  _id?: number | string;
  address?: string; // sender
  body: string;
  date?: number; // epoch ms
};

export async function ensureSmsPermission(): Promise<boolean> {
  if (!SMS_SUPPORTED) return false;
  try {
    const read = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS
    );
    if (read) return true;
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    return (
      granted[PermissionsAndroid.PERMISSIONS.READ_SMS] ===
      PermissionsAndroid.RESULTS.GRANTED
    );
  } catch {
    return false;
  }
}

function loadNativeBridge(): any | null {
  if (!SMS_SUPPORTED) return null;
  try {
    const SmsAndroid = require('react-native-get-sms-android');
    return SmsAndroid?.default ?? SmsAndroid;
  } catch {
    return null;
  }
}

type TraiCategory = 'transactional' | 'service' | 'promotional' | 'government' | 'unknown';

function traiCategory(address: string): TraiCategory {
  if (!address.includes('-')) return 'unknown';
  const parts = address.toUpperCase().split('-');
  const suffix = parts[parts.length - 1];
  if (suffix === 'T') return 'transactional';
  if (suffix === 'S') return 'service';
  if (suffix === 'P') return 'promotional';
  if (suffix === 'G') return 'government';
  return 'unknown';
}

function isFinancialSender(address: string | undefined): boolean {
  if (!address) return true;
  const clean = address.replace(/\s/g, '');
  if (/^\+?91?\d{10}$/.test(clean)) return false;
  if (/^\d+$/.test(clean)) return false;
  return /^[A-Z]{2}-[A-Z]/i.test(clean);
}

export async function readSmsSince(sinceEpochMs: number): Promise<RawSms[]> {
  const bridge = loadNativeBridge();
  if (!bridge) return [];

  return new Promise<RawSms[]>((resolve) => {
    const filter = { box: 'inbox', minDate: sinceEpochMs, maxCount: 500 };
    bridge.list(
      JSON.stringify(filter),
      () => resolve([]),
      (_count: number, raw: string) => {
        try {
          const arr: RawSms[] = JSON.parse(raw);
          if (!Array.isArray(arr)) { resolve([]); return; }

          const filtered = arr.filter(s => {
            const addr = s.address ?? '';
            // Drop promotional SMS immediately — TRAI guarantee
            if (traiCategory(addr) === 'promotional') return false;
            // Keep only financial senders
            return isFinancialSender(addr);
          });

          resolve(filtered);
        } catch {
          resolve([]);
        }
      }
    );
  });
}
