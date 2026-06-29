import { getTransactionInfo } from 'transaction-sms-parser';
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

type TraiSuffix = 'T' | 'S' | 'P' | 'G' | null;

const ENTITY_MAP: Record<string, string> = {
  // Public sector banks
  SBIINB: 'SBI',
  SBIBNK: 'SBI',
  SBIUPI: 'SBI',
  SBI: 'SBI',
  PNBSMS: 'PNB',
  PNB: 'PNB',
  BOBSMS: 'BOB',
  BOB: 'BOB',
  BOISMS: 'BOI',
  BOI: 'BOI',
  CANBNK: 'CANARA',
  CANARA: 'CANARA',
  UNIONB: 'UNION',
  UNION: 'UNION',
  CENTBK: 'CENTRAL',
  CENTRAL: 'CENTRAL',
  UCOBK: 'UCO',
  UCO: 'UCO',
  IOBSMS: 'IOB',
  IOB: 'IOB',
  // Private banks
  HDFCBK: 'HDFC',
  HDFC: 'HDFC',
  ICICIB: 'ICICI',
  ICICI: 'ICICI',
  AXISBK: 'AXIS',
  AXIS: 'AXIS',
  KOTAKB: 'KOTAK',
  KOTAK: 'KOTAK',
  YESBK: 'YES',
  YESBNK: 'YES',
  YES: 'YES',
  IDFCBK: 'IDFC',
  IDFC: 'IDFC',
  RBLBNK: 'RBL',
  RBL: 'RBL',
  FEDERAL: 'FEDERAL',
  INDBNK: 'INDUSIND',
  INDUSIND: 'INDUSIND',
  SCBANK: 'SCAPIA',
  SCAPIA: 'SCAPIA',
  BANDHN: 'BANDHAN',
  BANDHAN: 'BANDHAN',
  AUSFIN: 'AU',
  AU: 'AU',
  // Neo-banks / fintech
  SLICEIT: 'SLICE',
  SLCEIT: 'SLICE',
  SLICE: 'SLICE',
  ONECRD: 'ONECARD',
  ONECARD: 'ONECARD',
  NIYO: 'NIYO',
  // UPI / wallets
  PAYTMB: 'PAYTM',
  PAYTM: 'PAYTM',
  PHNPAY: 'PHONEPE',
  PHONEPE: 'PHONEPE',
  GPAY: 'GPAY',
  AIRTLM: 'AIRTEL',
  AIRTEL: 'AIRTEL',
};

const ENTITY_KEYS = Object.keys(ENTITY_MAP).sort((a, b) => b.length - a.length);

type SenderInfo = {
  suffix: TraiSuffix;
  bank: string | null; // resolved display name, e.g. "HDFC"
  isFinancial: boolean;
};

function parseSender(address: string | null | undefined): SenderInfo {
  if (!address) return { suffix: null, bank: null, isFinancial: true };

  if (/^\+?91?\d{10}$/.test(address.replace(/\s/g, ''))) {
    return { suffix: null, bank: null, isFinancial: false };
  }

  const up = address.toUpperCase();
  const segments = up.split('-');
  const lastSeg = segments[segments.length - 1];
  const suffix: TraiSuffix =
    lastSeg.length === 1 && /^[TSPG]$/.test(lastSeg) ? (lastSeg as TraiSuffix) : null;

  let bank: string | null = null;
  for (const key of ENTITY_KEYS) {
    if (up.includes(key)) {
      bank = ENTITY_MAP[key];
      break;
    }
  }

  // Only TRAI-format senders pass: exactly XX-[A-Z]... (2-letter prefix, dash, alpha body)
  const isFinancial = /^[A-Z]{2}-[A-Z]/i.test(up);
  return { suffix, bank, isFinancial };
}

const BODY_NOISE: RegExp[] = [
  /\botp\b/i,
  /\bverification\s*code\b/i,
  /offer(s)?\s+(valid|expires?|avail)/i,
  /\bkindly\s+(clear|pay|settle)\b/i,
  /\bloan\s+(offer|approv|disburse)/i,
  /apply\s+now/i,
  // Non-transaction service/notice messages
  /\backnowledgement\b/i,
  /\busage\s*&?\s*transaction\s+limit\b/i,
  /\byour\s+request\b/i,
  /\bhas\s+been\s+updated\b/i,
  /\bdue\s+(date|amount)\b/i,
  /\bminimum\s+(amount|due)\b/i,
  /\bstatement\s+(generated|ready|available)\b/i,
  // Promotional / marketing cues — telco recharge offers, etc.
  /\b(recharge|prepaid|postpaid)\s+(now|today|offer|plan|pack)\b/i,
  /\bspecial\s+offer\b/i,
  /\bvalid\s+(till|until|upto)\b/i,
  /\bavail\s+\d{1,3}\s*%/i,
  /\bget\s+\d+\s*gb\b/i,
  // Bill/tax notices that are reminders, not deductions
  /\bplease\s+ignore\s+if\s+(already\s+)?paid\b/i,
  /\bmake\s+payment\s+to\s+avail\b/i,
  /\bproperty\s+tax\b/i,
  /\bnagar\s+nigam\b/i,
  /\bmunicipal(ity)?\b/i,
  /\bfor\s+fy\s*\d{2,4}/i,
  /\bpid\s+[A-Z0-9]{6,}/i,
  // Short-link URLs are strong promo indicators; banks never include them
  /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|rb\.gy|ow\.ly)\b/i,
  // Merchant order/booking confirmations (Zepto/Swiggy/etc. own SMS, not bank)
  /\border\s+[A-Z0-9]{6,}\b/i,
  /\bconfirmed\s+as\s+cod\b/i,
  /\bcash\s+on\s+delivery\b/i,
  /\bout\s+for\s+delivery\b/i,
];

