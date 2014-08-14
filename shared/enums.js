enums = {}
enums.util = {}

enums.criteriaCategories = ['violence', 'sex', 'fear', 'drugs']
enums.classificationCategoriesFI = {violence: 'väkivalta', fear: 'ahdistus', sex: 'seksi', drugs: 'päihteet'}

enums.format = [
  '8 mm',
  '16 mm',
  '35 mm',
  '70 mm',
  'Blu-ray Disc',
  'CDKuva',
  'DCP',
  'DVD',
  'Televisio',
  'Verkkoaineisto',
  'VHS',
  'video',
  'VoD',
  'Muu'
]

enums.gameFormat = [
  '360 (Xbox 360)',
  'PC',
  'PS2',
  'PS3',
  '360',
  'DVD',
  'MAC',
  'PC/MAC',
  'XBOX',
  'N64',
  'DS',
  'GBA',
  'PSP',
  'GC',
  'Wii',
  'PSX',
  'N-Gage',
  'GBC',
  'PLM',
  'COIN',
  'PC (PC)',
  'DC',
  'XBLA',
  'DVDTV',
  'TV',
  'PS',
  'DVDTV (DVD TV-Games)',
  'COIN (Kolikkopeli)',
  'PS3 (PS3)',
  'Pokemon Mini',
  'DS (Nintendo DS)',
  'Wii (Wii)',
  'GC (GameCube)',
  'N64 (N64)',
  'Xbox One',
  'PS4'
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
  'Classifier': 'Luokittelija',
  'Distributor': 'Levittäjä',
  'Other': 'Muu'
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
  'Asiaohjelmat',
  'Elokuvat',
  'Kotimainen fiktio',
  'Kotimaiset elokuvat',
  'Kulttuuri',
  'Lasten ohjelmat',
  'Lifestyle',
  'Musiikki',
  'Muu urheilu',
  'Muut ohjelmat',
  'Muut uutislähetykset',
  'Opetus- ja tiedeohjelmat',
  'Ostos-TV',
  'Populaarikulttuuri',
  'Reality',
  'Ulkomainen fiktio',
  'Ulkomaiset elokuvat',
  'Urheilu',
  'Urheilu-uutiset',
  'Uutiset',
  'Vakiouutiset',
  'Viihde',
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
  0: 'KAVIn oma aloite',
  1: 'Yleisön palaute',
  2: 'Valitus',
  3: 'Oikaisupyyntö'
}

enums.isOikaisupyynto = function(val) { return val == 3 }

enums.authorOrganization = {
  0: 'Ulkopuolinen',
  1: 'KAVIn virkailija',
  2: 'Kuvalautakunta',
  3: 'KHO'
}

enums.isKHO = function(number) {
  return number == 3
}

enums.authorOrganizationIsKavi = function(c) { return c.authorOrganization === 1 }

