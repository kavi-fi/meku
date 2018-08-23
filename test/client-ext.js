var _ = require('lodash')
var request = require('request')
var webdriverio = require('webdriverio')
var assert = require('chai').assert
var keys = exports.keys = { enter: '\ue006' }

var client = null

exports.client = function(url) {
  return extend(webdriverio.remote({ desiredCapabilities: { browserName: 'chrome' } }).init().url(url || 'http://localhost:4000/'))
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
      client.execute(function() { return window.$ ? $('#header .user-info .name').text() : '' }, function(err, result) {
        if (err) return callback(err)
        if (result.value == userName) return callback()
        setTimeout(check, 50)
      })
    }
  })

  client.addCommand('login', function(username, password, name, callback) {
    this.waitForVisible('#login', 2000)
      .setValue('#login input[name="username"]', username)
      .setValue('#login input[name="password"]', password)
      .click('#login button.login')
      .waitForLogin(name)
      .waitForVisible('#login', 5000, true)
      .waitForVisible('#login-overlay', 5000, true)
      .waitForAjax()
      .call(callback)
  })

  client.addCommand('assertAgelimitAndWarnings', function(selector, string, callback) {
    client.execute(function(selector) {
      return [$(selector).find('.agelimit').attr('src').match(/agelimit-\d+/)[0].substring(9)]
        .concat($(selector).find('.warning').toArray().map(function (s) { return $(s).attr('class').replace('warning ','') }))
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
      var msg = 'Excepted '+selector+' to be visible'
      _.isArray(res) ? assert.ok(_.every(res), msg) : assert.ok(res, msg)
      callback(err)
    })
  })
  client.addCommand('assertHidden', function(selector, callback) {
    this.isVisible(selector, function(err, res) {
      var msg = 'Excepted '+selector+' to be hidden'
      _.isArray(res) ? assert.ok(_.every(res, function(x) { return !x }), msg) : assert.ok(res, msg)
      callback(err)
    })
  })

  client.addCommand('assertEnabled', function(selector, callback) {
    this.isEnabled(selector, function(err, res) {
      assert.ok(res)
      callback(err)
    })
  })

  client.addCommand('assertDisabled', function(selector, callback) {
    this.isEnabled(selector, function(err, res) {
      assert.ok(!res)
      callback(err)
    })
  })
  client.addCommand('assertValue', function(selector, expected, callback) {
    this.getValue(selector, function(err, res) {
      assert.equal(res, expected)
      callback(err)
    })
  })

  client.addCommand('assertSelect2OneValue', function(selector, value, callback) {
    this.assertText(selector + ' .select2-chosen', value)
      .call(callback)
  })

  client.addCommand('assertSelect2Value', function(selector, expectedValues, callback) {
    this.execute(function(selector) {
      return $(selector + ' .select2-search-choice').map(function() { return $.trim($(this).text()) }).toArray()
    }, selector, function(err, result) {
      if (err) return callback(err)
      assert.deepEqual(result.value, expectedValues)
      return callback()
    })
  })

  client.addCommand('ajaxClick', function(selector, callback) {
    this.click(selector).waitForAjax().call(callback)
  })

  client.addCommand('select2one', function(selector, query, expectedValue, callback) {
    if (expectedValue === true) expectedValue = query
    this.click(selector + ' a')
      .setValue('#select2-drop input[type=text]', query)
      .waitForText('#select2-drop .select2-highlighted', expectedValue)
      .addValue('#select2-drop input[type=text]', keys.enter)
      .assertText(selector + ' .select2-chosen', expectedValue)
      .call(callback)
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

  // expectedEmail: { to, subject, body }
  client.addCommand('assertLatestEmail', function(expectedEmail, callback) {
    this.call(function() {
      request('http://localhost:4000/emails/latest', function(error, response, body) {
        var msg = JSON.parse(body)
        assert.sameMembers(msg.to, _.isArray(expectedEmail.to) ? expectedEmail.to : [expectedEmail.to])
        assert.equal(msg.subject, expectedEmail.subject)
        assert.equal(stripTags(msg.html), expectedEmail.body)
        callback()
      })
    })

    function stripTags(emailHtml) {
      return emailHtml.replace(/(<([^>]+)>)/ig,"\n").replace(/\n+/g, '\n').replace(/(^\n)|(\n$)/g, '')
    }
  })

  return client
}
