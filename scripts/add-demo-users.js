// Usage: [MONGOHQ_URL=...] node ./add-demo-users.js

const env = require('../server/env').get()
const mongoose = require('mongoose')
const users = require('../cypress/fixtures/users')
const schema = require('../server/schema')
const User = schema.User

function persistUsers() {
  return Promise.all(users.map((user) => new Promise((resolve, reject) => {
      new User(user).save((err, result) => {
        err ? reject(err) : resolve(result)
      })
  })))
}

async function addUsers() {
  try {
    await mongoose.connect(process.env.MONGOHQ_URL || env.mongoUrl)
    await persistUsers()
    console.log("Users added.")
  } catch (err) {
    console.log(err)
  } finally {
    await mongoose.disconnect()
  }
}

addUsers()

