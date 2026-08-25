/**
 * content.js — Reads the job posting already visible on the page.
 *
 * Scope note (spec §3): this only reads content the user is currently looking
 * at, in their own authenticated session. It does not crawl, paginate,
 * enumerate listings, defeat bot protection, or call private endpoints.
 * One page, on request.
 */

(() => {
  'use strict';

  const SITES = [
    {
      id: 'LinkedIn',
      test: () => location.hostname.includes('linkedin.com'),
      isJobPage: () => /\/jobs\/(view|collections|search)/.test(location.pathname) || !!new URLSearchParams(location.search).get('currentJobId'),
      title:   ['.job-details-jobs-unified-top-card__job-title h1', '.jobs-unified-top-card__job-title', '.top-card-layout__title', 'h1.t-24'],
      company: ['.job-details-jobs-unified-top-card__company-name a', '.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name', '.topcard__org-name-link'],
      location:['.job-details-jobs-unified-top-card__primary-description-container .tvm__text', '.jobs-unified-top-card__bullet', '.topcard__flavor--bullet'],
      body:    ['#job-details', '.jobs-description__content', '.jobs-box__html-content', '.description__text', '.show-more-less-html__markup']
    },
    {
      id: 'Indeed',
      test: () => location.hostname.includes('indeed.com'),
      isJobPage: () => /\/(viewjob|jobs)/.test(location.pathname),
      title:   ['[data-testid="jobsearch-JobInfoHeader-title"]', '.jobsearch-JobInfoHeader-title', 'h1.jobsearch-JobInfoHeader-title'],
      company: ['[data-testid="inlineHeader-companyName"]', '[data-company-name]', '.jobsearch-CompanyInfoContainer a'],
      location:['[data-testid="inlineHeader-companyLocation"]', '[data-testid="job-location"]', '.jobsearch-JobInfoHeader-subtitle div'],
      body:    ['#jobDescriptionText', '.jobsearch-jobDescriptionText']
    },
    {
      id: 'Glassdoor',
      test: () => location.hostname.includes('glassdoor'),
      isJobPage: () => /\/(job-listing|Job)/i.test(location.pathname),
      title:   ['[data-test="job-title"]', '.JobDetails_jobTitle__', 'h1'],
      company: ['[data-test="employer-name"]', '.EmployerProfile_employerName__'],
      location:['[data-test="location"]', '.JobDetails_location__'],
      body:    ['[class*="JobDetails_jobDescription"]', '#JobDescriptionContainer', '.desc']
    },
    {
      id: 'The Hub',
      test: () => location.hostname.includes('thehub.io'),
      isJobPage: () => /\/jobs\//.test(location.pathname),
      title:   ['h1', '.view-job__title'],
      company: ['.view-job-details__company-name', 'a[href*="/startups/"]'],
      location:['.view-job-details__location', '[class*="location"]'],
      body:    ['.view-job-details__content', '.text-block', 'main']
    },
    {
      id: 'Arbetsförmedlingen',
      test: () => location.hostname.includes('arbetsformedlingen.se'),
      isJobPage: () => /annons|jobb/i.test(location.pathname),
      title:   ['h1', '.job-title'],
      company: ['.company-name', '[class*="employer"]'],
      location:['[class*="location"]', '[class*="workplace"]'],
      body:    ['.job-description', '[class*="description"]', 'main']
    },
    {
      id: 'Jobbsafari',
      test: () => location.hostname.includes('jobbsafari.se'),
      isJobPage: () => /\/jobb/i.test(location.pathname),
      title:   ['h1'],
      company: ['[class*="company"]', '[class*="employer"]'],
      location:['[class*="location"]'],
      body:    ['[class*="description"]', 'article', 'main']
    },
    {
      id: 'Academic Work',
      test: () => location.hostname.includes('academicwork'),
      isJobPage: () => /job|jobb/i.test(location.pathname),
      title:   ['h1'],
      company: ['[class*="company"]'],
      location:['[class*="location"]'],
      body:    ['[class*="description"]', 'main']
    },
    {
      id: 'Welcome to the Jungle',
      test: () => location.hostname.includes('welcometothejungle'),
      isJobPage: () => /\/jobs\//.test(location.pathname),
      title:   ['h1', '[class*="JobTitle"]'],
      company: ['[class*="companyName"]', 'a[href*="/companies/"]'],
      location:['[class*="location"]'],
      body:    ['[class*="jobDescription"]', 'article', 'main']
    },
    {
      id: 'StepStone',
      test: () => location.hostname.includes('stepstone'),
      isJobPage: () => /stellenangebote|job/i.test(location.pathname),
      title:   ['h1', '[data-at="header-job-title"]'],
      company: ['[data-at="metadata-company-name"]', '[class*="company"]'],
      location:['[data-at="metadata-location"]', '[class*="location"]'],
      body:    ['[data-at="job-ad-content"]', '[class*="description"]', 'main']
    },
    {
      id: 'Jobs.ie',
      test: () => location.hostname.includes('jobs.ie') || location.hostname.includes('irishjobs'),
      isJobPage: () => /job/i.test(location.pathname),
      title:   ['h1'],
      company: ['[class*="company"]', '[class*="employer"]'],
      location:['[class*="location"]'],
      body:    ['[class*="description"]', 'main']
    }
  ];

  function currentSite() {
    return SITES.find(s => s.test()) || null;
  }

  function pick(selectors) {
    for (const sel of selectors || []) {
      const el = document.querySelector(sel);
      const text = el?.innerText?.trim();
      if (text) return text.replace(/\s+/g, ' ').slice(0, 300);
    }
    return '';
  }

  function pickBody(selectors) {
    for (const sel of selectors || []) {
      const el = document.querySelector(sel);
      const text = el?.innerText?.trim();
      if (text && text.length > 150) return text;
    }
    // Last resort: the largest text block on the page
    let best = '';
    for (const el of document.querySelectorAll('main, article, section, div')) {
      if (el.children.length > 40) continue;
      const t = el.innerText || '';
      if (t.length > best.length && t.length < 25000) best = t;
    }
    return best.trim();
  }

  /** Try JSON-LD first — several Swedish boards publish clean JobPosting data. */
  function readJsonLd() {
    for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const raw = JSON.parse(node.textContent);
        const items = Array.isArray(raw) ? raw : (raw['@graph'] || [raw]);
        for (const item of items) {
          if (item && item['@type'] === 'JobPosting') {
            const loc = item.jobLocation?.address || item.jobLocation?.[0]?.address || {};
            return {
              title: item.title || '',
              company: item.hiringOrganization?.name || '',
              location: [loc.addressLocality, loc.addressRegion].filter(Boolean).join(', '),
              country: loc.addressCountry?.name || loc.addressCountry || '',
              description: (item.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
              postedDate: item.datePosted || '',
              employmentType: Array.isArray(item.employmentType) ? item.employmentType.join(', ') : (item.employmentType || '')
            };
          }
        }
      } catch { /* malformed block, move on */ }
    }
    return null;
  }

  /**
   * Build the job payload from whatever the page offers.
   */
  function extractJob() {
    const site = currentSite();
    const ld = readJsonLd();

    const title       = ld?.title       || pick(site?.title);
    const company     = ld?.company     || pick(site?.company);
    const locationTxt = ld?.location    || pick(site?.location);
    const description = (ld?.description && ld.description.length > 200)
      ? ld.description
      : pickBody(site?.body);

    if (!description || description.length < 100) {
      return { ok: false, error: 'No job description found on this page. Open a single job posting rather than a results list.' };
    }

    const haystack = `${title} ${locationTxt} ${description}`;

    // Country first, then a city from that country's list — this stops
    // "Cambridge" or "Hamburg" matching the wrong country.
    const countryCode = detectCountry(haystack);
    const countryName = countryCode ? (COUNTRIES[countryCode]?.name || '') : '';

    return {
      ok: true,
      job: {
        title: title || document.title.slice(0, 140),
        company,
        location: locationTxt || detectCity(haystack, countryCode ? [countryCode] : null),
        countryCode,
        country: ld?.country || countryName,
        description,
        postedDate: ld?.postedDate || '',
        employmentType: ld?.employmentType || '',
        source: site?.id || location.hostname.replace('www.', ''),
        url: location.href,
        technologies: extractTechnologies(description),
        experience: extractExperience(description),
        salary: extractSalary(description),
        workMode: extractWorkMode(haystack)
      }
    };
  }

  /* ── On-page badge ─────────────────────────────────────────────── */

  const BADGE_ID = 'sv-sponsor-badge';

  function removeBadge() {
    document.getElementById(BADGE_ID)?.remove();
  }

  function showBadge(analysis) {
    removeBadge();

    const meta = {
      CONFIRMED: { dot: '🟢', text: 'Sponsorship confirmed', color: '#1F7A4C', bg: '#E6F2EB' },
      POTENTIAL: { dot: '🟡', text: 'Sponsorship possible',  color: '#A9741A', bg: '#FBF1DE' },
      UNKNOWN:   { dot: '⚪', text: 'Not mentioned',          color: '#6B7785', bg: '#EDF0F3' },
      NONE:      { dot: '🔴', text: 'No sponsorship',        color: '#A63B2E', bg: '#F9E9E6' }
    }[analysis.status];

    const quote = analysis.evidence?.[0]?.sentence || '';
    const cc = analysis.country ? COUNTRIES[analysis.country] : null;

    const host = document.createElement('div');
    host.id = BADGE_ID;
    // Shadow DOM keeps host-page CSS from distorting the badge.
    const root = host.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>
        :host { all: initial; }
        .b {
          position: fixed; right: 18px; bottom: 18px; z-index: 2147483000;
          width: 268px; background: #fff; color: #16212E;
          border: 1px solid #D6DEE6; border-left: 4px solid ${meta.color};
          border-radius: 11px; box-shadow: 0 4px 20px rgba(15,36,56,.16);
          font: 400 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .h { display: flex; align-items: center; gap: 8px; padding: 10px 11px; }
        .d { font-size: 15px; }
        .t { flex: 1; font-size: 12.5px; font-weight: 640; color: ${meta.color}; }
        .x { border: 0; background: none; cursor: pointer; color: #A8B4C0; font-size: 15px; line-height: 1; padding: 2px 4px; border-radius: 4px; }
        .x:hover { background: #EEF1F4; color: #47576A; }
        .q {
          margin: 0 11px 10px; padding: 8px 9px; background: ${meta.bg};
          border-radius: 6px; font-size: 11.5px; line-height: 1.5; color: #16212E;
        }
        .n { margin: 0 11px 10px; font-size: 11px; color: #78889A; line-height: 1.5; }
        .w { margin: 0 11px 10px; font-size: 10.5px; color: #7A5412; background: #FBF1DE; padding: 6px 8px; border-radius: 5px; line-height: 1.45; }
        .c { margin: 0 11px 10px; font-size: 10.5px; color: #47576A; line-height: 1.45; }
      </style>
      <div class="b">
        <div class="h">
          <span class="d">${meta.dot}</span>
          <span class="t">${meta.text}</span>
          <button class="x" title="Dismiss">&times;</button>
        </div>
        ${quote
          ? `<div class="q">&ldquo;${quote.replace(/</g, '&lt;').slice(0, 200)}&rdquo;</div>`
          : `<div class="n">${analysis.reason.replace(/</g, '&lt;')}</div>`}
        ${cc ? `<div class="c">${cc.flag} ${cc.name} · ${cc.permitName.replace(/</g,'&lt;')}</div>` : ''}
        ${analysis.historical ? `<div class="w">Past-tense wording — confirm it applies to this role.</div>` : ''}
      </div>
    `;

    root.querySelector('.x').addEventListener('click', removeBadge);
    document.documentElement.appendChild(host);
  }

  /* ── Messaging ─────────────────────────────────────────────────── */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'PING') {
      const site = currentSite();
      sendResponse({
        ok: true,
        supported: !!site,
        site: site?.id || '',
        looksLikeJob: site ? site.isJobPage() : false,
        pageTitle: pick(site?.title) || document.title.slice(0, 120),
        company: pick(site?.company)
      });
      return true;
    }

    if (msg.type === 'EXTRACT') {
      try {
        sendResponse(extractJob());
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
      return true;
    }

    if (msg.type === 'SHOW_BADGE') {
      try { showBadge(msg.analysis); } catch { /* badge is non-critical */ }
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  /* ── Passive first pass ────────────────────────────────────────── */
  // Analyse once on load so the user gets a signal without opening the popup.
  // Runs locally, costs nothing, and never leaves the page.

  function autoScan() {
    const site = currentSite();
    if (!site || !site.isJobPage()) return;

    chrome.storage.local.get('settings', ({ settings }) => {
      if (settings && settings.showBadge === false) return;
      const result = extractJob();
      if (!result.ok) return;
      const analysis = analyzeSponsorship(result.job.description, {
        url: location.href,
        title: result.job.title,
        location: result.job.location
      });
      showBadge(analysis);
    });
  }

  let lastUrl = location.href;
  const debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  const rescan = debounce(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      removeBadge();
    }
    autoScan();
  }, 900);

  // Job boards are single-page apps: the posting changes without a reload.
  new MutationObserver(rescan).observe(document.body, { childList: true, subtree: true });

  setTimeout(autoScan, 1400);
})();
