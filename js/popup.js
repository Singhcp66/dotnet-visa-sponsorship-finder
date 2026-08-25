/**
 * popup.js — Dashboard controller.
 */

const $  = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let state = {
  tab: 'current',
  profile: null,
  settings: null,
  currentJob: null,
  currentAnalysis: null,
  jobs: [],
  companies: [],
  filters: {
    query: '',
    statuses: new Set(['CONFIRMED', 'POTENTIAL', 'UNKNOWN']),
    savedOnly: false,
    sort: 'match',
    country: ''
  },
  companyFilters: { query: '', sort: 'status', country: '' }
};

const STATUS_UI = {
  CONFIRMED: { dot: '🟢', label: 'Confirmed sponsorship' },
  POTENTIAL: { dot: '🟡', label: 'Potential sponsorship' },
  UNKNOWN:   { dot: '⚪', label: 'Not mentioned' },
  NONE:      { dot: '🔴', label: 'No sponsorship' }
};

/* ── Utilities ───────────────────────────────────────────────────── */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function toast(message, isError = false) {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('is-error', isError);
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2800);
}

function csv(str) {
  return String(str || '').split(',').map(s => s.trim()).filter(Boolean);
}

/** Display a country code as "🇸🇪 Sweden", falling back gracefully. */
function countryLabel(code, withFlag = true) {
  const c = Countries.COUNTRIES[code];
  if (!c) return '';
  return withFlag ? `${c.flag} ${c.name}` : c.name;
}

/** The country a job belongs to, however it was recorded. */
function jobCountry(job) {
  return job.countryCode || job.sponsorship?.country || '';
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Ask the content script something, tolerating pages where it isn't injected. */
function ask(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response);
    });
  });
}

/* ── Boot ────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
  state.profile  = await Store.getProfile();
  state.settings = await Store.getSettings();
  state.jobs     = await Store.getJobs();
  state.companies = await Store.getCompanies();

  buildCountryPicker();
  fillCountryDropdowns();

  wireTabs();
  wireCurrent();
  wireJobs();
  wireCompanies();
  wireExport();
  wireProfile();

  fillProfileForm();
  updateBrandSub();
  await refreshTally();
  await detectPage();
  renderJobs();
  renderCompanies();
  renderExportPreview();
});

/* ── Country selection ───────────────────────────────────────────── */

function buildCountryPicker() {
  const grid = $('country-grid');
  const selected = new Set(state.profile.countries || []);

  grid.innerHTML = Countries.COUNTRY_LIST.map(c => `
    <label class="country-opt" title="${esc(c.name)} — ${esc(c.permitName)}">
      <input type="checkbox" class="p-country" value="${c.code}"${selected.has(c.code) ? ' checked' : ''}>
      <span class="flag">${c.flag}</span>
      <span class="cname">${esc(c.name)}</span>
    </label>`).join('');

  // Selecting nothing means "anywhere", which is a valid choice — say so
  // rather than silently scoring every location at 50%.
  grid.insertAdjacentHTML('afterend', `
    <div class="country-actions">
      <button class="btn-link" id="country-all" type="button">Select all</button>
      <button class="btn-link" id="country-none" type="button">Clear</button>
    </div>`);

  $('country-all').addEventListener('click', () => {
    $$('.p-country').forEach(c => { c.checked = true; });
  });
  $('country-none').addEventListener('click', () => {
    $$('.p-country').forEach(c => { c.checked = false; });
  });
}

/** Populate the three country dropdowns with only countries actually seen. */
function fillCountryDropdowns() {
  const seen = new Set(state.jobs.map(jobCountry).filter(Boolean));
  const opts = [...seen]
    .sort((a, b) => (Countries.COUNTRIES[a]?.name || '').localeCompare(Countries.COUNTRIES[b]?.name || ''))
    .map(code => `<option value="${code}">${esc(countryLabel(code))}</option>`)
    .join('');

  for (const [id, current] of [
    ['country-filter',  state.filters.country],
    ['company-country', state.companyFilters.country],
    ['export-country',  '']
  ]) {
    const el = $(id);
    if (!el) continue;
    const label = id === 'company-country' ? 'All countries' : 'All countries';
    el.innerHTML = `<option value="">${label}</option>` + opts;
    el.value = current || '';
  }
}

