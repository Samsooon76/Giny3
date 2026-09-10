#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MARIADB_BIN="$(brew --prefix mariadb@11.4)/bin"
MARIADB=("$MARIADB_BIN/mariadb" --no-defaults --host=127.0.0.1 --port=3307 -uroot --batch --skip-column-names giny_world)

if ! "$MARIADB_BIN/mariadb-admin" --no-defaults --host=127.0.0.1 --port=3307 -uroot ping >/dev/null 2>&1; then
  echo "MariaDB locale n'est pas lancée. Lance scripts/start.sh --background d'abord."
  exit 1
fi

# Le dataset doit rester idempotent et administrable après son premier chargement.
"${MARIADB[@]}" < "$ROOT_DIR/server/Ressources/SQL/Patches/002_guild_camp.sql"
"${MARIADB[@]}" < "$ROOT_DIR/server/Ressources/SQL/Patches/002_guild_camp.sql"

CONFIG_RESULT="$("${MARIADB[@]}" -e "SELECT COUNT(*),(SELECT COUNT(*) FROM guild_building_levels),(SELECT COUNT(*) FROM guild_building_effects),(SELECT COUNT(*) FROM guild_building_level_requirements) FROM guild_buildings WHERE Enabled=1;")"
if [ "$CONFIG_RESULT" != $'3\t9\t17\t9' ]; then
  echo "Configuration du campement invalide: $CONFIG_RESULT"
  exit 1
fi

GEOMETRY_RESULT="$("${MARIADB[@]}" -e "SELECT GROUP_CONCAT(CONCAT(Id,':',OverlayX,',',OverlayY,',',OverlayWidth,',',OverlayHeight) ORDER BY Id SEPARATOR '|') FROM guild_buildings WHERE Enabled=1;")"
EXPECTED_GEOMETRY='1:323,30,251,200|2:113,181,217,177|3:528,174,236,190'
if [ "$GEOMETRY_RESULT" != "$EXPECTED_GEOMETRY" ]; then
  echo "Géométrie des parcelles invalide: $GEOMETRY_RESULT"
  exit 1
fi

TRANSACTION_RESULT="$("${MARIADB[@]}" < "$ROOT_DIR/server/Ressources/SQL/Tests/guild_camp_smoke_transaction.sql")"
EXPECTED=$'2\tGiny_GuildCamp/assets/buildings/forge-2.png\tCRAFT_COST_PERCENT\t-5\t19\n0\t0'
if [ "$TRANSACTION_RESULT" != "$EXPECTED" ]; then
  echo "Parcours Forge niveau 1 vers niveau 2 invalide:"
  echo "$TRANSACTION_RESULT"
  exit 1
fi

echo "Campement smoke test OK: dataset 3x3, financement Forge, passage niveau 2, asset forge-2, bonus craft -5 % et rollback propre."
