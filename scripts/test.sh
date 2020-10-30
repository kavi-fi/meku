#!/bin/bash

if [ ! -f ./node_modules/.bin/cypress ]; then echo "Run 'npm install' first"; exit 1; fi

./node_modules/.bin/eslint client/js server shared cypress/integration
if [ "$?" != 0 ]; then
  exit "$?"
fi

PORT=4000
NODE_ENV=test node server/app.js &
APP_PID=$!

NODE_ENV=test node cypress/fixtures
if [ "$?" = 0 ]; then
  CYPRESS_BASE_URL=http://localhost:$PORT/ node_modules/.bin/cypress run
fi

kill $APP_PID
