/**
 * countries.js — Country packs.
 *
 * Each country contributes three things the engine can't get from generic
 * English patterns:
 *
 *   1. Cities, so a posting can be located and matched to the user's prefs.
 *   2. The local name of the permit ("arbetstillstånd", "Blue Card",
 *      "Skilled Worker visa"), because employers use the local term.
 *   3. Native-language positive/negative patterns, because plenty of
 *      postings in Sweden, Germany, Poland or Spain are not in English.
 *
 * The `citizenshipBloc` field matters: "EU citizens only" excludes a non-EU
 * candidate applying to Germany, but says nothing useful about a job in
 * Canada. Blocs let the negative patterns stay accurate per destination.
 */

const COUNTRIES = {

  SE: {
    code: 'SE', name: 'Sweden', demonym: 'Swedish', flag: '🇸🇪',
    currency: 'SEK', bloc: 'EU',
    permitName: 'arbetstillstånd (work permit)',
    officialUrl: 'https://www.migrationsverket.se/English/Private-individuals/Working-in-Sweden.html',
    cities: ['Stockholm','Göteborg','Gothenburg','Malmö','Malmo','Uppsala','Västerås','Vasteras',
             'Lund','Linköping','Linkoping','Örebro','Helsingborg','Norrköping','Jönköping',
             'Umeå','Umea','Solna','Sundbyberg','Kista','Sverige','Sweden'],
    positive: [
      { re: /\bvi (?:hj[aä]lper|st[oö]ttar|assisterar)[^.!?]{0,60}\barbetstillst[aå]nd\b/i, w: 38, label: 'Hjälp med arbetstillstånd' },
      { re: /\bhj[aä]lp med arbetstillst[aå]nd\b/i, w: 38, label: 'Hjälp med arbetstillstånd' },
      { re: /\bvi sponsrar\b/i, w: 38, label: 'Vi sponsrar' },
      { re: /\bst[oö]d (?:f[oö]r|med) (?:arbetstillst[aå]nd|uppeh[aå]llstillst[aå]nd)\b/i, w: 36, label: 'Stöd för arbetstillstånd' },
      { re: /\bwork permit\b[^.!?]{0,40}\bsweden\b/i, w: 30, label: 'Swedish work permit referenced' }
    ],
    negative: [
      { re: /\bkrav p[aå] (?:giltigt )?arbetstillst[aå]nd\b/i, w: -42, label: 'Krav på arbetstillstånd' },
      { re: /\bdu (?:m[aå]ste|ska) ha (?:giltigt )?arbetstillst[aå]nd\b/i, w: -42, label: 'Måste ha arbetstillstånd' },
      { re: /\bsvenskt medborgarskap (?:kr[aä]vs|[aä]r ett krav)\b/i, w: -48, label: 'Svenskt medborgarskap krävs' },
      { re: /\bsvenska (?:kr[aä]vs|[aä]r ett krav)\b/i, w: -18, label: 'Swedish language required' }
    ],
    softNative: [
      { re: /\bflyttbidrag|relokaliseringsst[oö]d\b/i, w: 18, label: 'Flyttstöd' },
      { re: /\binternationella (?:kandidater|s[oö]kande)\b/i, w: 16, label: 'Internationella kandidater' }
    ]
  },

  NL: {
    code: 'NL', name: 'Netherlands', demonym: 'Dutch', flag: '🇳🇱',
    currency: 'EUR', bloc: 'EU',
    permitName: 'Highly Skilled Migrant permit',
    officialUrl: 'https://ind.nl/en/work/working-in-the-Netherlands',
    cities: ['Amsterdam','Rotterdam','The Hague','Den Haag','Utrecht','Eindhoven','Groningen',
             'Tilburg','Almere','Breda','Nijmegen','Haarlem','Arnhem','Delft','Leiden','Nederland'],
    positive: [
      { re: /\bhighly skilled migrant\b/i, w: 40, label: 'Highly Skilled Migrant route' },
      { re: /\b(?:we are|as) (?:a )?recognised sponsor\b/i, w: 42, label: 'IND recognised sponsor' },
      { re: /\bIND[- ](?:recognised|recognized) sponsor\b/i, w: 42, label: 'IND recognised sponsor' },
      { re: /\bkennismigrant\b/i, w: 38, label: 'Kennismigrant (knowledge migrant)' },
      { re: /\b30%[- ]ruling\b/i, w: 22, label: '30% ruling mentioned' },
      { re: /\bwij (?:helpen|ondersteunen)[^.!?]{0,50}\b(?:visum|werkvergunning)\b/i, w: 36, label: 'Hulp met werkvergunning' }
    ],
    negative: [
      { re: /\bmust (?:already )?have[^.!?]{0,40}\bdutch\b[^.!?]{0,20}\b(?:work permit|residence)\b/i, w: -42, label: 'Dutch permit required' },
      { re: /\bgeldige verblijfsvergunning (?:vereist|nodig)\b/i, w: -42, label: 'Verblijfsvergunning vereist' },
      { re: /\b(?:vloeiend|goede) nederlands (?:vereist|is een must)\b/i, w: -20, label: 'Dutch fluency required' }
    ],
    softNative: [
      { re: /\bverhuiskostenvergoeding|relocatiepakket\b/i, w: 18, label: 'Relocatiepakket' }
    ]
  },

  DE: {
    code: 'DE', name: 'Germany', demonym: 'German', flag: '🇩🇪',
    currency: 'EUR', bloc: 'EU',
    permitName: 'EU Blue Card / work visa',
    officialUrl: 'https://www.make-it-in-germany.com/en/visa-residence',
    cities: ['Berlin','Munich','München','Muenchen','Hamburg','Frankfurt','Cologne','Köln','Koeln',
             'Stuttgart','Düsseldorf','Duesseldorf','Dusseldorf','Leipzig','Dresden','Hannover',
             'Nuremberg','Nürnberg','Nuernberg','Karlsruhe','Bremen','Essen','Dortmund',
             'Deutschland','Germany'],
    positive: [
      { re: /\b(?:eu )?blue card\b/i, w: 38, label: 'EU Blue Card' },
      { re: /\bblaue karte\b/i, w: 38, label: 'Blaue Karte EU' },
      { re: /\bwir (?:helfen|unterst(?:ü|ue)tzen)[^.!?]{0,60}\b(?:visum|arbeitserlaubnis|aufenthalt)\b/i, w: 38, label: 'Hilfe mit Visum' },
      { re: /\bvisa[- ]?(?:support|sponsorship)\b[^.!?]{0,30}\bgermany\b/i, w: 34, label: 'Visa support for Germany' },
      { re: /\bunterst(?:ü|ue)tzung bei (?:der )?(?:visum|arbeitserlaubnis)\b/i, w: 38, label: 'Unterstützung bei Visum' },
      { re: /\bumzugshilfe|relocation[- ]paket\b/i, w: 18, label: 'Umzugshilfe' }
    ],
    negative: [
      { re: /\bg(?:ü|ue|u)ltige arbeitserlaubnis (?:erforderlich|vorausgesetzt|notwendig)\b/i, w: -42, label: 'Arbeitserlaubnis erforderlich' },
      { re: /\bdeutsche staatsangeh(?:ö|oe)rigkeit (?:erforderlich|vorausgesetzt)\b/i, w: -48, label: 'Deutsche Staatsangehörigkeit' },
      { re: /\bverhandlungssicheres deutsch (?:erforderlich|vorausgesetzt)\b/i, w: -20, label: 'Fluent German required' },
      { re: /\bdeutsch (?:auf )?(?:c1|c2|muttersprach)/i, w: -18, label: 'Near-native German required' }
    ],
    softNative: []
  },

  IE: {
    code: 'IE', name: 'Ireland', demonym: 'Irish', flag: '🇮🇪',
    currency: 'EUR', bloc: 'EU',
    permitName: 'Critical Skills Employment Permit',
    officialUrl: 'https://enterprise.gov.ie/en/what-we-do/workplace-and-skills/employment-permits/',
    cities: ['Dublin','Cork','Galway','Limerick','Waterford','Belfast','Éire'],
    positive: [
      { re: /\bcritical skills(?: employment)? permit\b/i, w: 42, label: 'Critical Skills Permit' },
      { re: /\bgeneral employment permit\b/i, w: 38, label: 'General Employment Permit' },
      { re: /\bemployment permit (?:support|sponsorship|application)\b/i, w: 36, label: 'Employment permit support' }
    ],
    negative: [
      { re: /\bmust (?:hold|have)[^.!?]{0,40}\bvalid (?:irish )?(?:work|employment) permit\b/i, w: -42, label: 'Existing permit required' },
      { re: /\bstamp ?4\b[^.!?]{0,30}\b(?:required|essential)\b/i, w: -40, label: 'Stamp 4 required' }
    ],
    softNative: []
  },

  GB: {
    code: 'GB', name: 'United Kingdom', demonym: 'British', flag: '🇬🇧',
    currency: 'GBP', bloc: 'UK',
    permitName: 'Skilled Worker visa',
    officialUrl: 'https://www.gov.uk/skilled-worker-visa',
    cities: ['London','Manchester','Birmingham','Edinburgh','Glasgow','Leeds','Bristol','Cambridge',
             'Oxford','Reading','Liverpool','Newcastle','Sheffield','Nottingham','Belfast','Cardiff',
             'Brighton','Milton Keynes','England','Scotland','Wales'],
    positive: [
      { re: /\bskilled worker visa\b/i, w: 40, label: 'Skilled Worker visa' },
      { re: /\btier 2\b/i, w: 36, label: 'Tier 2 route' },
      { re: /\bsponsor(?:ship)? licen[cs]e\b/i, w: 40, label: 'Sponsor licence held' },
      { re: /\bcertificate of sponsorship\b/i, w: 42, label: 'Certificate of Sponsorship' },
      { re: /\bglobal talent visa\b/i, w: 34, label: 'Global Talent visa' }
    ],
    negative: [
      { re: /\bright to work in the uk\b[^.!?]{0,40}\b(?:required|essential|must)\b/i, w: -42, label: 'UK right to work required' },
      { re: /\bmust (?:already )?have (?:the )?right to work in the uk\b/i, w: -44, label: 'Must hold UK right to work' },
      { re: /\bwe (?:do not|cannot|are unable to) sponsor\b/i, w: -50, label: 'Employer does not sponsor' },
      { re: /\b(?:british|uk) citizens? only\b/i, w: -48, label: 'UK citizens only' },
      { re: /\bsc clearance|security check(?:ed)?\b[^.!?]{0,40}\bbritish\b/i, w: -30, label: 'Clearance requires nationality' }
    ],
    softNative: []
  },

  DK: {
    code: 'DK', name: 'Denmark', demonym: 'Danish', flag: '🇩🇰',
    currency: 'DKK', bloc: 'EU',
    permitName: 'Pay Limit / Fast-track scheme',
    officialUrl: 'https://www.nyidanmark.dk/en-GB/Words%20and%20Concepts%20Front%20Page/US/Work',
    cities: ['Copenhagen','København','Kobenhavn','Aarhus','Odense','Aalborg','Esbjerg','Roskilde','Danmark','Denmark'],
    positive: [
      { re: /\bpay limit scheme\b/i, w: 40, label: 'Pay Limit Scheme' },
      { re: /\bfast[- ]track scheme\b/i, w: 38, label: 'Fast-track scheme' },
      { re: /\bvi (?:hj[aæ]lper|st[oø]tter)[^.!?]{0,50}\barbejdstilladelse\b/i, w: 38, label: 'Hjælp med arbejdstilladelse' }
    ],
    negative: [
      { re: /\bgyldig arbejdstilladelse (?:kr[aæ]ves|p[aå]kr[aæ]vet)\b/i, w: -42, label: 'Arbejdstilladelse kræves' },
      { re: /\bdansk (?:p[aå] )?(?:modersm[aå]lsniveau|flydende) (?:kr[aæ]ves)\b/i, w: -20, label: 'Fluent Danish required' }
    ],
    softNative: []
  },

  NO: {
    code: 'NO', name: 'Norway', demonym: 'Norwegian', flag: '🇳🇴',
    currency: 'NOK', bloc: 'EEA',
    permitName: 'Skilled worker residence permit',
    officialUrl: 'https://www.udi.no/en/want-to-apply/work-immigration/',
    cities: ['Oslo','Bergen','Trondheim','Stavanger','Tromsø','Tromso','Drammen','Kristiansand','Norge','Norway'],
    positive: [
      { re: /\bfaglært (?:arbeidstaker|oppholdstillatelse)\b/i, w: 38, label: 'Faglært oppholdstillatelse' },
      { re: /\bvi (?:hjelper|st[oø]tter)[^.!?]{0,50}\b(?:arbeidstillatelse|oppholdstillatelse)\b/i, w: 38, label: 'Hjelp med arbeidstillatelse' }
    ],
    negative: [
      { re: /\bgyldig arbeidstillatelse (?:kreves|p[aå]krevd)\b/i, w: -42, label: 'Arbeidstillatelse kreves' },
      { re: /\bflytende norsk (?:kreves|er et krav)\b/i, w: -20, label: 'Fluent Norwegian required' }
    ],
    softNative: []
  },

  FI: {
    code: 'FI', name: 'Finland', demonym: 'Finnish', flag: '🇫🇮',
    currency: 'EUR', bloc: 'EU',
    permitName: 'Residence permit for an employed person',
    officialUrl: 'https://migri.fi/en/working-in-finland',
    cities: ['Helsinki','Espoo','Tampere','Vantaa','Oulu','Turku','Jyväskylä','Jyvaskyla','Lahti','Suomi','Finland'],
    positive: [
      { re: /\bresidence permit\b[^.!?]{0,40}\bfinland\b/i, w: 34, label: 'Finnish residence permit' },
      { re: /\bautamme[^.!?]{0,50}\b(?:oleskelulupa|ty[oö]lupa)\b/i, w: 36, label: 'Autamme työluvassa' },
      { re: /\bspecialist\b[^.!?]{0,30}\bfast[- ]track\b/i, w: 32, label: 'Specialist fast-track' }
    ],
    negative: [
      { re: /\bvoimassa oleva (?:ty[oö]lupa|oleskelulupa) (?:vaaditaan|edellytet[aä][aä]n)\b/i, w: -42, label: 'Työlupa vaaditaan' },
      { re: /\bsujuva suomen kieli (?:vaaditaan|on edellytys)\b/i, w: -20, label: 'Fluent Finnish required' }
    ],
    softNative: []
  },

  PL: {
    code: 'PL', name: 'Poland', demonym: 'Polish', flag: '🇵🇱',
    currency: 'PLN', bloc: 'EU',
    permitName: 'Type A work permit',
    officialUrl: 'https://www.gov.pl/web/gov/uzyskaj-zezwolenie-na-prace-cudzoziemca',
    cities: ['Warsaw','Warszawa','Kraków','Krakow','Wrocław','Wroclaw','Poznań','Poznan','Gdańsk',
             'Gdansk','Łódź','Lodz','Katowice','Szczecin','Lublin','Polska'],
    positive: [
      { re: /\bpomagamy[^.!?]{0,50}\b(?:zezwolenie na prac[eę]|wiz[eę])\b/i, w: 38, label: 'Pomagamy z zezwoleniem' },
      { re: /\bwsparcie (?:w uzyskaniu )?(?:wizy|zezwolenia na prac[eę])\b/i, w: 38, label: 'Wsparcie wizowe' },
      { re: /\brelokacj[aę]\b/i, w: 16, label: 'Relokacja' }
    ],
    negative: [
      { re: /\bwymagane (?:aktualne )?zezwolenie na prac[eę]\b/i, w: -42, label: 'Wymagane zezwolenie' },
      { re: /\bbiegła znajomość j[eę]zyka polskiego\b/i, w: -18, label: 'Fluent Polish required' }
    ],
    softNative: []
  },

  ES: {
    code: 'ES', name: 'Spain', demonym: 'Spanish', flag: '🇪🇸',
    currency: 'EUR', bloc: 'EU',
    permitName: 'Highly Qualified Professional visa',
    officialUrl: 'https://www.inclusion.gob.es/web/migraciones/w/unidad-grandes-empresas',
    cities: ['Madrid','Barcelona','Valencia','Seville','Sevilla','Bilbao','Málaga','Malaga',
             'Zaragoza','Alicante','España','Espana'],
    positive: [
      { re: /\bhighly qualified professional\b/i, w: 36, label: 'Highly Qualified Professional visa' },
      { re: /\bayudamos[^.!?]{0,50}\b(?:visado|permiso de trabajo)\b/i, w: 38, label: 'Ayuda con el visado' },
      { re: /\bley de startups\b/i, w: 26, label: 'Startup Law route' }
    ],
    negative: [
      { re: /\bimprescindible (?:permiso de trabajo|nie)\b/i, w: -42, label: 'Permiso de trabajo requerido' },
      { re: /\bespañol nativo (?:requerido|imprescindible)\b/i, w: -20, label: 'Native Spanish required' }
    ],
    softNative: []
  },

  PT: {
    code: 'PT', name: 'Portugal', demonym: 'Portuguese', flag: '🇵🇹',
    currency: 'EUR', bloc: 'EU',
    permitName: 'D3 Highly Qualified visa',
    officialUrl: 'https://aima.gov.pt/',
    cities: ['Lisbon','Lisboa','Porto','Braga','Coimbra','Faro','Aveiro'],
    positive: [
      { re: /\bd3 visa|highly qualified activity visa\b/i, w: 36, label: 'D3 highly qualified visa' },
      { re: /\bajudamos[^.!?]{0,50}\b(?:visto|autorização de residência)\b/i, w: 38, label: 'Ajuda com o visto' }
    ],
    negative: [
      { re: /\bautorização de residência (?:obrigatória|necessária)\b/i, w: -42, label: 'Residence permit required' }
    ],
    softNative: []
  },

  CH: {
    code: 'CH', name: 'Switzerland', demonym: 'Swiss', flag: '🇨🇭',
    currency: 'CHF', bloc: 'CH',
    permitName: 'B / L work permit',
    officialUrl: 'https://www.sem.admin.ch/sem/en/home/themen/arbeit.html',
    cities: ['Zurich','Zürich','Zuerich','Geneva','Genève','Geneve','Basel','Bern','Lausanne','Lugano','Zug','Winterthur','Schweiz','Switzerland'],
    positive: [
      { re: /\b(?:b|l) permit\b[^.!?]{0,30}\b(?:support|sponsor|arrange)/i, w: 34, label: 'Swiss permit support' },
      { re: /\bwir (?:helfen|unterst(?:ü|ue)tzen)[^.!?]{0,50}\baufenthaltsbewilligung\b/i, w: 38, label: 'Hilfe mit Bewilligung' }
    ],
    negative: [
      { re: /\b(?:eu\/efta|efta) (?:citizens?|nationals?) only\b/i, w: -46, label: 'EU/EFTA nationals only' },
      { re: /\bg(?:ü|ue|u)ltige aufenthaltsbewilligung (?:erforderlich|vorausgesetzt)\b/i, w: -42, label: 'Bewilligung erforderlich' },
      { re: /\bswiss (?:work )?permit (?:required|mandatory)\b/i, w: -42, label: 'Swiss permit required' }
    ],
    softNative: []
  },

  BE: {
    code: 'BE', name: 'Belgium', demonym: 'Belgian', flag: '🇧🇪',
    currency: 'EUR', bloc: 'EU',
    permitName: 'Single Permit',
    officialUrl: 'https://economie.fgov.be/en',
    cities: ['Brussels','Bruxelles','Brussel','Antwerp','Antwerpen','Ghent','Gent','Leuven','Liège','Bruges'],
    positive: [
      { re: /\bsingle permit\b/i, w: 38, label: 'Single Permit route' },
      { re: /\bnous (?:aidons|soutenons)[^.!?]{0,50}\b(?:permis de travail|visa)\b/i, w: 36, label: 'Aide au permis de travail' }
    ],
    negative: [
      { re: /\bpermis de travail (?:valide )?(?:requis|obligatoire)\b/i, w: -42, label: 'Permis de travail requis' },
      { re: /\b(?:dutch|french) (?:and|&) english (?:required|mandatory)\b/i, w: -14, label: 'Bilingual requirement' }
    ],
    softNative: []
  },

  AT: {
    code: 'AT', name: 'Austria', demonym: 'Austrian', flag: '🇦🇹',
    currency: 'EUR', bloc: 'EU',
    permitName: 'Red-White-Red Card',
    officialUrl: 'https://www.migration.gv.at/en/',
    cities: ['Vienna','Wien','Graz','Linz','Salzburg','Innsbruck','Klagenfurt','Österreich','Oesterreich','Austria'],
    positive: [
      { re: /\bred[- ]white[- ]red card\b/i, w: 42, label: 'Red-White-Red Card' },
      { re: /\brot[- ]weiß[- ]rot[- ]karte\b/i, w: 42, label: 'Rot-Weiß-Rot-Karte' },
      { re: /\bwir (?:helfen|unterst(?:ü|ue)tzen)[^.!?]{0,50}\b(?:visum|arbeitserlaubnis)\b/i, w: 38, label: 'Hilfe mit Visum' }
    ],
    negative: [
      { re: /\bg(?:ü|ue|u)ltige arbeitserlaubnis (?:erforderlich|vorausgesetzt)\b/i, w: -42, label: 'Arbeitserlaubnis erforderlich' }
    ],
    softNative: []
  },

  CA: {
    code: 'CA', name: 'Canada', demonym: 'Canadian', flag: '🇨🇦',
    currency: 'CAD', bloc: 'CA',
    permitName: 'LMIA / Global Talent Stream',
    officialUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship.html',
    cities: ['Toronto','Vancouver','Montreal','Montréal','Ottawa','Calgary','Edmonton','Quebec',
             'Québec','Waterloo','Mississauga','Halifax','Winnipeg'],
    positive: [
      { re: /\bglobal talent stream\b/i, w: 42, label: 'Global Talent Stream' },
      { re: /\blmia[- ](?:support|sponsor|approved)\b/i, w: 40, label: 'LMIA support' },
      { re: /\bwe (?:will )?support[^.!?]{0,40}\bwork permit\b/i, w: 36, label: 'Work permit support' }
    ],
    negative: [
      { re: /\bmust be (?:legally )?(?:eligible|authorized) to work in canada\b/i, w: -40, label: 'Must be authorised in Canada' },
      { re: /\bcanadian citizens?(?: or permanent residents?)? only\b/i, w: -46, label: 'Citizens/PR only' },
      { re: /\bpermanent residen(?:t|cy)\b[^.!?]{0,25}\b(?:required|only)\b/i, w: -42, label: 'PR required' }
    ],
    softNative: []
  },

  EE: {
    code: 'EE', name: 'Estonia', demonym: 'Estonian', flag: '🇪🇪',
    currency: 'EUR', bloc: 'EU',
    permitName: 'Temporary residence permit for employment',
    officialUrl: 'https://www.politsei.ee/en/migration',
    cities: ['Tallinn','Tartu','Narva','Pärnu','Eesti'],
    positive: [
      { re: /\bwe (?:help|assist)[^.!?]{0,40}\brelocat(?:e|ion) to estonia\b/i, w: 32, label: 'Relocation to Estonia' },
      { re: /\bestonian (?:residence|work) permit\b[^.!?]{0,30}\b(?:support|assist)/i, w: 36, label: 'Estonian permit support' }
    ],
    negative: [
      { re: /\bvalid estonian (?:residence|work) permit (?:required|needed)\b/i, w: -42, label: 'Permit required' }
    ],
    softNative: []
  }
};

