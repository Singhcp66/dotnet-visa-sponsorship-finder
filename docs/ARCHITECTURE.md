# Architecture

## The one thing this product must get right

A false "🟢 Confirmed" is the most expensive bug here. Someone may plan a
relocation around it. So the whole system is built on one rule:

> **A sponsorship status is only ever asserted alongside the sentence it came from.**

Company size, industry, "lots of international staff", or being based in
Sweden are *never* treated as evidence. If no sentence in the posting refers
to permits, visas, sponsorship, or relocation, the answer is ⚪ Unknown — not
an educated guess.

---

## Folder structure

```
sweden-dotnet-visa/
├── manifest.json           Manifest V3
├── popup.html/.css         Dashboard shell + styling
├── content.js              Page detection, extraction, on-page badge
├── background.js           Service worker (toolbar badge, install defaults)
├── js/
│   ├── countries.js        Country packs: cities, permit terms, native patterns
│   ├── lexicon.js          Language-neutral English patterns, tech dictionary
│   ├── sponsorship.js      Classification engine  ← core
│   ├── matching.js         0–100 profile match scoring
│   ├── storage.js          Data layer + deduplication
│   ├── ai.js               Optional pluggable LLM layer
│   ├── export.js           Multi-sheet XLSX generation
│   └── popup.js            UI controller
├── lib/xlsx.full.min.js    SheetJS, vendored (see "Why vendored")
└── icons/
```

---

## Country layer

Sponsorship vocabulary is country-specific, so a single global pattern set
would be both too narrow (missing "Blaue Karte", "Critical Skills Permit")
and too blunt ("EU citizens only" is meaningless for Canada).

`countries.js` holds a pack per country with three things generic English
patterns can't supply: **cities**, the **local permit name**, and
**native-language patterns**. 16 countries are covered.

### Composition

```
patterns used = universal English (lexicon.js)
              + country pack positives/negatives (countries.js)
              + bloc exclusions for that country's bloc
```

Blocs (`EU`, `EEA`, `CH`, `UK`, `CA`) carry the citizenship-exclusion patterns.
This is why "Only EU citizens will be considered" marks a Madrid job 🔴 but is
never applied to a Toronto job, where it would be a false negative.

### Detection order

Country is resolved **before** classification, from a weighted signal scan:
country name (10) > city (6) > unique currency (5) > local permit vocabulary
(3). Below a threshold of 5 the answer is "unknown" rather than a guess, and
only universal patterns apply.

The posting's own country always wins. The user's profile is consulted only
when the posting is ambiguous *and* they've selected exactly one country —
so a German ad is never analysed as Swedish just because the user lives there.

### Transliteration

Job ads frequently drop diacritics (`Muenchen`, `gueltige`, `arbetstillstand`).
Patterns use classes like `g(?:ü|ue|u)ltige` and city lists carry both forms.
This was caught in testing: a German posting classified UNKNOWN purely because
it wrote `Gueltige` instead of `Gültige`.

---

## Sponsorship classification

`analyzeSponsorship(description, meta)` → status, confidence, evidence[].

### Pipeline

1. **Sentence split** — guards Swedish abbreviations (`t.ex.`, `bl.a.`, `ca.`)
   that break naive `.`-splitting, so quotes stay readable.
2. **Pattern scan** — three weighted buckets: explicit positive, soft
   positive, explicit negative. Each hit captures its source sentence.
3. **Negation guard** — a positive pattern is discarded if a negator appears
   in the ~40 characters before it. This is what stops *"we are unable to
   offer sponsorship"* from registering as an offer. It was a real bug caught
   in testing, and it is the single most important line of defence.
4. **Per-sentence cancellation** — a sentence carrying an explicit refusal
   cannot also count as an offer.
5. **Classification**.

### Decision table

| Condition | Status |
|---|---|
| Explicit refusal present | 🔴 NONE |
| Refusal **and** offer, different sentences | 🟡 POTENTIAL — flagged as contradictory |
| Explicit offer, conditional wording | 🟡 POTENTIAL |
| Explicit offer, past tense | 🟡 POTENTIAL — flagged historical |
| Explicit offer, unqualified | 🟢 CONFIRMED |
| Soft signals only (score ≥ 18) | 🟡 POTENTIAL |
| Nothing matched | ⚪ UNKNOWN |

Refusals outrank offers because an employer stating a hard requirement is the
most reliable sentence in any posting.

### Test coverage

**Suite 1 — classification (9 cases):** explicit offer, explicit refusal,
soft-only, silent, conditional, historical, EU-citizens-only,
self-contradictory, Swedish-language. Four failed on first run and drove the
fixes above.

**Suite 2 — countries (9 detection + 11 classification):** covers SE, NL, DE,
IE, GB, CA, CH, PL, ES across English, Swedish, German and transliterated
German.

**Suite 3 — storage/matching:** URL canonicalisation, company merging,
user-field preservation, score capping.

**Suite 4 — AI guard:** hallucinated quotes, cautious-merge on disagreement.

**Suite 5 — end-to-end:** 7 postings across 6 countries through analysis,
dedup, scoring and export.

All passing at time of packaging.

---

## Data model

