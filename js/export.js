/**
 * export.js — Builds the multi-sheet .xlsx workbook (spec §16–17).
 *
 * Sheets: Visa Sponsorship Jobs | Sponsoring Companies | Potential Sponsors
 *         | Saved Jobs | Application Tracker | Read Me
 *
 * Everything runs client-side via the bundled SheetJS build. No network call,
 * no server, no copy-paste.
 */

const SHEET_LIMITS = { CELL: 32000 };

/* ── Cell helpers ────────────────────────────────────────────────── */

function clean(value) {
  if (value === null || value === undefined) return '';
  const s = String(value).replace(/\s+/g, ' ').trim();
  return s.length > SHEET_LIMITS.CELL ? s.slice(0, SHEET_LIMITS.CELL - 1) + '…' : s;
}

function statusCell(status) {
  const map = {
    CONFIRMED: '🟢 Confirmed',
    POTENTIAL: '🟡 Potential',
    UNKNOWN:   '⚪ Unknown',
    NONE:      '🔴 No sponsorship'
  };
  return map[status] || '⚪ Unknown';
}

function dateCell(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

/** Turn a URL into a clickable, readable hyperlink cell. */
function linkCell(url, text) {
  if (!url) return { v: '' };
  return {
    v: text || url,
    l: { Target: url, Tooltip: url },
    s: { font: { color: { rgb: '0B5FFF' }, underline: true } }
  };
}

/**
 * Convert an array of row objects into a worksheet with:
 * frozen header, autofilter, sized columns, styled header row.
 */
function buildSheet(rows, columns) {
  const header = columns.map(c => c.header);

  const aoa = [header];
  for (const row of rows) {
    aoa.push(columns.map(c => {
      const val = c.get(row);
      return (val && typeof val === 'object' && ('v' in val)) ? val : clean(val);
    }));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa.map(r => r.map(c =>
    (c && typeof c === 'object' && 'v' in c) ? c.v : c
  )));

  // Re-apply hyperlink objects, which aoa_to_sheet flattens away.
  aoa.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell && typeof cell === 'object' && cell.l) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]) ws[addr].l = cell.l;
      }
    });
  });

  ws['!cols'] = columns.map(c => ({ wch: c.width || 18 }));

  // Autofilter gives every header a sort/filter dropdown in Excel.
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(rows.length, 1), c: columns.length - 1 }
    })
  };

  // Note: frozen panes are not available in the open-source SheetJS writer,
  // so the Read Me sheet tells the user the one-click Excel equivalent
  // (View > Freeze Panes > Freeze Top Row) rather than us silently failing.
  ws['!rows'] = [{ hpx: 22 }];

  return ws;
}

/* ── Column definitions ──────────────────────────────────────────── */

const JOB_COLUMNS = [
  { header: 'Company',              width: 24, get: j => j.company },
  { header: 'Job Title',            width: 32, get: j => j.title },
  { header: 'Location',             width: 18, get: j => j.location },
  { header: 'Country',              width: 14, get: j => j.country || '' },
  { header: 'Visa Sponsorship',     width: 18, get: j => statusCell(j.sponsorship?.status) },
  { header: 'Confidence %',         width: 12, get: j => j.sponsorship?.confidence ?? '' },
  { header: 'Sponsorship Evidence', width: 60, get: j => j.sponsorship?.evidence?.[0]?.sentence || '' },
  { header: 'Evidence Type',        width: 16, get: j => j.sponsorship?.historical ? 'Historical — verify' : (j.sponsorship?.conditional ? 'Conditional' : 'Current') },
  { header: 'Relocation Support',   width: 16, get: j => j.sponsorship?.relocation ? 'Yes' : '' },
  { header: 'Salary',               width: 22, get: j => j.salary?.text || '' },
  { header: 'Currency',             width: 10, get: j => j.salary?.currency || '' },
  { header: 'Experience',           width: 16, get: j => j.experience?.text || '' },
  { header: 'Work Mode',            width: 12, get: j => j.workMode || '' },
  { header: 'Technologies',         width: 40, get: j => (j.technologies || []).join(', ') },
  { header: 'Match Score',          width: 12, get: j => j.matchScore ?? '' },
  { header: 'Job Source',           width: 16, get: j => j.source || '' },
  { header: 'Job URL',              width: 42, get: j => linkCell(j.url, 'Open posting') },
  { header: 'Date Posted',          width: 14, get: j => dateCell(j.postedDate) },
  { header: 'Date Collected',       width: 14, get: j => dateCell(j.collectedAt) }
];

