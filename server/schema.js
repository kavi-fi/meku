var mongoose = require('mongoose')

var classification = {
  author: String,
  buyer: {_id: mongoose.Schema.Types.ObjectId, name: String},
  billing: {_id: mongoose.Schema.Types.ObjectId, name: String},
  format: String,
  duration: String, // for now matches a regexp in the client
  safe: Boolean,
  criteria: [Number],
  'warning-order': [String],
  comments: {}
}

var Movie = exports.Movie = mongoose.model('movies', {
  'emeku-id': { type: String, index: true },
  name: {type: [String], index: true},
  'name-fi': {type: [String], index: true},
  'name-sv': {type: [String], index: true},
  'name-other': {type: [String], index: true},
  deleted: Boolean,
  country: [String],
  year: String,
  'production-companies': {type: [String], index: true },
  genre: String,
  directors: {type: [String], index: true},
  actors: {type: [String], index: true},
  synopsis: String,
  classifications: [classification],
  'program-type': String, // enums.programType
  comments: String
})

var Account = exports.Account = mongoose.model('accounts', {
  'emeku-id': String,
  name: {type: String, index: true}
})

