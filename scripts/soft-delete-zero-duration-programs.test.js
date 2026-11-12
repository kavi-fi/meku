'use strict'

const assert = require('assert')
const {test} = require('node:test')
const subject = require('./soft-delete-zero-duration-programs')

function exportedProgram (id) { return {_id: {$oid: id}} }
function ids (count) {
  return Array.from({length: count}, (_, index) => exportedProgram(index.toString(16).padStart(24, '0')))
}

test('exportIds validates export shape, ids, duplicates, and expected count', () => {
  assert.throws(() => subject.exportIds(null), /array/)
  assert.throws(() => subject.exportIds([{}]), /invalid top-level/)
  const duplicate = ids(subject.EXPECTED_ID_COUNT)
  duplicate[1] = duplicate[0]
  assert.throws(() => subject.exportIds(duplicate), /exactly 653/)
  assert.strictEqual(subject.exportIds(ids(subject.EXPECTED_ID_COUNT)).length, 653)
})

test('HTTP client performs login, CSRF fetch, and authenticated deletion without exposing secrets', async () => {
  const requests = []
  const responses = [
    {statusCode: 200, headers: {'set-cookie': ['user=s%3Asigned-user; Path=/']}},
    {statusCode: 200, headers: {'set-cookie': ['_csrf=s%3Asecret; Path=/', '_csrf_token=token%20value; Path=/']}},
    {statusCode: 200, headers: {}}
  ]
  const request = (base, path, method, headers, body) => {
    requests.push({base, path, method, headers, body})
    return responses.shift()
  }
  const client = subject.createHttpClient('https://luokittelu.kavi.fi', request)
  await client.login('administrator', 'not-logged')
  const token = await client.fetchCsrfToken()
  await client.deleteProgram('abc def', token)

  assert.deepStrictEqual(requests.map((entry) => [entry.method, entry.path]), [['POST', '/login'], ['GET', '/'], ['DELETE', '/programs/abc%20def']])
  assert.deepStrictEqual(JSON.parse(requests[0].body), {username: 'administrator', password: 'not-logged'})
  assert.match(requests[1].headers.cookie, /user=s%3Asigned-user/)
  assert.match(requests[2].headers.cookie, /_csrf=s%3Asecret/)
  assert.strictEqual(requests[2].headers['x-csrf-token'], 'token value')
})

test('HTTP client rejects invalid status and missing authentication cookies', async () => {
  const failed = subject.createHttpClient('https://luokittelu.kavi.fi', () => Promise.resolve({statusCode: 403, headers: {}}))
  await assert.rejects(() => failed.login('user', 'password'), /HTTP 403/)
  const noCookie = subject.createHttpClient('https://luokittelu.kavi.fi', () => Promise.resolve({statusCode: 200, headers: {}}))
  await assert.rejects(() => noCookie.login('user', 'password'), /user cookie/)
  assert.throws(() => subject.createHttpClient('http://localhost'), /HTTPS/)
  assert.throws(() => subject.createHttpClient('ftp://localhost'), /HTTPS/)
})

test('base URLs are limited to exact approved HTTPS origins', () => {
  assert.strictEqual(subject.validateBaseUrl('https://luokittelu.kavi.fi').hostname, 'luokittelu.kavi.fi')
  assert.strictEqual(subject.validateBaseUrl('https://luokittelu-koulutus.kavi.fi/').hostname, 'luokittelu-koulutus.kavi.fi')
  for (const url of [
    'https://meku.example',
    'https://luokittelu.kavi.fi.evil.example',
    'https://luokittelu.kavi.fi/programs',
    'https://luokittelu.kavi.fi?target=programs',
    'https://user:password@luokittelu.kavi.fi',
    'https://luokittelu.kavi.fi:8443'
  ]) assert.throws(() => subject.validateBaseUrl(url), /approved Meku hostname|path, query, or fragment|credentials|nonstandard port/)
})

