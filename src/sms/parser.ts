import { lookupMerchantCategory } from './merchantMap';

export type ParsedSms = {
  amount: number; // paise
  merchant: string;
  bank: string | null;
  category: string;
  date: string; // ISO
  raw: string;
  hash: string;
  kind: 'debit' | 'credit';
};

// Heuristics for common Indian bank SMS formats.
// Covers HDFC, ICICI, Axis, SBI, Kotak, IndusInd, Yes, Federal, plus UPI alerts.

const CREDIT_KEYWORDS =
  /\b(credited|received|deposit(ed)?|refund(ed)?|salary)\b/i;
const DEBIT_KEYWORDS =
  /\b(debited|spent|withdrawn|paid|purchased|charged|txn of|deducted|transaction of|transaction for|is successful|has been processed)\b/i;

// Non-expense SMS — OTP, balance enquiry, reminders, etc.
const NOISE_KEYWORDS =
  /\b(otp|verification code|balance|bal is|available balance|e-?statement|mini statement|reminder|due|bill amount|payment due|credit limit|interest rate)\b/i;

// Amount patterns like "Rs.1,234.56", "INR 1234", "₹1,234"
const AMOUNT_RE =
  /(?:rs\.?|inr|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i;

const MERCHANT_AT_RE =
  /(?:\bat\s+|\bto\s+|\bfor\s+|\bvia\s+upi\s+to\s+|\btowards\s+|\bon\s+)([A-Z0-9@\-.\s&/*]{2,60}?)(?=\s+on\s|\s+ref|\s+txn|\s+upi|\s+is\s|\s+\-|\s+avl|\s+a\/c|\s+\(|\.|\n|$)/i;

const DATE_RE = /\b([0-3]?\d[-/][0-1]?\d[-/](?:20)?\d{2}|(?:on\s+)?\d{2}-[A-Z]{3}-\d{2,4})/i;

function parseAmount(raw: string): number | null {
  const m = raw.match(AMOUNT_RE);
  if (!m) return null;
  const num = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function parseMerchant(raw: string): string {
  const m = raw.match(MERCHANT_AT_RE);
  if (!m) return 'Unknown';
  let s = m[1].trim();
  s = s.replace(/^UPI\s*[-/:]?\s*/i, '');
  s = s.replace(/@[a-z]+$/i, '');
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/[\s*\-.]+$/, '');
  s = s.slice(0, 40);
  return s || 'Unknown';
}

function parseBank(raw: string, sender?: string | null): string | null {
  if (sender) {
    const m = sender.match(/([A-Z]{4,})/);
    if (m) return m[1];
  }
  const banks = [
    'HDFC',
    'ICICI',
    'AXIS',
    'SBI',
    'KOTAK',
    'YES',
    'INDUSIND',
    'IDFC',
    'RBL',
    'FEDERAL',
    'SLICE',
    'ONECARD',
    'SCAPIA',
    'NIYO',
    'CANARA',
    'PNB',
    'BOB',
    'BOI',
    'IOB',
    'UCO',
  ];
  const up = raw.toUpperCase();
  for (const b of banks) {
    if (up.includes(b)) return b;
  }
  return null;
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(36);
}

export function parseSms(
  raw: string,
  opts: { sender?: string | null; receivedAt?: string | number | Date } = {}
): ParsedSms | null {
  if (!raw || raw.length < 15) return null;
  if (NOISE_KEYWORDS.test(raw)) return null;

  const isDebit = DEBIT_KEYWORDS.test(raw);
  const isCredit = CREDIT_KEYWORDS.test(raw);
  if (!isDebit && !isCredit) return null;

  const amount = parseAmount(raw);
  if (!amount) return null;

  const merchant = parseMerchant(raw);
  const bank = parseBank(raw, opts.sender ?? null);
  const category =
    lookupMerchantCategory(merchant) ??
    (isCredit ? 'transfer' : 'other');
  const date = new Date(
    opts.receivedAt ?? Date.now()
  ).toISOString();

  return {
    amount,
    merchant,
    bank,
    category,
    date,
    raw,
    hash: djb2(raw.trim()),
    kind: isDebit ? 'debit' : 'credit',
  };
}