/* ── Bloc-aware exclusion patterns ────────────────────────────────
   "EU citizens only" is disqualifying for an EU destination but
   irrelevant for Canada, so these are attached per bloc rather than
   applied globally.                                                */
const BLOC_NEGATIVES = {
  EU: [
    { re: /\bonly (?:eu|eu\/eea|eea) (?:citizens?|nationals?|residents?)\b/i, w: -46, label: 'EU/EEA citizens only' },
    { re: /\b(?:eu|eu\/eea|eea) (?:citizenship|passport|nationality)[^.!?]{0,30}\b(?:required|mandatory|essential)\b/i, w: -44, label: 'EU/EEA status required' },
    { re: /\byou must be (?:an? )?(?:eu|eea) (?:citizen|national)\b/i, w: -46, label: 'Must be EU national' },
    { re: /\bendast (?:eu|eu\/ees|ees)[- ]medborgare\b/i, w: -46, label: 'Endast EU-medborgare' },
    { re: /\bnur (?:eu|ewr)[- ]b(?:ü|ue|u)rger\b/i, w: -46, label: 'Nur EU-Bürger' }
  ],
  EEA: [
    { re: /\bonly (?:eu|eea|eu\/eea) (?:citizens?|nationals?)\b/i, w: -46, label: 'EU/EEA citizens only' },
    { re: /\b(?:eu|eea) (?:citizenship|passport)[^.!?]{0,30}\b(?:required|mandatory)\b/i, w: -44, label: 'EEA status required' }
  ],
  CH: [
    { re: /\bonly (?:swiss|eu\/efta|efta) (?:citizens?|nationals?)\b/i, w: -46, label: 'Swiss/EFTA nationals only' }
  ],
  UK: [
    { re: /\bsettled status\b[^.!?]{0,30}\b(?:required|essential)\b/i, w: -40, label: 'Settled status required' },
    { re: /\bpre[- ]settled status (?:required|essential)\b/i, w: -38, label: 'Pre-settled status required' }
  ],
  CA: [
    { re: /\bcanadian citizens? or permanent residents? only\b/i, w: -46, label: 'Citizens/PR only' }
  ]
};

