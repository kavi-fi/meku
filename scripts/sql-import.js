var async = require('async')
var mysql = require('mysql')
var mongoose = require('mongoose')
var bcrypt = require('bcrypt')
var schema = require('../server/schema')
var enums = require('../shared/enums')
var utils = require('../shared/utils')
var stream = require('stream')
var _ = require('lodash')
var conn = mysql.createConnection({ host: 'localhost', user:'root', database: 'emeku' })

/*
 Dependencies:
   sequences & base & names before everything
   accounts before classifications
   linkTvSeries before nameIndex
   metadata before metadataIndex

 There are some memory issues, so run in parts, eg:
   node scripts/sql-import.js sequences base && node scripts/sql-import.js names && node scripts/sql-import.js metadata accounts classifications markTrainingProgramsDeleted linkTvSeries linkCustomersIds metadataIndex nameIndex

 Should remove programs which have no classifications? -> ~7400
   check how many are tv-series-names?
*/

var tasks = {
  wipe: wipe, sequences: sequences, base: base,
  wipeMetadata: wipeMetadata, metadata: metadata,
  wipeNames: wipeNames, names: names,
  wipeClassifications: wipeClassifications, classifications: classifications,
  wipeAccounts: wipeAccounts, accounts: accounts,
  nameIndex: nameIndex,
  wipeMetadataIndex: wipeMetadataIndex, metadataIndex: metadataIndex,
  markTrainingProgramsDeleted: markTrainingProgramsDeleted,
  linkCustomersIds: linkCustomersIds,
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
  var q = 'SELECT id, program_type, publish_year, year, countries, description, genre, tv_program_genre, game_genre, game_format FROM meku_audiovisualprograms where program_type != "11" and deleted != "1"'
  batchInserter(q, programMapper, 'Program', callback)

  function programMapper(row) {
    var obj = { emekuId: row.id }
    obj.programType = enums.legacyProgramTypes[row.program_type] || 0
    if (row.publish_year && row.publish_year != 'undefined') obj.year = row.publish_year
    if (row.year && row.year != 'undefined') obj.year = row.year
    if (row.countries) obj.country = optionListToArray(row.countries)
    if (row.description) obj.synopsis = trim(row.description)
    var legacyGenre = optionListToArray(row.genre).map(function(g) { return enums.legacyGenres[g] })
      .concat(optionListToArray(row.tv_program_genre).map(function(g) { return enums.legacyTvGenres[g] }))
      .concat(optionListToArray(row.game_genre))
    if (legacyGenre) obj.legacyGenre = _(legacyGenre).compact().uniq().value()
    if (row.program_type == '11' || row.program_type == '08') obj.gameFormat = row.game_format
    return obj
  }
}

function names(callback) {
  // NOTE: Should add meku_audiovisualprograms.name somehow?
  var q = 'select p.id, j.type, n.name from meku_audiovisualprograms p join meku_audiovs_meku_names_c j on (p.id = j.meku_audio91farograms_ida) join meku_names n on (j.meku_audio7e24u_names_idb = n.id) where p.deleted != "1" and j.deleted != "1" and n.deleted != "1" and j.type in ("1A", "1B", "2S", "3R", "4M")'
  batchUpdater(q, mapper, update, callback)

  function mapper(row, result) {
    var name = nameType(row.type)
    if (!result[row.id]) result[row.id] = {}
    if (!result[row.id][name]) result[row.id][name] = []
    var trimmed = trim(row.name)
    var arr = result[row.id][name]
    if (arr.indexOf(trimmed) == -1) arr.push(trimmed)
  }

  function update(key, obj, callback) {
    if (!obj.name) fixNameless(obj)
    schema.Program.update({ emekuId: key }, obj, callback)
  }

  function nameType(type) {
    if (type == '1A') return 'name'
    if (type == '1B') return 'nameOther' // ???
    if (type == '2S') return 'nameFi'
    if (type == '3R') return 'nameSv'
    if (type == '4M') return 'nameOther'
  }

  function fixNameless(doc) {
    var name = doc.nameFi[0] || doc.nameSv[0] || doc.nameOther[0]
    if (name) doc.name = [name]
  }
}

