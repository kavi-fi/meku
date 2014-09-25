
var envs = {
  production: {
    port: 3000,
    hostname: 'https://luokittelu.kavi.fi',
    sendEmail: true,
    forceSSL: true
  },
  training: {
    port: 3000,
    hostname: 'https://meku-training.herokuapp.com',
    sendEmail: true,
    forceSSL: true
  },
  staging: {
    port: 3000,
    hostname: 'https://luokittelu.kavi.fi',
    sendEmail: false,
    forceSSL: true
  },
  development: {
    isDev: true,
    port: 3000,
    hostname: 'http://localhost:3000',
    sendEmail: false,
    forceSSL: false,
    mongoUrl: 'mongodb://localhost/meku'
  },
  test: {
    port: 4000,
    hostname: 'http://localhost:4000',
    sendEmail: false,
    forceSSL: false,
    mongoUrl: 'mongodb://localhost/meku-test'
  }
}

Object.keys(envs).forEach(function(k) { envs[k].name = k })

exports.get = function() { return envs[process.env.NODE_ENV ? process.env.NODE_ENV : 'development'] }

