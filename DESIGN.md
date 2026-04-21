# Kharcha — Design Document

> **SMS-native expense tracker for India.**
> On-device. Zero backend. Reads the debit alerts your bank already sends you.

---

## 1. Premise

Most expense trackers fail one of two ways:

1. **Manual entry apps** — attrition is brutal. Users forget, give up after a week, end up with a half-month of data and a guilty conscience.
2. **Bank-sync apps** — they work, but the trust cost is real. Giving a third party read access to your actual bank feels wrong to a lot of people, and rightly so.

**Kharcha threads the needle by using a data source you already have:** every debit from a bank account triggers an SMS to the registered number. That SMS contains the amount, the merchant, the bank, and sometimes the account tail. Kharcha reads those SMSes **on the device**, parses them into transactions, auto-categorises, and never sends a byte to a server.

The pitch in one line: **"Your bank already tracks your spending. We just read the texts."**

---

## 2. Principles

1. **Private by architecture, not policy.** No account. No login. No sync. Data lives in on-device SQLite (Room on Android). If the phone is lost, the data is lost — that's the trade. A future v2 can offer user-keyed encrypted export to the user's own cloud, but never a Kharcha-owned server.
2. **SMS is the source of truth, human is the editor.** The app proposes; the user approves, corrects, or ignores. No silent miscategorisation.
3. **Numbers first, chrome last.** Money is the content. Everything else — chrome, icons, illustration — should recede.
4. **Dense but readable.** This is a tool people open five times a day. It should reward frequent, fast glances, not decorate them.
5. **Honest about uncertainty.** When the parser is unsure of a category, say so. Don't fake confidence with a colourful pill.

---

## 3. Data model

No database in the prototype (state in React + `localStorage` for screen persistence). In production, a single SQLite table is enough:

```
transactions (
  id            TEXT PRIMARY KEY,
  amount        INTEGER,          -- paise, to avoid float math
  merchant      TEXT,
  category      TEXT,             -- enum key from CATEGORIES
  date          TEXT,             -- ISO 8601
  source        TEXT,             -- 'sms' | 'manual'
  bank          TEXT,             -- nullable
  note          TEXT,             -- nullable
  raw_sms       TEXT              -- nullable, kept for audit + re-parse
)
```

Categories are a static enum in code (ten entries — food, transport, shopping, bills, groceries, fuel, entertainment, health, transfer, other). No user-defined categories in v1; that's a v2 feature once we understand how people actually want to slice.

A second ephemeral table — `pending_sms` — holds parsed-but-unconfirmed entries. The user confirms, edits-then-confirms, or ignores. Ignored entries are remembered so we don't re-surface the same SMS.

### Parser strategy

The SMS formats used by Indian banks are remarkably regular. A small set of regexes covers HDFC, ICICI, Axis, SBI, Kotak, and most UPI alerts (~95% of volume). The parser extracts:

- **amount** — the `Rs.X,XXX.XX` or `INR X` literal
- **merchant** — the token after `at` / `to` / `for` (cleaned of boilerplate: "UPI/", trailing reference numbers, `@ybl`, etc.)
- **bank** — the sender or first token
- **date** — header date, or receipt timestamp as fallback

A **merchant → category map** handles routing. "SWIGGY" → food, "IRCTC" → transport, etc. The map ships with ~200 entries and learns: whenever a user recategorises a merchant, that mapping is remembered and applied to all future SMSes from the same merchant. Over a few weeks a user's mapping becomes near-perfect.

Credit alerts (salary, refunds) are parsed but filed separately — they aren't expenses.

---

## 4. Visual system

The vibe the user picked: **stark mono brutalist.** Near-black surfaces, a single high-energy accent, monospace for numbers, sharp 2px corners, hairline borders, uppercase micro-labels. Think spreadsheet-as-product.

### Colour tokens

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0A0A0A` | Screen background (deep black) |
| `--surface` | `#111111` | Cards, list rows |
| `--surface-2` | `#161616` | Raised surface, sheet |
| `--border` | `#1F1F1F` | Hairline dividers |
| `--border-2` | `#2A2A2A` | Interactive borders, buttons |
| `--text` | `#F5F5F5` | Primary text, numbers |
| `--text-2` | `#A8A8A8` | Secondary text, captions |
| `--text-3` | `#6B6B6B` | Labels, meta |
| `--text-4` | `#3F3F3F` | Disabled, frame labels |
| `--accent` | `#D4FF4F` | **Lime** — CTA, active state, positive signals |
| `--accent-dim` | `#8FAA2E` | Pressed accent |
| `--danger` | `#FF5B5B` | Destructive, over-budget |

The **lime** is the only saturated colour in the app. Used sparingly, it carries weight: it marks the primary CTA, the active nav tab, today's heatmap cell, the "confirm" button in pending SMS review. Never used as a category colour — categories are differentiated by glyph and label, not hue, so the accent never competes with content.

A second background palette — **graphite** (`#14110f` + warm neutrals) — is exposed as a Tweak for users who find pure black too harsh on OLED at night.

### Typography

Two families:

- **Inter** (400, 500, 600) — UI, labels, merchant names, copy
- **JetBrains Mono** (400, 500, 600, 700) — **all numbers**, bank codes, timestamps, tags, any micro-label

The rule: **anything that is a number or a code is mono.** `₹2,148` is mono. `HDFC · 09:12` is mono. `TODAY · APR 19` is mono. Merchant names and descriptive copy are Inter.

