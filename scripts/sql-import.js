var async = require('async')
var mysql = require('mysql')
var mongoose = require('mongoose')
var schema = require('../server/schema')
var enums = require('../shared/enums')
var stream = require('stream')
var _ = require('lodash')
var conn = mysql.createConnection({ host: 'localhost', user:'root', database: 'emeku' })

// Remove programs which have no classifications? -> ~7400
// Remove programs with ' (<user-id>) in the name -> ~5000

var tasks = {
  wipe: wipe, base: base,
  wipeNames: wipeNames, names: names,
  wipeActors: wipeActors, actors: actors,
  wipeDirectors: wipeDirectors, directors: directors,
  wipeProductionCompanies: wipeProductionCompanies, productionCompanies: productionCompanies,
  wipeClassifications: wipeClassifications, classifications: classifications,
  wipeProviders: wipeProviders, providers: providers,
  wipeAccounts: wipeAccounts, accounts: accounts,
  wipeUsers: wipeUsers, users: users,
  nameIndex: nameIndex
}

if (process.argv.length < 3) {
  console.error('Usage: node '+process.argv[1]+' [tasks]')
  console.error('  where tasks in: '+Object.keys(tasks).join(', '))
  process.exit(1)
}

var jobs = process.argv.slice(2)

conn.connect(function(err) {
  if (err) throw err
  mongoose.connect('mongodb://localhost/meku')
  async.eachSeries(jobs, run, function(err) {
    mongoose.disconnect(function() {
      conn.end(function() {
        console.log('> All done: ', err ? err : 'OK')
      })
    })
  })
})

function run(job, callback) {
  console.log('\n> '+job)
  tasks[job](function(err) {
    console.log('\n> '+job+' done.', (err ? err : 'OK'))
    callback(err)
  })
}

function base(callback) {
  conn.query('SELECT id, program_type, publish_year, year, countries, description FROM meku_audiovisualprograms where deleted != "1"')
    .stream({ highWaterMark: 2000 })
    .pipe(programMapper())
    .pipe(batcher(1000))
    .pipe(batchInserter('Movie', callback))
}

function names(callback) {
  var tick = progressMonitor()
  var result = {}
  conn.query('select p.id, j.type, n.name from meku_audiovisualprograms p join meku_audiovs_meku_names_c j on (p.id = j.meku_audio91farograms_ida) join meku_names n on (j.meku_audio7e24u_names_idb = n.id) where p.deleted != "1" and j.deleted != "1" and n.deleted != "1" and j.type in ("1A", "1B", "2S", "3R", "4M")')
    .stream()
    .pipe(consumer(function(row, done) {
      tick()
      var name = nameType(row.type)
      if (!result[row.id]) result[row.id] = {}
      if (!result[row.id][name]) result[row.id][name] = []
      var trimmed = trim(row.name)
      var arr = result[row.id][name]
      if (arr.indexOf(trimmed) == -1) arr.push(trimmed)
      done()
    }, function() {
      async.eachLimit(Object.keys(result), 5, function(key, cb) {
        tick('*')
        schema.Movie.update({ 'emeku-id': key }, result[key], cb)
      }, callback)
    }))

  function nameType(type) {
    if (type == '1A') return 'name'
    if (type == '1B') return 'name-other' // ???
    if (type == '2S') return 'name-fi'
    if (type == '3R') return 'name-sv'
    if (type == '4M') return 'name-other'
  }
}

function actors(callback) {
  var tick = progressMonitor()
  var result = {}
  conn.query('select p.id, CONCAT_WS(" ", TRIM(n.name), TRIM(n.surname)) as name from meku_audiovisualprograms p join meku_audiov_meku_actors_c j on (p.id = j.meku_audio7d9crograms_ida) join meku_actors n on (j.meku_audio8fcb_actors_idb = n.id) where p.deleted != "1" and j.deleted != "1" and n.deleted != "1"')
    .stream()
    .pipe(consumer(function(row, done) {
      tick()
      if (!result[row.id]) result[row.id] = []
      result[row.id].push(row.name)
      done()
    }, function() {
      async.eachLimit(Object.keys(result), 5, function(key, cb) {
        tick('*')
        schema.Movie.update({ 'emeku-id': key }, { actors: result[key] }, cb)
      }, callback)
    }))
}

