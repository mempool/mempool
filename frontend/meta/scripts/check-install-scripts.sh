#!/usr/bin/env bash
#
# Audit frontend package-lock.json for unexpected hasInstallScript entries.
# Exits non-zero if any package not on the whitelist has hasInstallScript: true.
#
# Usage (from repo root):
#   frontend/meta/scripts/check-install-scripts.sh
#

set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCKFILE="${FRONTEND_DIR}/package-lock.json"

ALLOWED=(
  "mempool-frontend"
  "@parcel/watcher"
  "cypress"
  "esbuild"
  "fsevents"
  "lmdb"
  "msgpackr-extract"
)

is_allowed() {
  local pkg="$1"
  for allowed in "${ALLOWED[@]}"; do
    if [[ "$pkg" == "$allowed" ]]; then
      return 0
    fi
  done
  return 1
}

if [[ ! -f "$LOCKFILE" ]]; then
  echo "No package-lock.json found at ${LOCKFILE}"
  exit 1
fi

found_violations=0

violations=$(
  LOCKFILE_PATH="$LOCKFILE" node - <<'NODE'
const fs = require('fs');

const lock = JSON.parse(fs.readFileSync(process.env.LOCKFILE_PATH, 'utf8'));
const pkgs = lock.packages || {};

for (const [path, meta] of Object.entries(pkgs)) {
  if (meta && meta.hasInstallScript) {
    const name = path === '' ? (lock.name || '(root)') : path.replace(/^.*node_modules\//, '');
    console.log(name);
  }
}
NODE
)

while IFS= read -r pkg; do
  [[ -z "$pkg" ]] && continue
  if ! is_allowed "$pkg"; then
    echo "VIOLATION: unauthorized install script in '${pkg}' (${LOCKFILE})"
    found_violations=1
  fi
done <<< "$violations"

if [[ "$found_violations" -eq 1 ]]; then
  echo ""
  echo "FAILED: Found packages with install scripts not on the whitelist."
  echo "If this is a legitimate new dependency, add it to frontend/meta/scripts/check-install-scripts.sh"
  exit 1
else
  echo "OK: All frontend install scripts are from whitelisted packages."
fi
