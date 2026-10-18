#!/usr/bin/env bash
# =============================================================================
#  Creates the local verification database and applies
#    1. the Supabase schema emulation, and
#    2. every migration in supabase/migrations (in file name order).
#
#  The SQL files are piped through `stdin` rather than passed with `-f`,
#  because the `postgres` OS user cannot read files inside the (private)
#  workspace directory.
#
#  Usage:  bash scripts/local-db/setup.sh
#  Env:    RIWAQ_TEST_DB   (default: riwaq_test)
#          RIWAQ_TEST_USER (default: riwaq_test)
#          RIWAQ_TEST_PASSWORD (default: riwaq_test)
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB_NAME="${RIWAQ_TEST_DB:-riwaq_test}"
DB_USER="${RIWAQ_TEST_USER:-riwaq_test}"
DB_PASSWORD="${RIWAQ_TEST_PASSWORD:-riwaq_test}"

run_super() {
  local database="$1"
  local file="$2"
  if [ "$(id -u)" = "0" ]; then
    cat "$file" | psql -v ON_ERROR_STOP=1 -d "$database"
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    cat "$file" | sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d "$database"
  else
    cat "$file" | psql -v ON_ERROR_STOP=1 -d "$database"
  fi
}

run_super_sql() {
  local database="$1"
  local statement="$2"
  if [ "$(id -u)" = "0" ]; then
    psql -v ON_ERROR_STOP=1 -d "$database" -c "$statement"
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d "$database" -c "$statement"
  else
    psql -v ON_ERROR_STOP=1 -d "$database" -c "$statement"
  fi
}

echo "==> Recreating database ${DB_NAME}"
run_super_sql postgres "drop database if exists ${DB_NAME};" >/dev/null
run_super_sql postgres "create database ${DB_NAME};" >/dev/null

echo "==> Creating login role ${DB_USER}"
run_super_sql postgres "
do \$\$
begin
  if not exists (select 1 from pg_roles where rolname = '${DB_USER}') then
    create role ${DB_USER} login password '${DB_PASSWORD}';
  else
    alter role ${DB_USER} with login password '${DB_PASSWORD}';
  end if;
end
\$\$;" >/dev/null

echo "==> Applying the Supabase schema emulation"
run_super "${DB_NAME}" "${ROOT_DIR}/scripts/local-db/supabase_emulation.sql" >/dev/null

echo "==> Applying migrations"
for migration in "${ROOT_DIR}"/supabase/migrations/*.sql; do
  echo "    - $(basename "${migration}")"
  run_super "${DB_NAME}" "$migration" >/dev/null
done

echo "==> Granting the API roles to ${DB_USER}"
run_super_sql postgres "grant anon, authenticated, service_role to ${DB_USER};" >/dev/null
run_super_sql "${DB_NAME}" "grant all on schema public to ${DB_USER};" >/dev/null
run_super_sql "${DB_NAME}" "grant all on all tables in schema public to ${DB_USER};" >/dev/null
run_super_sql "${DB_NAME}" "grant all on all sequences in schema public to ${DB_USER};" >/dev/null
run_super_sql "${DB_NAME}" "grant all on all functions in schema public to ${DB_USER};" >/dev/null
run_super_sql "${DB_NAME}" "alter database ${DB_NAME} owner to ${DB_USER};" >/dev/null
run_super_sql "${DB_NAME}" "grant all on schema auth to ${DB_USER};" >/dev/null
run_super_sql "${DB_NAME}" "grant all on schema storage to ${DB_USER};" >/dev/null
run_super_sql "${DB_NAME}" "alter table auth.users owner to ${DB_USER};" >/dev/null
run_super_sql "${DB_NAME}" "alter table storage.buckets owner to ${DB_USER};" >/dev/null
run_super_sql "${DB_NAME}" "alter table storage.objects owner to ${DB_USER};" >/dev/null

cat <<EOF

Local verification database ready.

  DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}

Run the security suite with:

  DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME} npm run test:db
EOF
