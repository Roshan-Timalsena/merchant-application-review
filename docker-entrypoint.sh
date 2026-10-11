#!/bin/sh
set -e

if [ -f dist/database/data-source.js ]; then
  echo "Running database migrations..."
  node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
fi

exec "$@"