/* ── Tabs ────────────────────────────────────────────────────────── */

function wireTabs() {
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      $$('.tab').forEach(b => b.classList.toggle('is-active', b === btn));
      $$('.panel').forEach(p => p.classList.toggle('is-active', p.id === `panel-${state.tab}`));
      if (state.tab === 'export') renderExportPreview();
    });
  });
}

async function refreshTally() {
  const stats = await Store.getStats();
  $('tally-confirmed').textContent = stats.confirmed;
  $('tally-jobs').textContent = stats.totalJobs;
  return stats;
}

/* ── This page ───────────────────────────────────────────────────── */

function wireCurrent() {
  $('analyse-btn').addEventListener('click', runAnalysis);
  $('reanalyse-btn').addEventListener('click', runAnalysis);
  $('save-btn').addEventListener('click', saveCurrentJob);
}

async function detectPage() {
  const tab = await activeTab();
  if (!tab?.id) return;

  const ping = await ask(tab.id, { type: 'PING' });

  if (!ping?.supported) {
    $('current-empty').classList.remove('hidden');
    $('current-ready').classList.add('hidden');
    return;
  }

  $('current-empty').classList.add('hidden');
  $('current-ready').classList.remove('hidden');
  $('current-source').textContent = ping.site;
  $('current-title').textContent = ping.pageTitle || 'Job posting';
  $('current-company').textContent = ping.company || '';

  if (!ping.looksLikeJob) {
    $('analyse-hint').textContent = 'This looks like a results list. Open a single posting for the best result.';
  }
}

