# Visa Sponsorship Finder — .NET Jobs

A Chrome extension for international .NET developers job-hunting abroad.
It reads the job posting you're looking at, works out whether the employer
offers work-permit sponsorship, **shows you the sentence it based that on**,
and exports everything to Excel.

Covers **16 countries** across Europe, the UK and Canada.

**No API key. No account. No credits.** Analysis runs entirely on your device.

---

## Install

1. Download and unzip the extension folder somewhere permanent — Chrome reads
   it from disk, so don't delete it afterwards.
2. Open `chrome://extensions/`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and select the `sweden-dotnet-visa` folder

That's it. Open a job posting and the extension starts working.

---

## Using it

Open any .NET job on a supported site. A small card appears in the corner of
the page with the sponsorship verdict and the quote behind it.

Click the toolbar icon for the full breakdown:

- **This page** — verdict, evidence, match score, extracted details
- **Jobs** — everything you've analysed, filterable and sortable
- **Companies** — auto-built from your jobs, one record per employer
- **Export** — pick what to include, download the workbook
- **Profile** — your experience and tech, used for match scoring

### Supported sites

LinkedIn · Indeed · Glassdoor · The Hub · StepStone · Welcome to the Jungle ·
Reed · Totaljobs · Monster · Otta · IrishJobs · Arbetsförmedlingen ·
Jobbsafari · Pracuj · FINN · Jobindex · Academic Work

---

## Countries

Pick the countries you'd actually move to under **Profile > Countries you'd
move to**. This does two things:

1. **Tunes the analysis.** Sponsorship wording is country-specific, and the
   extension carries the local vocabulary for each one:

| | Country | Route it looks for |
|---|---|---|
| 🇸🇪 | Sweden | arbetstillstånd |
| 🇳🇱 | Netherlands | Highly Skilled Migrant / IND recognised sponsor |
| 🇩🇪 | Germany | EU Blue Card / Blaue Karte |
| 🇮🇪 | Ireland | Critical Skills Employment Permit |
| 🇬🇧 | United Kingdom | Skilled Worker visa / sponsor licence |
| 🇩🇰 | Denmark | Pay Limit & Fast-track schemes |
| 🇳🇴 | Norway | Faglært oppholdstillatelse |
| 🇫🇮 | Finland | Residence permit for employment |
| 🇵🇱 | Poland | Type A work permit |
| 🇪🇸 | Spain | Highly Qualified Professional visa |
| 🇵🇹 | Portugal | D3 highly qualified visa |
| 🇨🇭 | Switzerland | B / L permit |
| 🇧🇪 | Belgium | Single Permit |
| 🇦🇹 | Austria | Red-White-Red Card |
| 🇪🇪 | Estonia | Temporary residence permit |
| 🇨🇦 | Canada | LMIA / Global Talent Stream |

2. **Shapes your match scores.** A role in a country you didn't pick is capped
   at 65% so it can't outrank somewhere you'd actually go — but it stays
   visible, because people change their minds.

Leave every box unticked if you're open to anywhere.

Non-English postings are handled: Swedish, German, Dutch, Danish, Norwegian,
Finnish, Polish, Spanish, Portuguese and French patterns are all included,
with tolerance for transliteration (`Muenchen`, `arbetstillstand`).

---

## The four verdicts

| | Meaning |
|---|---|
| 🟢 **Confirmed** | The posting explicitly says the employer supports work permits or visas |
| 🟡 **Potential** | International hiring signals, or sponsorship offered conditionally / in the past tense |
| ⚪ **Unknown** | The posting says nothing about permits, visas, or relocation |
| 🔴 **No sponsorship** | The posting requires existing right to work, or rules sponsorship out |

**Every verdict shows its source sentence.** If the extension can't quote the
posting, it says Unknown rather than guessing. Company size, industry, or
"they have international staff" are never treated as evidence — those are how
people end up wasting an application.

Citizenship exclusions are bloc-aware: "EU citizens only" is disqualifying for
a job in Berlin but says nothing about a job in Toronto, so it's only applied
where it actually matters.

---

## Excel export

One workbook, six sheets:

| Sheet | Contents |
|---|---|
| Visa Sponsorship Jobs | Every job, best match first, with evidence column |
| Sponsoring Companies | Confirmed sponsors only |
| Potential Sponsors | Possible but unproven |
| Saved Jobs | Your shortlist |
| Application Tracker | Status, dates, notes |
| Read Me | How to read the statuses and their caveats |

Sized columns, filter dropdowns on every header, clickable links.

**One limitation, stated plainly:** frozen header rows aren't included — that's
a paid feature of the spreadsheet library this uses. In Excel it's one click:
*View > Freeze Panes > Freeze Top Row*. The Read Me sheet says so too.

---

## Optional: AI second opinion

Off by default, and genuinely optional — everything above works without it.

If you want it, go to **Profile > Optional AI second opinion**, choose
Anthropic, Gemini, or OpenAI, and paste a key. Gemini has a free tier if you
don't want to pay for credits.

The AI is held to the same standard as the rest of the extension: it must
quote the posting verbatim. Every quote is checked against the actual text,
and **any quote it can't produce from the posting is thrown away**. If it
claims sponsorship without evidence, its answer is discarded entirely. Where
the AI and the local analysis disagree, you get the more cautious of the two,
and you're told they disagreed.

Permission to reach the provider is requested only when you pick one.

---

## Privacy

- Everything stays in your browser's local storage
- No analytics, no telemetry, no server
- Without an AI key, no network requests are made at all
- With one, only the job description goes to the provider you chose
- Reads only the page you're on, when you ask — no crawling or scraping

---

## A caveat worth reading

This tells you what a job posting *says*. It can't tell you what an employer
will actually do. Postings go stale, policies change, and recruiters make
exceptions in both directions.

Treat 🟢 as "worth applying, ask to confirm" — not as a guarantee. Anything
marked *Historical — verify* is based on evidence over six months old or
past-tense wording, and should always be checked.

Not legal or immigration advice. Each analysis links to the official
immigration authority for the detected country — check there for the real rules.