/* ── Helpers ─────────────────────────────────────────────────────── */

const COUNTRY_LIST = Object.values(COUNTRIES)
  .sort((a, b) => a.name.localeCompare(b.name));

/** All patterns that apply when analysing a posting for a given country. */
function patternsFor(code) {
  const c = COUNTRIES[code];
  if (!c) return { positive: [], negative: [], soft: [] };
  return {
    positive: c.positive || [],
    negative: [...(c.negative || []), ...(BLOC_NEGATIVES[c.bloc] || [])],
    soft: c.softNative || []
  };
}

/**
 * Work out which country a posting is for.
 * Explicit country name beats city mentions; city mentions beat currency.
 * Returns a code, or '' when nothing is conclusive.
 */
function detectCountry(text) {
  if (!text) return '';
  const scores = {};

  const bump = (code, n) => { scores[code] = (scores[code] || 0) + n; };

  for (const c of Object.values(COUNTRIES)) {
    // Country name / demonym
    if (new RegExp(`\\b${c.name}\\b`, 'i').test(text)) bump(c.code, 10);
    if (new RegExp(`\\b${c.demonym}\\b`, 'i').test(text)) bump(c.code, 4);

    // Cities — strong signal, several cities are unique worldwide
    for (const city of c.cities) {
      if (new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
        bump(c.code, 6);
        break;
      }
    }

    // Local permit vocabulary
    for (const p of (c.positive || []).concat(c.negative || [])) {
      if (p.re.test(text)) { bump(c.code, 3); break; }
    }
  }

  // Currency is weak on its own (EUR spans many countries) so only counts
  // for currencies unique to one country in this registry.
  const uniqueCurrency = { SEK: 'SE', DKK: 'DK', NOK: 'NO', PLN: 'PL', CHF: 'CH', GBP: 'GB', CAD: 'CA' };
  for (const [cur, code] of Object.entries(uniqueCurrency)) {
    if (new RegExp(`\\b${cur}\\b`, 'i').test(text)) bump(code, 5);
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < 5) return '';
  return ranked[0][0];
}

/** Cities across every selected country, for location matching. */
function citiesFor(codes) {
  return (codes || []).flatMap(code => COUNTRIES[code]?.cities || []);
}

const Countries = {
  COUNTRIES, COUNTRY_LIST, BLOC_NEGATIVES,
  patternsFor, detectCountry, citiesFor
};

if (typeof window !== 'undefined') {
  window.Countries = Countries;
  window.COUNTRIES = COUNTRIES;
  window.detectCountry = detectCountry;
}
