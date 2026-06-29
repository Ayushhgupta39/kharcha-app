// Seed merchant → category map covering ~200 common Indian merchants.
// User edits override these via the merchant_map table.

export const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  // Food
  SWIGGY: 'food',
  ZOMATO: 'food',
  EATSURE: 'food',
  DOMINOS: 'food',
  MCDONALDS: 'food',
  KFC: 'food',
  BURGERKING: 'food',
  SUBWAY: 'food',
  STARBUCKS: 'food',
  CCD: 'food',
  BARISTA: 'food',
  HALDIRAM: 'food',
  BOX8: 'food',
  FASSOS: 'food',
  FRESHMENU: 'food',

  // Groceries
  BLINKIT: 'groceries',
  ZEPTO: 'groceries',
  BIGBASKET: 'groceries',
  DUNZO: 'groceries',
  INSTAMART: 'groceries',
  JIOMART: 'groceries',
  DMART: 'groceries',
  MORE: 'groceries',
  RELIANCEFRESH: 'groceries',
  NATURESBASKET: 'groceries',
  GROFERS: 'groceries',

  // Transport
  UBER: 'transport',
  OLA: 'transport',
  RAPIDO: 'transport',
  BLUSMART: 'transport',
  NAMMAYATRI: 'transport',
  IRCTC: 'transport',
  REDBUS: 'transport',
  ABHIBUS: 'transport',
  MAKEMYTRIP: 'transport',
  GOIBIBO: 'transport',
  YATRA: 'transport',
  EASEMYTRIP: 'transport',
  INDIGO: 'transport',
  VISTARA: 'transport',
  AIRINDIA: 'transport',
  SPICEJET: 'transport',
  METRO: 'transport',
  DMRC: 'transport',
  BMTC: 'transport',
  BEST: 'transport',

  // Fuel
  HPCL: 'fuel',
  BPCL: 'fuel',
  IOCL: 'fuel',
  INDIANOIL: 'fuel',
  'HP PETROL': 'fuel',
  RELIANCEPETRO: 'fuel',
  SHELL: 'fuel',

  // Shopping
  AMAZON: 'shopping',
  FLIPKART: 'shopping',
  MYNTRA: 'shopping',
  AJIO: 'shopping',
  MEESHO: 'shopping',
  NYKAA: 'shopping',
  TATACLIQ: 'shopping',
  SNAPDEAL: 'shopping',
  SHOPCLUES: 'shopping',
  LIFESTYLE: 'shopping',
  SHOPPERS: 'shopping',
  WESTSIDE: 'shopping',
  MAX: 'shopping',
  PANTALOONS: 'shopping',
  ZARA: 'shopping',
  HM: 'shopping',
  UNIQLO: 'shopping',
  DECATHLON: 'shopping',
  CROMA: 'shopping',
  RELIANCEDIGITAL: 'shopping',

  // Bills / utilities
  AIRTEL: 'bills',
  JIO: 'bills',
  VI: 'bills',
  VODAFONE: 'bills',
  BSNL: 'bills',
  TATAPOWER: 'bills',
  ADANIELECTRICITY: 'bills',
  BESCOM: 'bills',
  TNEB: 'bills',
  BSES: 'bills',
  ACTFIBERNET: 'bills',
  HATHWAY: 'bills',
  TATASKY: 'bills',
  DISHTV: 'bills',
  RENT: 'bills',
  NOBROKER: 'bills',

  // Entertainment
  NETFLIX: 'entertainment',
  PRIME: 'entertainment',
  AMAZONPRIME: 'entertainment',
  HOTSTAR: 'entertainment',
  DISNEY: 'entertainment',
  SONYLIV: 'entertainment',
  ZEE5: 'entertainment',
  SPOTIFY: 'entertainment',
  GAANA: 'entertainment',
  YOUTUBE: 'entertainment',
  BOOKMYSHOW: 'entertainment',
  PVR: 'entertainment',
  INOX: 'entertainment',
  PLAYSTATION: 'entertainment',
  STEAM: 'entertainment',

  // Health
  PHARMEASY: 'health',
  '1MG': 'health',
  NETMEDS: 'health',
  APOLLO: 'health',
  PRACTO: 'health',
  CULT: 'health',
  CULTFIT: 'health',
  HEALTHIFYME: 'health',
  MEDPLUS: 'health',

  // Transfer methods — category depends on direction; handled in lookupMerchantCategory
  UPI: 'transfer',
  NEFT: 'transfer',
  RTGS: 'transfer',
  IMPS: 'transfer',
};

const TRANSFER_METHOD_KEYS = new Set(['UPI', 'NEFT', 'RTGS', 'IMPS']);

export function lookupMerchantCategory(merchant: string, kind?: 'debit' | 'credit'): string | null {
  if (!merchant) return null;
  const key = merchant
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
  // Try direct
  const direct = MERCHANT_CATEGORY_MAP[key];
  if (direct) {
    if (TRANSFER_METHOD_KEYS.has(key) && kind === 'credit') return 'income_other';
    return direct;
  }
  // Try prefix / substring match
  for (const m of Object.keys(MERCHANT_CATEGORY_MAP)) {
    if (key.includes(m)) {
      if (TRANSFER_METHOD_KEYS.has(m) && kind === 'credit') return 'income_other';
      return MERCHANT_CATEGORY_MAP[m];
    }
  }
  return null;
}
