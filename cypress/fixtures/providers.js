const dateNow = Date.now()
module.exports = [{
  emekuId: '123',
  creationDate: dateNow,
  registrationDate: dateNow,
  yTunnus: '123456789-1',
  ssn: '',
  customerNumber: '123',
  name: 'testifirma',
  address: {street: 'testikatu', city: 'testikaupunki', zip: '00100', country: 'Suomi'},
  billing: {
    address: {street: 'testikatu', city: 'testikaupunki', zip: '00100', country: 'Suomi'},
    invoiceText: 'lasku',
    customerNumber: '123'
  },
  eInvoice: {address: 'verkkolasku', operator: 'operaattori'},
  billingPreference: 'address', // '' || 'address' || 'eInvoice'
  contactName: 'yhteyshenkilö',
  phoneNumber: '123456789',
  emailAddresses: ['test@test.com'],
  language: 'FI',
  deleted: false,
  active: true,
  message: 'viesti kaville',
  locations: [{
    emekuId: '123',
    customerNumber: '123',
    name: 'tarjoajapaikka 1',
    address: {street: 'testikatu 2', city: 'testikaupunki', zip: '00100', country: 'Suomi'},
    contactName: 'yhteyshenkilö 2',
    phoneNumber: '1233435',
    emailAddresses: ['test@test.example.com'],
    providingType: ['joku tyyppi'],
    registrationDate: dateNow,
    deleted: false,
    active: true,
    isPayer: true,
    adultContent: false,
    url: '',
    message: ''
  }]
}
]

