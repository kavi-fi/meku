#!/usr/bin/env node

/*
 * This maintenance operation deliberately uses the application's public
 * deletion endpoint. It must not be changed to access MongoDB directly.
 */

'use strict'

const https = require('https')
const fs = require('fs')

const EXPECTED_ID_COUNT = 653
const REQUEST_TIMEOUT_MS = 30 * 1000
const APPROVED_HOSTNAMES = new Set([
  'luokittelu.kavi.fi',
  'luokittelu-koulutus.kavi.fi'
])

function exportIds (programs) {
  if (!Array.isArray(programs)) throw new Error('Export must contain an array of programs')

  const ids = programs.map((program) => program && program._id && program._id.$oid)
  const invalidIds = ids.filter((id) => typeof id !== 'string' || !(/^[a-f\d]{24}$/i).test(id))
  const uniqueIds = [...new Set(ids)]

  if (invalidIds.length > 0) throw new Error('Export contains invalid top-level _id.$oid values')
  if (uniqueIds.length !== EXPECTED_ID_COUNT) {
    throw new Error('Expected exactly ' + EXPECTED_ID_COUNT + ' unique valid IDs, found ' + uniqueIds.length)
  }
  return uniqueIds
}

function optionValue (args, option) {
  const index = args.indexOf(option)
  return index === -1 ? undefined : args[index + 1]
}

function inputPath (args) {
  const input = optionValue(args, '--input')
  if (!input || input.startsWith('--')) throw new Error('--input <JSON file> must be explicitly set')
  return input
}

function loadPrograms (filePath, readFile = fs.readFileSync) {
  let contents
  try {
    contents = readFile(filePath, 'utf8')
  } catch (err) {
    throw new Error('Unable to read input file: ' + err.message)
  }

  try {
    return JSON.parse(contents)
  } catch (err) {
    throw new Error('Input file must contain valid JSON: ' + err.message)
  }
}

function requiredExecutionConfig (args, environment) {
  const baseUrl = optionValue(args, '--base-url') || environment.MEKU_BASE_URL
  if (!baseUrl) throw new Error('MEKU_BASE_URL (or --base-url) must be explicitly set')
  if (!environment.MEKU_USERNAME) throw new Error('MEKU_USERNAME must be explicitly set')
  if (!environment.MEKU_PASSWORD) throw new Error('MEKU_PASSWORD must be explicitly set')
  if (!args.includes('--confirm-delete-653')) throw new Error('--execute requires --confirm-delete-653')
  validateBaseUrl(baseUrl)
  return {baseUrl: baseUrl, username: environment.MEKU_USERNAME, password: environment.MEKU_PASSWORD}
}

function validateBaseUrl (baseUrl) {
  let base
  try {
    base = new URL(baseUrl)
  } catch (err) {
    throw new Error('MEKU_BASE_URL must be a valid HTTPS URL')
  }
  if (base.protocol !== 'https:') throw new Error('MEKU_BASE_URL must use HTTPS')
  if (!APPROVED_HOSTNAMES.has(base.hostname)) throw new Error('MEKU_BASE_URL must use an approved Meku hostname')
  if (base.port) throw new Error('MEKU_BASE_URL must not include a nonstandard port')
  if (base.username || base.password) throw new Error('MEKU_BASE_URL must not include credentials')
  if (base.pathname !== '/' || base.search || base.hash) throw new Error('MEKU_BASE_URL must not include a path, query, or fragment')
  return base
}

function cookiePairs (setCookies) {
  return (setCookies || []).map((cookie) => cookie.split(';', 1)[0])
}

function cookieValue (cookies, name) {
  const prefix = name + '='
  const pair = cookies.find((cookie) => cookie.startsWith(prefix))
  return pair && decodeURIComponent(pair.slice(prefix.length))
}

