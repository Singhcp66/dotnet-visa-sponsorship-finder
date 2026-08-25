/**
 * matching.js — Scores a job against the user's profile, 0–100.
 *
 * The score is a weighted sum of seven factors. Every factor returns its own
 * sub-score and a one-line explanation, so the UI can show WHY a job scored
 * what it did rather than presenting an unexplained number.
 *
 * Weighting reflects the product's purpose: sponsorship is the largest single
 * factor, because a perfect technical match the user cannot legally take is
 * worth less than a good match that will actually sponsor them.
 */

const MATCH_WEIGHTS = {
  sponsorship: 30,
  primaryTech: 25,
  experience:  15,
  location:    12,
  title:       10,
  workMode:     5,
  salary:       3
};

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9#+.]/g, '');
}

/** Tech comparison tolerant of ".NET Core" vs ".NET", "C#" vs "csharp". */
function techMatches(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

function scoreSponsorship(job, profile) {
  const status = job.sponsorship?.status || 'UNKNOWN';
  if (!profile.sponsorshipRequired) {
    return { pct: 100, note: 'Sponsorship not required by your profile' };
  }
  switch (status) {
    case 'CONFIRMED': return { pct: 100, note: 'Sponsorship confirmed in the posting' };
    case 'POTENTIAL': return { pct: 55,  note: 'Sponsorship possible — needs confirming' };
    case 'UNKNOWN':   return { pct: 25,  note: 'Sponsorship not mentioned — ask the employer' };
    case 'NONE':      return { pct: 0,   note: 'Posting rules sponsorship out' };
    default:          return { pct: 25,  note: 'Sponsorship unclear' };
  }
}

function scorePrimaryTech(job, profile) {
  const want = profile.primaryTech || [];
  if (!want.length) return { pct: 50, note: 'No primary technologies set' };
  const have = job.technologies || [];
  const hit = want.filter(w => have.some(h => techMatches(w, h)));
  const pct = Math.round((hit.length / want.length) * 100);
  return {
    pct,
    note: hit.length
      ? `Matches ${hit.length}/${want.length}: ${hit.join(', ')}`
      : 'None of your primary technologies appear'
  };
}

function scoreSecondaryTech(job, profile) {
  const want = profile.secondaryTech || [];
  if (!want.length) return { pct: 0, hits: [] };
  const have = job.technologies || [];
  const hit = want.filter(w => have.some(h => techMatches(w, h)));
  return { pct: Math.round((hit.length / want.length) * 100), hits: hit };
}

function scoreExperience(job, profile) {
  const req = job.experience?.min;
  const mine = Number(profile.yearsExperience) || 0;
  if (req === null || req === undefined) {
    return { pct: 60, note: 'No experience requirement stated' };
  }
  if (mine >= req) {
    const over = mine - req;
    // Being wildly overqualified is a mild negative, not a bonus.
    if (over > 6) return { pct: 75, note: `You exceed the ${req}-year requirement by ${over} years` };
    return { pct: 100, note: `You meet the ${req}-year requirement` };
  }
  const gap = req - mine;
  if (gap <= 1) return { pct: 75, note: `${gap} year below the ${req}-year requirement` };
  if (gap <= 2) return { pct: 50, note: `${gap} years below the ${req}-year requirement` };
  return { pct: 20, note: `${gap} years below the ${req}-year requirement` };
}

/**
 * Location scoring runs country-first, then city.
 *
 * A role in a country the user won't move to is a poor match even if the
 * city name happens to align, so the country check gates the city check.
 */
function scoreLocation(job, profile) {
  const C = (typeof window !== 'undefined' && window.Countries)
    ? window.Countries
    : (typeof Countries !== 'undefined' ? Countries : null);
  const wantCountries = profile.countries || [];
  const jobCountry = job.countryCode || job.sponsorship?.country || '';

  // Country gate
  if (wantCountries.length && jobCountry && !wantCountries.includes(jobCountry)) {
    const name = C?.COUNTRIES[jobCountry]?.name || jobCountry;
    if (job.workMode === 'Remote') return { pct: 55, note: `Remote, based in ${name}` };
    return { pct: 15, note: `In ${name}, not on your country list` };
  }

  const countryName = C?.COUNTRIES[jobCountry]?.name || '';
  const cities = (profile.preferredCities || []).filter(Boolean);
  const loc = norm(job.location);

  // City preference, when the user set one
  if (cities.length && loc) {
    const hit = cities.find(c => loc.includes(norm(c)));
    if (hit) return { pct: 100, note: `In your preferred city: ${hit}` };
    if (jobCountry && wantCountries.includes(jobCountry)) {
      return { pct: 68, note: `In ${countryName || 'a target country'}, outside your preferred cities` };
    }
    if (job.workMode === 'Remote') return { pct: 70, note: 'Remote role' };
    return { pct: 35, note: 'Outside your preferred locations' };
  }

  // No city preference — country match is enough
  if (jobCountry && wantCountries.includes(jobCountry)) {
    return { pct: 100, note: `In ${countryName}, on your country list` };
  }
  if (!wantCountries.length) return { pct: 75, note: 'Open to any country' };
  if (!jobCountry) return { pct: 50, note: 'Country could not be identified' };
  if (job.workMode === 'Remote') return { pct: 70, note: 'Remote role' };
  return { pct: 50, note: 'Location unclear' };
}

function scoreTitle(job, profile) {
  const t = norm(job.title);
  const want = norm(profile.jobTitle);
  if (!t) return { pct: 50, note: 'No title' };
  if (want && t.includes(want)) return { pct: 100, note: 'Title matches your target role' };
  const dotnet = /(net|c#|csharp|dotnet)/.test(t);
  const dev = /(developer|engineer|utvecklare|programmer)/.test(t);
  if (dotnet && dev) return { pct: 90, note: 'A .NET engineering role' };
  if (dotnet) return { pct: 70, note: 'Mentions .NET or C#' };
  if (dev) return { pct: 45, note: 'A developer role, but not .NET-specific' };
  return { pct: 20, note: 'Title does not look like a .NET role' };
}

function scoreWorkMode(job, profile) {
  const want = profile.workMode || 'Any';
  if (want === 'Any' || !job.workMode) return { pct: 70, note: '' };
  if (job.workMode === want) return { pct: 100, note: `${job.workMode} matches your preference` };
  if (want === 'Hybrid' && job.workMode === 'Remote') return { pct: 80, note: 'Remote, you prefer hybrid' };
  return { pct: 40, note: `${job.workMode}, you prefer ${want}` };
}

function scoreSalary(job, profile) {
  if (!profile.desiredSalary || !job.salary?.text) {
    return { pct: 60, note: '' };
  }
  const want = parseInt(String(profile.desiredSalary).replace(/\D/g, ''), 10);
  const nums = (job.salary.text.match(/\d[\d\s,.]*/g) || [])
    .map(n => parseInt(n.replace(/\D/g, ''), 10))
    .filter(n => n > 1000);
  if (!want || !nums.length) return { pct: 60, note: '' };
  const top = Math.max(...nums);
  if (top >= want) return { pct: 100, note: 'Meets your salary target' };
  if (top >= want * 0.9) return { pct: 75, note: 'Slightly below your salary target' };
  return { pct: 35, note: 'Below your salary target' };
}

/**
 * Compute the overall score.
 * @returns {{score:number, breakdown:Array, headline:string}}
 */
function calculateMatch(job, profile) {
  const factors = [
    { key: 'sponsorship', label: 'Sponsorship', ...scoreSponsorship(job, profile) },
    { key: 'primaryTech', label: 'Core tech',   ...scorePrimaryTech(job, profile) },
    { key: 'experience',  label: 'Experience',  ...scoreExperience(job, profile) },
    { key: 'location',    label: 'Location',    ...scoreLocation(job, profile) },
    { key: 'title',       label: 'Role',        ...scoreTitle(job, profile) },
    { key: 'workMode',    label: 'Work mode',   ...scoreWorkMode(job, profile) },
    { key: 'salary',      label: 'Salary',      ...scoreSalary(job, profile) }
  ];

  let total = 0, maxTotal = 0;
  for (const f of factors) {
    const w = MATCH_WEIGHTS[f.key];
    total += (f.pct / 100) * w;
    maxTotal += w;
    f.weight = w;
  }

  let score = Math.round((total / maxTotal) * 100);

  const secondary = scoreSecondaryTech(job, profile);
  if (secondary.hits.length) {
    score = Math.min(100, score + Math.min(4, secondary.hits.length));
  }

  // Caps are applied last so no bonus can lift a score back over a ceiling.

  // A role in a country the user said they wouldn't move to shouldn't read as
  // a top pick, however good the tech match is. It stays visible — people do
  // change their minds — but it can't outrank roles they can actually take.
  const jobCountryCode = job.countryCode || job.sponsorship?.country || '';
  const wanted = profile.countries || [];
  if (wanted.length && jobCountryCode && !wanted.includes(jobCountryCode)) {
    score = Math.min(score, 65);
  }

  // A job that explicitly refuses sponsorship cannot be a "strong match" for
  // someone who needs it, however well the tech lines up.
  if (profile.sponsorshipRequired && job.sponsorship?.status === 'NONE') {
    score = Math.min(score, 35);
  }

  let headline;
  if (score >= 85)      headline = 'Strong match';
  else if (score >= 70) headline = 'Good match';
  else if (score >= 50) headline = 'Partial match';
  else                  headline = 'Weak match';

  return { score, breakdown: factors, headline, secondaryHits: secondary.hits };
}

const Matching = { calculateMatch, MATCH_WEIGHTS };
if (typeof window !== 'undefined') {
  window.Matching = Matching;
  window.calculateMatch = calculateMatch;
}
