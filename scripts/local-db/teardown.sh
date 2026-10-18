#!/usr/bin/env bash
# =============================================================================
#  Drop the local verification database.
#
#  The database only ever contains fixtures of the test suite; dropping it is
#  safe at any time. `setup.sh` recreates it from scratch.
# =============================================================================
set -euo pipefail

DB_NAME="${PGDATABASE:-riwaq_test}"
DB_USER="${PGUSER:-riwaq_test}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not available — is PostgreSQL installed?" >&2
  exit 1
fi

echo "→ Dropping the database '${DB_NAME}'"

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS ${DB_NAME};
SQL

echo "✓ Done. Run 'bash scripts/local-db/setup.sh' to recreate it."
