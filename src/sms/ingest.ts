import { insertPending } from '../db/pending';
import { getMerchantCategory } from '../db/merchantMap';
import { insertTransaction } from '../db/transactions';
import { parseSms } from './parser';
import { readSmsSince, SMS_SUPPORTED } from './reader';
import { useSettings } from '../store/settings';

export async function scanInboxAndEnqueue(
  sinceEpochMs: number
): Promise<{ scanned: number; enqueued: number }> {
  if (!SMS_SUPPORTED) return { scanned: 0, enqueued: 0 };
  const raws = await readSmsSince(sinceEpochMs);
  const manualApprove = useSettings.getState().manualApprove;
  let enqueued = 0;
  for (const s of raws) {
    const parsed = parseSms(s.body, {
      sender: s.address,
      receivedAt: s.date ?? Date.now(),
    });
    if (!parsed || parsed.kind !== 'debit') continue;
    const userCat = await getMerchantCategory(parsed.merchant);
    const category = userCat ?? parsed.category;
    if (manualApprove) {
      const inserted = await insertPending({
        amount: parsed.amount,
        merchant: parsed.merchant,
        category,
        date: parsed.date,
        bank: parsed.bank,
        raw_sms: parsed.raw,
        sms_hash: parsed.hash,
      });
      if (inserted) enqueued++;
    } else {
      const inserted = await insertTransaction({
        amount: parsed.amount,
        merchant: parsed.merchant,
        category,
        date: parsed.date,
        source: 'sms',
        bank: parsed.bank,
        raw_sms: parsed.raw,
        sms_hash: parsed.hash,
      });
      if (inserted) enqueued++;
    }
  }
  return { scanned: raws.length, enqueued };
}