function metadata(callback) {
  async.applyEachSeries([actors, directors, productionCompanies], callback)

  function actors(callback) {
    console.log('\n> actors')
    var q = 'select p.id, CONCAT_WS(" ", TRIM(n.name), TRIM(n.surname)) as name from meku_audiovisualprograms p join meku_audiov_meku_actors_c j on (p.id = j.meku_audio7d9crograms_ida) join meku_actors n on (j.meku_audio8fcb_actors_idb = n.id) where p.deleted != "1" and j.deleted != "1" and n.deleted != "1"'
    batchUpdater(q, idToNameMapper, singleFieldUpdater('Program', 'actors'), callback)
  }

  function directors(callback) {
    console.log('\n> directors')
    var q = 'select p.id, CONCAT_WS(" ", TRIM(n.name), TRIM(n.surname)) as name from meku_audiovisualprograms p join meku_audiovku_directors_c j on (p.id = j.meku_audioc912rograms_ida) join meku_directors n on (j.meku_audioffd0rectors_idb = n.id) where p.deleted != "1" and j.deleted != "1" and n.deleted != "1"'
    batchUpdater(q, idToNameMapper, singleFieldUpdater('Program', 'directors'), callback)
  }

  function productionCompanies(callback) {
    console.log('\n> productionCompanies')
    var q = 'select p.id, pc.name from meku_audiovisualprograms p join meku_audiovon_companies_c j on (p.id = j.meku_audioe15crograms_ida) join meku_production_companies pc on (j.meku_audio8018mpanies_idb = pc.id) where p.deleted != "1" and j.deleted != "1" and pc.deleted != "1"'
    batchUpdater(q, idToNameMapper, singleFieldUpdater('Program', 'productionCompanies'), callback)
  }

  function idToNameMapper(row, result) {
    if (!result[row.id]) result[row.id] = []
    result[row.id].push(row.name)
  }
}

function classifications(callback) {
  // TODO: add c.no_items (== safe?)
  // TODO: verify that reg_date order is the valid ordering

  async.waterfall([base, criteria, mapUsers, mapBuyers, harmonize, save], callback)

  function base(callback) {
    var tick = progressMonitor()
    var result = { programs: {}, classifications: {} }
    conn.query('select p.id as programId, p.program_type, c.id as classificationId, p.provider_id, ' +
        ' c.format, c.runtime, c.age_level, c.descriptors, c.description, c.opinions, c.date_entered, c.reg_date, c.assigned_user_id, c.status' +
        ' from meku_audiovisualprograms p' +
        ' join meku_audiovassification_c j on (p.id = j.meku_audio31d8rograms_ida)' +
        ' join meku_classification c on (c.id = j.meku_audioc249ication_idb)' +
        ' where p.program_type != "11" and p.deleted != "1" and j.deleted != "1" and c.deleted != "1" and c.status != "in_pocess" and c.status != "in_process"')
      .stream()
      .pipe(consumer(function(row, done) {
        tick()
        var classification = { emekuId: row.classificationId }
        if (row.format) classification.format = mapFormat(row.format)
        if (row.runtime) classification.duration = row.runtime
        if (row.age_level) {
          classification.legacyAgeLimit = row.age_level
        }
        if (row.descriptors) classification.warningOrder = optionListToArray(row.descriptors)
        classification.provider_id = row.provider_id
        classification.comments = trimConcat(row.description, row.opinions, '\n')
        classification.creationDate = readAsUTCDate(row.date_entered)
        classification.registrationDate = readAsUTCDate(row.reg_date)
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
          if (!obj.criteriaComments) obj.criteriaComments = {}
          obj.criteriaComments[cId] = comment
        }
        done()
      }, function(err) {
        callback(err, result)
      }))
  }

  function mapUsers(result, callback) {
    schema.User.find({}, function(err, users) {
      if (err) return callback(err)
      var userMap = _.indexBy(users, 'emekuId')
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
      var accountMap = _.indexBy(accounts, 'emekuId')
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
        delete obj.legacyAgeLimit
      }
    })
    Object.keys(result.programs).forEach(function(key) {
      var arr = result.programs[key]
      if (arr.length > 1) result.programs[key] = _.sortBy(arr, 'registrationDate').reverse()
    })
    callback(null, result)
  }

  function save(result, callback) {
    var tick = progressMonitor(100)
    async.eachLimit(Object.keys(result.programs), 5, function(key, cb) {
      tick('*')
      schema.Program.update({ emekuId: key }, { 'classifications': result.programs[key] }, cb)
    }, callback)
  }
}