async function runAnalysis() {
  const tab = await activeTab();
  if (!tab?.id) return;

  const btn = $('analyse-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>Reading the posting…';

  try {
    const res = await ask(tab.id, { type: 'EXTRACT' });

    if (!res) throw new Error('Could not reach the page. Reload it and try again.');
    if (!res.ok) throw new Error(res.error);

    const job = res.job;

    // 1. Local rules pass — always runs, always free.
    // The posting's own country wins; the profile only breaks ties when the
    // posting is ambiguous, so a German ad never gets analysed as Swedish.
    let analysis = analyzeSponsorship(job.description, {
      url: job.url,
      title: job.title,
      location: job.location
    });

    if (!analysis.country && (state.profile.countries || []).length === 1) {
      analysis = analyzeSponsorship(job.description, {
        url: job.url,
        title: job.title,
        location: job.location,
        country: state.profile.countries[0]
      });
    }

    // 2. Optional AI pass.
    if (state.settings.aiProvider !== 'none' && state.settings.aiApiKey) {
      btn.innerHTML = '<span class="spin"></span>Checking with AI…';
      try {
        const aiResult = await AI.runAiAnalysis(job, state.settings);
        analysis = AI.mergeAnalyses(analysis, aiResult);
      } catch (err) {
        toast(`AI step skipped: ${err.message}`, true);
      }
    }

    state.currentJob = job;
    state.currentAnalysis = analysis;

    const match = Matching.calculateMatch(
      { ...job, sponsorship: analysis, countryCode: analysis.country }, state.profile);

    // Persist so it appears in lists and exports.
    const { job: stored } = await Store.upsertJob({
      ...job,
      countryCode: analysis.country || '',
      country: analysis.country ? (Countries.COUNTRIES[analysis.country]?.name || job.country) : job.country,
      sponsorship: analysis,
      matchScore: match.score
    });
    state.currentJob = stored;

    state.jobs = await Store.getJobs();
    state.companies = await Store.getCompanies();
    fillCountryDropdowns();

    renderResult(stored, analysis, match);
    await refreshTally();
    renderJobs();
    renderCompanies();

    ask(tab.id, { type: 'SHOW_BADGE', analysis });

  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analyse this posting';
  }
}

function renderResult(job, analysis, match) {
  $('current-ready').classList.add('hidden');
  $('current-result').classList.remove('hidden');

  const ui = STATUS_UI[analysis.status];
  const verdict = $('verdict');
  verdict.dataset.status = analysis.status;
  $('verdict-dot').textContent = ui.dot;
  $('verdict-label').textContent = ui.label;
  $('verdict-reason').textContent = analysis.reason;
  $('confidence-fill').style.width = `${analysis.confidence}%`;
  $('confidence-num').textContent = `${analysis.confidence}%`;

  $('historical-warn').classList.toggle('hidden', !analysis.historical);

  // Evidence — the point of the whole product
  const list = $('evidence-list');
  if (!analysis.evidence.length) {
    list.innerHTML = `<p class="block-sub" style="margin:0">No sentence in this posting refers to permits, visas, sponsorship, or relocation.</p>`;
  } else {
    list.innerHTML = analysis.evidence.map(e => `
      <div class="evidence" data-kind="${esc(e.kind)}">
        <div class="evidence-label">${esc(e.label)}</div>
        <div class="evidence-quote">${esc(e.sentence)}</div>
      </div>
    `).join('');
  }

  // Name the actual permit route so the user knows what to ask about
  const cc = Countries.COUNTRIES[analysis.country];
  const hintEl = $('permit-hint');
  if (cc && hintEl) {
    hintEl.classList.remove('hidden');
    hintEl.innerHTML = `Detected ${cc.flag} ${esc(cc.name)}. The relevant route here is usually the <b>${esc(cc.permitName)}</b>. <a href="${esc(cc.officialUrl)}" target="_blank" rel="noopener">Official guidance</a>`;
  } else if (hintEl) {
    hintEl.classList.add('hidden');
  }

  const notes = [];
  if (analysis.method !== 'rules') notes.push(`Method: ${analysis.method}.`);
  if (analysis.aiNote) notes.push(analysis.aiNote);
  if (analysis.aiRejectedQuotes) notes.push(`${analysis.aiRejectedQuotes} AI quote(s) discarded — not found in the posting.`);
  $('evidence-note').textContent = notes.join(' ');

  // Match breakdown
  $('match-pill').textContent = `${match.score}% · ${match.headline}`;
  $('match-bars').innerHTML = match.breakdown.map(f => {
    const cls = f.pct >= 75 ? 'is-high' : f.pct >= 45 ? 'is-mid' : 'is-low';
    return `
      <div class="mb">
        <span class="mb-label">${esc(f.label)}</span>
        <span class="mb-track"><span class="mb-fill ${cls}" style="width:${f.pct}%"></span></span>
        <span class="mb-val">${f.pct}</span>
        ${f.note ? `<span class="mb-note">${esc(f.note)}</span>` : ''}
      </div>`;
  }).join('');

  // Facts
  const rows = [
    ['Company',   job.company || '—'],
    ['Location',  job.location || '—'],
    ['Work mode', job.workMode || '—'],
    ['Experience', job.experience?.text || '—'],
    ['Salary',    job.salary?.text || '—'],
    ['Source',    job.source || '—']
  ];
  const tech = (job.technologies || []).length
    ? `<div class="tags">${job.technologies.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>`
    : '—';

  $('facts').innerHTML =
    rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') +
    `<dt>Tech</dt><dd>${tech}</dd>`;

  const saveBtn = $('save-btn');
  saveBtn.textContent = job.saved ? 'Saved' : 'Save job';
  saveBtn.classList.toggle('is-on', !!job.saved);
}

async function saveCurrentJob() {
  if (!state.currentJob) return;
  const next = !state.currentJob.saved;
  const updated = await Store.updateJob(state.currentJob.id, {
    saved: next,
    savedAt: next ? new Date().toISOString() : '',
    applicationStatus: next ? (state.currentJob.applicationStatus || 'Saved') : state.currentJob.applicationStatus
  });
  state.currentJob = updated;
  state.jobs = await Store.getJobs();

  const btn = $('save-btn');
  btn.textContent = next ? 'Saved' : 'Save job';
  btn.classList.toggle('is-on', next);
  toast(next ? 'Saved to your list' : 'Removed from saved');
  renderJobs();
  renderExportPreview();
}

/* ── Jobs list ───────────────────────────────────────────────────── */

function wireJobs() {
  $('job-search').addEventListener('input', (e) => {
    state.filters.query = e.target.value.toLowerCase();
    renderJobs();
  });

  $$('#status-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const s = chip.dataset.status;
      if (state.filters.statuses.has(s)) state.filters.statuses.delete(s);
      else state.filters.statuses.add(s);
      chip.classList.toggle('is-on');
      renderJobs();
    });
  });

  $('sort-by').addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    renderJobs();
  });

  $('country-filter').addEventListener('change', (e) => {
    state.filters.country = e.target.value;
    renderJobs();
  });

  $('saved-only').addEventListener('change', (e) => {
    state.filters.savedOnly = e.target.checked;
    renderJobs();
  });
}

