/**
 * sponsorship.js — Classifies a job posting's work-permit sponsorship status.
 *
 * Core rule (spec §5): a status is only ever asserted when we can show the
 * sentence it came from. Company size, nationality mix, or Swedish location
 * are NEVER treated as evidence. If no sentence matches, the answer is UNKNOWN.
 *
 * Runs entirely locally. The optional AI layer (js/ai.js) can refine a result
 * but cannot upgrade UNKNOWN → CONFIRMED without quoting matched text.
 */

const STATUS = {
  CONFIRMED: 'CONFIRMED',
  POTENTIAL: 'POTENTIAL',
  UNKNOWN:   'UNKNOWN',
  NONE:      'NONE'
};

const STATUS_META = {
  CONFIRMED: { dot: '🟢', label: 'Confirmed sponsorship',  short: 'Confirmed' },
  POTENTIAL: { dot: '🟡', label: 'Potential sponsorship',  short: 'Potential' },
  UNKNOWN:   { dot: '⚪', label: 'Not mentioned',          short: 'Unknown'   },
  NONE:      { dot: '🔴', label: 'No sponsorship',         short: 'None'      }
};

/**
 * Split text into sentences so evidence can be quoted in context.
 * Handles Swedish abbreviations (t.ex., bl.a., ca.) that break naive splits.
 */
function splitSentences(text) {
  const guarded = text
    .replace(/\bt\.ex\./gi, 't§ex§')
    .replace(/\bbl\.a\./gi, 'bl§a§')
    .replace(/\bm\.m\./gi,  'm§m§')
    .replace(/\bca\./gi,    'ca§')
    .replace(/\be\.g\./gi,  'e§g§')
    .replace(/\bi\.e\./gi,  'i§e§');

  return guarded
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.replace(/§/g, '.').replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 12 && s.length < 500);
}

/**
 * Phrases that invert a sponsorship offer. "We are unable to offer sponsorship"
 * must never be read as an offer — this is the highest-cost error the engine
 * can make, because it turns a clear refusal into false hope.
 */