function accounts(callback) {
  async.applyEachSeries([accountBase, accountEmailAddresses, providers, userBase, userEmails, demoUsers, linkUserAccounts, linkSecurityGroupAccounts, generateApiTokens, accountSequence], callback)

  function accountBase(callback) {
    var q = 'select id, name, customer_type, sic_code,' +
      ' bills_lang, bills_text, billing_address_street, billing_address_city, billing_address_postalcode, billing_address_country,' +
      ' e_invoice, e_invoice_operator' +
      ' from accounts where customer_type not like "%Location_of_providing%" and deleted != "1"'
    function onRow(row) {
      return {
        emekuId: row.id, name: trim(row.name), roles: optionListToArray(row.customer_type), yTunnus: trim(row.sic_code),
        billing: {
          street: trim(row.billing_address_street), city: trim(row.billing_address_city), zip: trim(row.billing_address_postalcode), country: legacyCountryToCode(trim(row.billing_address_country)),
          language: langCode(trim(row.bills_lang)), invoiceText: trim(row.bills_text)
        },
        eInvoice: { address: trim(row.e_invoice), operator: trim(row.e_invoice_operator) }
      }
    }
    batchInserter(q, onRow, 'Account', callback)
  }

  function accountEmailAddresses(callback) {
    var q = 'select a.id, e.email_address, j.primary_address from accounts a join email_addr_bean_rel j on (j.bean_id = a.id) join email_addresses e on (j.email_address_id = e.id) where a.deleted != "1" and j.deleted != "1" and e.deleted != "1" and j.bean_module = "Accounts"'
    batchUpdater(q, idToEmailMapper, singleFieldUpdater('Account', 'emailAddresses'), callback)
  }

  function providers(callback) {
    var q = 'select id, name from accounts where customer_type like "%Location_of_providing%" and deleted != "1"'
    function onRow(row) { return { emekuId: row.id, name: trim(row.name) } }
    batchInserter(q, onRow, 'Provider', callback)
  }

  function userBase(callback) {
    var q = 'select id, user_name, CONCAT_WS(" ", TRIM(first_name), TRIM(last_name)) as name, status from users'
    function onRow(row) { return { emekuId: row.id, username: row.user_name, name: row.name, active: row.status == 'Active' } }
    batchInserter(q, onRow, 'User', callback)
  }

  function userEmails(callback) {
    var q = 'select u.id, e.email_address, j.primary_address from users u join email_addr_bean_rel j on (j.bean_id = u.id) join email_addresses e on (j.email_address_id = e.id) where u.deleted != "1" and j.deleted != "1" and e.deleted != "1" and j.bean_module = "Users"'
    batchUpdater(q, idToEmailMapper, singleFieldUpdater('User', 'emails'), callback)
  }

  function demoUsers(callback) {
    async.forEach(['root', 'kavi', 'user'], function(u, callback) {
      new schema.User({ username:u, password:u, role:u, name:u, emails:[u+'@fake-meku.fi'] }).save(callback)
    }, callback)
  }

  function linkUserAccounts(callback) {
    conn.query('select a.id as accountId, u.id as userId from users u join accounts_users j on (u.id = j.user_id) join accounts a on (a.id = j.account_id) where u.deleted != "1" and j.deleted != "1" and a.deleted != "1"')
      .stream()
      .pipe(consumer(pushUserToAccount, callback))
  }

  function linkSecurityGroupAccounts(callback) {
    // securitygroup:8d4ad931-1055-a4f5-96da-4e3664911855 is meku users, which are linked everywhere, ignoring.
    conn.query('select a.id as accountId, u.id as userId from users u join securitygroups_users sgu on (u.id = sgu.user_id) join securitygroups sg on (sg.id = sgu.securitygroup_id) join securitygroups_records sgr on (sg.id = sgr.securitygroup_id and sgr.module = "Accounts") join accounts a on (sgr.record_id = a.id) where sg.id != "8d4ad931-1055-a4f5-96da-4e3664911855" and u.deleted != "1" and sgu.deleted != "1" and sg.deleted != "1" and sgr.deleted != "1" and a.deleted != "1"')
      .stream()
      .pipe(consumer(pushUserToAccount, callback))
  }

  function generateApiTokens(callback) {
    // yle, nelonenmedia, mtv
    var ids = ['cd5ad00f-3632-3f57-cc9e-4e770b9eeef9', '1db92ef2-ab3d-950d-e053-4e82f88d1df0', 'ae57bb17-a9f2-1f09-a928-4e97f008b792']
    async.forEach(ids, setApiToken, callback)
  }

  function accountSequence(callback) {
    schema.Account.find({}, function(err, docs) {
      if (err) callback(new Error())
      async.forEach(docs, function(doc, callback) {
        schema.Sequence.next('Account', function(err, seq) {
          if (err) callback(new Error())
          doc.sequenceId = seq
          doc.save(callback)
        })
      }, callback)
    })
  }

  function idToEmailMapper(row, result) {
    if (!result[row.id]) result[row.id] = []
    if (row.primary_address == '1') {
      result[row.id].unshift(row.email_address)
    } else {
      result[row.id].push(row.email_address)
    }
  }

  function pushUserToAccount(row, callback) {
    schema.User.findOne({ emekuId: row.userId }, { username: 1 }, function (err, user) {
      if (err || !user) return callback(err || new Error('No such user ' + row.userId))
      var data = { _id: user._id, name: user.username }
      schema.Account.update({ emekuId: row.accountId }, { $addToSet: { users: data } }, callback)
    })
  }

  function setApiToken(accountEmekuId, callback) {
    schema.Account.update({ emekuId: accountEmekuId }, { apiToken: mongoose.Types.ObjectId().toString() }, callback)
  }

  function langCode(lang) { return lang == 'Swedish' ? 'SE' : 'FI' }

  function legacyCountryToCode(country) {
    if (!country) return 'FI'
    var mapping = {
      'suomi': 'FI',
      'finland': 'FI',
      'helsinki': 'FI',
      'ahvenanmaa': 'FI',
      'united kingdom': 'GB',
      'sweden': 'SE',
      'sverige': 'SE',
      'denmark': 'DK'
    }
    var result = mapping[country.toLowerCase()]
    if (!result) throw new Error('No legacyCountryCode for "'+country+'"')
    return result
  }
}

