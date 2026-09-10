#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DIR="$ROOT_DIR/.local"
MARIADB_BIN="$(brew --prefix mariadb@11.4)/bin"

for name in auth world; do
  pid_file="$LOCAL_DIR/$name.pid"
  if [ -f "$pid_file" ]; then
    pid="$(cat "$pid_file")"
    kill "$pid" 2>/dev/null || true
    rm -f "$pid_file"
  fi
done

# Les fichiers PID peuvent devenir périmés après une interruption du script.
# Termine également les processus qui occupent réellement les ports Giny,
# y compris une instance partielle limitée à son API ou à l'IPC.
for port in 8443 5555 9000 9001 18000; do
  while IFS= read -r pid; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done < <(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
done

# Termine également d'éventuels processus zombies non-écoutants
pkill -9 -f "Giny\.(World|Auth)" 2>/dev/null || true

for _ in $(seq 1 20); do
  if ! lsof -nP -iTCP:8443 -sTCP:LISTEN -t >/dev/null 2>&1 && \
     ! lsof -nP -iTCP:5555 -sTCP:LISTEN -t >/dev/null 2>&1 && \
     ! lsof -nP -iTCP:9000 -sTCP:LISTEN -t >/dev/null 2>&1 && \
     ! lsof -nP -iTCP:9001 -sTCP:LISTEN -t >/dev/null 2>&1 && \
     ! lsof -nP -iTCP:18000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

"$MARIADB_BIN/mariadb-admin" --no-defaults --host=127.0.0.1 --port=3307 -uroot shutdown >/dev/null 2>&1 || true
echo "Giny et sa base locale sont arrêtés."
