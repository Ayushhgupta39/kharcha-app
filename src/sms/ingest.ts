import { insertPending } from '../db/pending';
import { getMerchantCategory } from '../db/merchantMap';
import { parseSms } from './parser';
import { readSmsSince, SMS_SUPPORTED } from './reader';

/**
 * Pull SMSes from the inbox (Android only), parse them, and enqueue
 * debits into pending_sms for the user to review. Returns count enqueued.
 */
export async function scanInboxAndEnqueue(
  sinceEpochMs: number
): Promise<{ scanned: number; enqueued: number }> {
  if (!SMS_SUPPORTED) return { scanned: 0, enqueued: 0 };
  const raws = await readSmsSince(sinceEpochMs);
  let enqueued = 0;
  for (const s of raws) {
    const parsed = parseSms(s.body, {
      sender: s.address,
      receivedAt: s.date ?? Date.now(),
    });
    if (!parsed || parsed.kind !== 'debit') continue;
    // user override
    const userCat = await getMerchantCategory(parsed.merchant);
    const inserted = await insertPending({
      amount: parsed.amount,
      merchant: parsed.merchant,
      category: userCat ?? parsed.category,
      date: parsed.date,
      bank: parsed.bank,
      raw_sms: parsed.raw,
      sms_hash: parsed.hash,
    });
    if (inserted) enqueued++;
  }
  return { scanned: raws.length, enqueued };
}
