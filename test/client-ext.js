const _ = require('lodash')
const request = require('request')
const webdriverio = require('webdriverio')
const assert = require('chai').assert
const keys = {enter: '\ue006'}

let clientExt = null

exports.client = function (url) {
  clientExt = extend(webdriverio.remote({desiredCapabilities: {browserName: 'chrome'}}).init().url(url || 'http://localhost:4000/'))
  return clientExt
}

process.on('uncaughtException', (err) => {
  if (clientExt) {
    const file = 'webdriver-fail-' + Date.now() + '.png'
    console.log('Fail, screenshot at: ' + file)
    clientExt.saveScreenshot(file)
  }
  throw err
})

function extend(client) {
  client.timeoutsAsyncScript(2000)

  client.addCommand('waitForAjax', function (callback) {
    this.executeAsync((done) => {
      check()
      function check() {
        if ($.active === 0) return done()
        $(document).one('ajaxStop', check)
      }
    }, callback)
  })
  client.addCommand('waitForThrottledAjax', function (callback) {
    this.timeoutsAsyncScript(2000).executeAsync((done) => {
      $(document).one('ajaxSend', check)
      function check() {
        if ($.active === 0) return done()
        $(document).one('ajaxStop', check)
      }
    }, callback)
  })

  client.addCommand('waitForAnimations', function (callback) {
    this.executeAsync((done) => {
      check()
      function check() {
        if ($(':animated').length === 0) return done()
        setTimeout(check, 50)
      }
    }, callback)
  })

  client.addCommand('waitForLogin', (userName, callback) => {
    check()
    function check() {
      client.execute(() => (window.$ ? $('#header .user-info .name').text() : ''), (err, result) => {
        if (err) return callback(err)
        if (result.value === userName) return callback()
        setTimeout(check, 50)
      })
    }
  })

  client.addCommand('login', function (username, password, name, callback) {
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

  client.addCommand('assertAgelimitAndWarnings', (warningSummarySelector, string, callback) => {
    client.execute((selector) => [$(selector).find('.agelimit').attr('src').match(/agelimit-\d+/)[0].substring(9)]
        .concat($(selector).find('.warning').toArray().map((s) => $(s).attr('class').replace('warning ', '')))
        .join(' '), warningSummarySelector, (err, result) => {
      if (err) return callback(err)
      return callback(result.value === string ? null : 'Assertion failed: ' + result.value + ' == ' + string)
    })
  })

  client.addCommand('assertText', function (selector, expected, callback) {
    this.getText(selector, (err, res) => {
      assert.equal(res, expected)
      callback(err)
    })
  })

  client.addCommand('assertVisible', function (selector, callback) {
    this.isVisible(selector, (err, res) => {
      const msg = 'Excepted ' + selector + ' to be visible'
      _.isArray(res) ? assert.ok(_.every(res), msg) : assert.ok(res, msg)
      callback(err)
    })
  })
  client.addCommand('assertHidden', function (selector, callback) {
    this.isVisible(selector, (err, res) => {
      const msg = 'Excepted ' + selector + ' to be hidden'
      _.isArray(res) ? assert.ok(_.every(res, (x) => !x), msg) : assert.ok(res, msg)
      callback(err)
    })
  })

  client.addCommand('assertEnabled', function (selector, callback) {
    this.isEnabled(selector, (err, res) => {
      assert.ok(res)
      callback(err)
    })
  })

  client.addCommand('assertDisabled', function (selector, callback) {
    this.isEnabled(selector, (err, res) => {
      assert.ok(!res)
      callback(err)
    })
  })
  client.addCommand('assertValue', function (selector, expected, callback) {
    this.getValue(selector, (err, res) => {
      assert.equal(res, expected)
      callback(err)
    })
  })

  client.addCommand('assertSelect2OneValue', function (selector, value, callback) {
    this.assertText(selector + ' .select2-chosen', value)
      .call(callback)
  })

  client.addCommand('assertSelect2Value', function (select2Selector, expectedValues, callback) {
    this.execute((selector) => $(selector + ' .select2-search-choice').map(function () { return $.trim($(this).text()) }).toArray(), select2Selector, (err, result) => {
      if (err) return callback(err)
      assert.deepEqual(result.value, expectedValues)
      return callback()
    })
  })

  client.addCommand('ajaxClick', function (selector, callback) {
    this.click(selector).waitForAjax().call(callback)
  })

  client.addCommand('select2one', function (selector, query, expectedValue, callback) {
    const expected = expectedValue === true ? query : expectedValue
    this.click(selector + ' a')
      .setValue('#select2-drop input[type=text]', query)
      .waitForText('#select2-drop .select2-highlighted', expected)
      .addValue('#select2-drop input[type=text]', keys.enter)
      .assertText(selector + ' .select2-chosen', expected)
      .call(callback)
  })

  /*
   * .select2(x, 'su', 'Suomi') == enter 'su', expect 'Suomi'
   * .select2(x, 'Suomi', true) == enter 'Suomi', expect 'Suomi'
   * .select2(x, ['Suomi', 'Ruotsi'], true) == enter 'Suomi', then enter 'Ruotsi', expect ['Suomi', 'Ruotsi']
   */
  client.addCommand('select2', function (selector, query, expectedValue, callback) {
    const me = this
    const queryArray = _.isString(query) ? [query] : query
    const expected = expectedValue === true ? queryArray : expectedValue
    const expectedArray = _.isString(expected) ? [expected] : expected

    me.click(selector + ' input')
    queryArray.forEach((q, index) => {
      me.setValue(selector + ' input', q)
        .waitForText('#select2-drop .select2-highlighted', expectedArray[index])
        .addValue(selector + ' input', keys.enter)
    })
    me.assertText(selector, expectedArray.join('\n'))
    me.call(callback)
  })

  client.addCommand('assertSearchResultRow', function (selector, row, callback) {
    this.assertText(selector + ' .name', row.name)
      .assertText(selector + ' .duration-or-game', row.duration)
      .assertText(selector + ' .program-type', row.type)
      .assertAgelimitAndWarnings(selector + ' .warning-summary', row.ageAndWarnings)
      .call(callback)
  })

  client.addCommand('assertProgramBox', function (selector, program, callback) {
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

  client.addCommand('assertSearchResult', function (rowSelector, row, program, callback) {
    this.assertSearchResultRow('#search-page .results ' + rowSelector, row)
      .click('#search-page .results ' + rowSelector)
      .waitForAnimations()
      .assertVisible('#search-page .program-box')
      .assertProgramBox('#search-page .program-box', program)
      .call(callback)
  })

  // expectedEmail: { to, subject, body }
  client.addCommand('assertLatestEmail', function (expectedEmail, callback) {
    this.call(() => {
      request('http://localhost:4000/emails/latest', (error, response, body) => {
        const msg = JSON.parse(body)
        assert.sameMembers(msg.to, _.isArray(expectedEmail.to) ? expectedEmail.to : [expectedEmail.to])
        assert.equal(msg.subject, expectedEmail.subject)
        assert.equal(stripTags(msg.html), expectedEmail.body)
        callback()
      })
    })

    function stripTags(emailHtml) {
      return emailHtml.replace(/(<([^>]+)>)/ig, "\n").replace(/\n+/g, '\n').replace(/(^\n)|(\n$)/g, '')
    }
  })

  return client
}