function filteredJobs() {
  const f = state.filters;
  let list = state.jobs.filter(j => {
    const status = j.sponsorship?.status || 'UNKNOWN';
    if (!f.statuses.has(status)) return false;
    if (f.savedOnly && !j.saved) return false;
    if (f.country && jobCountry(j) !== f.country) return false;
    if (f.query) {
      const hay = `${j.title} ${j.company} ${(j.technologies || []).join(' ')} ${j.location}`.toLowerCase();
      if (!hay.includes(f.query)) return false;
    }
    return true;
  });

  const rank = { CONFIRMED: 3, POTENTIAL: 2, UNKNOWN: 1, NONE: 0 };
  const sorters = {
    match:   (a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0),
    status:  (a, b) => rank[b.sponsorship?.status || 'UNKNOWN'] - rank[a.sponsorship?.status || 'UNKNOWN'] || (b.matchScore ?? 0) - (a.matchScore ?? 0),
    recent:  (a, b) => new Date(b.collectedAt) - new Date(a.collectedAt),
    company: (a, b) => (a.company || '').localeCompare(b.company || '')
  };
  return list.sort(sorters[f.sort] || sorters.match);
}

function renderJobs() {
  const list = filteredJobs();
  const el = $('jobs-list');

  if (!state.jobs.length) {
    el.innerHTML = `<div class="empty">
      <p class="empty-title">No jobs collected yet</p>
      <p class="empty-body">Open a .NET job posting on a supported site and analyse it from the "This page" tab. Everything you analyse is collected here.</p>
    </div>`;
    return;
  }

  if (!list.length) {
    el.innerHTML = `<div class="empty"><p class="empty-body">No jobs match these filters.</p></div>`;
    return;
  }

  el.innerHTML = list.map(j => {
    const status = j.sponsorship?.status || 'UNKNOWN';
    const quote = j.sponsorship?.evidence?.[0]?.sentence || '';
    const statuses = Store.APPLICATION_STATUSES
      .map(s => `<option value="${esc(s)}"${j.applicationStatus === s ? ' selected' : ''}>${esc(s)}</option>`)
      .join('');

    return `
      <article class="card" data-status="${status}" data-id="${esc(j.id)}">
        <div class="card-top">
          <div>
            <div class="card-title">${esc(j.title)}</div>
            <div class="card-company">${esc(j.company || 'Unknown company')}${j.location ? ' · ' + esc(j.location) : ''}</div>
          </div>
          <span class="card-score">${j.matchScore ?? '—'}%</span>
        </div>
        <div class="card-row">
          <span class="badge" data-status="${status}">${STATUS_UI[status].dot} ${esc(STATUS_UI[status].label)}</span>
          ${jobCountry(j) ? `<span class="tag-country">${esc(countryLabel(jobCountry(j)))}</span>` : ''}
          ${j.sponsorship?.historical ? '<span class="badge" data-status="POTENTIAL">Verify — historical</span>' : ''}
          ${j.workMode ? `<span class="tag">${esc(j.workMode)}</span>` : ''}
        </div>
        ${quote ? `<div class="card-quote">${esc(quote.slice(0, 150))}${quote.length > 150 ? '…' : ''}</div>` : ''}
        <div class="card-actions">
          <button class="mini act-open" data-id="${esc(j.id)}">Open</button>
          <button class="mini act-save ${j.saved ? 'is-on' : ''}" data-id="${esc(j.id)}">${j.saved ? 'Saved' : 'Save'}</button>
          <select class="card-select act-status" data-id="${esc(j.id)}">
            <option value="">Status…</option>${statuses}
          </select>
        </div>
      </article>`;
  }).join('');

  el.querySelectorAll('.act-open').forEach(b =>
    b.addEventListener('click', () => {
      const job = state.jobs.find(j => j.id === b.dataset.id);
      if (job?.url) chrome.tabs.create({ url: job.url });
    }));

  el.querySelectorAll('.act-save').forEach(b =>
    b.addEventListener('click', async () => {
      const job = state.jobs.find(j => j.id === b.dataset.id);
      const next = !job.saved;
      await Store.updateJob(job.id, {
        saved: next,
        savedAt: next ? new Date().toISOString() : '',
        applicationStatus: next ? (job.applicationStatus || 'Saved') : job.applicationStatus
      });
      state.jobs = await Store.getJobs();
      renderJobs();
      renderExportPreview();
      toast(next ? 'Saved' : 'Removed from saved');
    }));

  el.querySelectorAll('.act-status').forEach(sel =>
    sel.addEventListener('change', async () => {
      const value = sel.value;
      if (!value) return;
      const patch = { applicationStatus: value, saved: true };
      if (value === 'Applied') patch.appliedDate = new Date().toISOString();
      if (['Interview', 'Technical interview', 'Offer'].includes(value)) patch.interviewStatus = value;
      await Store.updateJob(sel.dataset.id, patch);
      state.jobs = await Store.getJobs();
      renderJobs();
      renderExportPreview();
      toast(`Marked as ${value.toLowerCase()}`);
    }));
}