test('native requests time out, destroy the request, and reject', async () => {
  let timeout
  let destroyedWith
  let errorHandler
  const request = {
    on: (event, handler) => { if (event === 'error') errorHandler = handler },
    setTimeout: (milliseconds, handler) => {
      assert.strictEqual(milliseconds, subject.REQUEST_TIMEOUT_MS)
      timeout = handler
    },
    destroy: (error) => { destroyedWith = error; errorHandler(error) },
    end: () => undefined
  }
  const transport = {request: () => request}
  const pending = subject.nativeRequest(new URL('https://luokittelu.kavi.fi'), '/login', 'POST', {}, undefined, transport)
  timeout()
  await assert.rejects(pending, /POST \/login timed out after 30000ms/)
  assert.match(destroyedWith.message, /timed out/)
})

test('execute deletes sequentially and stops at the first failure', async () => {
  const calls = []
  const client = {
    login: () => Promise.resolve(calls.push('login')),
    fetchCsrfToken: () => Promise.resolve().then(() => { calls.push('csrf'); return 'token' }),
    deleteProgram: (id) => Promise.resolve().then(() => {
      calls.push(id)
      if (id === 'second') throw new Error('unavailable')
    })
  }
  let failure
  try {
    await subject.execute(['first', 'second', 'third'], {username: 'user', password: 'password'}, client, {info: () => undefined, error: () => undefined})
  } catch (err) { failure = err }
  assert.deepStrictEqual(calls, ['login', 'csrf', 'first', 'second'])
  assert.match(failure.message, /second/)
  assert.deepStrictEqual(failure.summary, {total: 3, deleted: 1, failures: [{id: 'second', error: 'unavailable'}]})
})

test('main requires an input file for dry runs and execution', async () => {
  const messages = []
  const readFile = () => JSON.stringify(ids(653))
  await assert.rejects(() => subject.main({args: [], readFile}), /--input <JSON file>/)
  const result = await subject.main({args: ['--input', 'test-export.json'], readFile, logger: {info: (message) => messages.push(message)}, clientFactory: () => { throw new Error('must not request') }})
  assert.deepStrictEqual(result, {total: 653, deleted: 0, failures: []})
  assert.match(messages[0], /No HTTP requests/)
  await assert.rejects(() => subject.main({args: ['--input', 'test-export.json', '--execute'], readFile, environment: {}}), /MEKU_BASE_URL/)
  await assert.rejects(() => subject.main({args: ['--input', 'test-export.json', '--execute', '--base-url', 'http://localhost'], readFile, environment: {MEKU_USERNAME: 'u', MEKU_PASSWORD: 'p'}}), /confirm-delete-653/)
  await assert.rejects(() => subject.main({args: ['--input', 'test-export.json', '--execute', '--base-url', 'http://localhost', '--confirm-delete-653'], readFile, environment: {MEKU_USERNAME: 'u', MEKU_PASSWORD: 'p'}}), /HTTPS/)
})

test('main uses explicit base URL and environment credentials only during confirmed execution', async () => {
  const calls = []
  const client = {login: (username, password) => Promise.resolve(calls.push([username, password])), fetchCsrfToken: () => Promise.resolve('token'), deleteProgram: () => Promise.resolve()}
  const messages = []
  await subject.main({
    args: ['--input', 'test-export.json', '--execute', '--base-url', 'https://luokittelu.kavi.fi', '--confirm-delete-653'],
    readFile: () => JSON.stringify(ids(653)),
    environment: {MEKU_BASE_URL: 'https://luokittelu-koulutus.kavi.fi', MEKU_USERNAME: 'root', MEKU_PASSWORD: 'secret'},
    clientFactory: (baseUrl) => { assert.strictEqual(baseUrl, 'https://luokittelu.kavi.fi'); return client },
    logger: {info: (message) => messages.push(message), error: () => undefined}
  })
  assert.deepStrictEqual(calls, [['root', 'secret']])
  assert.match(messages.at(-1), /deleted: 653; failures: 0/)
})
