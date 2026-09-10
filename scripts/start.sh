#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DIR="$ROOT_DIR/.local"
LOG_DIR="$LOCAL_DIR/logs"
DB_DIR="$LOCAL_DIR/mariadb"
DB_PORT=3307
AUTH_PORT=8443
WORLD_PORT=5555
IPC_PORT=18000

mkdir -p "$LOG_DIR"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew est requis : https://brew.sh"
  exit 1
fi

DOTNET_ROOT="${DOTNET_ROOT:-$(brew --prefix dotnet@6)/libexec}"
export DOTNET_ROOT
export PATH="$DOTNET_ROOT:$PATH"
export DOTNET_CLI_HOME="$LOCAL_DIR/dotnet-cli"
export NUGET_PACKAGES="$LOCAL_DIR/nuget"
export DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
export MSBUILDDISABLENODEREUSE=1
export DOTNET_CLI_DO_NOT_USE_MSBUILD_SERVER=1

MARIADB_BIN="$(brew --prefix mariadb@11.4)/bin"

if ! "$MARIADB_BIN/mariadb-admin" --no-defaults --host=127.0.0.1 --port="$DB_PORT" -uroot ping >/dev/null 2>&1; then
  if [ ! -d "$DB_DIR/mysql" ]; then
    mkdir -p "$DB_DIR"
    "$MARIADB_BIN/mariadb-install-db" --no-defaults --datadir="$DB_DIR" --auth-root-authentication-method=normal --skip-test-db
  fi

  nohup "$MARIADB_BIN/mariadbd" --no-defaults \
    --datadir="$DB_DIR" --port="$DB_PORT" --bind-address=127.0.0.1 \
    --socket="$LOCAL_DIR/mariadb.sock" --pid-file="$LOCAL_DIR/mariadb.pid" \
    --log-error="$LOG_DIR/mariadb.log" </dev/null >"$LOG_DIR/mariadb.stdout.log" 2>&1 &

  for _ in $(seq 1 30); do
    if "$MARIADB_BIN/mariadb-admin" --no-defaults --host=127.0.0.1 --port="$DB_PORT" -uroot ping >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if ! "$MARIADB_BIN/mariadb" --no-defaults --host=127.0.0.1 --port="$DB_PORT" -uroot -e 'SELECT 1 FROM giny_auth.accounts LIMIT 1' >/dev/null 2>&1; then
  echo "Import des bases Giny..."
  "$MARIADB_BIN/mariadb" --no-defaults --host=127.0.0.1 --port="$DB_PORT" -uroot \
    -e 'CREATE DATABASE IF NOT EXISTS giny_auth CHARACTER SET utf8mb4; CREATE DATABASE IF NOT EXISTS giny_world CHARACTER SET utf8mb4;'
  "$MARIADB_BIN/mariadb" --no-defaults --host=127.0.0.1 --port="$DB_PORT" -uroot giny_auth < "$ROOT_DIR/server/Ressources/SQL/SQL_a_jour_02_12_2025/giny_auth.sql"
  unzip -p "$ROOT_DIR/server/Ressources/SQL/SQL_a_jour_02_12_2025/giny_world.zip" giny_world.sql | \
    "$MARIADB_BIN/mariadb" --no-defaults --host=127.0.0.1 --port="$DB_PORT" -uroot giny_world
fi

BUILD_OPTIONS=(--configuration Release --no-restore -nr:false -p:UseSharedCompilation=false -m:1 --nologo -v:q)
dotnet build "$ROOT_DIR/server/Servers/Giny.Auth/Giny.Auth.csproj" "${BUILD_OPTIONS[@]}"
dotnet build "$ROOT_DIR/server/Servers/Giny.World/Giny.World.csproj" "${BUILD_OPTIONS[@]}"
# Module Pokéfus (feature optionnelle chargée depuis Modules/)
dotnet build "$ROOT_DIR/server/Modules/Giny.Pokefus/Giny.Pokefus.csproj" "${BUILD_OPTIONS[@]}"
# Campement de guilde (feature data-driven chargée depuis Modules/)
dotnet build "$ROOT_DIR/server/Modules/Giny.GuildCamp/Giny.GuildCamp.csproj" "${BUILD_OPTIONS[@]}"
# Quêtes journalières/hebdomadaires data-driven
dotnet build "$ROOT_DIR/server/Modules/Giny.Quests/Giny.Quests.csproj" "${BUILD_OPTIONS[@]}"

AUTH_BIN="$ROOT_DIR/server/Servers/Giny.Auth/bin/Release/net6.0"
WORLD_BIN="$ROOT_DIR/server/Servers/Giny.World/bin/Release/net6.0"
cp "$ROOT_DIR/server/Ressources/MacOS/auth.config.json" "$AUTH_BIN/config.json"
cp "$ROOT_DIR/server/Ressources/MacOS/world.config.json" "$WORLD_BIN/config.json"
mkdir -p "$WORLD_BIN/Modules"
if [ -f "$ROOT_DIR/server/Modules/Giny.Pokefus/bin/Release/net6.0/Giny.Pokefus.dll" ]; then
  cp "$ROOT_DIR/server/Modules/Giny.Pokefus/bin/Release/net6.0/Giny.Pokefus.dll" "$WORLD_BIN/Modules/"
