#!/usr/bin/env bash
#
# Audit backend install-script sources before running a full npm install.
# Exits non-zero if any package not on the whitelist has hasInstallScript: true.
#
# Usage (from repo root):
#   backend/meta/scripts/check-install-scripts.sh
#

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCKFILE="${BACKEND_DIR}/package-lock.json"
RUST_GBT_LOCKFILE="${BACKEND_DIR}/../rust/gbt/napi-cli/package-lock.json"

BACKEND_ALLOWED=(
  "mempool-backend"
  "fsevents"
  "unrs-resolver"
)

RUST_GBT_ALLOWED=()

is_allowed() {
  local pkg="$1"
  shift
  local allowed
  for allowed in "$@"; do
    if [[ "$pkg" == "$allowed" ]]; then
      return 0
    fi
  done
  return 1
}

collect_has_install_script_packages() {
  local lockfile="$1"
  if [[ ! -f "$lockfile" ]]; then
    echo "No package-lock.json found at ${lockfile}"
    return 1
  fi

  LOCKFILE_PATH="$lockfile" node - <<'NODE'
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
}

audit_lockfile() {
  local lockfile="$1"
  local label="$2"
  shift 2
  local allowed=("$@")
  local found_violations=0
  local pkg

  while IFS= read -r pkg; do
    [[ -z "$pkg" ]] && continue
    if ! is_allowed "$pkg" "${allowed[@]}"; then
      echo "VIOLATION: unauthorized install script in '${pkg}' (${label}: ${lockfile})"
      found_violations=1
    fi
  done < <(collect_has_install_script_packages "$lockfile")

  if [[ "$found_violations" -eq 1 ]]; then
    echo ""
    echo "FAILED: Found packages with install scripts not on the whitelist."
    return 1
  fi

  echo "OK: All ${label} install scripts are from whitelisted packages."
}

audit_rust_gbt_preinstall_chain() {
  if [[ "${#RUST_GBT_ALLOWED[@]}" -gt 0 ]]; then
    audit_lockfile "${RUST_GBT_LOCKFILE}" "backend preinstall toolchain" "${RUST_GBT_ALLOWED[@]}"
  else
    audit_lockfile "${RUST_GBT_LOCKFILE}" "backend preinstall toolchain"
  fi
}

audit_lockfile "${LOCKFILE}" "backend lockfile" "${BACKEND_ALLOWED[@]}"
audit_rust_gbt_preinstall_chain

echo "OK: Backend install-script audit passed."
