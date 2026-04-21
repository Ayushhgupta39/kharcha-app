import { Platform, PermissionsAndroid } from 'react-native';

// SMS read is Android-only. iOS does not expose inbox access.
// On Android, `react-native-get-sms-android` is the common bridge used in
// production. It must be installed via a dev/prebuild flow (not Expo Go).
//
// This module dynamically requires the native bridge so the app still boots
// on iOS and inside Expo Go (where the bridge won't be present).

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SmsAndroid = require('react-native-get-sms-android');
    return SmsAndroid?.default ?? SmsAndroid;
  } catch {
    return null;
  }
}

export async function readSmsSince(sinceEpochMs: number): Promise<RawSms[]> {
  const bridge = loadNativeBridge();
  if (!bridge) return [];
  return new Promise<RawSms[]>((resolve) => {
    const filter = {
      box: 'inbox',
      minDate: sinceEpochMs,
      maxCount: 500,
    };
    bridge.list(
      JSON.stringify(filter),
      () => resolve([]),
      (_count: number, raw: string) => {
        try {
          const arr = JSON.parse(raw);
          resolve(Array.isArray(arr) ? arr : []);
        } catch {
          resolve([]);
        }
      }
    );
  });
}
