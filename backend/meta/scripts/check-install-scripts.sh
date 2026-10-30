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
RUST_GBT_DIR="${BACKEND_DIR}/../rust/gbt"
TMP_AUDIT_DIR=""

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

cleanup() {
  if [[ -n "${TMP_AUDIT_DIR}" && -d "${TMP_AUDIT_DIR}" ]]; then
    rm -rf "${TMP_AUDIT_DIR}"
  fi
}

trap cleanup EXIT

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

get_rust_gbt_napi_cli_version() {
  local rust_gbt_package_json="${RUST_GBT_DIR}/package.json"
  if [[ ! -f "$rust_gbt_package_json" ]]; then
    echo "No rust/gbt package.json found at ${rust_gbt_package_json}"
    return 1
  fi

  RUST_GBT_PACKAGE_JSON="$rust_gbt_package_json" node - <<'NODE'
const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync(process.env.RUST_GBT_PACKAGE_JSON, 'utf8'));
const buildScript = (pkg.scripts && pkg.scripts.build) || '';
const match = buildScript.match(/npm install --no-save @napi-rs\/cli@([^\s]+)/);

if (!match) {
  console.error('Could not determine the @napi-rs/cli version from rust/gbt/package.json.');
  process.exit(1);
}

process.stdout.write(match[1]);
NODE
}

generate_rust_gbt_audit_lockfile() {
  local napi_cli_version="$1"

  TMP_AUDIT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/backend-rust-gbt-audit.XXXXXX")"
  cat > "${TMP_AUDIT_DIR}/package.json" <<EOF
{
  "name": "rust-gbt-install-audit",
  "private": true,
  "dependencies": {
    "@napi-rs/cli": "${napi_cli_version}"
  }
}
EOF

  (
    cd "${TMP_AUDIT_DIR}"
    npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null
  )

  printf '%s\n' "${TMP_AUDIT_DIR}/package-lock.json"
}

audit_rust_gbt_preinstall_chain() {
  local napi_cli_version
  local rust_gbt_lockfile

  napi_cli_version="$(get_rust_gbt_napi_cli_version)"
  rust_gbt_lockfile="$(generate_rust_gbt_audit_lockfile "${napi_cli_version}")"
  if [[ "${#RUST_GBT_ALLOWED[@]}" -gt 0 ]]; then
    audit_lockfile "${rust_gbt_lockfile}" "backend preinstall toolchain" "${RUST_GBT_ALLOWED[@]}"
  else
    audit_lockfile "${rust_gbt_lockfile}" "backend preinstall toolchain"
  fi
}

audit_lockfile "${LOCKFILE}" "backend lockfile" "${BACKEND_ALLOWED[@]}"
audit_rust_gbt_preinstall_chain

echo "OK: Backend install-script audit passed."
