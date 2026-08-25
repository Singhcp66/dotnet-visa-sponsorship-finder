/**
 * storage.js — Data layer over chrome.storage.local.
 *
 * Entities: profile, jobs, companies, applications.
 * Deduplication (spec §20): jobs key on canonical URL, companies on a
 * normalised name, so 20 Microsoft jobs produce one company record.
 */

const KEYS = {
  PROFILE:   'profile',
  JOBS:      'jobs',
  COMPANIES: 'companies',
  SETTINGS:  'settings'
};

const APPLICATION_STATUSES = [
  'Saved', 'Applied', 'Recruiter contacted', 'Interview',
  'Technical interview', 'Offer', 'Rejected', 'Withdrawn'
];

/* ── Key normalisation ───────────────────────────────────────────── */

/** Strip tracking params so the same job saved twice collapses to one row. */
function canonicalUrl(url) {
  try {
    const u = new URL(url);
    const junk = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term',
                  'refId','trackingId','trk','position','pageNum','origin','src'];
    junk.forEach(p => u.searchParams.delete(p));
    // LinkedIn job pages carry the id in currentJobId when browsing the list view
    if (u.hostname.includes('linkedin.com')) {
      const id = u.searchParams.get('currentJobId');
      if (id) return `https://www.linkedin.com/jobs/view/${id}`;
      const m = u.pathname.match(/\/jobs\/view\/(\d+)/);
      if (m) return `https://www.linkedin.com/jobs/view/${m[1]}`;
    }
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return url || '';
  }
}

/** Normalise a company name so "Spotify AB" and "spotify" merge. */
function companyKey(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\b(ab|aktiebolag|inc|ltd|llc|gmbh|oy|as|a\/s|group|sweden|sverige)\b/g, '')
    .replace(/[^a-z0-9åäö]+/g, '')
    .trim();
}

/* ── Generic get/set ─────────────────────────────────────────────── */

async function get(key, fallback) {
  const res = await chrome.storage.local.get(key);
  return res[key] !== undefined ? res[key] : fallback;
}

async function set(key, value) {
  await chrome.storage.local.set({ [key]: value });
  return value;
}

/* ── Profile ─────────────────────────────────────────────────────── */

const DEFAULT_PROFILE = {
  yearsExperience: 5,
  jobTitle: '.NET Developer',
  primaryTech: ['C#', '.NET', 'ASP.NET Core'],
  secondaryTech: ['Azure', 'SQL Server', 'REST'],
  desiredSalary: '',
  // Destination countries the user will consider. Empty = anywhere.
  countries: ['SE'],
  preferredCities: [],
  workMode: 'Any',
  sponsorshipRequired: true,
  relocationRequired: true
};

const getProfile   = () => get(KEYS.PROFILE, DEFAULT_PROFILE);
const saveProfile  = (p) => set(KEYS.PROFILE, p);

/* ── Settings ────────────────────────────────────────────────────── */

const DEFAULT_SETTINGS = {
  aiEnabled: false,
  aiProvider: 'none',   // none | anthropic | gemini | openai
  aiApiKey: '',
  showBadge: true
};

const getSettings  = () => get(KEYS.SETTINGS, DEFAULT_SETTINGS);
const saveSettings = (s) => set(KEYS.SETTINGS, s);

/* ── Jobs ────────────────────────────────────────────────────────── */

const getJobs = () => get(KEYS.JOBS, []);

/**
 * Insert or update a job. Returns { job, isNew }.
 * Re-analysing an existing job refreshes its data but keeps user fields
 * (application status, notes, saved date) intact.
 */
async function upsertJob(job) {
  const jobs = await getJobs();
  const key = canonicalUrl(job.url);
  const idx = jobs.findIndex(j => canonicalUrl(j.url) === key);

  if (idx >= 0) {
    const existing = jobs[idx];
    jobs[idx] = {
      ...existing,
      ...job,
      id: existing.id,
      // preserve user-owned fields
      saved: existing.saved,
      savedAt: existing.savedAt,
      applicationStatus: existing.applicationStatus,
      appliedDate: existing.appliedDate,
      interviewStatus: existing.interviewStatus,
      notes: existing.notes,
      updatedAt: new Date().toISOString()
    };
    await set(KEYS.JOBS, jobs);
    await syncCompanyFromJob(jobs[idx]);
    return { job: jobs[idx], isNew: false };
  }

  const record = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    saved: false,
    savedAt: '',
    applicationStatus: '',
    appliedDate: '',
    interviewStatus: '',
    notes: '',
    collectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...job
  };
  jobs.unshift(record);
  await set(KEYS.JOBS, jobs);
  await syncCompanyFromJob(record);
  return { job: record, isNew: true };
}

