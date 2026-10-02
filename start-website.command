#!/bin/bash
cd "$(dirname "$0")"
echo "Starting the website... keep this window open. Visit http://localhost:3000"
(sleep 2; open http://localhost:3000/admin) &
node server/index.js