function createHttpClient (baseUrl, request = nativeRequest) {
  const base = validateBaseUrl(baseUrl)
  const basePath = base.pathname.replace(/\/$/, '')
  const cookies = new Map()

  async function send (method, path, headers, body) {
    const response = await request(base, basePath + path, method, headers, body)
    if (response.headers['set-cookie']) {
      cookiePairs(response.headers['set-cookie']).forEach((pair) => {
        cookies.set(pair.split('=', 1)[0], pair)
      })
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(method + ' ' + path + ' failed with HTTP ' + response.statusCode)
    }
    return response
  }

  function cookieHeader () { return [...cookies.values()].join('; ') }

  return {
    async login (username, password) {
      const body = JSON.stringify({username: username, password: password})
      await send('POST', '/login', {'content-type': 'application/json', 'content-length': Buffer.byteLength(body)}, body)
      if (!cookieValue([...cookies.values()], 'user')) throw new Error('Login did not return a user cookie')
    },
    async fetchCsrfToken () {
      await send('GET', '/', {cookie: cookieHeader()})
      const token = cookieValue([...cookies.values()], '_csrf_token')
      if (!token) throw new Error('GET / did not return a CSRF token cookie')
      return token
    },
    deleteProgram (id, csrfToken) {
      return send('DELETE', '/programs/' + encodeURIComponent(id), {cookie: cookieHeader(), 'x-csrf-token': csrfToken})
    }
  }
}

function nativeRequest (base, path, method, headers, body, transport = https) {
  return new Promise((resolve, reject) => {
    const request = transport.request({
      protocol: base.protocol,
      hostname: base.hostname,
      port: base.port,
      method: method,
      path: path,
      headers: headers
    }, (response) => {
      response.resume()
      response.on('end', () => resolve({statusCode: response.statusCode, headers: response.headers}))
    })
    request.on('error', reject)
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error(method + ' ' + path + ' timed out after ' + REQUEST_TIMEOUT_MS + 'ms'))
    })
    if (body) request.write(body)
    request.end()
  })
}

async function execute (ids, config, client, logger = console) {
  await client.login(config.username, config.password)
  const csrfToken = await client.fetchCsrfToken()
  const summary = {total: ids.length, deleted: 0, failures: []}

  for (const id of ids) {
    try {
      // Sequential requests limit the impact of an unexpected server failure.
      // eslint-disable-next-line no-await-in-loop
      await client.deleteProgram(id, csrfToken)
      summary.deleted += 1
      logger.info('Deleted: ' + id)
    } catch (err) {
      summary.failures.push({id: id, error: err.message})
      logger.error('Failed program ' + id + ': ' + err.message)
      break
    }
  }

  if (summary.failures.length > 0) throw executionFailure(summary)
  return summary
}

function executionFailure (summary) {
  const error = new Error('Deletion stopped after failure for program ID: ' + summary.failures[0].id)
  error.summary = summary
  return error
}

function reportSummary (label, summary, logger = console) {
  logger.info(label + ': ' + summary.total + ' targets; deleted: ' + summary.deleted + '; failures: ' + summary.failures.length + '.')
}

async function main ({args = process.argv.slice(2), environment = process.env, logger = console, readFile, clientFactory = createHttpClient} = {}) {
  const programs = loadPrograms(inputPath(args), readFile)
  const ids = exportIds(programs)
  if (!args.includes('--execute')) {
    logger.info('Dry run: ' + ids.length + ' validated targets. No HTTP requests or changes were made.')
    logger.info('To execute, set MEKU_BASE_URL, MEKU_USERNAME, and MEKU_PASSWORD, then add --execute --confirm-delete-653.')
    return {total: ids.length, deleted: 0, failures: []}
  }

  const config = requiredExecutionConfig(args, environment)
  logger.info('Executing deletion for ' + ids.length + ' programs sequentially.')
  const summary = await execute(ids, config, clientFactory(config.baseUrl), logger)
  reportSummary('Complete', summary, logger)
  return summary
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed: ' + err.message)
    process.exitCode = 1
  })
}

module.exports = {APPROVED_HOSTNAMES, EXPECTED_ID_COUNT, REQUEST_TIMEOUT_MS, cookiePairs, cookieValue, createHttpClient, execute, executionFailure, exportIds, inputPath, loadPrograms, main, nativeRequest, optionValue, reportSummary, requiredExecutionConfig, validateBaseUrl}