fi
if [ -f "$ROOT_DIR/server/Modules/Giny.GuildCamp/bin/Release/net6.0/Giny.GuildCamp.dll" ]; then
  cp "$ROOT_DIR/server/Modules/Giny.GuildCamp/bin/Release/net6.0/Giny.GuildCamp.dll" "$WORLD_BIN/Modules/"
fi
if [ -f "$ROOT_DIR/server/Modules/Giny.Quests/bin/Release/net6.0/Giny.Quests.dll" ]; then
  cp "$ROOT_DIR/server/Modules/Giny.Quests/bin/Release/net6.0/Giny.Quests.dll" "$WORLD_BIN/Modules/"
fi
if [ -f "$ROOT_DIR/server/Ressources/pokefus.json" ]; then
  cp "$ROOT_DIR/server/Ressources/pokefus.json" "$WORLD_BIN/pokefus.json"
fi

for port in "$AUTH_PORT" "$WORLD_PORT" 9000 9001 "$IPC_PORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Un composant Giny écoute déjà sur le port $port. Utilise scripts/stop.sh avant de relancer."
    exit 1
  fi
done

# Back up the legacy schema before World applies the first storage migrations.
# This runs only after checking that no game server is listening; --lock-all-tables
# also makes the old MyISAM tables consistent in the backup.
MIGRATION_TABLE_EXISTS=$("$MARIADB_BIN/mariadb" --no-defaults --host=127.0.0.1 --port="$DB_PORT" -uroot -N -B \
  -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='giny_world' AND TABLE_NAME='schema_migrations'")
STORAGE_MIGRATED=0
if [ "$MIGRATION_TABLE_EXISTS" = 1 ]; then
  STORAGE_MIGRATED=$("$MARIADB_BIN/mariadb" --no-defaults --host=127.0.0.1 --port="$DB_PORT" -uroot -N -B \
    -e "SELECT COUNT(*) FROM giny_world.schema_migrations WHERE Module='world' AND Version='002-transactional-player-storage'")
fi
if [ "$STORAGE_MIGRATED" = 0 ]; then
  umask 077
  mkdir -p "$LOCAL_DIR/backups"
  BACKUP_FILE="$LOCAL_DIR/backups/before-storage-$(date -u +%Y%m%dT%H%M%SZ)-$$.sql.gz"
  "$MARIADB_BIN/mariadb-dump" --no-defaults --host=127.0.0.1 --port="$DB_PORT" -uroot \
    --lock-all-tables --hex-blob --routines --events --databases giny_auth giny_world | gzip > "$BACKUP_FILE"
  gzip -t "$BACKUP_FILE"
  echo "Sauvegarde avant migration : $BACKUP_FILE"
fi

pushd "$AUTH_BIN" >/dev/null
nohup dotnet Giny.Auth.dll </dev/null >"$LOG_DIR/auth.log" 2>&1 &
AUTH_PID=$!
popd >/dev/null
echo "$AUTH_PID" > "$LOCAL_DIR/auth.pid"

AUTH_READY=false
for _ in $(seq 1 60); do
  if ! kill -0 "$AUTH_PID" 2>/dev/null; then
    echo "Le serveur Auth s'est arrêté pendant son démarrage. Consulte $LOG_DIR/auth.log."
    exit 1
  fi
  if curl -fsS "http://127.0.0.1:9001/Version/launcher" >/dev/null 2>&1 && \
     lsof -nP -iTCP:"$AUTH_PORT" -sTCP:LISTEN -t >/dev/null 2>&1 && \
     lsof -nP -iTCP:"$IPC_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    AUTH_READY=true
    break
  fi
  sleep 0.5
done
if [ "$AUTH_READY" != true ]; then
  echo "Le serveur Auth n'est pas devenu prêt. Consulte $LOG_DIR/auth.log."
  exit 1
fi

pushd "$WORLD_BIN" >/dev/null
nohup dotnet Giny.World.dll </dev/null >"$LOG_DIR/world.log" 2>&1 &
WORLD_PID=$!
popd >/dev/null
echo "$WORLD_PID" > "$LOCAL_DIR/world.pid"

WORLD_READY=false
for _ in $(seq 1 120); do
  if ! kill -0 "$WORLD_PID" 2>/dev/null; then
    echo "Le serveur World s'est arrêté pendant son démarrage. Consulte $LOG_DIR/world.log."
    exit 1
  fi
  if lsof -nP -iTCP:"$WORLD_PORT" -sTCP:LISTEN -t >/dev/null 2>&1 && \
     lsof -nP -iTCP:9000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    WORLD_READY=true
    break
  fi
  sleep 0.5
done
if [ "$WORLD_READY" != true ]; then
  echo "Le serveur World n'est pas devenu prêt. Consulte $LOG_DIR/world.log."
  exit 1
fi

echo "Giny est lancé."
echo "  Auth : 127.0.0.1:$AUTH_PORT"
echo "  Monde : 127.0.0.1:$WORLD_PORT"
echo "  Compte de test : admin / test"
echo "  Logs : $LOG_DIR/auth.log et $LOG_DIR/world.log"

if [ "${1:-}" != "--background" ]; then
  cleanup() {
    "$ROOT_DIR/scripts/stop.sh"
  }
  trap cleanup INT TERM EXIT
  wait "$WORLD_PID"
fi
