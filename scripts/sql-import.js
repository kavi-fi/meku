var async = require('async')
var mysql = require('mysql')
var mongoose = require('mongoose')
var schema = require('../server/schema')
var enums = require('../shared/enums')
var utils = require('../shared/utils')
var stream = require('stream')
var _ = require('lodash')
var conn = mysql.createConnection({ host: 'localhost', user:'root', database: 'emeku' })

// Remove programs which have no classifications? -> ~7400

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
  nameIndex: nameIndex,
  markTrainingProgramsDeleted: markTrainingProgramsDeleted,
  linkTvSeries: linkTvSeries
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
  conn.query('SELECT id, program_type, publish_year, year, countries, description, genre, tv_program_genre, game_genre, game_format FROM meku_audiovisualprograms where deleted != "1"')
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
    conn.query('select p.id as programId, p.program_type, c.id as classificationId, p.provider_id, ' +
        ' c.format, c.runtime, c.age_level, c.descriptors, c.description, c.opinions, c.date_entered, c.reg_date, c.assigned_user_id, c.status,' +
        ' c.pegi_descriptors, c.pegi_age_level' +
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
        if (row.age_level) {
          classification['legacy-age-limit'] = row.age_level
        }
        if (row.program_type == '11') {
          classification['legacy-age-limit'] = row.pegi_age_level
        }
        if (row.descriptors) classification['warning-order'] = optionListToArray(row.descriptors)
        classification.provider_id = row.provider_id
        classification.comments = trimConcat(row.description, row.opinions, '\n')
        classification['creation-date'] = row.date_entered && new Date(row.date_entered) || undefined
        classification['registration-date'] = row.reg_date && new Date(row.reg_date) || undefined
        classification.assigned_user_id = row.assigned_user_id
        classification.status = row.status
        if (row.program_type == '11') classification.pegiWarnings = optionListToArray(row.pegi_descriptors)
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
  schema.Movie.find({}, { name:1, 'name-fi':1, 'name-sv': 1, 'name-other': 1, 'program-type':1, season:1, episode:1 }, function(err, allPrograms) {
    if (err) return callback(err)
    async.eachLimit(allPrograms, 5, function(p, callback) {
      tick()
      p.populateAllNames()
      schema.Movie.update({ _id: p._id }, { 'all-names': p['all-names'] }, callback)
    }, callback)
  })
}

function markTrainingProgramsDeleted(callback) {
  // CHECK: e.g.
  // * Armadillo OK
  // * Requiem for a dream (no valid entries, broken in emeku...)
  // * Antichrist (LUJUPI) is on name-fi
  var tick = progressMonitor(1)
  var count = 0
  schema.User.find({ username: { $ne: 'VET' } }, { username: 1 }, function(err, users) {
    if (err) return callback(err)
    async.eachLimit(users, 50, function(u, callback) {
      var q = new RegExp('\\(' + utils.escapeRegExp(u.username) + '\\)')
      schema.Movie.update({ $or: [ { name: q }, { 'name-fi': q } ] }, { deleted: true }, { multi:true }, function(err, numChanged) {
        tick()
        count += numChanged
        callback()
      })
    }, function(err) {
      if (err) return callback(err)
      console.log('\n> Number of test-programs marked as deleted: '+count)
      callback()
    })
  })
}

function linkTvSeries(callback) {
  var tick = progressMonitor()
  conn.query('select program.id as programId, program.season, program.episode, parent.id as parentId from meku_audiovisualprograms program join meku_audiovisualprograms parent on (program.parent_id = parent.id) where program.deleted != "1" and parent.deleted != "1" and program.program_type = "03" and parent.program_type = "05"')
    .stream()
    .pipe(consumer(onRow, callback))

  function onRow(row, callback) {
    tick()
    schema.Movie.findOne({ 'emeku-id': row.parentId }, { name:1 }, function(err, parent) {
      var update = { season: trimPeriod(row.season), episode: trimPeriod(row.episode), series: { _id: parent._id, name: parent.name[0] } }
      schema.Movie.update({ 'emeku-id': row.programId }, update, callback)
    })
  }
  function trimPeriod(s) { return s && s.replace(/\.$/, '') || s }
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
    obj['program-type'] = legacyProgramTypes[row.program_type] || 0
    if (row.publish_year && row.publish_year != 'undefined') obj.year = row.publish_year
    if (row.year && row.year != 'undefined') obj.year = row.year
    if (row.countries) obj.country = optionListToArray(row.countries)
    if (row.description) obj.synopsis = trim(row.description)
    var legacyGenre = optionListToArray(row.genre).map(function(g) { return legacyGenres[g] })
      .concat(optionListToArray(row.tv_program_genre).map(function(g) { return legacyTvGenres[g] }))
      .concat(optionListToArray(row.game_genre))
    if (legacyGenre) obj['legacy-genre'] = _(legacyGenre).compact().uniq().value()
    if (row.program_type == '11' || row.program_type == '08') obj.gameFormat = row.game_format
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
    async.each(schema.models, function(m, callback) {
      m.collection.dropAllIndexes(function() {
        dropCollection(m.collection.name, function() { callback() })
      })
    }, callback)
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

var legacyGenres = {
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
var legacyTvGenres = {
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

var legacyProgramTypes = {
  '01': 1,       //'Kotimainen elokuva' -> movie
  '02': 1,       //'Ulkomainen elokuva' -> movie
  '02b': 0,    // 'TESTI' -> unknown
  '03': 3,       //'TV-sarjan jakso' -> tv
  '04': 3,       // 'Muu tv-ohjelma' -> tv
  '05': 2,       // 'TV-sarjan nimi' -> series
  '06': 5,       // 'Traileri' -> trailer
  '07': 4,       // 'Extra' -> extra
  '08': 6,       // 'Peli' -> game
  '10': 0,      // 'Yhteistuotanto' -> unknown
  '11': 7,      // 'PEGI hyväksytty peli' -> game
  '12': 0       // 'Muu kuvaohjelma' -> unknown
}