function directors(callback) {
  var tick = progressMonitor()
  var result = {}
  conn.query('select p.id, CONCAT_WS(" ", TRIM(n.name), TRIM(n.surname)) as name from meku_audiovisualprograms p join meku_audiovku_directors_c j on (p.id = j.meku_audioc912rograms_ida) join meku_directors n on (j.meku_audioffd0rectors_idb = n.id) where p.deleted != "1" and j.deleted != "1" and n.deleted != "1"')
    .stream()
    .pipe(consumer(function(row, done) {
      tick()
      if (!result[row.id]) result[row.id] = []
      result[row.id].push(row.name)
      done()
    }, function() {
      async.eachLimit(Object.keys(result), 5, function(key, cb) {
        tick('*')
        schema.Movie.update({ 'emeku-id': key }, { directors: result[key] }, cb)
      }, callback)
    }))
}

function productionCompanies(callback) {
  var tick = progressMonitor()
  var result = {}
  conn.query('select p.id, pc.name from meku_audiovisualprograms p join meku_audiovon_companies_c j on (p.id = j.meku_audioe15crograms_ida) join meku_production_companies pc on (j.meku_audio8018mpanies_idb = pc.id) where p.deleted != "1" and j.deleted != "1" and pc.deleted != "1"')
    .stream()
    .pipe(consumer(function(row, done) {
      tick()
      if (!result[row.id]) result[row.id] = []
      result[row.id].push(row.name)
      done()
    }, function() {
      async.eachLimit(Object.keys(result), 5, function(key, cb) {
        tick('*')
        schema.Movie.update({ 'emeku-id': key }, { 'production-companies': result[key] }, cb)
      }, callback)
    }))
}

function classifications(callback) {
  // TODO: add c.status, c.no_items (== safe?), c.date_entered?, ...
  // TODO: verify that reg_date order is the valid ordering

  async.waterfall([base, criteria, mapUsers, mapBuyers, harmonize, save], callback)

  function base(callback) {
    var tick = progressMonitor()
    var result = { programs: {}, classifications: {} }
    conn.query('select p.id as programId, c.id as classificationId, p.provider_id, ' +
        ' c.format, c.runtime, c.age_level, c.descriptors, c.description, c.opinions, c.reg_date, c.assigned_user_id, c.status' +
        ' from meku_audiovisualprograms p' +
        ' join meku_audiovassification_c j on (p.id = j.meku_audio31d8rograms_ida)' +
        ' join meku_classification c on (c.id = j.meku_audioc249ication_idb)' +
        ' where p.deleted != "1" and j.deleted != "1" and c.deleted != "1" and c.status != "in_pocess" and c.status != "in_process"')
      .stream()
      .pipe(consumer(function(row, done) {
        tick()
        var classification = { 'emeku-id': row.classificationId }
        if (row.format) classification.format = mapFormat(row.format)
        if (row.runtime) classification.duration = row.runtime
        if (row.age_level) classification['legacy-age-limit'] = row.age_level
        if (row.descriptors) classification['warning-order'] = optionListToArray(row.descriptors)
        classification.provider_id = row.provider_id
        classification.comments = trimConcat(row.description, row.opinions, '\n')
        classification['registration-date'] = row.reg_date && new Date(row.reg_date) || undefined
        classification.assigned_user_id = row.assigned_user_id
        classification.status = row.status
        if (!result.programs[row.programId]) result.programs[row.programId] = []
        result.programs[row.programId].push(classification)
        result.classifications[row.classificationId] = classification
        done()
      }, function(err) {
        callback(err, result)
      }))
  }

  function criteria(result, callback) {
    var tick = progressMonitor()
    conn.query('select c.id as classificationId, substring(i.name, 1, 2) as item, l.text from meku_classification c' +
        ' join meku_classication_items_c l on (c.id = l.meku_classd51cication_ida)' +
        ' join meku_classification_items i on (i.id = l.meku_class42efn_items_idb)' +
        ' where c.deleted != "1" and l.deleted != "1" and i.deleted != "1"')
      .stream()
      .pipe(consumer(function(row, done) {
        tick('+')
        var obj = result.classifications[row.classificationId]
        if (!obj) return done()
        var cId = parseInt(row.item)
        if (!obj.criteria) obj.criteria = []
        obj.criteria.push(cId)
        var comment = trim(row.text)
        if (comment) {
          if (!obj['criteria-comments']) obj['criteria-comments'] = {}
          obj['criteria-comments'][cId] = comment
        }
        done()
      }, function(err) {
        callback(err, result)
      }))
  }

  function mapUsers(result, callback) {
    schema.User.find({}, function(err, users) {
      if (err) return callback(err)
      var userMap = _.indexBy(users, 'emeku-id')
      _.values(result.classifications).forEach(function(c) {
        if (c.assigned_user_id) {
          var u = userMap[c.assigned_user_id]
          c.author = { _id: u._id, name: u.name }
        }
      })
      callback(null, result)
    })
  }

  function mapBuyers(result, callback) {
    schema.Account.find({}, function(err, accounts) {
      if (err) return callback(err)
      var accountMap = _.indexBy(accounts, 'emeku-id')
      _.values(result.classifications).forEach(function(c) {
        if (!c.provider_id || c.provider_id == '0') return
        // Special case: FOX is now 'Location_of_providing/Tarjoamispaikka' but used to probably be 'Subscriber/Tilaaja'
        if (c.provider_id == '38d427ff-a829-14ce-9950-4fcf065ceb64') return

        var a = accountMap[c.provider_id]
        var obj = { _id: a._id, name: a.name }
        c.buyer = obj
        c.billing = obj
      })
      callback(null, result)
    })
  }

  function harmonize(result, callback) {
    Object.keys(result.classifications).forEach(function(key) {
      var obj = result.classifications[key]
      if (obj.criteria && obj.criteria.length > 0) {
        delete obj['legacy-age-limit']
      }
    })
    Object.keys(result.programs).forEach(function(key) {
      var arr = result.programs[key]
      if (arr.length > 1) result.programs[key] = _.sortBy(arr, 'registration-date').reverse()
    })
    callback(null, result)
  }

  function save(result, callback) {
    var tick = progressMonitor(100)
    async.eachLimit(Object.keys(result.programs), 5, function(key, cb) {
      tick('*')
      schema.Movie.update({ 'emeku-id': key }, { 'classifications': result.programs[key] }, cb)
    }, callback)
  }
}

