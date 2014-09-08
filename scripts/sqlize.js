/*
 This import tool assumes a directory containing 1 xml-file per table to be created.

  The following process was previously used to split the all-in-one xml file into table-specific files, YMMV:

    1) Remove non-utf8 characters (e.g. <E6> @ import_maps - table):
    iconv -c -f utf-8 -t utf-8 emeku.xml > emeku-stripped-utf8.xml

    2) Remove utf8 control characters:
    tr -d '\036\037' < emeku-stripped-utf8.xml > emeku-fixed-stripped-utf8.xml

    3) Split into table-specific files:
    mkdir split; cd split; awk '/<!-- Table/{ if (f) { print "</docs>" > f; close(f); } f = $3".xml"; print "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<docs>" > f }{ if (f) print > f }' ../emeku-fixed-stripped-utf8.xml
*/
var xml = require('xml-object-stream')
var async = require('async')
var path = require('path')
var fs = require('fs')
var dataDir = path.join(__dirname, '../tables/')
var mysql = require('mysql')
var conn = mysql.createConnection({ host: 'localhost', user:'root', database: 'emeku' })

conn.connect(function(err) { if (err) throw err })

fs.readdir(dataDir, function(err, files) {
  async.each(files, createTable, function(err) {
    if (err) throw err
    async.eachSeries(files, fillTable, shutdown)
  })
})

function createTable(fileName, callback) {
  parseTableStructure(fileName, function(err, structure) {
    if (!structure) return callback()
    var sql = 'create table '+structure.name+' ('+structure.columns.map(asColumn).join(', ')+');'
    conn.query(sql, callback)
  })
  function asColumn(c) {
    if (c == 'id') return c + ' VARCHAR(36) PRIMARY KEY'
    return c + ' TEXT'
  }
}


function parseTableStructure(fileName, callback) {
  var callbackFired = false
  var parser = xml.parse(fs.createReadStream(path.join(dataDir, fileName)))
  parser.each('table', function(table) {
    if (callbackFired) return
    callbackFired = true
    var declaration = { name: table.$.name, columns: table.$children.map(function(c) { return c.$.name }) }
    callback(null, declaration)
    parser.pause()
  })
  parser.on('close', function() {
    if (callbackFired) return
    callbackFired = true
    callback()
  })
}

function fillTable(fileName, callback) {
  var ii = 0
  var tableName = fileName.replace('.xml', '')
  process.stdout.write('\n'+ tableName)
  var parser = xml.parse(fs.createReadStream(path.join(dataDir, fileName)))
  var rows = []
  parser.each('table', function(table) {
    if (ii++ % 500 == 0) process.stdout.write('.')
    rows.push(table.$children.map(asValue))
    if (ii % 10 == 0) {
      insert(rows)
      rows = []
    }
  })
  parser.on('close', function() {
    insert(rows)
    callback()
  })

  function insert(rows) {
    if (rows.length == 0) return
    parser.pause()
    var sql = 'insert into '+tableName+' values ('+rows.map(asRow).join('), (')+')'
    conn.query(sql, function(err) {
      if (err) throw err
      parser.resume()
    })
  }

  function asRow(arr) {
    return arr.join(', ')
  }

  function asValue(c) {
    if (c.$text == 'NULL') return c.$text
    if (c.$text == undefined) return 'NULL'
    return '"'+c.$text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')+'"'
  }
}

function shutdown(err) {
  if (err) throw err
  conn.end()
}

