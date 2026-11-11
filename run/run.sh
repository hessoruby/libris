#!/usr/bin/env bash

cd "$(dirname "$0")/../backend" || exit 1

echo "Compiling the Java files in src ..."
if ! javac -d classes src/*.java; then
    echo "Compile failed. Read the error above."
    exit 1
fi

( sleep 2; xdg-open http://localhost:8080 >/dev/null 2>&1 || open http://localhost:8080 >/dev/null 2>&1 ) &

java -cp "sqlite-jdbc-3.49.1.0.jar:classes" JavaApp
