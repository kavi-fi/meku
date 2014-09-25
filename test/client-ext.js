var assert = require('assert')
var _ = require('lodash')
var webdriverio = require('webdriverio')
var keys = exports.keys = { enter: '\ue006' }

/*

First-time setup:

 npm install -g selenium-server
 start-selenium

Run tests:

 npm test

*/
var browsers = {
  'phantomjs': { desiredCapabilities: { browserName: 'phantomjs' } }, // doesn't work, no flex support!
  'firefox': { desiredCapabilities: { browserName: 'firefox' } },
  'chrome': { desiredCapabilities: { browserName: 'chrome' } }
}

var client = null

exports.client = function(url) {
  var options = process.env.BROWSER ? browsers[process.env.BROWSER] : browsers['chrome']
  client = extend(webdriverio.remote(options).init().url(url || 'http://localhost:4000/'))
  return client
}

process.on('uncaughtException', function(err) {
  if (client) {
    var file = 'webdriver-fail-'+Date.now()+'.png'
    console.log('Fail, screenshot at: '+file)
    client.saveScreenshot(file)
  }
  throw err
})

function extend(client) {
  client.timeoutsAsyncScript(2000)

  client.addCommand('waitForAjax', function(callback) {
    this.executeAsync(function(done) {
      check()
      function check() {
        if ($.active == 0) return done()
        $(document).one('ajaxStop', check)
      }
    }, callback)
  })
  client.addCommand('waitForThrottledAjax', function(callback) {
    this.timeoutsAsyncScript(2000).executeAsync(function(done) {
      $(document).one('ajaxSend', check)
      function check() {
        if ($.active == 0) return done()
        $(document).one('ajaxStop', check)
      }
    }, callback)
  })

  client.addCommand('waitForAnimations', function(callback) {
    this.executeAsync(function(done) {
      check()
      function check() {
        if ($(':animated').length == 0) return done()
        setTimeout(check, 50)
      }
    }, callback)
  })

  client.addCommand('waitForLogin', function(userName, callback) {
    check()
    function check() {
      client.execute(function() { return $('#header .user-info .name').text() }, function(err, result) {
        if (err) return callback(err)
        if (result.value == userName) return callback()
        setTimeout(check, 50)
      })
    }
  })

  client.addCommand('login', function(username, password, name, callback) {
    this.waitForVisible('#login', 2000)
      .setValue('#login input[name="username"]', 'kavi')
      .setValue('#login input[name="password"]', 'kavi')
      .click('#login button.login')
      .waitForLogin('kavi')
      .waitForAjax()
      .call(callback)
  })

  client.addCommand('assertAgelimitAndWarnings', function(selector, string, callback) {
    client.execute(function(selector) {
      return [$(selector).find('.agelimit').attr('src').match(/agelimit-\d+/)[0].substring(9)]
        .concat($(selector).find('.warning').map(function() { return $(this).attr('class').replace('warning ','') }))
        .join(' ')
    }, selector, function(err, result) {
      if (err) return callback(err)
      return callback(result.value == string ? null : 'Assertion failed: '+result.value+' == '+string)
    })
  })

  client.addCommand('assertText', function(selector, expected, callback) {
    this.getText(selector, function(err, res) {
      assert.equal(res, expected)
      callback(err)
    })
  })

  client.addCommand('assertVisible', function(selector, callback) {
    this.isVisible(selector, function(err, res) {
      assert(res)
      callback(err)
    })
  })

  client.addCommand('assertEnabled', function(selector, callback) {
    this.isEnabled(selector, function(err, res) {
      assert(res)
      callback(err)
    })
  })

  client.addCommand('ajaxClick', function(selector, callback) {
    this.click(selector).waitForAjax().call(callback)
  })

  client.addCommand('select2one', function(selector, query, expectedValue, callback) {
    if (expectedValue === true) expectedValue = query

  this.click(selector + ' a')
    .waitForVisible('#select2-drop')
    .setValue('#select2-drop input[type=text]', query)
    .waitForText('#select2-drop .select2-highlighted', expectedValue)
    .addValue('#select2-drop input[type=text]', keys.enter)
    .assertText(selector + ' .select2-chosen', expectedValue)
  this.call(callback)

})

  // .select2(x, 'su', 'Suomi') == enter 'su', expect 'Suomi'
  // .select2(x, 'Suomi', true) == enter 'Suomi', expect 'Suomi'
  // .select2(x, ['Suomi', 'Ruotsi'], true) == enter 'Suomi', then enter 'Ruotsi', expect ['Suomi', 'Ruotsi']
  client.addCommand('select2', function(selector, query, expectedValue, callback) {
    var me = this
    if (_.isString(query)) query = [query]
    if (expectedValue === true) expectedValue = query
    if (_.isString(expectedValue)) expectedValue = [expectedValue]

    me.click(selector + ' input')
    query.forEach(function(q, index) {
      me.setValue(selector + ' input', q)
        .waitForText('#select2-drop .select2-highlighted', expectedValue[index])
        .addValue(selector + ' input', keys.enter)
    })
    me.assertText(selector, expectedValue.join('\n'))
    me.call(callback)
  })

  client.addCommand('assertSearchResultRow', function(selector, row, callback) {
    this.assertText(selector + ' .name', row.name)
      .assertText(selector + ' .duration-or-game', row.duration)
      .assertText(selector + ' .program-type', row.type)
      .assertAgelimitAndWarnings(selector + ' .warning-summary', row.ageAndWarnings)
      .call(callback)
  })

  client.addCommand('assertProgramBox', function(selector, program, callback) {
    this.assertText(selector + ' .primary-name', program.name)
      .assertText(selector + ' .name', program.name)
      .assertText(selector + ' .nameFi', program.nameFi)
      .assertText(selector + ' .nameSv', program.nameSv)
      .assertText(selector + ' .nameOther', program.nameOther)
      .assertText(selector + ' .country', program.country)
      .assertText(selector + ' .year', program.year)
      .assertText(selector + ' .productionCompanies', program.productionCompanies)
      .assertText(selector + ' .genre', program.genre || '')
      .assertText(selector + ' .directors', program.directors || '')
      .assertText(selector + ' .actors', program.actors || '')

      .assertText(selector + ' .current-format', program.format)
      .assertText(selector + ' .current-duration', program.duration)
      .assertText(selector + ' .author', program.author)
      .assertText(selector + ' .buyer', program.buyer)
      .assertText(selector + ' .billing', program.billing)

      .assertAgelimitAndWarnings(selector + ' .warning-summary', program.ageAndWarnings)
      .assertText(selector + ' .criteria', program.criteria.join('\n'))
      .call(callback)
  })

  client.addCommand('assertSearchResult', function(rowSelector, row, program, callback) {
    this.assertSearchResultRow('#search-page .results '+rowSelector, row)
      .click('#search-page .results '+rowSelector)
      .waitForAnimations()
      .assertVisible('#search-page .program-box')
      .assertProgramBox('#search-page .program-box', program)
      .call(callback)
  })

  return client
}