enums = {}
enums.util = {}

enums.criteriaCategories = ['violence', 'sex', 'fear', 'drugs']
enums.classificationCategoriesFI = {violence: 'väkivalta', fear: 'ahdistus', sex: 'seksi', drugs: 'päihteet'}
enums.classificationCategoriesSV = {violence: 'våld', fear: 'ångest', sex: 'sexuellt innehåll', drugs: 'droger'}

enums.format = [
  'Blu-ray Disc',
  'DCP',
  'DVD',
  'Verkkoaineisto',
  '8 mm',
  '16 mm',
  '35 mm',
  '70 mm',
  'CDKuva',
  'Televisio',
  'VHS',
  'video',
  'VoD',
  'Muu'
]

enums.gameFormat = [
  '3DS',
  'DVD TV-peli',
  'Kolikkopeli',
  'PC',
  'PS3',
  'PS4',
  'PSV',
  'WII',
  'WIIU',
  'X1',
  'X360'
]

enums.userRoles = {
  root: { name: 'Pääkäyttäjä', order: 1 },
  kavi: { name: 'Kavi', order: 2 },
  user: { name: 'Luokittelija', order: 3 },
  trainee: { name: 'Luokittelija (koulutus)', order: 3 }
}
enums.util.userRoleName = function(role) {
  var userRole = enums.userRoles[role]
  return userRole ? userRole.name : undefined
}

enums.util.isClassifier = function(role) {
  return role === 'user' || role === 'trainee'
}

enums.roles = {
  'Provider': 'Tarjoaja',
  'Location_of_providing': 'Tarjoamispaikka',
  'Subscriber': 'Tilaaja',
  'Classifier': 'Työnantaja/Luokitteluyritys',
  'Distributor': 'Levittäjä',
  'Other': 'Muu'
}

enums.providingType = {
  'Recordings_provide': 'Tallenteiden tarjoaminen',
  'Public_presentation': 'Julkinen esittäminen',
  'National_TV': 'Valtakunnallinen televisio-ohjelmisto',
  'Regional_TV': 'Alueellinen televisio-ohjelmisto',
  'Transmitted_abroad_program': 'Ulkomailta välitetty ohjelmisto',
  'Subscription_of_program': 'Tilausohjelmapalvelu'
}

enums.providingTypeName = function(type) {
  return enums.providingType[type] || 'Tuntematon'
}

enums.providingTypePrices = {
  'Recordings_provide': 100,
  'Public_presentation': 200,
  'National_TV': 600,
  'Regional_TV': 100,
  'Transmitted_abroad_program': 400,
  'Subscription_of_program': 400
}

enums.programType = {
  0: { type: 'unknown', fi: '?' },
  1: { type: 'movie', fi: 'Elokuva' },
  2: { type: 'series', fi: 'TV-sarjan nimi' },
  3: { type: 'episode', fi: 'TV-sarjan jakso' },
  4: { type: 'other-tv', fi: 'Muu TV-ohjelma' },
  5: { type: 'extra', fi: 'Extra' },
  6: { type: 'trailer', fi: 'Traileri' },
  7: { type: 'game', fi: 'Peli' }
}

enums.util.programTypeName = function(programType) {
  var p = enums.programType[programType]
  return p ? p.fi : undefined
}

enums.util.isTvEpisode = function(p) { return p.programType == 3 }
enums.util.isOtherTv = function(p) { return p.programType == 4 }
enums.util.isMovieType = function(p) { return p.programType == 1 || p.programType == 5 || p.programType == 6 }
enums.util.isGameType = function(p) { return p.programType == 7 }
enums.util.isDefinedProgramType = function(i) { return i >= 1 && i <= 7 }
enums.util.isTvSeriesName = function(p) { return p.programType == 2 }
enums.util.isUnknown = function(p) { return p.programType === 0 }

enums.movieGenre = [
  'Fiktio',
  'Animaatio',
  'Viihde',
  'Seksi / Erotiikka',
  'Dokumentti',
  'Lasten ohjelmat',
  'Romantiikka',
  'Draama',
  'Historiallinen näytelmä',
  'Trilleri',
  'Seikkailu',
  'Western',
  'Sota',
  'Kauhu',
  'Tieteisseikkailu',
  'Toimintaelokuva',
  'Fantasia',
  'Komedia ja farssi',
  'Musiikki',
  'Opetus',
  'Urheilu',
  'Matkailu',
  'Henkilödokumentti',
  'Luontodokumentti',
  'Lasten animaatio',
  'Lasten fiktio',
  'Muu lastenelokuva',
  'Mainonta',
  'Tietoisku',
  'Kokeiluelokuva',
  'Videotaide',
  'Muut'
]

