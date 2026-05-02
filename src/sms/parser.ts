import { getTransactionInfo } from 'transaction-sms-parser';
import { lookupMerchantCategory } from './merchantMap';

export type ParsedSms = {
  amount: number;   // paise
  merchant: string;
  bank: string | null;
  category: string;
  date: string;     // ISO
  raw: string;
  hash: string;
  kind: 'debit' | 'credit';
};

type TraiSuffix = 'T' | 'S' | 'P' | 'G' | null;

const ENTITY_MAP: Record<string, string> = {
  // Public sector banks
  SBIINB: 'SBI', SBIBNK: 'SBI', SBIUPI: 'SBI', SBI: 'SBI',
  PNBSMS: 'PNB', PNB: 'PNB',
  BOBSMS: 'BOB', BOB: 'BOB',
  BOISMS: 'BOI', BOI: 'BOI',
  CANBNK: 'CANARA', CANARA: 'CANARA',
  UNIONB: 'UNION', UNION: 'UNION',
  CENTBK: 'CENTRAL', CENTRAL: 'CENTRAL',
  UCOBK: 'UCO', UCO: 'UCO',
  IOBSMS: 'IOB', IOB: 'IOB',
  // Private banks
  HDFCBK: 'HDFC', HDFC: 'HDFC',
  ICICIB: 'ICICI', ICICI: 'ICICI',
  AXISBK: 'AXIS', AXIS: 'AXIS',
  KOTAKB: 'KOTAK', KOTAK: 'KOTAK',
  YESBK: 'YES', YESBNK: 'YES', YES: 'YES',
  IDFCBK: 'IDFC', IDFC: 'IDFC',
  RBLBNK: 'RBL', RBL: 'RBL',
  FEDERAL: 'FEDERAL',
  INDBNK: 'INDUSIND', INDUSIND: 'INDUSIND',
  SCBANK: 'SCAPIA', SCAPIA: 'SCAPIA',
  BANDHN: 'BANDHAN', BANDHAN: 'BANDHAN',
  AUSFIN: 'AU', AU: 'AU',
  // Neo-banks / fintech
  SLICEIT: 'SLICE', SLCEIT: 'SLICE', SLICE: 'SLICE',
  ONECRD: 'ONECARD', ONECARD: 'ONECARD',
  NIYO: 'NIYO',
  // UPI / wallets
  PAYTMB: 'PAYTM', PAYTM: 'PAYTM',
  PHNPAY: 'PHONEPE', PHONEPE: 'PHONEPE',
  GPAY: 'GPAY',
  AIRTLM: 'AIRTEL', AIRTEL: 'AIRTEL',
};

const ENTITY_KEYS = Object.keys(ENTITY_MAP).sort((a, b) => b.length - a.length);

type SenderInfo = {
  suffix: TraiSuffix;
  bank: string | null;   // resolved display name, e.g. "HDFC"
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
    lastSeg.length === 1 && /^[TSPG]$/.test(lastSeg)
      ? (lastSeg as TraiSuffix)
      : null;

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
];

// Devanagari range — Hindi/Marathi etc. Banks send transaction SMS in English / Latin.
// Promotional SMS in Hindi (telco recharge, etc.) commonly carry ₹ amounts and slip
// past the English noise patterns. If the body is mostly Devanagari, treat as non-txn.
const DEVANAGARI_RE = /[ऀ-ॿ]/;
function isMostlyDevanagari(body: string): boolean {
  const letters = body.match(/[A-Za-zऀ-ॿ]/g);
  if (!letters || letters.length === 0) return false;
  const dev = letters.filter(c => DEVANAGARI_RE.test(c)).length;
  return dev / letters.length > 0.3;
}

// Real bank/card txn SMS almost always include one of these structural markers.
// If none are present AND no explicit debit/credit verb was found, the SMS is
// probably a notice/promo that just happens to mention an amount.
const TXN_STRUCTURE_RE = [
  /\bA\/?[Cc]\b/,                       // A/c, A/C, AC
  /\bacc(?:oun)?t\b/i,
  /\bcard\b/i,
  /\b(?:xx+|x{2,}|\*{2,})\d{3,}\b/,     // masked card/account tail e.g. xxxx1234
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
  return TXN_STRUCTURE_RE.some(r => r.test(body));
}

const AMOUNT_RE =
  /(?:Rs\.?\s*|INR\s*|₹\s*)([0-9,]+(?:\.[0-9]{1,2})?)/i;

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
  /\b(credited|deposited|refund|cashback|reversal|reversed)\b/i,
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
  if (CREDIT_SIGNALS_STRONG.some(r => r.test(body))) return 'credit';

  // Debit beats weak credit
  if (DEBIT_SIGNALS.some(r => r.test(body))) return 'debit';

  // Weak credit only if no debit present
  if (CREDIT_SIGNALS_WEAK.some(r => r.test(body))) return 'credit';

  return null;
}

const UPI_REF_RE = /UPI\/[A-Z0-9]+\/[0-9]+\/([^/\n.]+?)(?:\s+(?:Ref|Not\s+you)|\.|,|\n|$)/i;
const ON_MERCHANT_RE =
  /\b(?:on|at|to)\s+([A-Z][A-Za-z0-9&'_-]+(?:\s+[A-Z][A-Za-z0-9&'_-]+)?)(?=[\s.,!?]|$)/;

const NOT_MERCHANT = new Set([
  'your', 'the', 'a', 'an', 'this', 'that', 'us', 'call',
  'behalf', 'account', 'date', 'time',
]);

function extractMerchant(body: string): string | null {
  const upi = body.match(UPI_REF_RE);
  if (upi) return upi[1].trim().replace(/\s+/g, ' ') || null;

  const on = body.match(ON_MERCHANT_RE);
  if (on) {
    const name = on[1].trim().replace(/\s+/g, ' ').replace(/[.,!]+$/, '');
    const first = name.split(' ')[0].toLowerCase();
    if (!NOT_MERCHANT.has(first)) return name;
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
    else if (!sender.suffix) kind = 'debit'; // unknown suffix, amount present — assume debit
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