function accounts(callback) {
  async.eachSeries([accountBase, accountEmailAddresses], function(fn, cb) { fn(cb) }, callback)
}

function accountBase(callback) {
  conn.query('select id, name, customer_type from accounts where customer_type not like "%Location_of_providing%" and deleted != "1"')
    .stream({ highWaterMark: 2000 })
    .pipe(transformer(function(row) { return { 'emeku-id': row.id, name: trim(row.name), roles: optionListToArray(row.customer_type) } }))
    .pipe(batcher(1000))
    .pipe(batchInserter('Account', callback))
}

function accountEmailAddresses(callback) {
  var tick = progressMonitor(100)
  var result = {}
  conn.query('select a.id, e.email_address, j.primary_address from accounts a join email_addr_bean_rel j on (j.bean_id = a.id) join email_addresses e on (j.email_address_id = e.id) where a.deleted != "1" and j.deleted != "1" and e.deleted != "1" and j.bean_module = "Accounts"')
    .stream()
    .pipe(consumer(function(row, done) {
      tick()
      if (!result[row.id]) result[row.id] = []
      if (row.primary_address == '1') {
        result[row.id].unshift(row.email_address)
      } else {
        result[row.id].push(row.email_address)
      }
      done()
    }, function() {
      async.eachLimit(Object.keys(result), 5, function(key, cb) {
        tick('*')
        schema.Account.update({ 'emeku-id': key }, { 'email-addresses': result[key] }, cb)
      }, callback)
    }))
}

function providers(callback) {
  conn.query('select id, name from accounts where customer_type like "%Location_of_providing%" and deleted != "1"')
    .stream({ highWaterMark: 2000 })
    .pipe(transformer(function(row) { return { 'emeku-id': row.id, name: trim(row.name) } }))
    .pipe(batcher(1000))
    .pipe(batchInserter('Provider', callback))
}

function users(callback) {
  conn.query('select id, user_name, CONCAT_WS(" ", TRIM(first_name), TRIM(last_name)) as name, status from users')
    .stream({ highWaterMark: 2000 })
    .pipe(transformer(function(row) { return { 'emeku-id': row.id, username: row.user_name, name: row.name, active: row.status == 'Active' } }))
    .pipe(batcher(1000))
    .pipe(batchInserter('User', callback))
}

