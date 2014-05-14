enums = {}
enums.util = {}

enums.criteriaCategories = ['violence', 'sex', 'fear', 'drugs']

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

enums.roles = {
  'Provider': 'Tarjoaja',
  'Location_of_providing': 'Tarjoamispaikka',
  'Subscriber': 'Tilaaja',
  'Classifier': 'Luokittelija',
  'Distributor': 'Levittaja',
  'Other': 'Muu'
}

enums.programType = {
  0: { type: 'unknown', fi: '?' },
  1: { type: 'movie', fi: 'Elokuva' },
  2: { type: 'series', fi: 'TV-sarjan nimi' },
  3: { type: 'tv', fi: 'TV' },
  4: { type: 'extra', fi: 'Extra' },
  5: { type: 'trailer', fi: 'Traileri' },
  6: { type: 'game', fi: 'Peli' },
  7: { type: 'pegi', fi: 'PEGI-peli' }
}

enums.genre = [
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

enums.classificationStatus = [
  'reclassification1',
  'reclassification3',
  'registered',
  'disapproved',
  'in_process'
  // 'in_pocess',
  // NULL,
]

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
  'CS': 'Serbia / Tsekkoslovakia',
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
  'ES': 'ES',
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
  'MC': 'Monaca',
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

enums.productionCompanies = [
  'Amblin Entertainment',
  'Keystone Studios',
  'Spyglass Entertainment',
  'Tuffi Films',
  'United Artists Films, Inc.',
  'Universal Studios',
  'Walt Disney Studios',
  'Warner Brothers',
  'Warner Sisters'
]

if (typeof module !== 'undefined' && module.exports) {
  module.exports = enums
}