async function updateJob(id, patch) {
  const jobs = await getJobs();
  const idx = jobs.findIndex(j => j.id === id);
  if (idx < 0) return null;
  jobs[idx] = { ...jobs[idx], ...patch, updatedAt: new Date().toISOString() };
  await set(KEYS.JOBS, jobs);
  return jobs[idx];
}

async function deleteJob(id) {
  const jobs = await getJobs();
  await set(KEYS.JOBS, jobs.filter(j => j.id !== id));
}

/* ── Companies ───────────────────────────────────────────────────── */

const getCompanies = () => get(KEYS.COMPANIES, []);

/**
 * Roll a job up into its company record.
 *
 * A company's sponsorship status is the BEST status observed across its jobs,
 * but the evidence and the role it came from are always carried with it, and
 * evidence older than 6 months is flagged historical (spec §8) so the user is
 * never told "this company sponsors" on the strength of a stale posting.
 */
async function syncCompanyFromJob(job) {
  if (!job.company) return;
  const companies = await getCompanies();
  const key = companyKey(job.company);
  if (!key) return;

  const idx = companies.findIndex(c => c.key === key);
  const rank = { CONFIRMED: 3, POTENTIAL: 2, UNKNOWN: 1, NONE: 0 };
  const status = job.sponsorship?.status || 'UNKNOWN';

  if (idx < 0) {
    companies.push({
      key,
      name: job.company,
      industry: '',
      size: '',
      website: '',
      location: job.location || '',
      country: job.country || job.sponsorship?.country || '',
      careersUrl: '',
      linkedinUrl: '',
      sponsorshipStatus: status,
      sponsorshipEvidence: job.sponsorship?.evidence?.[0]?.sentence || '',
      evidenceSourceUrl: job.url || '',
      evidenceDate: job.sponsorship?.collectedAt || new Date().toISOString(),
      sponsoredJobTitles: status === 'CONFIRMED' && job.title ? [job.title] : [],
      jobIds: [job.id],
      lastUpdated: new Date().toISOString()
    });
  } else {
    const c = companies[idx];
    if (!c.jobIds.includes(job.id)) c.jobIds.push(job.id);
    c.location = c.location || job.location || '';
    c.country  = c.country  || job.country || job.sponsorship?.country || '';

    // Upgrade status only when the new evidence is genuinely stronger.
    if (rank[status] > rank[c.sponsorshipStatus]) {
      c.sponsorshipStatus   = status;
      c.sponsorshipEvidence = job.sponsorship?.evidence?.[0]?.sentence || c.sponsorshipEvidence;
      c.evidenceSourceUrl   = job.url || c.evidenceSourceUrl;
      c.evidenceDate        = job.sponsorship?.collectedAt || c.evidenceDate;
    }
    if (status === 'CONFIRMED' && job.title && !c.sponsoredJobTitles.includes(job.title)) {
      c.sponsoredJobTitles.push(job.title);
    }
    c.lastUpdated = new Date().toISOString();
    companies[idx] = c;
  }

  await set(KEYS.COMPANIES, companies);
}

/** Evidence older than this is presented as historical, not current. */
const HISTORICAL_AFTER_DAYS = 180;

function isEvidenceHistorical(isoDate) {
  if (!isoDate) return true;
  const age = (Date.now() - new Date(isoDate).getTime()) / 86400000;
  return age > HISTORICAL_AFTER_DAYS;
}

/** Recompute every company from scratch — used after bulk deletes. */
async function rebuildCompanies() {
  await set(KEYS.COMPANIES, []);
  const jobs = await getJobs();
  for (const job of jobs) await syncCompanyFromJob(job);
  return getCompanies();
}

/* ── Stats ───────────────────────────────────────────────────────── */

async function getStats() {
  const jobs = await getJobs();
  const companies = await getCompanies();
  const count = (s) => jobs.filter(j => j.sponsorship?.status === s).length;
  return {
    totalJobs: jobs.length,
    totalCompanies: companies.length,
    confirmed: count('CONFIRMED'),
    potential: count('POTENTIAL'),
    unknown:   count('UNKNOWN'),
    none:      count('NONE'),
    saved:     jobs.filter(j => j.saved).length,
    applied:   jobs.filter(j => j.applicationStatus && j.applicationStatus !== 'Saved').length
  };
}

async function clearAll() {
  await chrome.storage.local.remove([KEYS.JOBS, KEYS.COMPANIES]);
}

const Store = {
  KEYS, APPLICATION_STATUSES, DEFAULT_PROFILE,
  canonicalUrl, companyKey,
  getProfile, saveProfile,
  getSettings, saveSettings,
  getJobs, upsertJob, updateJob, deleteJob,
  getCompanies, rebuildCompanies, isEvidenceHistorical, HISTORICAL_AFTER_DAYS,
  getStats, clearAll
};

if (typeof window !== 'undefined') window.Store = Store;
