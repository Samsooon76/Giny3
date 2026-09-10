#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CATALOG_PYTHON="${GINY_CATALOG_PYTHON:-$ROOT_DIR/.local/catalog-venv/bin/python}"
if [[ ! -x "$CATALOG_PYTHON" ]]; then
  echo "Environnement Python absent. Voir docs/CATALOGUE-OFFICIEL-SQL.md pour l'installation." >&2
  exit 1
fi
export PYTHONPATH="$ROOT_DIR/client/dofus3${PYTHONPATH:+:$PYTHONPATH}"
exec "$CATALOG_PYTHON" -m extractor.official_catalog sync \
  --archive-root "$ROOT_DIR/.local/catalog/snapshots" \
  --output-root "$ROOT_DIR/output/catalogs/releases" \
  --socket "$ROOT_DIR/.local/mariadb.sock" "$@"
