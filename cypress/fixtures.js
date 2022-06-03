const mongoose = require('mongoose')
const schema = require('../server/schema')
const env = require('../server/env').get()
const users = require('./fixtures/users')
const programs = require('./fixtures/programs')
const accounts = require('./fixtures/accounts')

if (!env || !env.isTest) {
  console.error('Not a test env, adding fixtures failed')
  return process.exit(1)
}

function connect() {
  const mongoUrl = process.env.MONGOHQ_URL || env.mongoUrl
  return mongoose.connect(mongoUrl, {poolSize: 10, keepAlive: 300000, useUnifiedTopology: true, useNewUrlParser: true})
}

function disconnect() {
  return mongoose.disconnect()
}

function wipeAllData() {
  return Promise.all(schema.models.map((model) =>
    new Promise((resolve, reject) =>
      mongoose.connection.db.listCollections({name: model.collection.name}).next((err, coll) =>
        err ? reject(err) : drop(coll, (err) => err ? reject(err) : resolve())))))

  function drop(collection, callback) {
    if (!collection) return callback()
    mongoose.connection.db.dropCollection(collection.name, callback)
  }
}

function persist(objs, Schema) {
  return Promise.all(objs.map((obj) => {
    return new Promise((resolve, reject) => {
      if (obj.customersId) {
        schema.Account.findOne({name: obj.customer}, (err, account) => {
          if (err) return reject(err)
          obj.customersId.account = account._id
          new Schema(obj).save((err, result) => {
            err ? reject(err) : resolve(result)
          })
        })
      } else {
        new Schema(obj).save((err, result) => {
          err ? reject(err) : resolve(result)
        })
      }
    })
  }))
}

async function addFixturesData() {
  try {
    const db = await connect()
    await wipeAllData()
    await persist(users, schema.User)
    await persist([accounts[0]], schema.Account) // Avoid MongoError: E11000 duplicate key error collection: meku-test.sequences index: _id_ dup key: { : "Account" }
    await persist(accounts.slice(1), schema.Account)
    await persist([programs[0]], schema.Program)
    await persist(programs.slice(1), schema.Program)
    await disconnect(db)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

addFixturesData()