enums.invoiceRowType = {
  registration: 'Kuvaohjelman rekisteröinti',
  classification: 'KAVIn luokittelu',
  reclassification: 'KAVIn uudelleenluokittelu'
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

enums.util.toCountry = function(code) { return enums.countries[code] || '-' }
enums.util.toCountryString = function(countries) { return countries.map(function(c) { return enums.countries[c] }).join(', ') }

enums.classificationCriteria = [
  { id:1,  category: 'violence', age: 18, title: "Erittäin voimakasta väkivaltaa", description: "Fiktiivistä, realistista ja erittäin veristä ja yksityiskohtaista tai erittäin pitkäkestoista ja yksityiskohtaista tai erittäin pitkäkestoista ja sadistista ihmisiin tai eläimiin kohdistuvaa väkivaltaa" },
  { id:2,  category: 'violence', age: 18, title: "Erittäin voimakasta väkivaltaa", description: "Aitoa ja yksityiskohtaisesti tai selväpiirteisesti sekä viihteellisesti tai ihannoiden esitettyä ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  { id:3,  category: 'violence', age: 18, title: "Erittäin voimakasta väkivaltaa", description: "Fiktiivistä, selväpiirteisesti ja pitkäkestoisesti esitettyä seksiin liittyvää väkivaltaa (raiskaus, insesti, pedofilia)" },
  { id:4,  category: 'violence', age: 16, title: "Voimakasta väkivaltaa", description: "Fiktiivistä tai aitoa yksityiskohtaista ja realistista tai hallitsevaa tai pitkäkestoista ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  { id:5,  category: 'violence', age: 16, title: "Voimakasta väkivaltaa", description: "Fiktiivistä tai aitoa yksityiskohtaisesti ja korostetusti tai yksityiskohtaisesti ja viihteellistetysti esitettyä ihmisiin tai eläimiin kohdistuvaa väkivallan tai onnettomuuksien seurausten kuvausta." },
  { id:6,  category: 'violence', age: 16, title: "Voimakasta väkivaltaa", description: "Fiktiivistä, esitystavaltaan selvästi yliampuvaa tai parodista, veristä ja yksityiskohtaista tai pitkäkestoista ja yksityiskohtaista tai pitkäkestoista ja sadistista ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  { id:7,  category: 'violence', age: 16, title: "Voimakasta väkivaltaa", description: "Aitoa yksityiskohtaisesti ta selväpiirteisesti esitettyä väkivaltaa, jossa uhrin kärsimykset tai väkivallan seuraukset tuodaan realistisesti esille." },
  { id:8,  category: 'violence', age: 16, title: "Voimakasta väkivaltaa", description: "Seksiin liittyvää fiktiivistä väkivaltaa, jossa uhrin kärsimys tulee selvästi esiin ja väkivalta on tarinan kannalta perusteltua tai voimakkaita viittauksia alaikäisiin kohdistuvaan seksuaaliseen väkivaltaan tai hyväksikäyttöön." },
  { id:9,  category: 'violence', age: 12, title: "Väkivaltaa", description: "Ei erityisen yksityiskohtaista tai ei hallitsevasti lapsiin, eläimiin tai lapsi-päähenkilön perheenjäseniin kohdistuvaa tai tarinan kannalta perusteltu yksittäinen, yksityiskohtainen ihmisiin tai eläimiin kohdistuva väkivaltakohtaus." },
  { id:10, category: 'violence', age: 12, title: "Väkivaltaa", description: "Epärealistisessa, etäännytetyssä yhteydessä esitettyä (joko epärealistinen väkivalta ihmis- tai eläinmäisiä hahmoja kohtaan tai realistinen väkivalta selkeän kuvitteellisia hahmoja kohtaan tai historiallinen, kulttuurinen jne. etäännytys!)" },
  { id:11, category: 'violence', age: 12, title: "Väkivaltaa", description: "Seksuaaliseen väkivaltaan viittaavaa (raiskaus, insesti, pedofilia)." },
  { id:12, category: 'violence', age: 7,  title: "Lievää väkivaltaa", description: "Epärealistista tai komediallista tai animaatio- tai slapstick-komediassa esitettyä yliampuvaa tai vähäistä väkivaltaa." },
  { id:13, category: 'violence', age: 7,  title: "Lievää väkivaltaa", description: "Yksittäinen, lievähkö ja lyhytkestoinen realistinen väkivaltakohtaus tai selkeät, mutta lievät tai lyhytkestoiset väkivaltaviitteet." },
  { id:14, category: 'violence', age: 0,  title: "Väkivaltaa tai vain hyvin lievää väkivaltaa", description: "Kuvaohjelmassa ei ole lainkaan väkivaltaa tai se on vain hyvin lievää." },
  { id:15, category: 'sex',      age: 18, title: "Erittäin yksityiskohtaista seksuaalista sisältöä", description: "Hallitsevaa ja seksikohtauksissa sukuelimiä selväpiirteisesti näyttävää." },
  { id:16, category: 'sex',      age: 16, title: "Avointa seksuaalista sisältöä", description: "Avointa, mutta yksityiskohdiltaan peiteltyä kuvausta tai yksityiskohtainen, yksittäinen ja lyhyt seksikohtaus." },
  { id:17, category: 'sex',      age: 12, title: "Seksuaalista sisältöä", description: "Peiteltyjä seksikohtauksia tai runsaasti selkeitä seksiviitteitä." },
  { id:18, category: 'sex',      age: 12, title: "Seksuaalista sisältöä", description: "Yksittäinen avoin, mutta yksityiskohdiltaan peitelty seksikuvaus (seksikohtaus)." },
  { id:19, category: 'sex',      age: 7,  title: "Lievää seksuaalista sisältöä", description: "Lieviä seksuaalisia viittauksia tai yksittäisiä verhotusti esitettyjä eroottissävyisiä kohtauksia." },
  { id:20, category: 'sex',      age: 0,  title: "Vain hyvin lievää seksuaalista sisältöä", description: "Halailua, syleilyä tai suudelmia tai alastomuutta muussa kuin seksuaalisessa kontekstissa." },
  { id:21, category: 'fear',     age: 18, title: "Erittäin voimakasta ahdistusta herättävää sisältöä", description: "Hallitsevaa, erittäin järkyttävää, yksityiskohtaista kuvausta ihmisiin tai eläimiin kohdistuvista julmuuksista tai perversioista." },
  { id:22, category: 'fear',     age: 18, title: "Erittäin voimakasta ahdistusta herättävää sisältöä", description: "Aitoa ongelmattomana tai ihannoiden esitettyä itseä tai muita vahingoittavaa, vakavasti henkeä uhkaavaa ja hengenvaarallista käyttäytymistä." },
  { id:23, category: 'fear',     age: 16, title: "Voimakasta ahdistusta herättävää sisältöä", description: "Ihmisiin tai eläimiin kohdistuvaa järkyttävää ja ahdistusta herättävää, pitkäkestoista ja intensiivistä kuoleman, vakavan väkivallan tai psyykkisen hajoamisen uhkaa. Myös itsemurhan ihannointi. Yliluonnolliseen liittyvää voimakasta ahdistavuutta. Yliluonnolliseen liittyvää voimakasta ahdistavuutta." },
  { id:24, category: 'fear',     age: 16, title: "Voimakasta ahdistusta herättävää sisältöä", description: "Runsaasti realistisia ja yksityiskohtaisia (makaabereja) kuvia silpoutuneista, pahoin vahingoittuneista tai mädäntyneistä ruumiista tai väkivallan uhreista." },
  { id:25, category: 'fear',     age: 16, title: "Voimakasta ahdistusta herättävää sisältöä", description: "Aitoa, ihannoivasti esitettyä itseä tai muita vahingoittavaa käyttäytymistä." },
  { id:26, category: 'fear',     age: 12, title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Ihmisiin tai eläimiin kohdistuvaa lyhytkestoista tai ei-hallitsevaa väkivallan tai kuoleman uhkaa tai kaltoin kohtelun tai psyykkisen kärsimyksen kuvausta. Menetysten, esim. perheenjäsenten sairauden tai kuoleman, voimakkaan surun, sekavuustilan tai itsemurhan kuvauksia." },
  { id:27, category: 'fear',     age: 12, title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Ahdistusta herättäviä luonnonmullistusten, onnettomuuksien, katastrofien tai konfliktien ja niihin kytkeytyvän kuoleman uhan tai uhrien kuvauksia." },
  { id:28, category: 'fear',     age: 12, title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Voimakkaita, äkillisiä ja yllättäviä ahdistusta, pelkoa tai kauhua herättäviä ääni- ja kuvatehosteita tai pitkäkestoista piinaavaa uhkaa. Yliluonnolliseen liittyvää melko voimakasta ahdistavuutta." },
  { id:29, category: 'fear',     age: 12, title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Yksittäisiä realistisia ja yksityiskohtaisia kuvauksia silpoutuneista, pahoin vahingoittuneista tai mädäntyneistä ruumiista tai väkivallan uhreista." },
  { id:30, category: 'fear',     age: 12, title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Aitoa, itseä tai muita vahingoittavaa käyttäytymistä." },
  { id:31, category: 'fear',     age: 7,  title: "Lievää ahdistusta herättävää sisältöä", description: "Melko lieviä ja lyhytkestoisia kauhuelementtejä, pientä pelottavuutta tai jännittävyyttä tai väkivallan uhkaa esimerkiksi animaatiossa tai fantasiassa (hirviöhahmoja, muodonmuutoksia, synkähköä visuaalista kuvastoa, lyhytkestoisia takaa-ajoja tai kohtalaisia äänitehosteita)." },
  { id:32, category: 'fear',     age: 7,  title: "Lievää ahdistusta herättävää sisältöä", description: "Lasten universaaleja pelkoja käsitteleviä kuvauksia tai tilanteita (esimerkiksi yksin jääminen, vanhemmista eroon joutuminen, pimeä, eksyminen tai läheisen menettäminen)." },
  { id:33, category: 'fear',     age: 7,  title: "Lievää ahdistusta herättävää sisältöä", description: "Dokumentaarista ihmisiin/eläimiin kohdistuvaa  lyhytkestoista uhkaa ilman tehosteita." },
  { id:34, category: 'fear',     age: 0,  title: "Vain hyvin lievää ahdistavaa sisältöä", description: "Hyvin lieviä ja lyhytkestoisia pelottavia tai jännittäviä elementtejä, jotka ratkeavat hyvin nopeasti positiiviseen suuntaan." },
  { id:35, category: 'drugs',    age: 18, title: "Ihannoivaa erittäin vaarallisten huumeiden käyttöä", description: "Hallitsevaa ja ihannoivassa valossa yksityiskohtaisesti esitettyä erittäin vaarallisten huumeiden käyttöä." },
  { id:36, category: 'drugs',    age: 16, title: "Huumeiden käyttöä", description: "Huumeiden realistista ja yksityiskohtaista ongelmakäyttöä tai yksittäisiä ongelmattomia tai ihannoivia huumeiden käytön kuvauksia." },
  { id:37, category: 'drugs',    age: 12, title: "Huumeiden ei-hallitsevaa käyttöä / alaikäisten alkoholin käyttöä", description: "Tällä tarkoitetaan huumeiden viitteellistä tai vähäistä käyttöä tai alaikäisten korostettua, viihteellistä tai ongelmatonta alkoholin käyttöä." }
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = enums
}