/* ── Companies ───────────────────────────────────────────────────── */

function wireCompanies() {
  $('company-search').addEventListener('input', (e) => {
    state.companyFilters.query = e.target.value.toLowerCase();
    renderCompanies();
  });
  $('company-sort').addEventListener('change', (e) => {
    state.companyFilters.sort = e.target.value;
    renderCompanies();
  });
  $('company-country').addEventListener('change', (e) => {
    state.companyFilters.country = e.target.value;
    renderCompanies();
  });
}

function renderCompanies() {
  const el = $('companies-list');
  const f = state.companyFilters;

  let list = state.companies.filter(c => {
    if (f.country && c.country !== f.country) return false;
    if (!f.query) return true;
    return c.name.toLowerCase().includes(f.query) || (c.location || '').toLowerCase().includes(f.query);
  });

  const rank = { CONFIRMED: 3, POTENTIAL: 2, UNKNOWN: 1, NONE: 0 };
  const sorters = {
    status: (a, b) => rank[b.sponsorshipStatus] - rank[a.sponsorshipStatus] || b.jobIds.length - a.jobIds.length,
    jobs:   (a, b) => b.jobIds.length - a.jobIds.length,
    recent: (a, b) => new Date(b.evidenceDate || 0) - new Date(a.evidenceDate || 0),
    name:   (a, b) => a.name.localeCompare(b.name)
  };
  list = list.sort(sorters[f.sort] || sorters.status);

  if (!list.length) {
    el.innerHTML = `<div class="empty">
      <p class="empty-title">No companies yet</p>
      <p class="empty-body">Companies are built automatically from the postings you analyse. Each company appears once, however many of its roles you collect.</p>
    </div>`;
    return;
  }

  el.innerHTML = list.map(c => {
    const historical = Store.isEvidenceHistorical(c.evidenceDate);
    return `
      <article class="card" data-status="${c.sponsorshipStatus}">
        <div class="card-top">
          <div>
            <div class="card-title">${esc(c.name)}</div>
            <div class="card-company">${esc(c.location || 'Location unknown')}${c.country ? ' · ' + esc(countryLabel(c.country)) : ''} · ${c.jobIds.length} role${c.jobIds.length === 1 ? '' : 's'} collected</div>
          </div>
        </div>
        <div class="card-row">
          <span class="badge" data-status="${c.sponsorshipStatus}">${STATUS_UI[c.sponsorshipStatus].dot} ${esc(STATUS_UI[c.sponsorshipStatus].label)}</span>
          ${historical && c.sponsorshipStatus !== 'UNKNOWN'
            ? '<span class="badge" data-status="POTENTIAL">Historical — verify</span>'
            : ''}
        </div>
        ${c.sponsorshipEvidence ? `<div class="card-quote">${esc(c.sponsorshipEvidence.slice(0, 160))}</div>` : ''}
        ${c.sponsoredJobTitles?.length
          ? `<div class="card-row">${c.sponsoredJobTitles.slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>`
          : ''}
        ${c.evidenceSourceUrl
          ? `<div class="card-actions"><button class="mini act-src" data-url="${esc(c.evidenceSourceUrl)}">Open source posting</button></div>`
          : ''}
      </article>`;
  }).join('');

  el.querySelectorAll('.act-src').forEach(b =>
    b.addEventListener('click', () => chrome.tabs.create({ url: b.dataset.url })));
}

/* ── Export ──────────────────────────────────────────────────────── */

function wireExport() {
  $$('.exp-status').forEach(cb => cb.addEventListener('change', renderExportPreview));
  $$('input[name="scope"]').forEach(r => r.addEventListener('change', renderExportPreview));
  $('export-country').addEventListener('change', renderExportPreview);
  $('export-btn').addEventListener('click', doExport);

  $('clear-btn').addEventListener('click', async () => {
    if (!confirm('Delete every collected job and company? This cannot be undone.')) return;
    await Store.clearAll();
    state.jobs = [];
    state.companies = [];
    fillCountryDropdowns();
    renderJobs();
    renderCompanies();
    renderExportPreview();
    await refreshTally();
    toast('All collected data cleared');
  });
}

function exportSelection() {
  const statuses = $$('.exp-status').filter(c => c.checked).map(c => c.value);
  const scope = document.querySelector('input[name="scope"]:checked')?.value || 'all';
  const country = $('export-country')?.value || '';

  let jobs = scope === 'saved' ? state.jobs.filter(j => j.saved) : state.jobs;
  if (country) jobs = jobs.filter(j => jobCountry(j) === country);

  const companies = country
    ? state.companies.filter(c => c.country === country)
    : state.companies;

  const included = jobs.filter(j => statuses.includes(j.sponsorship?.status || 'UNKNOWN'));
  return { statuses, scope, country, jobs, companies, included };
}

function renderExportPreview() {
  const { included } = exportSelection();
  const companies = new Set(included.map(j => Store.companyKey(j.company)).filter(Boolean));
  const confirmed = included.filter(j => j.sponsorship?.status === 'CONFIRMED').length;

  $('preview-grid').innerHTML = `
    <div class="pv"><div class="pv-num">${included.length}</div><div class="pv-lab">jobs</div></div>
    <div class="pv"><div class="pv-num">${companies.size}</div><div class="pv-lab">companies</div></div>
    <div class="pv"><div class="pv-num">${confirmed}</div><div class="pv-lab">confirmed</div></div>
  `;

  $('export-btn').disabled = included.length === 0;
  $('export-hint').textContent = included.length
    ? 'Built on your device. Nothing is uploaded.'
    : 'Nothing matches this selection yet.';
}

async function doExport() {
  const btn = $('export-btn');
  const { statuses, scope, country, jobs, companies } = exportSelection();

  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>Building workbook…';

  try {
    const stats = await Store.getStats();
    const suffix = country ? `-${country.toLowerCase()}` : '';
    const result = await Exporter.exportWorkbook({
      jobs,
      companies,
      stats,
      statuses,
      scope,
      country: country ? countryLabel(country, false) : 'All countries',
      filename: `visa-sponsorship-jobs${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`
    });
    toast(`${result.jobCount} jobs exported`);
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download Excel workbook';
    renderExportPreview();
  }
}

/* ── Profile ─────────────────────────────────────────────────────── */

function wireProfile() {
  $('save-profile-btn').addEventListener('click', async () => {
    state.profile = {
      yearsExperience: parseFloat($('p-years').value) || 0,
      jobTitle: $('p-title').value.trim(),
      primaryTech: csv($('p-primary').value),
      secondaryTech: csv($('p-secondary').value),
      desiredSalary: $('p-salary').value.trim(),
      countries: $$('.p-country').filter(c => c.checked).map(c => c.value),
      preferredCities: csv($('p-cities').value),
      workMode: $('p-mode').value,
      sponsorshipRequired: $('p-sponsor').checked,
      relocationRequired: $('p-relocate').checked
    };
    await Store.saveProfile(state.profile);

    // Rescore everything already collected so the lists stay meaningful.
    for (const job of state.jobs) {
      const match = Matching.calculateMatch(job, state.profile);
      await Store.updateJob(job.id, { matchScore: match.score });
    }
    state.jobs = await Store.getJobs();
    fillCountryDropdowns();
    renderJobs();
    updateBrandSub();
    const n = state.profile.countries.length;
    toast(n ? `Profile saved — ${n} countr${n === 1 ? 'y' : 'ies'}, all jobs rescored` : 'Profile saved — open to any country');
  });

  $('ai-provider').addEventListener('change', () => {
    const off = $('ai-provider').value === 'none';
    $('ai-key-field').classList.toggle('hidden', off);
  });

  $('save-ai-btn').addEventListener('click', async () => {
    const provider = $('ai-provider').value;
    const key = $('ai-key').value.trim();

    if (provider !== 'none' && !key) {
      toast('Add an API key or set the provider to off', true);
      return;
    }

    // Ask for host access only for the provider actually chosen.
    if (provider !== 'none') {
      const origins = {
        anthropic: 'https://api.anthropic.com/*',
        gemini:    'https://generativelanguage.googleapis.com/*',
        openai:    'https://api.openai.com/*'
      };
      const granted = await chrome.permissions.request({ origins: [origins[provider]] })
        .catch(() => false);
      if (!granted) {
        toast('Permission denied — staying on rules-only analysis', true);
        return;
      }
    }

    state.settings = { ...state.settings, aiProvider: provider, aiApiKey: key, aiEnabled: provider !== 'none' };
    await Store.saveSettings(state.settings);
    toast(provider === 'none' ? 'AI turned off' : `${AI.AI_PROVIDERS[provider].label} connected`);
  });
}

function updateBrandSub() {
  const el = $('brand-sub');
  if (!el) return;
  const codes = state.profile.countries || [];
  if (!codes.length) { el.textContent = '.NET roles, any country'; return; }
  if (codes.length === 1) { el.textContent = `.NET roles in ${Countries.COUNTRIES[codes[0]]?.name || 'your country'}`; return; }
  if (codes.length <= 3) {
    el.textContent = codes.map(c => Countries.COUNTRIES[c]?.flag || '').join(' ') + ` ${codes.length} countries`;
    return;
  }
  el.textContent = `.NET roles across ${codes.length} countries`;
}

function fillProfileForm() {
  const p = state.profile;
  $('p-years').value     = p.yearsExperience;
  $('p-title').value     = p.jobTitle;
  $('p-primary').value   = (p.primaryTech || []).join(', ');
  $('p-secondary').value = (p.secondaryTech || []).join(', ');
  $('p-cities').value    = (p.preferredCities || []).join(', ');
  $('p-salary').value    = p.desiredSalary || '';
  $('p-mode').value      = p.workMode || 'Any';
  $('p-sponsor').checked  = !!p.sponsorshipRequired;
  $('p-relocate').checked = !!p.relocationRequired;

  $('ai-provider').value = state.settings.aiProvider || 'none';
  $('ai-key').value = state.settings.aiApiKey || '';
  $('ai-key-field').classList.toggle('hidden', (state.settings.aiProvider || 'none') === 'none');
}
