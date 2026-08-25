/**
 * ai.js — Optional second opinion from a configurable LLM provider.
 *
 * Design constraint that matters most (spec §5): the AI may only return a
 * status together with a VERBATIM quote from the posting. Any quote that
 * cannot be found in the source text is discarded and the AI result is
 * ignored. This makes it structurally impossible for the AI to invent
 * sponsorship that isn't in the posting — the failure mode that would make
 * this product actively harmful to someone planning a move to Sweden.
 *
 * The rules engine remains the source of truth; AI only refines.
 */

const AI_PROVIDERS = {
  anthropic: {
    label: 'Anthropic Claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    keyHint: 'sk-ant-…',
    build: (key, prompt) => ({
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        // Required for calls made directly from a browser context.
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }]
      })
    }),
    parse: (data) => data?.content?.map(c => c.text || '').join('') || ''
  },

  gemini: {
    label: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    keyHint: 'AIza…',
    build: (key, prompt) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 900, temperature: 0 }
      })
    }),
    parse: (data) => data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || ''
  },

  openai: {
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    keyHint: 'sk-…',
    build: (key, prompt) => ({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 900,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }]
      })
    }),
    parse: (data) => data?.choices?.[0]?.message?.content || ''
  }
};

function buildPrompt(job) {
  return `You are analysing a job posting from Sweden to determine whether the employer offers work-permit or visa sponsorship for a non-EU candidate.

POSTING
Title: ${job.title || ''}
Company: ${job.company || ''}
Location: ${job.location || ''}

DESCRIPTION
${(job.description || '').slice(0, 6000)}

RULES YOU MUST FOLLOW
1. Base your answer ONLY on sentences that appear in the description above.
2. Every claim must be supported by a quote copied EXACTLY, character for character, from the description. Do not paraphrase quotes.
3. If the description does not mention permits, visas, sponsorship, or relocation, the status is UNKNOWN and the evidence array is empty.
4. Never infer sponsorship from company size, industry, international staff, or the fact the role is in Sweden.
5. If the employer requires existing right to work, or says it cannot sponsor, the status is NONE.
6. If sponsorship is conditional ("case by case", "for the right candidate") or described in the past tense, the status is POTENTIAL, not CONFIRMED.

Respond with ONLY this JSON, no markdown fence, no commentary:

{
  "status": "CONFIRMED" | "POTENTIAL" | "UNKNOWN" | "NONE",
  "confidence": 0-100,
  "reason": "one sentence explaining the status",
  "evidence": [
    { "quote": "exact sentence copied from the description", "kind": "positive" | "negative" | "soft" }
  ],
  "relocationSupport": true | false,
  "historical": true | false
}`;
}

/** Normalise whitespace and case so quote verification tolerates formatting. */
function normaliseForMatch(s) {
  return (s || '').toLowerCase().replace(/[\s\u00a0]+/g, ' ').replace(/[""'']/g, '"').trim();
}

/**
 * Run the AI pass. Returns null on any failure — callers keep the rules result.
 */
async function runAiAnalysis(job, settings) {
  const provider = AI_PROVIDERS[settings.aiProvider];
  if (!provider || !settings.aiApiKey) return null;

  const prompt = buildPrompt(job);
  const cfg = provider.build(settings.aiApiKey, prompt);

  const res = await fetch(cfg.url || provider.endpoint, {
    method: 'POST',
    headers: cfg.headers,
    body: cfg.body
  });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      msg = err?.error?.message || err?.message || msg;
    } catch { /* keep default */ }
    throw new Error(msg);
  }

  const data = await res.json();
  const raw = provider.parse(data);
  if (!raw) throw new Error('Empty response from the AI provider.');

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error('The AI response was not valid JSON.');
  }

  // ── Quote verification ──────────────────────────────────────────
  // Discard any quote that is not actually present in the description.
  const haystack = normaliseForMatch(job.description);
  const verified = (parsed.evidence || []).filter(e => {
    const q = normaliseForMatch(e.quote);
    return q.length > 15 && haystack.includes(q);
  });

  const rejected = (parsed.evidence || []).length - verified.length;

  // A status stronger than UNKNOWN with no verifiable quote is unusable.
  const needsEvidence = ['CONFIRMED', 'POTENTIAL', 'NONE'];
  if (needsEvidence.includes(parsed.status) && verified.length === 0) {
    return {
      rejected: true,
      reason: 'The AI could not point to text in the posting, so its answer was discarded.'
    };
  }

  return {
    status: parsed.status,
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
    reason: parsed.reason || '',
    relocation: !!parsed.relocationSupport,
    historical: !!parsed.historical,
    evidence: verified.map(e => ({
      kind: e.kind === 'negative' ? 'negative' : (e.kind === 'soft' ? 'soft' : 'positive'),
      label: 'Identified by AI',
      sentence: e.quote,
      weight: 0
    })),
    rejectedQuotes: rejected,
    method: 'ai'
  };
}

/**
 * Merge the rules result with the AI result.
 * The AI can add evidence and adjust a status, but a disagreement is surfaced
 * to the user rather than silently resolved.
 */
function mergeAnalyses(rules, ai) {
  if (!ai || ai.rejected) {
    return { ...rules, aiNote: ai?.reason || '' };
  }

  const rank = { NONE: 0, UNKNOWN: 1, POTENTIAL: 2, CONFIRMED: 3 };
  const disagrees = ai.status !== rules.status;

  // Combine evidence, keeping unique sentences.
  const seen = new Set(rules.evidence.map(e => normaliseForMatch(e.sentence)));
  const extra = ai.evidence.filter(e => !seen.has(normaliseForMatch(e.sentence)));
  const evidence = [...rules.evidence, ...extra].slice(0, 8);

  // When they disagree, take the more cautious of the two. Over-promising
  // sponsorship is far more costly to the user than under-promising.
  const status = disagrees
    ? (rank[ai.status] < rank[rules.status] ? ai.status : rules.status)
    : rules.status;

  return {
    ...rules,
    status,
    evidence,
    confidence: disagrees
      ? Math.round((rules.confidence + ai.confidence) / 2)
      : Math.max(rules.confidence, ai.confidence),
    relocation: rules.relocation || ai.relocation,
    historical: rules.historical || ai.historical,
    method: 'rules+ai',
    aiNote: disagrees
      ? `Pattern analysis said ${rules.status.toLowerCase()}, the AI said ${ai.status.toLowerCase()}. Showing the more cautious result.`
      : '',
    aiRejectedQuotes: ai.rejectedQuotes || 0
  };
}

const AI = { AI_PROVIDERS, runAiAnalysis, mergeAnalyses };
if (typeof window !== 'undefined') window.AI = AI;
