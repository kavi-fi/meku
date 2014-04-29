var async = require('async')
var mysql = require('mysql')
var mongoose = require('mongoose')
var schema = require('../server/schema')
var enums = require('../shared/enums')
var stream = require('stream')
var conn = mysql.createConnection({ host: 'localhost', user:'root', database: 'emeku' })

var tasks = {
  wipe: wipe, base: base,
  wipeNames: wipeNames, names: names,
  wipeActors: wipeActors, actors: actors,
  wipeDirectors: wipeDirectors, directors: directors,
  wipeProductionCompanies: wipeProductionCompanies, productionCompanies: productionCompanies,
  wipeClassifications: wipeClassifications, classifications: classifications
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
    .pipe(batchInserter(callback))
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
      result[row.id][name].push(row.name.trim())
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
  var tick = progressMonitor()
  var result = {}
  conn.query('select p.id, c.id as classificationId, c.date_entered, c.reg_date, c.age_level, c.descriptors, c.status, c.format, c.no_items, c.description from meku_audiovisualprograms p join meku_audiovassification_c j on (p.id = j.meku_audio31d8rograms_ida) join meku_classification c on (c.id = j.meku_audioc249ication_idb) where p.deleted != "1" and j.deleted != "1" and c.deleted != "1"')
    .stream()
    .pipe(consumer(function(row, done) {
      tick()
      if (!result[row.id]) result[row.id] = []
      var classification = { 'emeku-id': row.classificationId }
      if (row.format) classification.format = mapFormat(row.format)
      result[row.id].push(classification)
      done()
    }, function() {
      async.eachLimit(Object.keys(result), 5, function(key, cb) {
        tick('*')
        schema.Movie.update({ 'emeku-id': key }, { 'classifications': result[key] }, cb)
      }, callback)
    }))
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
  var tx = new stream.Transform({ objectMode: true })
  tx._transform = function(row, encoding, done) {
    var obj = { 'emeku-id': row.id }
    if (row.program_type) obj['program-type'] = row.program_type
    if (row.publish_year && row.publish_year != 'undefined') obj.year = row.publish_year
    if (row.year && row.year != 'undefined') obj.year = row.year
    if (row.countries) obj.country = optionListToArray(row.countries)
    if (row.description) obj.synopsis = row.description.trim()
    tx.push(obj)
    done()
  }
  return tx
}

function batchInserter(callback) {
  var tick = progressMonitor(2)
  var onRows = function(rows, cb) {
    tick()
    var args = rows.concat([cb])
    schema.Movie.create.apply(schema.Movie, args)
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

function consumer(onRow, callback) {
  var s = new stream.Writable({ objectMode: true })
  s._write = function(row, enc, cb) { onRow(row, cb) }
  s.on('finish', callback)
  return s
}

function optionListToArray(string) {
  if (!string || string.length == 0) return []
  return string.split(',').map(function(s) { return s.replace(/[\^\s]/g, '')} )
}
function mapFormat(f) {
  if (enums.format.indexOf(f) >= 0) return f
  return 'Muu'
}

function dropCollection(coll, callback) {
  mongoose.connection.db.dropCollection(coll, callback)
}
function wipe(callback) {
  // Calling native driver methods right after mongoose.connect doesn't work, so work-around'ing:
  schema.Movie.findOne({}, function() {
    dropCollection('movies', function(err) {
      if (err) return callback(err)
      dropCollection('accounts', callback)
    })
  })
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