const COMPANY_COLUMNS = [
  { header: 'Company Name',         width: 26, get: c => c.name },
  { header: 'Industry',             width: 20, get: c => c.industry },
  { header: 'Company Size',         width: 14, get: c => c.size },
  { header: 'Country',              width: 14, get: c => c.country ? (typeof Countries !== 'undefined' ? (Countries.COUNTRIES[c.country]?.name || c.country) : c.country) : '' },
  { header: 'Location',             width: 20, get: c => c.location },
  { header: 'Website',              width: 30, get: c => c.website ? linkCell(c.website, c.website) : '' },
  { header: 'Careers URL',          width: 30, get: c => c.careersUrl ? linkCell(c.careersUrl, 'Careers') : '' },
  { header: 'LinkedIn URL',         width: 30, get: c => c.linkedinUrl ? linkCell(c.linkedinUrl, 'LinkedIn') : '' },
  { header: 'Sponsorship Status',   width: 18, get: c => statusCell(c.sponsorshipStatus) },
  { header: 'Evidence Age',         width: 18, get: c => Store.isEvidenceHistorical(c.evidenceDate) ? 'Historical — verify' : 'Current' },
  { header: 'Sponsorship Evidence', width: 60, get: c => c.sponsorshipEvidence },
  { header: 'Sponsored Job Titles', width: 40, get: c => (c.sponsoredJobTitles || []).join('; ') },
  { header: 'Active Job Count',     width: 14, get: c => (c.jobIds || []).length },
  { header: 'Evidence Source',      width: 42, get: c => c.evidenceSourceUrl ? linkCell(c.evidenceSourceUrl, 'Source posting') : '' },
  { header: 'Last Updated',         width: 14, get: c => dateCell(c.lastUpdated) }
];

const TRACKER_COLUMNS = [
  { header: 'Company',            width: 24, get: j => j.company },
  { header: 'Job Title',          width: 32, get: j => j.title },
  { header: 'Visa Sponsorship',   width: 18, get: j => statusCell(j.sponsorship?.status) },
  { header: 'Job URL',            width: 42, get: j => linkCell(j.url, 'Open posting') },
  { header: 'Application Status', width: 20, get: j => j.applicationStatus || 'Saved' },
  { header: 'Applied Date',       width: 14, get: j => dateCell(j.appliedDate) },
  { header: 'Interview Status',   width: 20, get: j => j.interviewStatus || '' },
  { header: 'Notes',              width: 50, get: j => j.notes || '' },
  { header: 'Saved Date',         width: 14, get: j => dateCell(j.savedAt) }
];

/* ── Read Me sheet ───────────────────────────────────────────────── */

function buildReadMeSheet(stats, options) {
  const rows = [
    ['.NET Jobs — Visa Sponsorship Export'],
    [''],
    ['Generated', new Date().toLocaleString('sv-SE')],
    [''],
    ['HOW TO READ THE SPONSORSHIP COLUMN'],
    ['🟢 Confirmed', 'The posting explicitly states the employer supports work permits or visas.'],
    ['', 'Wording is country-specific: Blue Card, Skilled Worker visa, arbetstillstånd, LMIA and so on.'],
    ['🟡 Potential', 'Signals point to international hiring, or sponsorship is conditional. Not confirmed.'],
    ['⚪ Unknown',   'The posting does not mention permits, visas, or relocation.'],
    ['🔴 No sponsorship', 'The posting requires existing right to work, or rules sponsorship out.'],
    [''],
    ['IMPORTANT'],
    ['', 'Every status in this file comes from text found in the job posting itself.'],
    ['', 'The Sponsorship Evidence column shows the exact sentence used.'],
    ['', 'A status is never inferred from company size, industry, or location.'],
    ['', 'Rows marked "Historical — verify" rely on evidence older than 6 months'],
    ['', 'or past-tense wording. Confirm with the employer before relying on them.'],
    [''],
    ['TIPS'],
    ['', 'Every header has a filter dropdown — click it to sort or filter.'],
    ['', 'To keep headers visible while scrolling: View > Freeze Panes > Freeze Top Row.'],
    ['', 'Job URL and Evidence Source columns are clickable links.'],
    [''],
    ['CONTENTS'],
    ['Total jobs', stats.totalJobs],
    ['Companies', stats.totalCompanies],
    ['Confirmed sponsorship', stats.confirmed],
    ['Potential sponsorship', stats.potential],
    ['Unknown', stats.unknown],
    ['No sponsorship', stats.none],
    ['Saved jobs', stats.saved],
    [''],
    ['FILTERS APPLIED'],
    ['Statuses included', (options.statuses || []).join(', ') || 'All'],
    ['Scope', options.scope || 'All discovered jobs'],
    ['Countries', options.country || 'All countries']
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 26 }, { wch: 78 }];
  return ws;
}