Why: monospace numbers are readable at a glance in columns and tables (tabular figures are non-negotiable in a money app), and the mono-for-data / sans-for-language split gives us visual variety without adding colour or weight.

Type scale is small and deliberate: 9, 10, 11, 13, 15, 22, 28, 44. The 44px figure is reserved for the single hero number per screen (today's total, month total, transaction amount). Everything else is 15 or below.

### Motion

- **Scan line** on SMS detection (1.8s linear top-to-bottom sweep in 12% accent) — sells the "we're reading your messages" moment on onboarding and pending review.
- **Pulse** (1.6s) on the PENDING badge when unseen SMSes are waiting.
- **Sheet slide-up** — 220ms, `cubic-bezier(0.32, 0.72, 0, 1)` (iOS-like ease-out).
- **Press feedback** — 0.88 scale on heatmap cells, no ripple.

Motion budget is tight on purpose. The app shouldn't feel playful; it should feel precise.

### Iconography

Unicode geometric glyphs for categories — `◔ ◑ ◕ ◼ ◆ ▲ ◈ ＋ ⇄ ○`. Each category is one character. Rationale: no icon set to license, no illustration slop, instant recognition after a week of use, and they sit naturally next to mono text without dominating.

---

## 5. Information architecture

Four tabs + two sheets + a detail view:

```
┌─ Tab: HOME ───────── today-first dashboard, heatmap, recents
├─ Tab: LEDGER ─────── full transaction list, filter, search
├─ Tab: INSIGHTS ──── charts (D/W/M/Y/Custom) + categories + top merchants
└─ Tab: SETTINGS ──── data/budget/account/privacy

  ⌜ tap +  ⌝ → ManualSheet (slide-up)
  ⌜ pending ⌝ → PendingSheet (slide-up, SMS review)
  ⌜ tap txn ⌝ → TxDetail (full screen)
```

Onboarding is a separate one-shot flow before the app mounts.

### Screen-by-screen

**Onboarding** — Three beats: hero claim ("Your bank already tracks you."), the permission ask (SMS read) with a plain-language explanation of what we do and don't do, a simulated scan of the last 90 days that lands on "We found 2,184 debits." The scan is the delight moment — it turns a dry permission prompt into a payoff.

**Home** — Hero: today's spend (44px mono). Secondary: week-to-date vs last week, budget burn-down. A 30-day heatmap shows spend intensity per day — taps scrub the hero to that day. Below: the last 5 transactions. Top-right of the hero carries the **PENDING** badge (lime pulse when > 0) — the single most important affordance in the app.

**Ledger** — Full list, grouped by day. Sticky day headers with day total. Filter chips (category, bank, source). Search by merchant. Swipe-left on a row to recategorise inline.

**Transaction detail** — Amount, merchant, category (tap to change), date, source tag (SMS / MANUAL), note field. If `source === 'sms'`, the **raw SMS** is shown at the bottom in a bordered box with the parsed fields highlighted — this is the trust layer. Users can always see exactly what we read.

**Insights** — Range selector: D / W / M / Y / **C** (custom). Primary chart (bar chart by default; line available via Tweaks). Below: category breakdown as a horizontal bar list with percentages. Below that: top 5 merchants for the range. Custom range is a two-tap date pair.

**Pending sheet** — Stack of pending SMS cards. Each shows: raw text (dimmed), parsed fields (bright, editable on tap), confirm / ignore buttons. Scan line plays once when sheet opens. Primary decision is binary and fast.

**Manual sheet** — Amount (big mono keypad), merchant (text), category (grid of glyphs), date (defaults to now). Minimum keystrokes to a saved entry: 5.

---

## 6. Key UX decisions

**Pending review is opt-in, not intrusive.** We don't auto-import. Every parsed SMS sits in a pending queue that the user visits on their own terms. This is slightly more friction but it preserves the "human is the editor" principle and catches parser failures before they become silent bad data.

**Today is the default context, everywhere.** Home opens to today. Charts default to this-week. The insight that matters most is the one closest in time.

**Source tagging is visible.** Every transaction carries a `SMS` or `MANUAL` tag. This isn't chrome — it's a trust signal. Users can filter by it. Bank reconciliation becomes easy: manual entries are the ones you might have double-counted.

**No login, ever.** The price of no backend is no multi-device sync. That's the right trade for v1. Users who want backup get an encrypted export to their own storage (drive/dropbox) in v2.

**Budget is soft.** A single monthly limit with a 85% alert. No envelope system, no per-category budgets in v1. Over-budget shows in `--danger`, not red screaming modals.

---

Target Android versions: 10+ (covers the permission model we need). Minimum screen width 360dp. The design is tuned for a 400×866 viewport in the frame.


---

<!-- ## 11. Open questions

1. **Encrypted backup in v2** — do we ship it at all, or lean fully into "device-local, period"? Position either way is defensible.
2. **Credit / income** — surface it as a second ledger, fold it into a net-worth view, or keep it ignored? Feels like a separate product if we do it right.
3. **Subscription detection** — SMS patterns for Netflix / Spotify / Prime are trivial to detect. Worth a dedicated "Subscriptions" screen, or just a filter?
4. **Shared expenses** — someone will ask for Splitwise-style splits. Saying no in v1 is fine, but we should have a stance.
5. **Widget** — "Today's spend" on the home screen is an obvious Android widget. Cheap to build, meaningful retention lever. -->
