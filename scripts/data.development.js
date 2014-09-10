exports.users = [
  {username:'ROOT', active: true, password:'root', role:'root', name:'root', emails:['root@fake-meku.fi'] },
  {username:'KAVI', active: true, password:'kavi', role:'kavi', name:'kavi', emails:['kavi@fake-meku.fi'] },
  {username:'USER', active: true, password:'user', role:'user', name:'user', emails:['user@fake-meku.fi'] }
]

exports.accounts = [
  {name: "DEMO tilaaja 1", roles: ['Subscriber'], emailAddresses: [], users: ['ROOT', 'KAVI', 'USER'], yTunnus: 'DEMO1' },
  {name: "DEMO tilaaja 2", roles: ['Subscriber'], emailAddresses: [], users: ['ROOT', 'KAVI', 'USER'], yTunnus: 'DEMO2' },
  {name: "DEMO tilaaja 3", roles: ['Subscriber', 'Classifier'], emailAddresses: [], users: ['ROOT', 'KAVI', 'USER'], yTunnus: 'DEMO3' }
]

