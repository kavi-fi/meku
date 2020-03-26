#!/bin/bash

if [ ! -f ./node_modules/chromedriver/bin/chromedriver ]; then echo "Run 'npm install' first"; exit 1; fi

./node_modules/.bin/eslint server test
if [ "$?" != 0 ]; then
  exit "$?"
fi

BASE_DIR=`dirname $0`
cd $BASE_DIR/..

java -Dwebdriver.chrome.driver=./node_modules/chromedriver/bin/chromedriver -jar ./node_modules/selenium-server-standalone-jar/jar/selenium-server-standalone-3.141.59.jar &
SELENIUM_PID=$!

if [ "$1" == "" ]; then
  TEST=""
else
  TEST="test/$1.js"
fi

NODE_ENV=test ./node_modules/.bin/mocha $TEST --exit
kill $SELENIUM_PID