```
Profile   1 ─── * Job          (scoring input)
Company   1 ─── * Job          (rolled up, deduplicated)
Job       1 ─── 1 Analysis     (status + evidence[] + confidence)
Job       1 ─── 0..1 Application  (status, dates, notes)
```

### Deduplication

- **Jobs** key on a canonical URL: tracking params stripped, LinkedIn's
  `currentJobId` resolved to `/jobs/view/<id>`. The same posting reached from
  a search list and from a direct link collapses into one record.
- **Companies** key on a normalised name — legal suffixes (`AB`, `Inc`,
  `GmbH`), punctuation and case removed. "Spotify AB", "spotify" and
  "Spotify Sweden AB" all resolve to one record.

Re-analysing a job refreshes the analysis but **preserves user-owned fields**
(saved flag, notes, application status, applied date). Verified by test.

### Company status roll-up

A company's status is the best observed across its roles, but the evidence
and the source posting travel with it, and anything older than 180 days is
labelled *Historical — verify*. This implements the current-vs-historical
distinction: past sponsorship is displayed, never silently promoted into a
present-tense claim.

---

## Match scoring

Weighted sum, 0–100, with a per-factor breakdown surfaced in the UI so the
number is explainable rather than magic.

| Factor | Weight | Why |
|---|---|---|
| Sponsorship | 30 | A role the user cannot legally take is worth less than a good role that will sponsor |
| Primary tech | 25 | |
| Experience | 15 | |
| Location | 12 | Country-gated: country match is checked before city |
| Role title | 10 | |
| Work mode | 5 | |
| Salary | 3 | Rarely stated in Swedish postings |

Three deliberate asymmetries, all applied **after** bonuses so nothing can lift
a score back over a ceiling:

- Being **6+ years overqualified** scores 75, not 100 — it often signals a mismatch.
- A 🔴 NONE job is **capped at 35** when the profile requires sponsorship.
- A job in a **country the user didn't select is capped at 65**. It stays
  visible and findable, but can't be presented as a top match ahead of
  somewhere they said they'd actually move to.

The cap ordering was a real bug: the secondary-tech bonus originally ran after
the sponsorship cap, letting a "no sponsorship" role score 37 against a
declared ceiling of 35.

---

## Optional AI layer

Off by default. The extension is fully functional with no API key, no
account, and no network access.

When enabled (Anthropic / Gemini / OpenAI, switchable in Profile):

- The model is instructed to return only **verbatim quotes**.
- Every returned quote is checked against the actual description text.
  Unverifiable quotes are dropped and counted.
- A status stronger than UNKNOWN with **zero verified quotes is discarded entirely**.
- On disagreement, **the more cautious status wins**, and the disagreement is
  shown to the user rather than hidden.

This makes AI hallucination structurally unable to manufacture sponsorship
that isn't in the posting. Tested.

Host permissions for AI providers are **optional** and requested at the moment
the user picks a provider — the extension ships requesting none of them.

---

## Excel export

Six sheets via vendored SheetJS, generated in-memory then handed to
`chrome.downloads`:

1. **Visa Sponsorship Jobs** — every job passing the filter, best match first
2. **Sponsoring Companies** — CONFIRMED only
3. **Potential Sponsors** — POTENTIAL only
4. **Saved Jobs**
5. **Application Tracker**
6. **Read Me** — how to read the statuses, and the caveats

Each sheet gets sized columns, autofilter on every header, and clickable
hyperlinks for job URLs and evidence sources.

### Two honest limitations

- **Frozen header rows are not implemented.** Freeze panes are a paid feature
  of SheetJS; the open-source writer silently ignores `!freeze`. Rather than
  ship code that pretends to work, the Read Me sheet tells the user the
  one-click equivalent (*View > Freeze Panes > Freeze Top Row*). Verified by
  inspecting the generated `sheet1.xml` for a `<pane>` element — absent in
  all three attempted formats.
- **Cell styling is limited** for the same reason. Colour coding is carried by
  the emoji status prefix (🟢/🟡/⚪/🔴), which survives everywhere.

### Why vendored

Manifest V3 forbids remote script execution, so SheetJS ships inside the
extension rather than from a CDN. This also means export works offline.

---

## Scope and compliance

The content script reads **the posting currently on screen**, in the user's
own authenticated session, when they ask for it. It does not crawl, paginate,
enumerate listings, defeat bot protection, or call private endpoints.

Structured data is preferred where offered: `JSON-LD` `JobPosting` blocks are
parsed first, with DOM selectors as fallback and a largest-text-block heuristic
as last resort.

Permissions requested: `activeTab`, `storage`, `scripting`, `downloads`.
No `tabs`, no broad `<all_urls>`, no analytics, no telemetry. All data stays
in `chrome.storage.local`.

---

## Not built

Honest scope boundary — the brief's Phase 5 backend (ASP.NET Core, EF Core,
PostgreSQL, JWT) is **not** included. It isn't needed for anything the
extension currently does: analysis is local, storage is local, export is
local. A backend earns its place only when you want cross-device sync or a
shared sponsor database, and adding one now would mean shipping an
unnecessary API key custodian and a privacy surface for no user benefit.

The data model above maps cleanly onto EF Core entities if that changes.
