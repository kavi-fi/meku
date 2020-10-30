const fs = require('fs')
const axios = require('axios')

module.exports = (on, config) => {
  on('task', {
    sendXML (filename) {
      const fileStream = fs.createReadStream(filename)
      return axios({
        method: 'POST',
        url: 'http://localhost:4000/xml/v1/programs/clientToken',
        headers: {
          'Content-Type': 'text/xml'
        },
        data: fileStream
      }).then((response) => response.data)
    }
  })
}