// Devanagari range — Hindi/Marathi etc. Banks send transaction SMS in English / Latin.
// Promotional SMS in Hindi (telco recharge, etc.) commonly carry ₹ amounts and slip
// past the English noise patterns. If the body is mostly Devanagari, treat as non-txn.
const DEVANAGARI_RE = /[ऀ-ॿ]/;
function isMostlyDevanagari(body: string): boolean {
  const letters = body.match(/[A-Za-zऀ-ॿ]/g);
  if (!letters || letters.length === 0) return false;
  const dev = letters.filter((c) => DEVANAGARI_RE.test(c)).length;
  return dev / letters.length > 0.3;
}

// Real bank/card txn SMS almost always include one of these structural markers.
// If none are present AND no explicit debit/credit verb was found, the SMS is
// probably a notice/promo that just happens to mention an amount.
const TXN_STRUCTURE_RE = [
  /\bA\/?[Cc]\b/, // A/c, A/C, AC
  /\bacc(?:oun)?t\b/i,
  /\bcard\b/i,
  /\b(?:xx+|x{2,}|\*{2,})\d{3,}\b/, // masked card/account tail e.g. xxxx1234
  /\bUPI\b/i,
  /\bIMPS\b/i,
  /\bNEFT\b/i,
  /\bRTGS\b/i,
  /\bbal(?:ance)?\b/i,
  /\bavl\s*bal\b/i,
  /\btxn\s*(?:id|ref|no)\b/i,
  /\bref(?:erence)?\s*(?:no|id|#)\b/i,
];
function hasTxnStructure(body: string): boolean {
  return TXN_STRUCTURE_RE.some((r) => r.test(body));
}

const AMOUNT_RE = /(?:Rs\.?\s*|INR\s*|₹\s*)([0-9,]+(?:\.[0-9]{1,2})?)/i;

function extractAmount(body: string): number | null {
  const m = body.match(AMOUNT_RE);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const DEBIT_SIGNALS = [
  /\b(debited|debit|spent|purchase|charged|withdrawn)\b/i,
  // "transaction of/for/at" and standalone "transaction" (e.g. "credit card transaction of Rs X")
  /\b(transaction|txn)\b/i,
  /\bdr\.?\b/i,
  // "used on", "successful" spend confirmations
  /\bis\s+successful\b/i,
];
// Unambiguous credit signals — past tense or explicit incoming money words
// NOTE: "credit" alone is NOT here because "credit card" is a payment instrument, not a direction
const CREDIT_SIGNALS_STRONG = [
  /\b(credited|deposited|cashback|reversal|reversed)\b/i,
  /\bcr\.?\b/i,
];
// Weaker credit signals — only win if no debit signal present
const CREDIT_SIGNALS_WEAK = [
  // "received" alone: wins only when no debit signal
  /\breceived\b/i,
  // explicit payment-received phrasing
  /\bpayment\s+(of\s+\S+\s+)?(has\s+been\s+)?received\b/i,
];

function detectKind(body: string): 'debit' | 'credit' | null {
  // Strong credit wins immediately — these words are unambiguous
  if (CREDIT_SIGNALS_STRONG.some((r) => r.test(body))) return 'credit';

  // Debit beats weak credit
  if (DEBIT_SIGNALS.some((r) => r.test(body))) return 'debit';

  // Weak credit only if no debit present
  if (CREDIT_SIGNALS_WEAK.some((r) => r.test(body))) return 'credit';

  return null;
}

const UPI_REF_RE = /UPI\/[A-Z0-9]+\/[0-9]+\/([^/\n.]+?)(?:\s+(?:Ref|Not\s+you)|\.|,|\n|$)/i;
// HDFC-style "To <MERCHANT NAME>" on its own line (multi-word, all-caps merchants).
// Strict-case so prose words like "to mobile" / "to harshitkhera277" are skipped here
// and handled by later, looser matchers.
const TO_LINE_RE =
  /(?:^|\n)\s*To\s+([A-Z][A-Za-z0-9&'_.-]*(?:\s+[A-Z][A-Za-z0-9&'_.-]*){0,5})\s*(?=\n|$)/;
// Strict-case (no /i) on the FIRST word so prose like "on your", "to mobile",
// "at your" doesn't get captured. Subsequent words may be lower or mixed case
// (Indian merchant names like "Shri abhyudaya udyama", "Mahendra kumar").
// Trailing junk tokens ("is", "successful", "for"…) are stripped later by
// cleanMerchantName.
const ON_MERCHANT_RE =
  /\b(?:on|at|to|On|At|To|ON|AT|TO)\s+([A-Z][A-Za-z0-9&'_-]+(?:\s+[A-Za-z][A-Za-z0-9&'_-]+){0,4})(?=[\s.,!?]|$)/g;