const NEGATION_GUARD = /\b(?:not|no|never|cannot|can'?t|unable to|won'?t|will not|do(?:es)?n'?t|without|lack of|inte|kan inte|ingen|inget)\b/i;

/**
 * True when a negator appears before the matched phrase in the same sentence.
 * Position matters: "we sponsor permits, but do not cover flights" is an offer.
 */
function isNegated(sentence, re) {
  const m = sentence.match(re);
  if (!m) return false;
  const before = sentence.slice(0, m.index);
  // Only the ~40 characters preceding the phrase can negate it.
  return NEGATION_GUARD.test(before.slice(-40));
}

/**
 * Find every lexicon hit, capturing the sentence that produced it.
 *
 * @param countryCode - when set, the destination country's own permit
 *   vocabulary and bloc exclusions are added to the universal patterns.
 *   Without it only the language-neutral English patterns apply, which is
 *   why detection runs before classification.
 */
function collectEvidence(text, sentences, countryCode) {
  const L = (typeof window !== 'undefined' && window.SPONSORSHIP_LEXICON)
    ? window.SPONSORSHIP_LEXICON
    : SPONSORSHIP_LEXICON;

  const C = (typeof window !== 'undefined' && window.Countries)
    ? window.Countries
    : (typeof Countries !== 'undefined' ? Countries : null);

  const pack = (C && countryCode) ? C.patternsFor(countryCode) : { positive: [], negative: [], soft: [] };

  const positivePatterns = [...L.explicitPositive, ...pack.positive];
  const softPatterns     = [...L.softPositive,     ...pack.soft];
  const negativePatterns = [...L.explicitNegative, ...pack.negative];

  const found = { positive: [], soft: [], negative: [] };

  const scan = (patterns, bucket, kind, guardNegation) => {
    for (const p of patterns) {
      for (const sentence of sentences) {
        if (!p.re.test(sentence)) continue;
        if (guardNegation && isNegated(sentence, p.re)) continue;
        // one hit per pattern — avoid inflating score with repetition
        bucket.push({
          kind,
          label: p.label,
          weight: p.w,
          sentence: sentence.length > 300 ? sentence.slice(0, 297) + '…' : sentence
        });
        break;
      }
    }
  };

  scan(positivePatterns, found.positive, 'positive', true);
  scan(softPatterns,     found.soft,     'soft',     true);
  scan(negativePatterns, found.negative, 'negative', false);

  // A sentence that also carries an explicit refusal cannot count as an offer.
  const negatedSentences = new Set(found.negative.map(e => e.sentence.toLowerCase()));
  found.positive = found.positive.filter(e => !negatedSentences.has(e.sentence.toLowerCase()));
  found.soft     = found.soft.filter(e => !negatedSentences.has(e.sentence.toLowerCase()));

  const historical  = L.historical.some(re => re.test(text));
  const conditional = L.conditional.some(re => re.test(text));

  return { ...found, historical, conditional };
}

/**
 * Classify. Returns a full analysis object with evidence attached.
 *
 * @param {string} description - the job description text
 * @param {object} meta - { url, company, title, collectedAt }
 */
function analyzeSponsorship(description, meta = {}) {
  const text = (description || '').trim();

  const C = (typeof window !== 'undefined' && window.Countries)
    ? window.Countries
    : (typeof Countries !== 'undefined' ? Countries : null);

  // Detect the destination before classifying: the country determines which
  // permit vocabulary and which citizenship exclusions are relevant.
  const country = meta.country || (C ? C.detectCountry(`${meta.title || ''} ${meta.location || ''} ${text}`) : '');

  if (text.length < 80) {
    return {
      status: STATUS.UNKNOWN,
      confidence: 0,
      evidence: [],
      historical: false,
      conditional: false,
      relocation: false,
      country,
      reason: 'Job description too short to analyse.',
      method: 'rules',
      sourceUrl: meta.url || '',
      collectedAt: new Date().toISOString()
    };
  }

  const sentences = splitSentences(text);
  const ev = collectEvidence(text, sentences, country);

  // ── Scoring ──────────────────────────────────────────────────────
  const posScore  = ev.positive.reduce((s, e) => s + e.weight, 0);
  const softScore = ev.soft.reduce((s, e) => s + e.weight, 0);
  const negScore  = ev.negative.reduce((s, e) => s + e.weight, 0); // negative numbers

  let status;
  let reason;
  let confidence;

  // Explicit negatives always win. An employer saying "no sponsorship"
  // is the most reliable signal in the whole document.
  if (ev.negative.length > 0) {
    status = STATUS.NONE;
    confidence = Math.min(95, 55 + ev.negative.length * 12);
    reason = 'The posting states a requirement that rules out sponsorship.';

    // Contradiction: both an explicit offer and an explicit exclusion.
    if (ev.positive.length > 0) {
      status = STATUS.POTENTIAL;
      confidence = 40;
      reason = 'The posting contains both a sponsorship offer and a right-to-work requirement. Ask the employer which applies.';
    }
  }
  else if (ev.positive.length > 0) {
    if (ev.conditional) {
      status = STATUS.POTENTIAL;
      confidence = Math.min(75, 45 + posScore * 0.4);
      reason = 'Sponsorship is offered but framed as conditional or case-by-case.';
    } else if (ev.historical) {
      status = STATUS.POTENTIAL;
      confidence = Math.min(70, 40 + posScore * 0.4);
      reason = 'Sponsorship is described in the past tense — confirm it applies to this role.';
    } else {
      status = STATUS.CONFIRMED;
      confidence = Math.min(96, 60 + posScore * 0.7 + softScore * 0.2);
      reason = 'The posting explicitly states the employer supports work permits or visas.';
    }
  }
  else if (ev.soft.length > 0 && softScore >= 18) {
    status = STATUS.POTENTIAL;
    confidence = Math.min(65, 25 + softScore * 0.9);
    reason = 'Signals point to international hiring, but sponsorship is not stated outright.';
  }
  else {
    status = STATUS.UNKNOWN;
    confidence = ev.soft.length ? 15 : 0;
    reason = 'The posting does not mention work permits, visas, or relocation.';
  }

  const relocation = ev.soft.some(e => /relocation|flytt/i.test(e.label));

  // Several patterns often match the same sentence. Show each sentence once,
  // keeping the highest-weight label for it, so the evidence list reads cleanly.
  const dedupe = (items) => {
    const bySentence = new Map();
    for (const item of items) {
      const key = item.sentence.toLowerCase();
      const existing = bySentence.get(key);
      if (!existing || Math.abs(item.weight) > Math.abs(existing.weight)) {
        bySentence.set(key, item);
      }
    }
    return [...bySentence.values()];
  };

  return {
    status,
    confidence: Math.round(confidence),
    evidence: dedupe([...ev.negative, ...ev.positive, ...ev.soft]).slice(0, 6),
    historical: ev.historical,
    conditional: ev.conditional,
    relocation,
    country,
    reason,
    method: 'rules',
    sourceUrl: meta.url || '',
    collectedAt: new Date().toISOString()
  };
}

/* ── Field extraction helpers ─────────────────────────────────────── */

function extractTechnologies(text) {
  const list = (typeof window !== 'undefined' && window.ALL_TECH) ? window.ALL_TECH : ALL_TECH;
  const hits = new Set();
  for (const tech of list) {
    // escape regex metacharacters in tech names like ".NET" and "C#"
    const esc = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|[^\\w.#+])${esc}(?:$|[^\\w#+])`, 'i');
    if (re.test(text)) hits.add(tech);
  }
  // Collapse .NET version noise: keep the most specific
  const arr = [...hits];
  if (arr.some(t => /^\.NET \d/.test(t))) {
    return arr.filter(t => t !== '.NET');
  }
  return arr;
}

function extractExperience(text) {
  const patterns = [
    /(\d+)\s*\+?\s*(?:-|to|–)\s*(\d+)\s*(?:years?|års?)\s*(?:of\s*)?(?:experience|erfarenhet)/i,
    /(?:at least|minimum(?: of)?|minst)\s*(\d+)\s*(?:years?|års?)/i,
    /(\d+)\s*\+\s*(?:years?|års?)\s*(?:of\s*)?(?:experience|erfarenhet)/i,
    /(\d+)\s*(?:years?|års?)\s*(?:of\s*)?(?:experience|erfarenhet)/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const lo = parseInt(m[1], 10);
      const hi = m[2] ? parseInt(m[2], 10) : null;
      if (lo >= 0 && lo <= 30) {
        return { min: lo, max: hi, text: hi ? `${lo}–${hi} years` : `${lo}+ years` };
      }
    }
  }
  if (/\b(?:senior|lead|principal)\b/i.test(text)) return { min: 5, max: null, text: '5+ years (inferred from title)' };
  if (/\b(?:junior|graduate|entry[- ]level|trainee)\b/i.test(text)) return { min: 0, max: 2, text: '0–2 years (inferred)' };
  return { min: null, max: null, text: '' };
}

/** Currency tokens the extractor recognises, mapped to a code. */
const CURRENCY_TOKENS = [
  { re: /\bSEK\b|\bkr\b/i,  code: 'SEK' },
  { re: /\bDKK\b/i,         code: 'DKK' },
  { re: /\bNOK\b/i,         code: 'NOK' },
  { re: /\bPLN\b|\bzł\b/i,  code: 'PLN' },
  { re: /\bCHF\b/i,         code: 'CHF' },
  { re: /\bCAD\b/i,         code: 'CAD' },
  { re: /£|\bGBP\b/i,       code: 'GBP' },
  { re: /€|\bEUR\b/i,       code: 'EUR' },
  { re: /\bUSD\b/i,         code: 'USD' }
];

function extractSalary(text) {
  // Ranges and single figures, before or after the currency token.
  const patterns = [
    /(?:€|£|kr|SEK|DKK|NOK|PLN|CHF|EUR|GBP|CAD|USD)\s?\d{1,3}(?:[\s,.]\d{3})+(?:\s?(?:-|–|to)\s?(?:€|£|kr)?\s?\d{1,3}(?:[\s,.]\d{3})+)?/i,
    /\d{1,3}(?:[\s,.]\d{3})+\s?(?:-|–|to)\s?\d{1,3}(?:[\s,.]\d{3})+\s?(?:€|£|kr|SEK|DKK|NOK|PLN|CHF|EUR|GBP|CAD|USD)/i,
    /\d{1,3}(?:[\s,.]\d{3})+\s?(?:€|£|kr|SEK|DKK|NOK|PLN|CHF|EUR|GBP|CAD|USD)\s?(?:\/|per\s*)?(?:month|månad|mån|year|år|annum|jahr|maand)?/i,
    /(?:€|£)\s?\d{2,3}k(?:\s?(?:-|–|to)\s?(?:€|£)?\s?\d{2,3}k)?/i
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const found = m[0].replace(/\s+/g, ' ').trim();
      const cur = CURRENCY_TOKENS.find(c => c.re.test(found));
      return { text: found, currency: cur ? cur.code : '' };
    }
  }
  return { text: '', currency: '' };
}

