#!/bin/bash

if [ ! -f ./node_modules/.bin/cypress ]; then echo "Run 'npm install' first"; exit 1; fi

echo "Running ESLint..."
./node_modules/.bin/eslint client/js server shared cypress/integration
if [ "$?" != 0 ]; then
  exit "$?"
fi

PORT=4000
echo "Starting server for browser tests..."
NODE_ENV=test SENDGRID_APIKEY="SG.dummy-apikey" node server/app.js &
APP_PID=$!

printf "Waiting for the server to listen.."
until $(curl --output /dev/null --silent --head http://localhost:4000); do
    printf '.'
    sleep 2
done

echo "Importing test fixtures..."
NODE_ENV=test node cypress/fixtures
if [ "$?" = 0 ]; then
  echo "Starting Cypress run..."
  CYPRESS_BASE_URL=http://localhost:$PORT/ node_modules/.bin/cypress run
fi

kill $APP_PID