enums.tvGenre = [
  'Ajankohtaisohjelmat',
  'Animaatio',
  'Asiaohjelmat',
  'Dokumentti',
  'Draama',
  'Elokuvat',
  'Fantasia',
  'Fiktio',
  'Henkilödokumentti',
  'Historiallinen näytelmä',
  'Kauhu',
  'Kokeiluelokuva',
  'Komedia ja farssi',
  'Kotimainen fiktio',
  'Kotimaiset elokuvat',
  'Kulttuuri',
  'Lasten animaatio',
  'Lasten fiktio',
  'Lasten ohjelmat',
  'Lifestyle',
  'Luontodokumentti',
  'Mainonta',
  'Matkailu',
  'Musiikki',
  'Muu lastenelokuva',
  'Muu urheilu',
  'Muut ohjelmat',
  'Muut uutislähetykset',
  'Muut',
  'Opetus',
  'Opetus- ja tiedeohjelmat',
  'Ostos-TV',
  'Populaarikulttuuri',
  'Reality',
  'Romantiikka',
  'Seikkailu',
  'Seksi / Erotiikka',
  'Sota',
  'Tieteisseikkailu',
  'Tietoisku',
  'Toimintaelokuva',
  'Trilleri',
  'Ulkomainen fiktio',
  'Ulkomaiset elokuvat',
  'Urheilu',
  'Urheilu-uutiset',
  'Uutiset',
  'Vakiouutiset',
  'Videotaide',
  'Viihde',
  'Western',
  'WWW (peliohjelmat, chatit)'
]

enums.classificationStatus = [
  'reclassification1',
  'reclassification3',
  'registered',
  'in_process'
  //'disapproved',
  // 'in_pocess',
  // NULL,
]

enums.reclassificationReason = {
  0: { emailText: 'KAVI:n oma aloite', uiText: 'KAVI:n oma aloite' },
  1: { emailText: 'Yleisön pyyntö', uiText: 'Palaute' },
  2: { emailText: 'Valitusosoitus', uiText: 'Valitus' },
  3: { emailText: 'Oikaisupyyntö', uiText: 'Oikaisuvaatimus' }
}

enums.isOikaisupyynto = function(val) { return val == 3 }

enums.authorOrganization = {
  0: 'Ulkopuolinen',
  1: 'KAVI',
  2: 'Kuvaohjelmalautakunta',
  3: 'KHO'
}

enums.authorOrganizationIsKavi = function(c) { return c.authorOrganization === 1 }
enums.authorOrganizationIsKuvaohjelmalautakunta = function(c) { return c.authorOrganization === 2 }
enums.authorOrganizationIsKHO = function(c) { return c.authorOrganization === 3 }

enums.invoiceRowType = {
  registration: 'Kuvaohjelman rekisteröinti',
  classification: 'KAVI:n luokittelu',
  reclassification: 'KAVI:n uudelleenluokittelu'
}