function extractWorkMode(text) {
  const W = (typeof window !== 'undefined' && window.WORK_MODE) ? window.WORK_MODE : WORK_MODE;
  if (W.hybrid.test(text)) return 'Hybrid';
  if (W.remote.test(text)) return 'Remote';
  if (W.onsite.test(text)) return 'On-site';
  return '';
}

/**
 * Find a city mentioned in the text.
 * When country codes are supplied, only those countries' cities are
 * considered — this stops "Cambridge" in a UK-targeted search matching a
 * Massachusetts posting.
 */
function detectCity(text, countryCodes) {
  const C = (typeof window !== 'undefined' && window.Countries)
    ? window.Countries
    : (typeof Countries !== 'undefined' ? Countries : null);
  if (!C) return '';

  const codes = (countryCodes && countryCodes.length)
    ? countryCodes
    : Object.keys(C.COUNTRIES);

  for (const code of codes) {
    for (const city of (C.COUNTRIES[code]?.cities || [])) {
      const esc = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${esc}\\b`, 'i').test(text)) return city;
    }
  }
  return '';
}

// Kept for backwards compatibility with earlier saved data.
const detectSwedishCity = (text) => detectCity(text, ['SE']);

/* Export */
if (typeof window !== 'undefined') {
  window.analyzeSponsorship   = analyzeSponsorship;
  window.extractTechnologies  = extractTechnologies;
  window.extractExperience    = extractExperience;
  window.extractSalary        = extractSalary;
  window.extractWorkMode      = extractWorkMode;
  window.detectCity           = detectCity;
  window.detectSwedishCity    = detectSwedishCity;
  window.STATUS               = STATUS;
  window.STATUS_META          = STATUS_META;
}