function nameIndex(callback) {
  var tick = progressMonitor()
  schema.Movie.find({}, { name:1, 'name-fi':1, 'name-sv': 1, 'name-other': 1 }, function(err, allPrograms) {
    if (err) return callback(err)
    async.eachLimit(allPrograms, 5, function(p, callback) {
      tick()
      var words = p.name.concat(p['name-fi']).concat(p['name-sv']).concat(p['name-other']).map(function(s) { return s.split(/\s+/) })
      words = _(words).flatten().uniq().invoke('toLowerCase').sort().value()
      schema.Movie.update({ _id: p._id }, { 'all-names': words }, callback)
    }, callback)
  })
}

function batcher(num) {
  var arr = []
  var tx = new stream.Transform({ objectMode: true })
  tx._transform = function(chunk, encoding, done) {
    arr.push(chunk)
    if (arr.length == num) {
      tx.push(arr)
      arr = []
    }
    done()
  }
  tx._flush = function(done) {
    tx.push(arr)
    arr = []
    done()
  }
  return tx
}

function programMapper() {
  return transformer(function(row) {
    var obj = { 'emeku-id': row.id }
    if (row.program_type) obj['program-type'] = row.program_type
    if (row.publish_year && row.publish_year != 'undefined') obj.year = row.publish_year
    if (row.year && row.year != 'undefined') obj.year = row.year
    if (row.countries) obj.country = optionListToArray(row.countries)
    if (row.description) obj.synopsis = trim(row.description)
    return obj
  })
}

function batchInserter(model, callback) {
  var tick = progressMonitor(2)
  var onRows = function(rows, cb) {
    tick()
    var args = rows.concat([cb])
    schema[model].create.apply(schema[model], args)
  }
  return consumer(onRows, callback)
}

function progressMonitor(num) {
  var ii = 0
  var tick = num || 500
  return function(char) {
    if (ii++ % tick == 0) process.stdout.write(char || '.')
  }
}

function transformer(onRow) {
  var tx = new stream.Transform({ objectMode: true })
  tx._transform = function(row, encoding, done) {
    tx.push(onRow(row))
    done()
  }
  return tx
}

function consumer(onRow, callback) {
  var s = new stream.Writable({ objectMode: true })
  s._write = function(row, enc, cb) { onRow(row, cb) }
  s.on('finish', callback)
  return s
}

function optionListToArray(string) {
  if (!string || string.length == 0) return []
  var arr = string.split(',').map(function(s) { return s.replace(/[\^\s]/g, '')} )
  return _(arr).compact().uniq().value()
}

function mapFormat(f) {
  if (enums.format.indexOf(f) >= 0) return f
  return 'Muu'
}

function trim(s) {
  if (!s) return undefined
  var trimmed = s.trim()
  if (!trimmed) return undefined
  return trimmed
}
function trimConcat(s1, s2, sep){
  return _.compact([trim(s1), trim(s2)]).join(sep)
}

function wipe(callback) {
  // Calling native driver methods right after mongoose.connect doesn't work, so work-around'ing:
  connectMongoose(function() {
    async.each(schema.models, function(m, callback) { dropCollection(m.collection.name, function() { callback() }) }, callback)
  })
}
function wipeAccounts(callback) {
  connectMongoose(function() { dropCollection('accounts', function() { callback() }) })
}
function wipeProviders(callback) {
  connectMongoose(function() { dropCollection('providers', function() { callback() }) })
}
function wipeUsers(callback) {
  connectMongoose(function() { dropCollection('users', function() { callback() }) })
}

function wipeNames(callback) {
  schema.Movie.update({}, { 'name': [], 'name-fi': [], 'name-sv': [], 'name-other': [] }, { multi:true }, callback)
}
function wipeActors(callback) {
  schema.Movie.update({}, { 'actors': [] }, { multi:true }, callback)
}
function wipeDirectors(callback) {
  schema.Movie.update({}, { 'directors': [] }, { multi:true }, callback)
}
function wipeProductionCompanies(callback) {
  schema.Movie.update({}, { 'production-companies': [] }, { multi:true }, callback)
}
function wipeClassifications(callback) {
  schema.Movie.update({}, { 'classifications': [] }, { multi:true }, callback)
}

function dropCollection(coll, callback) {
  mongoose.connection.db.dropCollection(coll, callback)
}
function connectMongoose(callback) {
  schema.Movie.findOne({}, callback)
}