enums.countries = {
  'AE': 'Arabiemiirikunnat',
  'AF': 'Afganistan',
  'AL': 'Albania',
  'AR': 'Argentiina',
  'AT': 'Itävalta',
  'AU': 'Australia',
  'BA': 'Bosnia-Hertsegovina',
  'BD': 'Bangladesh',
  'BE': 'Belgia',
  'BG': 'Bulgaria',
  'BH': 'Bhutan',
  'BM': 'Bermuda',
  'BO': 'Bolivia',
  'BR': 'Brasilia',
  'BT': 'Bhutan',
  'BY': 'Valko-Venäjä',
  'CA': 'Kanada',
  'CH': 'Sveitsi',
  'CL': 'Chile',
  'CM': 'Kamerun',
  'CN': 'Kiina',
  'CO': 'Kolumbia',
  'CR': 'Costa Rica',
  'CS': 'Serbia ja Montenegro / Tsekkoslovakia',
  'CU': 'Kuuba',
  'CY': 'Kypros',
  'CZ': 'Tsekinmaa',
  'DD': 'Itä-Saksa',
  'DE': 'Saksa',
  'DK': 'Tanska',
  'DZ': 'Algeria',
  'EC': 'Ecuador',
  'EE': 'Viro',
  'EG': 'Egypti',
  'ES': 'Espanja',
  'ET': 'Etiopia',
  'EU': 'Euroopan unioni',
  'FI': 'Suomi',
  'FO': 'Fär-saaret',
  'FR': 'Ranska',
  'GB': 'Iso-Britannia',
  'GL': 'Grönlanti',
  'GN': 'Guinea',
  'GR': 'Kreikka',
  'GT': 'Guatemala',
  'HK': 'Hongkong',
  'HR': 'Kroatia',
  'HU': 'Unkari',
  'ID': 'Indonesia',
  'IE': 'Irlanti',
  'IL': 'Israel',
  'IN': 'Intia',
  'IQ': 'Irak',
  'IR': 'Iran',
  'IS': 'Islanti',
  'IT': 'Italia',
  'JM': 'Jamaika',
  'JO': 'Jordania',
  'JP': 'Japani',
  'KN': 'Kenia',
  'KP': 'Pohjois-Korea',
  'KR': 'Etelä-Korea',
  'LA': 'Laos',
  'LB': 'Libanon',
  'LI': 'Lichtenstein',
  'LK': 'Sri Lanka',
  'LT': 'Liettua',
  'LU': 'Luxemburg',
  'LV': 'Latvia',
  'MA': 'Marokko',
  'MC': 'Monaco',
  'ME': 'Montenegro',
  'ML': 'Mali',
  'MN': 'Mongolia',
  'MR': 'Mauritania',
  'MT': 'Malta',
  'MU': 'Mauritius',
  'MX': 'Meksiko',
  'MY': 'Malesia',
  'MZ': 'Mosambik',
  'NA': 'Namibia',
  'NE': 'Niger',
  'NG': 'Nigeria',
  'NI': 'Nicaragua',
  'NL': 'Alankomaat',
  'NO': 'Norja',
  'NP': 'Nepal',
  'NZ': 'Uusi-Seelanti',
  'PE': 'Peru',
  'PH': 'Filippiinit',
  'PK': 'Pakistan',
  'PL': 'Puola',
  'PR': 'Puerto Rico',
  'PT': 'Portugali',
  'PY': 'Paraguay',
  'RO': 'Romania',
  'RS': 'Serbia',
  'RU': 'Venäjä',
  'SD': 'Sudan',
  'SE': 'Ruotsi',
  'SG': 'Singapore',
  'SI': 'Slovenia',
  'SK': 'Slovakia',
  'SN': 'Senegal',
  'SU': 'Neuvostoliitto',
  'SV': 'El Salvador',
  'SY': 'Syyria',
  'TH': 'Thaimaa',
  'TN': 'Tunisia',
  'TR': 'Turkki',
  'TW': 'Taiwan',
  'TZ': 'Tansania',
  'UA': 'Ukraina',
  'US': 'Yhdysvallat',
  'UY': 'Uruguay',
  'VA': 'Vatikaanivaltio',
  'VE': 'Venezuela',
  'VN': 'Vietnam',
  'YU': 'Jugoslavia',
  'ZA': 'Etelä-Afrikka',
  'ZM': 'Sambia',
  'ZW': 'Zimbabwe',
  '-': 'Muu maa'
}

enums.getCountryCode = function(country) {
  if (_.isEmpty(country)) return

  return _(enums.countries).mapValues(function(country) {
    return country.toLowerCase()
  }).invert().value()[country.toLowerCase()]
}

enums.util.toCountry = function(code) { return enums.countries[code] || '-' }
enums.util.toCountryString = function(countries) { return countries.map(function(c) { return enums.countries[c] }).join(', ') }

enums.warnings = { violence: 'Väkivalta', sex: 'Seksi', fear: 'Ahdistus', drugs: 'Päihteet' }