function nameIndex(callback) {
  var fields = { name:1, nameFi:1, nameSv: 1, nameOther: 1, programType:1, season:1, episode:1, series:1 }
  var tick = progressMonitor()
  schema.Program.find({}, fields).stream().pipe(consumer(onRow, callback))

  function onRow(p, callback) {
    tick()
    p.populateAllNames(function(err) {
      if (err) return callback(err)
      schema.Program.update({ _id: p._id }, { allNames: p.allNames }, callback)
    })
  }
}

function metadataIndex(callback) {
  var tick = progressMonitor()
  schema.Program.find({}, { actors: 1, directors: 1 }).stream().pipe(consumer(onRow, callback))

  function onRow(p, callback) {
    tick()
    schema.Actor.updateWithNames(p.actors, function() {
      schema.Director.updateWithNames(p.directors, function() {
        callback()
      })
    })
  }
}

function markTrainingProgramsDeleted(callback) {
  // CHECK: e.g.
  // * Armadillo OK
  // * Requiem for a dream (no valid entries, broken in emeku...)
  // * Antichrist (LUJUPI) is on nameFi
  var tick = progressMonitor(1)
  var count = 0
  schema.User.find({ username: { $ne: 'VET' } }, { username: 1 }, function(err, users) {
    if (err) return callback(err)
    async.eachLimit(users, 50, function(u, callback) {
      var q = new RegExp('\\(' + utils.escapeRegExp(u.username) + '\\)')
      schema.Program.update({ $or: [ { name: q }, { nameFi: q } ] }, { deleted: true }, { multi:true }, function(err, numChanged) {
        tick()
        count += numChanged
        callback()
      })
    }, function(err) {
      if (err) return callback(err)
      console.log('\n> Number of test-programs marked as deleted: '+count)
      schema.Program.update({ name:[] }, { deleted: 1 }, { multi:true }, callback)
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
    schema.Program.findOne({ emekuId: row.parentId }, { name:1 }, function(err, parent) {
      var update = { season: trimPeriod(row.season), episode: trimPeriod(row.episode), series: { _id: parent._id, name: parent.name[0] } }
      schema.Program.update({ emekuId: row.programId }, update, callback)
    })
  }
  function trimPeriod(s) { return s && s.replace(/\.$/, '') || s }
}

function linkCustomersIds(callback) {
  schema.Account.find({}, { emekuId:1 }, function(err, accounts) {
    if (err) return callback(err)
    var accountMap = _.indexBy(accounts, 'emekuId')

    var tick = progressMonitor()
    conn.query('select id, ref_id, provider_id from meku_audiovisualprograms where ref_id is not null')
      .stream()
      .pipe(consumer(onRow, callback))

    function onRow(row, callback) {
      tick()
      var update = { customersId: { account: accountMap[row.provider_id]._id, id: row.ref_id } }
      schema.Program.update({ emekuId: row.id }, update, callback)
    }
  })
}

function sequences(callback) {
  async.forEach(['Account', 'Program'], createSequence, callback)

  function createSequence(s, callback) { new schema.Sequence({ _id: s, seq: 0 }).save(callback) }
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

function batchInserter(q, mapFn, modelName, callback) {
  conn.query(q)
    .stream({ highWaterMark: 2000 })
    .pipe(transformer(mapFn))
    .pipe(batcher(1000))
    .pipe(inserter(modelName, callback))
}

function inserter(model, callback) {
  var tick = progressMonitor(2)
  var onRows = function(rows, cb) {
    tick()
    var args = rows.concat([cb])
    schema[model].create.apply(schema[model], args)
  }
  return consumer(onRows, callback)
}

function batchUpdater(query, mapFn, updateFn, callback) {
  var tick = progressMonitor()
  var result = {}
  conn.query(query)
    .stream()
    .pipe(consumer(function(row, done) {
      tick()
      mapFn(row, result)
      done()
    }, function() {
      async.eachLimit(Object.keys(result), 5, function(key, cb) {
        tick('*')
        updateFn(key, result[key], cb)
      }, callback)
    }))
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

function singleFieldUpdater(schemaName, fieldName) {
  return function(key, obj, callback) {
    schema[schemaName].update({ emekuId: key }, utils.keyValue(fieldName, obj), callback)
  }
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

function readAsUTCDate(s) {
  return s && new Date(s + 'Z') || undefined
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
  connectMongoose(function() {
    async.each(['accounts', 'providers', 'users'], dropCollection, callback)
  })
}
function wipeMetadataIndex(callback) {
  connectMongoose(function() {
    async.each(['actors', 'directors'], dropCollection, callback)
  })
}
function wipeNames(callback) {
  schema.Program.update({}, { name: [], nameFi: [], nameSv: [], nameOther: [] }, { multi:true }, callback)
}
function wipeMetadata(callback) {
  schema.Program.update({}, { actors: [], directors: [], productionCompanies: [] }, { multi:true }, callback)
}
function wipeClassifications(callback) {
  schema.Program.update({}, { 'classifications': [] }, { multi:true }, callback)
}

function dropCollection(coll, callback) {
  mongoose.connection.db.dropCollection(coll, callback)
}
function connectMongoose(callback) {
  schema.Program.findOne({}, callback)
}
