#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MARIADB_BIN="$(brew --prefix mariadb@11.4)/bin"
MARIADB=("$MARIADB_BIN/mariadb" --no-defaults --host=127.0.0.1 --port=3307 -uroot --batch --skip-column-names giny_world)

if ! "$MARIADB_BIN/mariadb-admin" --no-defaults --host=127.0.0.1 --port=3307 -uroot ping >/dev/null 2>&1; then
  echo "MariaDB locale n'est pas lancée. Lance scripts/start.sh --background d'abord."
  exit 1
fi

# The migration must remain safe to execute repeatedly.
"${MARIADB[@]}" < "$ROOT_DIR/server/Ressources/SQL/Patches/001_pokefus_genome_phase1.sql"
"${MARIADB[@]}" < "$ROOT_DIR/server/Ressources/SQL/Patches/001_pokefus_genome_phase1.sql"

CONFIG_RESULT="$("${MARIADB[@]}" -e "SELECT COUNT(*),(SELECT COUNT(*) FROM pokefus_genome_branches WHERE SpeciesId=101),(SELECT COUNT(*) FROM pokefus_genes WHERE SpeciesId=101),(SELECT COALESCE(SUM(OgrineCost),0) FROM pokefus_genes WHERE SpeciesId=101),(SELECT MaxActiveGenes FROM pokefus_species WHERE Id=101);")"
if [ "$CONFIG_RESULT" != $'1\t3\t12\t0\t4' ]; then
  echo "Configuration Bouftou invalide: $CONFIG_RESULT"
  exit 1
fi

TRANSACTION_RESULT="$("${MARIADB[@]}" < "$ROOT_DIR/server/Ressources/SQL/Tests/pokefus_smoke_transaction.sql")"
if [ "$TRANSACTION_RESULT" != $'500\t0\t1\t1\t1\n0\t0' ]; then
  echo "Transaction Pokéfus invalide:"
  echo "$TRANSACTION_RESULT"
  exit 1
fi

echo "Pokéfus smoke test OK: migration idempotente, Bouftou 3/12, kamas-only, recherche/unlock/slot atomiques et rollback propre."