enums.classificationCriteria = [
  { id:1,  category: 'violence', age: 18,
    fi: { title: "Erittäin voimakasta väkivaltaa", description: "Fiktiivistä, realistista ja erittäin veristä ja yksityiskohtaista tai erittäin pitkäkestoista ja yksityiskohtaista tai erittäin pitkäkestoista ja sadistista ihmisiin tai eläimiin kohdistuvaa väkivaltaa" },
    sv: { title: 'Mycket kraftigt våld', description:'Bildprogrammet innehåller fiktivt, realistiskt och mycket blodigt och detaljerat eller mycket utdraget och detaljerat eller mycket utdraget och sadistiskt våld som riktar sig mot människor eller djur.' }
  },
  { id:2,  category: 'violence', age: 18,
    fi: { title:  "Erittäin voimakasta väkivaltaa", description: "Aitoa ja yksityiskohtaisesti tai selväpiirteisesti sekä viihteellisesti tai ihannoiden esitettyä ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
    sv: { title: 'Mycket kraftigt våld', description:'Bildprogrammet innehåller äkta och detaljerat eller tydligt samt presenterat på ett underhållande eller idealiserat sätt våld som riktar sig mot människor eller djur.'}
  },
  { id:3,  category: 'violence', age: 18,
    fi: { title:  "Erittäin voimakasta väkivaltaa", description: "Fiktiivistä, selväpiirteisesti ja pitkäkestoisesti esitettyä seksiin liittyvää väkivaltaa (raiskaus, insesti, pedofilia)" },
    sv: { title: 'Mycket kraftigt våld', description:'Bildprogrammet innehåller fiktivt, tydligt och utdraget presenterat våld (våldtäkt, incest, pedofili) som hänför sig till sex.'}
  },
  { id:4,  category: 'violence', age: 16,
    fi: { title:  "Voimakasta väkivaltaa", description: "Fiktiivistä tai aitoa yksityiskohtaista ja realistista tai hallitsevaa tai pitkäkestoista ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
    sv: { title: 'Kraftigt våld', description:'Bildprogrammet innehåller fiktivt eller äkta detaljerat och realistiskt eller dominerande eller utdraget våld som riktar sig mot människor eller djur' }
  },
  { id:5,  category: 'violence', age: 16,
    fi: { title:  "Voimakasta väkivaltaa", description: "Fiktiivistä tai aitoa yksityiskohtaisesti ja korostetusti tai yksityiskohtaisesti ja viihteellistetysti esitettyä ihmisiin tai eläimiin kohdistuvaa väkivallan tai onnettomuuksien seurausten kuvausta." },
    sv: { title: 'Kraftigt våld', description:'Bildprogrammet innehåller fiktivt eller äkta detaljerad och framhävande eller detaljerad och på ett populariserat sätt presenterad skildring av påföljder av olyckor eller våld som riktar sig mot människor eller djur.' }
  },
  { id:6,  category: 'violence', age: 16,
    fi: { title:  "Voimakasta väkivaltaa", description: "Fiktiivistä, esitystavaltaan selvästi yliampuvaa tai parodista, veristä ja yksityiskohtaista tai pitkäkestoista ja yksityiskohtaista tai pitkäkestoista ja sadistista ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
    sv: { title: 'Kraftigt våld', description:'Bildprogrammet innehåller fiktivt, till sitt framförande tydligt överdrivet eller parodiskt blodigt och detaljerat eller utdraget och detaljerat eller utdraget och sadistiskt våld som riktar sig mot människor eller djur' }
  },
  { id:7,  category: 'violence', age: 16,
    fi: { title:  "Voimakasta väkivaltaa", description: "Aitoa yksityiskohtaisesti ta selväpiirteisesti esitettyä väkivaltaa, jossa uhrin kärsimykset tai väkivallan seuraukset tuodaan realistisesti esille." },
    sv: { title: 'Kraftigt våld', description:'Bildprogrammet innehåller äkta detaljerat eller tydligt presenterat våld, där offrets lidande eller våldets påföljder presenteras realistiskt.' }
  },
  { id:8,  category: 'violence', age: 16,
    fi: { title:  "Voimakasta väkivaltaa", description: "Seksiin liittyvää fiktiivistä väkivaltaa, jossa uhrin kärsimys tulee selvästi esiin ja väkivalta on tarinan kannalta perusteltua tai voimakkaita viittauksia alaikäisiin kohdistuvaan seksuaaliseen väkivaltaan tai hyväksikäyttöön." },
    sv: { title: 'Kraftigt våld', description:'Bildprogrammet innehåller fiktivt våld som hänför sig till sex, där offrets lidande klart kommer fram och våldet är motiverat med tanke på historien eller starka hänvisningar till sexuellt våld eller utnyttjande som riktar sig mot minderåriga.' }
  },
  { id:9,  category: 'violence', age: 12,
    fi: { title:  "Väkivaltaa", description: "Ei erityisen yksityiskohtaista tai ei hallitsevasti lapsiin, eläimiin tai lapsi-päähenkilön perheenjäseniin kohdistuvaa tai tarinan kannalta perusteltu yksittäinen, yksityiskohtainen ihmisiin tai eläimiin kohdistuva väkivaltakohtaus." },
    sv: { title: 'Våld', description:'Bildprogrammet innehåller våld som inte är speciellt detaljerat, eller riktar sig inte i huvudsak mot barn, djur eller barn-huvudpersonens familjemedlemmar eller med tanke på intrigen motiverat enskild, detaljerad våldscen som riktar sig mot människor eller djur.' }
  },
  { id:10, category: 'violence', age: 12,
    fi: { title:  "Väkivaltaa", description: "Epärealistisessa, etäännytetyssä yhteydessä esitettyä (joko epärealistinen väkivalta ihmis- tai eläinmäisiä hahmoja kohtaan tai realistinen väkivalta selkeän kuvitteellisia hahmoja kohtaan tai historiallinen, kulttuurinen jne. etäännytys!)" },
    sv: { title: 'Våld', description:'Bildprogrammet innehåller våld presenterad i ett orealistiskt, distanserat samband.' }
  },
  { id:11, category: 'violence', age: 12,
    fi: { title:  "Väkivaltaa", description: "Seksuaaliseen väkivaltaan viittaavaa (raiskaus, insesti, pedofilia)." },
    sv: { title: 'Våld', description:'Bildprogrammet innehåller våld som hänvisar till sexuellt våld (våldtäkt, incest, pedofili).' }
  },
  { id:12, category: 'violence', age: 7,
    fi: { title:  "Lievää väkivaltaa", description: "Epärealistista tai komediallista tai animaatio- tai slapstick-komediassa esitettyä yliampuvaa tai vähäistä väkivaltaa." },
    sv: { title: 'Lindrigt våld', description:'Bildprogrammet innehåller våld som är orealistiskt eller komedimässigt eller presenterat i animations- eller slapstick-komedi överdrivet eller i liten omfattning.' }
  },
  { id:13, category: 'violence', age: 7,
    fi: { title:  "Lievää väkivaltaa", description: "Yksittäinen, lievähkö ja lyhytkestoinen realistinen väkivaltakohtaus tai selkeät, mutta lievät tai lyhytkestoiset väkivaltaviitteet." },
    sv: { title: 'Lindrigt våld', description:'Bildprogrammet innehåller enskild, tämligen lindrig och kortvarig realistisk våldsscen eller tydliga, men lindriga eller kortvariga hänvisningar om våld.' }
  },
  { id:14, category: 'violence', age: 0,
    fi: { title:  "Väkivaltaa tai vain hyvin lievää väkivaltaa", description: "Kuvaohjelmassa ei ole lainkaan väkivaltaa tai se on vain hyvin lievää." },
    sv: { title: 'Mycket lindrigt våld', description:'Bildprogrammet innehåller inte alls något våld eller innehåller bara mycket lindrigt våld.' }
  },
  { id:15, category: 'sex',      age: 18,
    fi: { title:  "Erittäin yksityiskohtaista seksuaalista sisältöä", description: "Hallitsevaa ja seksikohtauksissa sukuelimiä selväpiirteisesti näyttävää." },
    sv: { title: 'Mycket explicit sexuellt innehåll', description:'Bildprogrammet innehåller dominerande och i sexscener könsorganen tydligt presenterade.' }
  },
  { id:16, category: 'sex',      age: 16,
    fi: { title:  "Avointa seksuaalista sisältöä", description: "Avointa, mutta yksityiskohdiltaan peiteltyä kuvausta tai yksityiskohtainen, yksittäinen ja lyhyt seksikohtaus." },
    sv: { title: 'Öppet sexuellt innehåll', description:'Bildprogrammet innehåller öppen, men till sina detaljer dold skildring eller en detaljerad, enskild och kort sexscen.' }
  },
  { id:17, category: 'sex',      age: 12,
    fi: { title:  "Seksuaalista sisältöä", description: "Peiteltyjä seksikohtauksia tai runsaasti selkeitä seksiviitteitä." },
    sv: { title: 'Sexuellt innehåll', description:'Bildprogrammet innehåller dolda sexscener eller rikligt med tydliga hänvisningar till sex.' }
  },
  { id:18, category: 'sex',      age: 12,
    fi: { title:  "Seksuaalista sisältöä", description: "Yksittäinen avoin, mutta yksityiskohdiltaan peitelty seksikuvaus (seksikohtaus)." },
    sv: { title: 'Sexuellt innehåll', description:'Bildprogrammet innehåller enskild öppen, men till sina detaljer dold sexskildring (sexscen).' }
  },
  { id:19, category: 'sex',      age: 7,
    fi: { title:  "Lievää seksuaalista sisältöä", description: "Lieviä seksuaalisia viittauksia tai yksittäisiä verhotusti esitettyjä eroottissävyisiä kohtauksia." },
    sv: { title: 'Lindrigt sexuellt innehåll', description:'Bildprogrammet innehåller lindriga sexuella hänvisningar eller enskilda dolt framförda erotiska scener.' }
  },
  { id:20, category: 'sex',      age: 0,
    fi: { title:  "Vain hyvin lievää seksuaalista sisältöä", description: "Halailua, syleilyä tai suudelmia tai alastomuutta muussa kuin seksuaalisessa kontekstissa." },
    sv: { title: 'Mycket lindrigt sexuellt innehåll', description:'Bildprogrammet innehåller kramande, omfamning eller kyssar eller nakenhet i annat än sexuell kontext.' }
  },
  { id:21, category: 'fear',     age: 18,
    fi: { title:  "Erittäin voimakasta ahdistusta herättävää sisältöä", description: "Hallitsevaa, erittäin järkyttävää, yksityiskohtaista kuvausta ihmisiin tai eläimiin kohdistuvista julmuuksista tai perversioista." },
    sv: { title: 'Innehåll som väcker mycket stark ångest', description:'Bildprogrammet innehåller dominerande, mycket uppskakande, detaljerad skildring av brutalitet eller perversioner som riktar sig mot människor eller djur.' }
  },
  { id:22, category: 'fear',     age: 18,
    fi: { title:  "Erittäin voimakasta ahdistusta herättävää sisältöä", description: "Aitoa ongelmattomana tai ihannoiden esitettyä itseä tai muita vahingoittavaa, vakavasti henkeä uhkaavaa ja hengenvaarallista käyttäytymistä." },
    sv: { title:'Innehåll som väcker mycket stark ångest', description:'beteende som presenteras dokumentariskt på ett oproblematiskt eller idealiserat sätt som skadar personen själv eller andra, allvarligt livshotande och livsfarligt beteende.' }
  },
  { id:23, category: 'fear',     age: 16,
    fi: { title:  "Voimakasta ahdistusta herättävää sisältöä", description: "Ihmisiin tai eläimiin kohdistuvaa järkyttävää ja ahdistusta herättävää, pitkäkestoista ja intensiivistä kuoleman, vakavan väkivallan tai psyykkisen hajoamisen uhkaa. Myös itsemurhan ihannointi. Yliluonnolliseen liittyvää voimakasta ahdistavuutta. Yliluonnolliseen liittyvää voimakasta ahdistavuutta." },
    sv: { title: 'Innehåll som väcker stark ångest', description:'Bildprogrammet innehåller hot som riktar sig mot människor eller djur och som uppskakar och väcker ångest, utdraget och intensivt hot om död, brutalt våld eller psykisk upplösning. Även idealisering av självmord. Stark ångest som hänför sig till det övernaturliga.' }
  },
  { id:24, category: 'fear',     age: 16,
    fi: { title:  "Voimakasta ahdistusta herättävää sisältöä", description: "Runsaasti realistisia ja yksityiskohtaisia (makaabereja) kuvia silpoutuneista, pahoin vahingoittuneista tai mädäntyneistä ruumiista tai väkivallan uhreista." },
    sv: { title: 'Innehåll som väcker stark ångest', description:'Bildprogrammet innehåller rikligt med realistiska och detaljerade (makabra) bilder av stympade, svårt skadade eller ruttna lik eller offer för våld.' }
  },
  { id:25, category: 'fear',     age: 16,
    fi: { title:  "Voimakasta ahdistusta herättävää sisältöä", description: "Aitoa, ihannoivasti esitettyä itseä tai muita vahingoittavaa käyttäytymistä." },
    sv: { title: 'Innehåll som väcker stark ångest', description:'Bildprogrammet innehåller äkta, på ett idealiserat sätt presenterat beteende som skadar personen själv eller andra.' }
  },
  { id:26, category: 'fear',     age: 12,
    fi: { title:  "Melko voimakasta ahdistusta herättävää sisältöä", description: "Ihmisiin tai eläimiin kohdistuvaa lyhytkestoista tai ei-hallitsevaa väkivallan tai kuoleman uhkaa tai kaltoin kohtelun tai psyykkisen kärsimyksen kuvausta. Menetysten, esim. perheenjäsenten sairauden tai kuoleman, voimakkaan surun, sekavuustilan tai itsemurhan kuvauksia." },
    sv: { title: 'Innehåll som väcker tämligen stark ångest', description:'Bildprogrammet innehåller hot om våld eller död som riktar sig mot människor eller djur och som är kortvarigt eller icke-dominerande eller skildring av illabehandling eller psykiskt lidande. Skildringar av förlustelser, t.ex. familjemedlemmars sjukdomar eller död och andra starka beskrivningar av sorg, förvirringstillstånd eller självmord.' }
  },
  { id:27, category: 'fear',     age: 12,
    fi: { title:  "Melko voimakasta ahdistusta herättävää sisältöä", description: "Ahdistusta herättäviä luonnonmullistusten, onnettomuuksien, katastrofien tai konfliktien ja niihin kytkeytyvän kuoleman uhan tai uhrien kuvauksia." },
    sv: { title: 'Innehåll som väcker tämligen stark ångest', description:'Bildprogrammet innehåller skildringar av ångestväckande naturkatastrofer, olyckor, katastrofer eller konflikter samt till dessa sammankopplade dödshot och offer.' }
  },
  { id:28, category: 'fear',     age: 12,
    fi: { title:  "Melko voimakasta ahdistusta herättävää sisältöä", description: "Voimakkaita, äkillisiä ja yllättäviä ahdistusta, pelkoa tai kauhua herättäviä ääni- ja kuvatehosteita tai pitkäkestoista piinaavaa uhkaa. Yliluonnolliseen liittyvää melko voimakasta ahdistavuutta." },
    sv: { title: 'Innehåll som väcker tämligen stark ångest', description:'Bildprogrammet innehåller starka, plötsliga och överraskande ljud- och bildeffekter som väcker ångest, rädsla eller skräck eller utdraget pinande hot. Tämligen stark ångest som hänför sig till det övernaturliga.' }
  },
  { id:29, category: 'fear',     age: 12,
    fi: { title:  "Melko voimakasta ahdistusta herättävää sisältöä", description: "Yksittäisiä realistisia ja yksityiskohtaisia kuvauksia silpoutuneista, pahoin vahingoittuneista tai mädäntyneistä ruumiista tai väkivallan uhreista." },
    sv: { title: 'Innehåll som väcker tämligen stark ångest', description:'Bildprogrammet innehåller enskilda realistiska och detaljerade skildringar om sönderslitna, svårt skadade eller ruttna lik eller offer för våld.' }
  },
  { id:30, category: 'fear',     age: 12,
    fi: { title:  "Melko voimakasta ahdistusta herättävää sisältöä", description: "Aitoa, itseä tai muita vahingoittavaa käyttäytymistä." },
    sv: { title: 'Innehåll som väcker tämligen stark ångest', description:'Bildprogrammet innehåller äkta beteende som skadar personen själv eller andra' }
  },
  { id:31, category: 'fear',     age: 7,
    fi: { title:  "Lievää ahdistusta herättävää sisältöä", description: "Melko lieviä ja lyhytkestoisia kauhuelementtejä, pientä pelottavuutta tai jännittävyyttä tai väkivallan uhkaa esimerkiksi animaatiossa tai fantasiassa (hirviöhahmoja, muodonmuutoksia, synkähköä visuaalista kuvastoa, lyhytkestoisia takaa-ajoja tai kohtalaisia äänitehosteita)." },
    sv: { title: 'Innehåll som väcker mycket lindrigt ångest', description:'Bildprogrammet innehåller tämligen lindriga och kortvariga skräckelement, litet skrämmande eller spännande eller hot om våld till exempel i en animation eller fantasi (monsterfigurer, transformationer, dystert visuellt bildmaterial, kortvariga förföljelser eller måttliga ljudeffekter).' }
  },
  { id:32, category: 'fear',     age: 7,
    fi: { title:  "Lievää ahdistusta herättävää sisältöä", description: "Lasten universaaleja pelkoja käsitteleviä kuvauksia tai tilanteita (esimerkiksi yksin jääminen, vanhemmista eroon joutuminen, pimeä, eksyminen tai läheisen menettäminen)." },
    sv: { title: 'Innehåll som väcker mycket lindrigt ångest', description:'Bildprogrammet innehåller skildringar eller situationer som behandlar barns universella rädsla (till exempel att lämnas ensa, separeras från föräldrarna, mörker, att gå vilse eller att förlora en närstående).' }
  },
  { id:33, category: 'fear',     age: 7,
    fi: { title:  "Lievää ahdistusta herättävää sisältöä", description: "Dokumentaarista ihmisiin/eläimiin kohdistuvaa  lyhytkestoista uhkaa ilman tehosteita." },
    sv: { title: 'Innehåll som väcker mycket lindrigt ångest', description:'Bildprogrammet innehåller dokumentariskt, kortvarigt hot utan effekter som riktar sig mot människor/djur.' }
  },
  { id:34, category: 'fear',     age: 0,
    fi: { title:  "Vain hyvin lievää ahdistavaa sisältöä", description: "Hyvin lieviä ja lyhytkestoisia pelottavia tai jännittäviä elementtejä, jotka ratkeavat hyvin nopeasti positiiviseen suuntaan." },
    sv: { title: 'Mycket lindrigt ångestfullt innehåll', description:'Bildprogrammet innehåller mycket lindriga och kortvariga skrämmande eller spännande element som mycket snabbt får en positiv lösning.' }
  },
  { id:35, category: 'drugs',    age: 18,
    fi: { title:  "Ihannoivaa erittäin vaarallisten huumeiden käyttöä", description: "Hallitsevaa ja ihannoivassa valossa yksityiskohtaisesti esitettyä erittäin vaarallisten huumeiden käyttöä." },
    sv: { title: 'Idealiserad användning av (mycket farliga) droger', description:'Bildprogrammet innehåller dominerande och på ett idealiserat sätt i detalj presenterad användning av mycket farliga droger.' }
  },
  { id:36, category: 'drugs',    age: 16,
    fi: { title:  "Huumeiden käyttöä", description: "Huumeiden realistista ja yksityiskohtaista ongelmakäyttöä tai yksittäisiä ongelmattomia tai ihannoivia huumeiden käytön kuvauksia." },
    sv: { title: 'Användning av droger', description:'Bildprogrammet innehåller realistisk och detaljerad problemanvändning av droger eller skildringar av enskild problemfri eller idealiserad användning av droger.' }
  },
  { id:37, category: 'drugs',    age: 12,
    fi: { title:  "Huumeiden ei-hallitsevaa käyttöä / alaikäisten alkoholin käyttöä", description: "Tällä tarkoitetaan huumeiden viitteellistä tai vähäistä käyttöä tai alaikäisten korostettua, viihteellistä tai ongelmatonta alkoholin käyttöä." },
    sv: { title: 'Icke-dominerande användning av droger/minderårigas bruk av alkohol', description:'Bildprogrammet innehåller hänvisande eller obetydlig användning av droger eller minderårigas framhävda användning av alkohol som är presenterat som problemfritt eller och problemfri användning av alkohol eller minderårigas framhävda nöjesbruk av alkohol.' }
  }
]

enums.legacyGenres = {
  '1': 'Fiktio',
  '2': 'Animaatio',
  '3': 'Viihde',
  '4': 'Seksi / Erotiikka',
  '5': 'Dokumentti',
  '6': 'Lasten ohjelmat',
  '9': 'Muut',
  '1a': 'Romantiikka',
  '1b': 'Draama',
  '1c': 'Historiallinen näytelmä',
  '1d': 'Trilleri',
  '1e': 'Seikkailu',
  '1f': 'Western',
  '1g': 'Sota',
  '1h': 'Kauhu',
  '1j': 'Tieteisseikkailu',
  '1k': 'Toimintaelokuva',
  '1m': 'Fantasia',
  '1n': 'Komedia ja farssi',
  '3c': 'Musiikki',
  '5a': 'Opetus',
  '5b': 'Urheilu',
  '5c': 'Matkailu',
  '5d': 'Henkilödokumentti',
  '5e': 'Luontodokumentti',
  '6a': 'Lasten animaatio',
  '6b': 'Lasten fiktio',
  '6c': 'Muu lastenelokuva',
  '9a': 'Mainonta',
  '9c': 'Tietoisku',
  '9d': 'Kokeiluelokuva',
  '9e': 'Videotaide',
  '7a': 'Trailer',
  '7b': 'Extra'
}

enums.legacyTvGenres = {
  '2': 'Ajankohtaisohjelmat',
  '3': 'Asiaohjelmat/kulttuuri/lifestyle',
  '4': 'Urheilu',
  '5': 'Kotimainen fiktio',
  '6': 'Ulkomainen fiktio',
  '7': 'Elokuvat',
  '8': 'Lasten ohjelmat',
  '9': 'Opetus- ja tiedeohjelmat',
  '10': 'Viihde/kevyt musiikki/reality',
  '11': 'Muu musiikki',
  '12': 'Muut ohjelmat',
  '1.': 'Uutiset',
  '1.1': 'Vakiouutiset',
  '1.2': 'Muut uutislähetykset',
  '3.1': 'Asiaohjelmat/lifestyle',
  '3.2': 'Kulttuuriohjelmat',
  '4.1': 'Urheilu-uutiset',
  '4.2': 'Muu urheilu',
  '7.1': 'Kotimaiset elokuvat',
  '7.2': 'Ulkomaiset elokuvat',
  '12.1': 'Ostos-TV',
  '12.2': 'WWW (peliohjelmat, chatit)',
  '10.1': 'Kotimainen viihde/kevyt musiikki/reality',
  '10.2': 'Ulkomainen viihde/kevyt musiikki/reality',
  '13': 'Populaarikulttuuri'
}

enums.legacyGameGenres = [
  "opetus",
  "seikkailu",
  "strategia",
  "toiminta",
  "rooli",
  "simulaatio",
  "tasohyppely",
  "urheilu",
  "muu",
  "räiskintä",
  "autopeli (ajopeli)",
  "puzzle",
  "managerointi",
  "first person shooter (FPS)",
  "koulutus",
  "lastenpeli",
  "onlinepeli",
  "karaoke",
  "musiikki",
  "party"
]

enums.legacyProgramTypes = {
  '01': 1,       //'Kotimainen elokuva' -> movie
  '02': 1,       //'Ulkomainen elokuva' -> movie
  '02b': 0,    // 'TESTI' -> unknown
  '03': 3,       //'TV-sarjan jakso' -> tv
  '04': 4,       // 'Muu tv-ohjelma' -> tv
  '05': 2,       // 'TV-sarjan nimi' -> series
  '06': 6,       // 'Traileri' -> trailer
  '07': 5,       // 'Extra' -> extra
  '08': 7,       // 'Peli' -> game
  '10': 0,      // 'Yhteistuotanto' -> unknown
  // '11': 0,   // 'PEGI hyväksytty peli' -> pegi-game (disabled)
  '12': 0       // 'Muu kuvaohjelma' -> unknown
}

enums.billingLanguages = {
  'FI': 'Suomi',
  'SV': 'Ruotsi',
  'EN': 'Englanti'
}

enums.billingLanguage = function(k) { return enums.billingLanguage[k] }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = enums
}
