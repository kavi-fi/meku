/*

To generate tables -directory from original xml:

# Remove non-utf8 characters (e.g. <E6> @ import_maps - table):
iconv -c -f utf-8 -t utf-8 emeku-original.xml > emeku-stripped-utf8.xml

# Remove utf8 control characters:
tr -d '\036\037' < emeku-stripped-utf8.xml > emeku-fixed-stripped-utf8.xml

# Split all tables to separate xml files
mkdir tables
cd tables
awk '/<!-- Table/{ if (f) { print "</docs>" > f; close(f); } f = $3".xml"; print "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<docs>" > f }{ if (f) print > f }' ../emeku-fixed-stripped-utf8.xml

*/

// TODO: None of the import functions currently handle the deleted-attribute!

var schema = require('../server/schema')
var xml = require('xml-object-stream')
var mongoose = require('mongoose')
var async = require('async')
var path = require('path')
var fs = require('fs')

var dataDir = path.join(__dirname, '../tables/')
var debug = true

var tasks = {
  wipe: wipe,
  base: base,
  wipeActors: wipeActors,
  actors: actors,
  wipeNames: wipeNames,
  names: names
}

var mappings = {
  meku_audiovisualprograms: { table:'meku_audiovisualprograms', fields: { 'id':mapTo('emeku-id'), 'name':asArray, 'deleted':intToBoolean } },
  meku_actors: { table:'meku_actors', fields: { 'id':1, 'name':trim, 'surname':trim, 'deleted':intToBoolean } },
  meku_audiov_meku_actors_c: { table: 'meku_audiov_meku_actors_c', fields: { 'meku_audio7d9crograms_ida':1, 'meku_audio8fcb_actors_idb':1, 'deleted':intToBoolean } },

  meku_names: { table: 'meku_names', fields: { 'id':1, 'name':trim, 'deleted':intToBoolean } },
  meku_audiovs_meku_names_c: { table: 'meku_audiovs_meku_names_c', fields: { type:1, 'meku_audio91farograms_ida':1, 'meku_audio7e24u_names_idb':1, 'deleted':intToBoolean } }
}

if (process.argv.length < 3) {
  console.error('Usage: node '+process.argv[1]+' [tasks]')
  console.error('  where tasks in: '+Object.keys(tasks).join(', '))
  process.exit(1)
}

mongoose.connect('mongodb://localhost/meku')

var jobs = process.argv.slice(2)

async.eachSeries(jobs, run, function(err) {
  mongoose.disconnect(function() {
    console.log('Done ', err ? err : 'OK')
  })
})

function run(job, callback) {
  console.log('> '+job)
  tasks[job](function(err) {
    console.log('> '+job+' done.', (err ? err : 'OK'))
    callback(err)
  })
}

function wipe(callback) {
  var collections = ['Movie', 'ProductionCompany', 'Account']
  async.each(collections, function(c,callback) { schema[c].remove({}, callback) }, callback)
}

function wipeActors(callback) {
  schema.Movie.update({}, { actors:[] }, { multi:true }, callback)
}

function wipeNames(callback) {
  schema.Movie.update({}, { $push: { name: { $each: [ ], $slice: 1 } } }, { multi:true}, function() {
    schema.Movie.update({}, { 'name-fi': [], 'name-sv': [] }, { multi:true }, callback)
  })
}

function base(callback) {
  parseTableToJsonArray(mappings.meku_audiovisualprograms, function(err, programs) {
    if (err) return callback(err)
    massCreate('Movie', programs, callback)
  })
}

function names(callback) {
  // NOTE: This has NOT been tested yet.
  parseTableToJsonArray(mappings.meku_names, function(err, allNames) {
    if (err) return callback(err)
    parseTableToJsonArray(mappings.meku_audiovs_meku_names_c, function(err, allLinks) {
      if (err) return callback(err)
      var nameMap = toIdObject('id', allNames)
      console.log('> mapping names')
      var updates = allLinks.map(function(link) {
        var type = movieNameType(link.type)
        if (!type) return undefined
        var name = nameMap[link.meku_audio7e24u_names_idb]
        if (!name) return undefined
        return {
          cond: { 'emeku-id': link.meku_audio91farograms_ida },
          update: { $addToSet: keyValue(type, name.name) }
        }
      }).filter(function(u) { return u !== undefined })
      console.log('> updating names')
      massUpdate('Movie', updates, callback)
    })
  })

  function movieNameType(type) {
    if (type == '1A') return 'name'
    if (type == '2S') return 'name-fi'
    if (type == '3R') return 'name-sv'
    return undefined
  }
}

function actors(callback) {
  parseTableToJsonArray(mappings.meku_actors, function(err, allActors) {
    if (err) return callback(err)
    parseTableToJsonArray(mappings.meku_audiov_meku_actors_c, function(err, allLinks) {
      if (err) return callback(err)
      console.log('> idfying actors')
      var actorMap = toIdObject('id', allActors)
      console.log('> mapping actors')
      var updates = allLinks.map(function(link) {
        var actor = actorMap[link.meku_audio8fcb_actors_idb]
        if (!actor) return undefined
        return {
          cond: { 'emeku-id': link.meku_audio7d9crograms_ida },
          update: { $addToSet: { actors: ((actor.name || '') + ' ' + (actor.surname || '')).trim() } }
        }
      }).filter(function(u) { return u !== undefined })
      console.log('> updating actors')
      massUpdate('Movie', updates, callback)
    })
  })
}

function massCreate(schemaName, objects, callback) {
  async.eachLimit(objects, 5, function(obj, callback) { schema[schemaName].create(obj, callback) }, callback)
}
function massUpdate(schemaName, objects, callback) {
  async.eachLimit(objects, 5, function(obj, callback) { schema[schemaName].update(obj.cond, obj.update, {}, callback) }, callback)
}

function toIdObject(idKey, array) {
  var result = {}
  array.forEach(function(item) { result[item[idKey]] = item })
  return result
}

function parseTableToJsonArray(mapping, callback) {
  var ii = 0
  var result = []
  var parser = xml.parse(fs.createReadStream(path.join(dataDir, mapping.table+'.xml')))

  if (debug) process.stdout.write('\n'+mapping.table)
  parser.each('table', function(table) {
    if (debug && ((ii++) % 500 == 0)) process.stdout.write('.')
    result.push(toObject(table, mapping.fields))
  })
  parser.on('error', callback)
  parser.on('end', function() { callback(null, result) })

  // TODO: do we need to explicitly close the read stream?
}

function toObject(table, fieldMapping) {
  var obj = {}
  table.$children.forEach(function(c) {
    var columnName = c.$.name
    var value = c.$text
    if (value == 'NULL') return
    var mapper = fieldMapping[columnName]
    if (mapper) {
      if (mapper == '1') {
        obj[columnName] = value
      } else {
        mapper(obj, columnName, value)
      }
    }
  })
  return obj
}

function asArray(obj, key, value) {
  obj[key] = [(value || '').trim()]
}

function mapTo(fieldName) {
  return function(obj, key, value) {
    obj[fieldName] = value
  }
}
function trim(obj, key, value) {
  obj[key] = (value || '').trim()
}
function intToBoolean(obj, value) {
  if (value == '1') obj[key] = true
}

function keyValue(key, value) {
  var o = {}
  o[key] = value
  return o
}