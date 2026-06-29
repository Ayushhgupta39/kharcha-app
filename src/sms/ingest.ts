import { insertPending } from '../db/pending';
import { getMerchantCategory } from '../db/merchantMap';
import { insertTransaction } from '../db/transactions';
import { listAccounts, resolveAccountId } from '../db/accounts';
import { parseSms } from './parser';
import { readSmsSince, SMS_SUPPORTED } from './reader';
import { useSettings } from '../store/settings';

export async function scanInboxAndEnqueue(
  sinceEpochMs: number
): Promise<{ scanned: number; enqueued: number }> {
  if (!SMS_SUPPORTED) return { scanned: 0, enqueued: 0 };
  const raws = await readSmsSince(sinceEpochMs);
  const manualApprove = useSettings.getState().manualApprove;
  const defaultAccountId = useSettings.getState().defaultAccountId;
  const accounts = manualApprove ? [] : await listAccounts();
  let enqueued = 0;
  let parsedCount = 0;
  let sampleLogged = 0;
  for (const s of raws) {
    const parsed = parseSms(s.body, {
      sender: s.address,
      receivedAt: s.date ?? Date.now(),
    });
    if (!parsed) {
      if (sampleLogged < 5) {
        sampleLogged++;
      }
      continue;
    }
    parsedCount++;
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
        type: parsed.kind,
        kind: parsed.kind === 'credit' ? 'income' : 'expense',
        merchant: parsed.merchant,
        category,
        date: parsed.date,
        source: 'sms',
        bank: parsed.bank,
        account_id: resolveAccountId(accounts, defaultAccountId, parsed.bank),
        raw_sms: parsed.raw,
        sms_hash: parsed.hash,
      });
      if (inserted) enqueued++;
    }
  }
  return { scanned: raws.length, enqueued };
}
