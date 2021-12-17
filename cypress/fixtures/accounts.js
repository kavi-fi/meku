const users = require('./users')

module.exports = [
  {name: "DEMO tilaaja 1", roles: ['Subscriber'], emailAddresses: ['demo.1@email.org'], users: [], yTunnus: 'DEMO1', address: {street: '', zip: '00000', city: 'Helsinki'}},
  {name: "DEMO tilaaja 2", roles: ['Subscriber'], emailAddresses: ['demo.2@email.org'], users: users, yTunnus: 'DEMO2', address: {street: '', zip: '00000', city: 'Helsinki'}},
  {name: "DEMO tilaaja 3", roles: ['Subscriber', 'Classifier'], emailAddresses: ['demo.3@email.org'], users: users, yTunnus: 'DEMO3', address: {street: '', zip: '00000', city: 'Helsinki'}, apiToken: 'clientToken'},
  {name: "DEMO tilaaja 4", roles: ['Subscriber', 'Classifier'], emailAddresses: ['demo.4@email.org'], users: users, yTunnus: 'DEMO4', address: {street: '', zip: '00000', city: 'Helsinki'}, apiToken: 'clientToken'}
]
