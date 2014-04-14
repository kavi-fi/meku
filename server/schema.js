var mongoose = require('mongoose')

var classification = {
  author: String,
  buyer: {_id: mongoose.Schema.Types.ObjectId, name: String},
  billing: {_id: mongoose.Schema.Types.ObjectId, name: String},
  format: String,
  duration: String, // for now matches a regexp in the client
  safe: Boolean,
  criteria: [Number],
  comments: {}
}

var Movie = exports.Movie = mongoose.model('movies', {
  name: String,
  'name-fi': String,
  'name-sv': String,
  country: String,
  year: Number,
  'production-companies': [{_id: mongoose.Schema.Types.ObjectId, name: {type: String, index: true}}],
  genre: String,
  directors: [String],
  actors: [String],
  synopsis: String,
  classifications: [classification]
})

var ProductionCompany = exports.ProductionCompany = mongoose.model('production_companies', {
  name: String
})

var Account = exports.Account = mongoose.model('accounts', {
  name: String
})

