#!/bin/bash

set -e

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <path to userlist .xlsx>"
  exit
fi

node scripts/sql-import.js wipe
node scripts/sql-import.js sequences
node scripts/sql-import.js accounts
echo "> Adding emails for users from $1"
node scripts/map-user-emails.js logUpdates $1 | mongo meku
node scripts/sql-import.js programs
node scripts/sql-import.js names
node scripts/sql-import.js \
  metadata \
  classifications \
  deleteTrainingPrograms \
  markUnclassifiedProgramsDeleted \
  deleteTrainingUsers \
  linkTvSeries \
  linkCustomersIds \
  metadataIndex \
  nameIndex
node scripts/create-demo-data.js