// "; <NAME> credited" — ICICI P2P credit naming the sender.
const SEMI_CREDITED_RE =
  /[;,]\s*([A-Z][A-Za-z0-9&'_.-]*(?:\s+[A-Z][A-Za-z0-9&'_.-]*){0,3})\s+credited\b/;
// Standalone all-caps merchant block, often on its own line in card SMS
// (e.g. Axis CC: "AMAZON MKTP", "BIG BAZAAR"). Must be 4+ chars and not a
// known bank/section keyword.
const ALLCAPS_MERCHANT_RE =
  /(?:^|\n|\s)([A-Z][A-Z0-9&'_.-]{2,}(?:\s+[A-Z][A-Z0-9&'_.-]{1,}){0,4})(?=\s|\n|\.|,|$)/g;

const NOT_MERCHANT = new Set([
  'your',
  'the',
  'a',
  'an',
  'this',
  'that',
  'us',
  'call',
  'sms',
  'behalf',
  'account',
  'date',
  'time',
  'mobile',
  'card',
  'credit',
  'debit',
  'no',
  'no.',
  'ref',
  'ref.',
  'ref#',
  'rs',
  'rs.',
  'inr',
  'avl',
  'bal',
  'limit',
  'block',
  'not',
  'you',
  'is',
  'has',
  'been',
  'from',
  'and',
  'cr',
  'cr.',
  'dr',
  'dr.',
  'upi',
  'imps',
  'neft',
  'rtgs',
]);

// Trailing tokens that clearly aren't part of a merchant name and should be
// stripped (e.g. "Swiggy is" → "Swiggy", "Zomato successful" → "Zomato").
const TRAILING_JUNK = new Set([
  'is',
  'was',
  'has',
  'have',
  'for',
  'on',
  'at',
  'to',
  'of',
  'in',
  'successful',
  'success',
  'completed',
  'done',
  'today',
  'now',
  'and',
  'with',
  'by',
  'from',
  'the',
  'a',
  'an',
  'ltd',
  'limited',
]);

// Words that, even if uppercase, are never a merchant. Used to filter ALLCAPS_MERCHANT_RE.
const ALLCAPS_BLOCKLIST = new Set([
  'IST',
  'PM',
  'AM',
  'INR',
  'RS',
  'UPI',
  'IMPS',
  'NEFT',
  'RTGS',
  'A/C',
  'AC',
  'OTP',
  'SMS',
  'CALL',
  'BLOCK',
  'NOT',
  'YOU',
  'REF',
  'AVL',
  'BAL',
  'LIMIT',
  'CARD',
  'NO',
  'DR',
  'CR',
  'TXN',
  ...Object.values(ENTITY_MAP),
]);

function cleanMerchantName(raw: string): string {
  let name = raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!;:]+$/, '');
  // Strip trailing junk tokens like "is", "successful", "for".
  const parts = name.split(' ');
  while (parts.length > 1 && TRAILING_JUNK.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  name = parts.join(' ');
  return name;
}

function isUsableMerchant(name: string): boolean {
  if (!name) return false;
  const first = name.split(' ')[0].toLowerCase();
  if (NOT_MERCHANT.has(first)) return false;
  // Pure numeric or too short
  if (/^\d+$/.test(name)) return false;
  if (name.replace(/[^A-Za-z]/g, '').length < 2) return false;
  // Masked account/card tails (XXXXX1234, xxxx0539, **0539, all-X strings)
  if (/^[Xx*]{2,}\d*$/.test(name.replace(/\s+/g, ''))) return false;
  if (/^[Xx*]+\d+$/.test(name.replace(/\s+/g, ''))) return false;
  return true;
}

