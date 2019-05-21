var env = require('../server/env').get()
var mongoose = require('mongoose')
var schema = require('../server/schema')
var _ = require('lodash')
var Program = schema.Program

mongoose.connect(process.env.MONGOHQ_URL || env.mongoUrl)
var stream = Program.find({}).stream()

stream.on('data', function (program) {
  const fixedClassifications = _.map(program.classifications, (classification) => {
    if (classification.duration && classification.duration.trim().length < 6){
      var match = /^(\d+):(\d+)$/.exec(classification.duration.trim())
      if (match) {
        const hours = '00'
        const minutes = match[1] && match[1].length == 2 ? match[1] : match[1] ? match[1].padStart(2, '0') : '00'
        const seconds = match[2] && match[2].length == 2 ? match[2] : match[2] ? match[2].padStart(2, '0') : '00'

        const fixedTime = `${hours}:${minutes}:${seconds}`
        return _.extend(classification, { duration: fixedTime })
      } else {
        console.log(`Name: ${_.join(program.name, ', ')}, SequenceId: ${program.sequenceId}, Duration: ${classification.duration}`)
        return classification
      }
    } else if (classification.duration && (classification.duration.trim().length >= 6 && classification.duration.trim().length < 8)){
      var m = /(?:(\d+)?:)(\d+):(\d+)$/.exec(classification.duration.trim())
      if (m){
        const hours = m[1] && m[1].length == 2 ? m[1] : m[1] ? m[1].padStart(2, '0') : '00'
        const minutes = m[2] && m[2].length == 2 ? m[2] : m[2] ? m[2].padStart(2, '0') : '00'
        const seconds = m[3] && m[3].length == 2 ? m[3] : m[3] ? m[3].padStart(2, '0') : '00'

        const fixedTime = `${hours}:${minutes}:${seconds}`
        return _.extend(classification, {duration: fixedTime})
      } else {
        console.log(`Name: ${_.join(program.name, ', ')}, SequenceId: ${program.sequenceId}, Duration: ${classification.duration}`)
        return classification
      }
    } else if(classification.duration && classification.duration.trim().length > 8){
        console.log(`Name: ${_.join(program.name, ', ')}, SequenceId: ${program.sequenceId}, Duration: ${classification.duration}`)
        return classification
    }
    return classification
  })

  const updatedProgram = _.extend(program, {classifications: fixedClassifications})
  updatedProgram.save(function (err) {
    if (err) console.error(err)
    stream.resume()
  })
})
stream.on('error', function (err) {
   console.error('Error: ' + err)
})
stream.on('close', function () {
   console.info('done')
   mongoose.disconnect()
})