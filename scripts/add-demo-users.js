// Usage: [MONGOHQ_URL=...] node ./add-demo-users.js

const env = require('../server/env').get()
const mongoose = require('mongoose')
const users = require('../cypress/fixtures/users')
const schema = require('../server/schema')
const User = schema.User

function persistUsers() {
  return Promise.all(users.map((user) => new Promise((resolve, reject) => {
    new User(user).save((saveErr, result) => {
      if (saveErr) {
        reject(saveErr)
      } else {
        User.collection.createIndexes([{key: {_id: 1}}], (indexErr) => {
          if (indexErr) {
            reject(indexErr)
          } else {
            resolve(result)
          }
        })
      }
    })
  })))
}

async function addUsers() {
  try {
    await mongoose.connect(process.env.MONGOHQ_URL || env.mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    await persistUsers()
    console.log("Users added.")
  } catch (err) {
    console.log(err)
  } finally {
    await mongoose.disconnect()
  }
}

addUsers()