/* ── Main export ─────────────────────────────────────────────────── */

/**
 * @param {object} opts
 *   jobs, companies, stats
 *   statuses: array of statuses to include
 *   scope: 'all' | 'filtered' | 'saved'
 */
async function exportWorkbook({ jobs, companies, stats, statuses, scope, country, filename }) {
  if (typeof XLSX === 'undefined') {
    throw new Error('Spreadsheet library failed to load. Reload the extension and try again.');
  }

  const allowed = new Set(statuses && statuses.length ? statuses : ['CONFIRMED','POTENTIAL','UNKNOWN','NONE']);
  const filteredJobs = jobs.filter(j => allowed.has(j.sponsorship?.status || 'UNKNOWN'));

  if (!filteredJobs.length && !companies.length) {
    throw new Error('Nothing to export yet. Analyse some job postings first.');
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1 — all jobs passing the filter, best matches first
  const sorted = [...filteredJobs].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  XLSX.utils.book_append_sheet(wb, buildSheet(sorted, JOB_COLUMNS), 'Visa Sponsorship Jobs');

  // Sheet 2 — companies with confirmed evidence
  const confirmedCos = companies.filter(c => c.sponsorshipStatus === 'CONFIRMED');
  XLSX.utils.book_append_sheet(wb, buildSheet(confirmedCos, COMPANY_COLUMNS), 'Sponsoring Companies');

  // Sheet 3 — companies where it looks possible but is unproven
  const potentialCos = companies.filter(c => c.sponsorshipStatus === 'POTENTIAL');
  XLSX.utils.book_append_sheet(wb, buildSheet(potentialCos, COMPANY_COLUMNS), 'Potential Sponsors');

  // Sheet 4 — saved jobs
  const saved = jobs.filter(j => j.saved);
  XLSX.utils.book_append_sheet(wb, buildSheet(saved, JOB_COLUMNS), 'Saved Jobs');

  // Sheet 5 — application tracker
  const tracked = jobs.filter(j => j.saved || j.applicationStatus);
  XLSX.utils.book_append_sheet(wb, buildSheet(tracked, TRACKER_COLUMNS), 'Application Tracker');

  // Sheet 6 — read me
  XLSX.utils.book_append_sheet(wb, buildReadMeSheet(stats, { statuses: [...allowed], scope, country }), 'Read Me');

  const name = filename || `visa-sponsorship-jobs-${new Date().toISOString().slice(0,10)}.xlsx`;

  // Build in memory rather than calling writeFile: a popup can be dismissed
  // mid-write, and the downloads API survives that.
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
  await downloadBuffer(buffer, name);

  return {
    filename: name,
    jobCount: filteredJobs.length,
    companyCount: confirmedCos.length + potentialCos.length,
    savedCount: saved.length
  };
}

/** Hand the workbook to Chrome's download manager. */
function downloadBuffer(buffer, filename) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);

    const revoke = () => setTimeout(() => URL.revokeObjectURL(url), 60000);

    if (typeof chrome !== 'undefined' && chrome.downloads?.download) {
      chrome.downloads.download({ url, filename, saveAs: true }, (id) => {
        if (chrome.runtime.lastError) {
          revoke();
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          revoke();
          resolve(id);
        }
      });
    } else {
      // Fallback for contexts without the downloads permission
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      revoke();
      resolve();
    }
  });
}

const Exporter = { exportWorkbook, statusCell };
if (typeof window !== 'undefined') window.Exporter = Exporter;
