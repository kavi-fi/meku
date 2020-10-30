const users = require('./users')

module.exports = [
  {name: "DEMO tilaaja 1", roles: ['Subscriber'], emailAddresses: ['demo.1@email.org'], users: [], yTunnus: 'DEMO1'},
  {name: "DEMO tilaaja 2", roles: ['Subscriber'], emailAddresses: ['demo.2@email.org'], users: users, yTunnus: 'DEMO2'},
  {name: "DEMO tilaaja 3", roles: ['Subscriber', 'Classifier'], emailAddresses: ['demo.3@email.org'], users: users, yTunnus: 'DEMO3', apiToken: 'clientToken'}
]
