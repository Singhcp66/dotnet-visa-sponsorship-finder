/**
 * lexicon.js — Evidence patterns for Swedish work-permit sponsorship detection.
 *
 * Every pattern carries a weight. Weights are summed into a confidence score,
 * but a category is NEVER assigned without a matched sentence to show the user.
 * See docs/ARCHITECTURE.md §Sponsorship for the scoring rules.
 *
 * These are the LANGUAGE-NEUTRAL English patterns that apply to every
 * destination. Country-specific vocabulary (arbetstillstånd, Blue Card,
 * Skilled Worker visa, LMIA...) lives in countries.js and is merged in at
 * analysis time based on the detected or selected country.
 */

const SPONSORSHIP_LEXICON = {

  /* ── EXPLICIT POSITIVE ──────────────────────────────────────────────
     Employer states it provides permit/immigration support.
     Any single hit here can justify CONFIRMED.                        */
  explicitPositive: [
    { re: /\bwe (?:can |will |do )?sponsor(?:ship)?\b/i,                    w: 40, label: 'Employer states it sponsors' },
    { re: /\bvisa sponsorship (?:is )?(?:available|provided|offered)\b/i,   w: 40, label: 'Visa sponsorship offered' },
    { re: /\bwork permit sponsorship\b/i,                                   w: 40, label: 'Work permit sponsorship' },
    { re: /\bwe (?:offer|provide|assist with|help with|support)[^.!?]{0,60}\bwork permit\b/i, w: 38, label: 'Work permit support offered' },
    { re: /\bwe (?:offer|provide|assist with|help with|support)[^.!?]{0,60}\b(?:visa|immigration)\b/i, w: 34, label: 'Visa/immigration support offered' },
    { re: /\b(?:support|assistance|help) with (?:the )?(?:work|residence) permits?(?: applications?)?\b/i, w: 38, label: 'Permit application assistance' },
    { re: /\bimmigration (?:support|assistance|services)\b/i,               w: 32, label: 'Immigration support' },
    { re: /\bwe (?:handle|manage|cover|take care of)[^.!?]{0,40}\b(?:work permit|visa|immigration)\b/i, w: 36, label: 'Employer handles permit process' },
    { re: /\bsponsor(?:s|ed|ing)?\s+(?:your\s+|the\s+)?(?:work\s+|residence\s+)?permits?\b/i, w: 40, label: 'Sponsors work permits' },
    { re: /\b(?:offer|provide|consider|arrange)(?:s|ed|ing)?\s+(?:visa\s+|work\s+permit\s+)?sponsorship\b/i, w: 34, label: 'Sponsorship offered' },
    { re: /\bsponsorship (?:is )?(?:possible|considered)\b/i,               w: 30, label: 'Sponsorship possible' },
    { re: /\bpermits? (?:process|application) (?:is )?(?:handled|covered|managed) by (?:us|the company)\b/i, w: 36, label: 'Company manages permit process' },
    { re: /\bwe (?:are|hold)[^.!?]{0,30}\b(?:licensed|approved|registered) (?:to )?sponsor\b/i, w: 40, label: 'Licensed to sponsor' }
  ],

  /* ── SOFT POSITIVE ──────────────────────────────────────────────────
     Suggests international hiring but does not confirm sponsorship.
     Caps out at POTENTIAL — never CONFIRMED on its own.               */
  softPositive: [
    { re: /\brelocation (?:package|assistance|support|allowance|bonus)\b/i, w: 18, label: 'Relocation support mentioned' },
    { re: /\bwe (?:offer|provide) relocation\b/i,                           w: 20, label: 'Relocation offered' },
    { re: /\b(?:international|non-?EU|overseas|foreign) (?:candidates|applicants|talent|hires)\b[^.!?]{0,60}\b(?:welcome|encouraged|considered)\b/i, w: 20, label: 'International candidates welcomed' },
    { re: /\bopen to (?:international|candidates from abroad|applicants worldwide)\b/i, w: 18, label: 'Open to international applicants' },
    { re: /\bwe (?:hire|recruit) (?:globally|internationally|from abroad)\b/i, w: 18, label: 'Hires internationally' },
    { re: /\bmoving to sweden\b/i,                                          w: 14, label: 'Mentions moving to Sweden' },
    { re: /\bhelp(?:ing)? you (?:settle|relocate|move)\b/i,                  w: 16, label: 'Relocation help mentioned' },
    { re: /\b(?:english|engelska) is (?:our|the) (?:working|company|official) language\b/i, w: 8,  label: 'English working language' },
    { re: /\bno swedish (?:language )?(?:required|needed|necessary)\b/i,     w: 10, label: 'Swedish not required' },
    { re: /\bvisa\b[^.!?]{0,40}\bsupport\b/i,                               w: 16, label: 'Visa support referenced' },
    { re: /\bwork(?:ing)? (?:from|in) (?:any|multiple) (?:eu )?countr(?:y|ies)\b/i, w: 12, label: 'Multi-country hiring' }
  ],

  /* ── EXPLICIT NEGATIVE ──────────────────────────────────────────────
     Employer rules sponsorship out. Overrides all positives.          */
  explicitNegative: [
    { re: /\bno (?:visa )?sponsorship (?:is )?(?:available|offered|provided)\b/i,  w: -50, label: 'No sponsorship available' },
    { re: /\bwe (?:do not|don'?t|cannot|can'?t|are unable to) (?:offer|provide|support)[^.!?]{0,40}\b(?:sponsor|visa|work permit)\b/i, w: -50, label: 'Employer cannot sponsor' },
    { re: /\bunable to sponsor\b/i,                                          w: -50, label: 'Unable to sponsor' },
    { re: /\bsponsorship (?:is )?not (?:available|offered|possible|provided)\b/i, w: -50, label: 'Sponsorship not available' },
    { re: /\bmust (?:already )?(?:have|hold|possess)[^.!?]{0,50}\b(?:valid )?(?:work permit|right to work|work authorisation|work authorization)\b/i, w: -42, label: 'Must already hold right to work' },
    { re: /\b(?:valid )?(?:eu|eu\/eea|eea) (?:citizenship|passport|work permit)[^.!?]{0,30}\b(?:required|mandatory|necessary|is a must)\b/i, w: -44, label: 'EU/EEA status required' },
    { re: /\byou must (?:be|hold)[^.!?]{0,40}\b(?:citizen|national|permanent resident)\b/i, w: -44, label: 'Citizenship requirement' },
    { re: /\bright to work\b[^.!?]{0,40}\b(?:required|is required|mandatory|essential)\b/i, w: -40, label: 'Right to work required' },
    { re: /\bno (?:visa|permit) (?:applications?|candidates?) (?:will be )?(?:accepted|considered)\b/i, w: -46, label: 'Visa applicants not considered' },
    { re: /\bwithout (?:the )?need for sponsorship\b/i,                       w: -40, label: 'Must not need sponsorship' },
    { re: /\bsecurity clearance\b[^.!?]{0,60}\b(?:citizenship|nationals? only)\b/i, w: -30, label: 'Clearance requires citizenship' }
  ],

  /* ── HISTORICAL MARKERS ─────────────────────────────────────────────
     Phrases indicating past sponsorship, not a current commitment.
     Triggers the "verify for current role" warning (spec §8).         */
  historical: [
    /\bhave (?:previously )?sponsored\b/i,
    /\bin the past we\b/i,
    /\bhas sponsored\b/i,
    /\bpreviously (?:offered|provided) sponsorship\b/i,
    /\bhistorically\b[^.!?]{0,40}\bsponsor/i
  ],

  /* ── CONDITIONAL / HEDGED ───────────────────────────────────────────
     Sponsorship framed as case-by-case. Caps at POTENTIAL.            */
  conditional: [
    /\bcase[- ]by[- ]case\b/i,
    /\bfor the right candidate\b/i,
    /\bmay (?:be able to )?(?:offer|consider|provide) sponsorship\b/i,
    /\bdepending on (?:the candidate|experience|circumstances)\b/i,
    /\bpotentially (?:offer|provide) (?:visa|sponsorship|relocation)\b/i,
    /\bif (?:you )?(?:require|need) (?:a )?(?:visa|work permit)\b[^.!?]{0,40}\b(?:let us know|contact|discuss)\b/i
  ]
};

