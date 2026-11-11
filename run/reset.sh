#!/usr/bin/env bash

cd "$(dirname "$0")/../backend" || exit 1
rm -f javaapp.db
echo "Done. The database will be created again with sample data when you run ./run/run.sh"