function extractMerchant(body: string): string | null {
  // 1. UPI reference path — strongest signal.
  const upi = body.match(UPI_REF_RE);
  if (upi) {
    const name = cleanMerchantName(upi[1]);
    if (isUsableMerchant(name)) return name;
  }

  // 2. HDFC-style "To <NAME>" on its own line (strict case).
  const toLine = body.match(TO_LINE_RE);
  if (toLine) {
    const name = cleanMerchantName(toLine[1]);
    if (isUsableMerchant(name)) return name;
  }

  // 3. "; <NAME> credited" — ICICI P2P credit recipient/sender.
  const semi = body.match(SEMI_CREDITED_RE);
  if (semi) {
    const name = cleanMerchantName(semi[1]);
    if (isUsableMerchant(name)) return name;
  }

  // 4. Iterate every "on/at/to <Name>" match (strict case) and pick the first
  //    one that survives the generic-word filter. Strict case prevents prose
  //    like "to mobile" / "on your" from anchoring a match.
  ON_MERCHANT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ON_MERCHANT_RE.exec(body)) !== null) {
    const name = cleanMerchantName(m[1]);
    if (isUsableMerchant(name)) return name;
  }

  // 5. All-caps merchant block (Axis CC: "AMAZON MKTP", "ZOMATO LIMITED").
  ALLCAPS_MERCHANT_RE.lastIndex = 0;
  while ((m = ALLCAPS_MERCHANT_RE.exec(body)) !== null) {
    const candidate = m[1].trim();
    const tokens = candidate.split(/\s+/);
    // Reject if the whole match is just blocklisted tokens.
    const meaningful = tokens.filter((t) => !ALLCAPS_BLOCKLIST.has(t.replace(/[.,]/g, '')));
    if (meaningful.length === 0) continue;
    const name = cleanMerchantName(meaningful.join(' '));
    if (isUsableMerchant(name)) return name;
  }

  return null;
}

const BODY_BANK_RE = new RegExp(
  `\\b(${Object.values(ENTITY_MAP)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join('|')})\\b`,
  'i'
);

function bankFromBody(body: string): string | null {
  const m = body.match(BODY_BANK_RE);
  return m ? m[1].toUpperCase() : null;
}

function makeHash(raw: string, amount: number, receivedAt: string): string {
  const key = `${amount}|${receivedAt.slice(0, 10)}|${raw.slice(0, 80)}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  }
  return 'h' + (h >>> 0).toString(36);
}

export function parseSms(
  raw: string,
  opts: { sender?: string | null; receivedAt?: string | number | Date } = {}
): ParsedSms | null {
  if (!raw || raw.length < 15) return null;

  const sender = parseSender(opts.sender);

  if (!sender.isFinancial) return null;

  // Drop promotional and government TRAI categories — neither carry user txns.
  if (sender.suffix === 'P' || sender.suffix === 'G') return null;

  // Hindi/Marathi promo (telco etc.) — banks never send Devanagari txn SMS.
  if (isMostlyDevanagari(raw)) return null;

  for (const re of BODY_NOISE) {
    if (re.test(raw)) return null;
  }

  let amount = extractAmount(raw);

  if (!amount) {
    try {
      const { transaction } = getTransactionInfo(raw);
      if (transaction.amount) {
        const n = Number(transaction.amount.replace(/[^0-9.]/g, ''));
        if (Number.isFinite(n) && n > 0) amount = n;
      }
    } catch {
      // ignore
    }
  }

  if (!amount) return null;

  let kind = detectKind(raw);

  if (!kind) {
    try {
      const { transaction } = getTransactionInfo(raw);
      if (transaction.type === 'credit' || transaction.type === 'debit') {
        kind = transaction.type;
      }
    } catch {
      // ignore
    }
  }

  if (!kind) {
    // No verb match. Only default to debit if the body carries txn-structure
    // markers (A/c, card, UPI, balance, ref no, masked digits…). Otherwise the
    // SMS is almost certainly a notice / reminder / promo that happens to
    // mention an amount (e.g. "Your H.tax for PID … is Rs. 6158").
    if (!hasTxnStructure(raw)) return null;
    // T = transactional, S = service — both can carry transaction SMS
    if (sender.suffix === 'T' || sender.suffix === 'S') kind = 'debit';
    else if (!sender.suffix)
      kind = 'debit'; // unknown suffix, amount present — assume debit
    else return null;
  }

  const bank = sender.bank ?? bankFromBody(raw);

  const merchant =
    extractMerchant(raw) ??
    bank ??
    opts.sender?.replace(/^[A-Z]{2}-/i, '').replace(/-[TSPG]$/i, '') ??
    'Unknown';

  const category =
    lookupMerchantCategory(merchant, kind) ?? (kind === 'credit' ? 'income_other' : 'other');
  const date = new Date(opts.receivedAt ?? Date.now()).toISOString();

  return {
    amount: Math.round(amount * 100),
    merchant,
    bank,
    category,
    date,
    raw,
    hash: makeHash(raw, Math.round(amount * 100), date),
    kind,
  };
}