/* ── .NET / C# TECHNOLOGY DICTIONARY ─────────────────────────────────
   Used for tech extraction and match scoring.                        */
const TECH_DICTIONARY = {
  core: [
    '.NET', '.NET Core', '.NET 6', '.NET 7', '.NET 8', '.NET 9', 'C#', 'ASP.NET',
    'ASP.NET Core', 'Blazor', 'MAUI', 'Entity Framework', 'EF Core', 'LINQ',
    'Web API', 'MVC', 'Razor', 'SignalR', 'WPF', 'WinForms', 'Xamarin', 'NuGet'
  ],
  cloud: [
    'Azure', 'Azure DevOps', 'Azure Functions', 'AWS', 'GCP', 'Kubernetes',
    'Docker', 'Terraform', 'Service Fabric', 'App Service', 'Azure SQL'
  ],
  data: [
    'SQL Server', 'T-SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
    'Cosmos DB', 'Elasticsearch', 'Dapper', 'RabbitMQ', 'Kafka'
  ],
  frontend: [
    'React', 'Angular', 'Vue', 'TypeScript', 'JavaScript', 'HTML', 'CSS',
    'Next.js', 'Tailwind'
  ],
  practice: [
    'Microservices', 'REST', 'GraphQL', 'gRPC', 'DDD', 'CQRS', 'TDD',
    'CI/CD', 'Agile', 'Scrum', 'Git', 'Unit Testing', 'xUnit', 'NUnit', 'Moq'
  ]
};

const ALL_TECH = [
  ...TECH_DICTIONARY.core,
  ...TECH_DICTIONARY.cloud,
  ...TECH_DICTIONARY.data,
  ...TECH_DICTIONARY.frontend,
  ...TECH_DICTIONARY.practice
];

/* ── WORK MODE PATTERNS ──────────────────────────────────────────── */
const WORK_MODE = {
  remote: /\b(?:fully )?remote\b|\bdistans\b|\bwork from (?:home|anywhere)\b/i,
  hybrid: /\bhybrid\b|\bhybridarbete\b|\b\d\s?days? (?:per week )?(?:in|at) (?:the )?office\b/i,
  onsite: /\bon[- ]?site\b|\bin[- ]?office\b|\bplats(?:en)?\b|\bkontoret\b/i
};

// Export for both content-script (global) and module contexts
if (typeof window !== 'undefined') {
  window.SPONSORSHIP_LEXICON = SPONSORSHIP_LEXICON;
  window.TECH_DICTIONARY = TECH_DICTIONARY;
  window.ALL_TECH = ALL_TECH;
  window.WORK_MODE = WORK_MODE;
}
