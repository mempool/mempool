#!/usr/bin/env bash
#
# Safely install frontend npm dependencies by refreshing the lockfile without
# running install scripts, auditing it, then doing the real install.
#
# Usage (from repo root):
#   frontend/meta/scripts/safe-install.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOCKFILE="${FRONTEND_DIR}/package-lock.json"
RESTORE_LOCKFILE_DONE=0

# Back up the lockfile so we can restore on failure
if [[ -f "$LOCKFILE" ]]; then
  cp "$LOCKFILE" "${LOCKFILE}.bak"
fi

restore_lockfile() {
  trap - ERR INT TERM
  if [[ "${RESTORE_LOCKFILE_DONE}" -eq 1 ]]; then
    return
  fi
  RESTORE_LOCKFILE_DONE=1

  if [[ -f "${LOCKFILE}.bak" ]]; then
    mv "${LOCKFILE}.bak" "$LOCKFILE"
    echo "Restored original package-lock.json."
  elif [[ -f "$LOCKFILE" ]]; then
    rm "$LOCKFILE"
    echo "Removed generated package-lock.json."
  fi
}

trap restore_lockfile ERR INT TERM

echo "==> Refreshing frontend lockfile (--ignore-scripts --package-lock-only)..."
(cd "$FRONTEND_DIR" && npm install --ignore-scripts --package-lock-only --no-audit --no-fund)

echo ""
echo "==> Auditing lockfile for install scripts..."
bash "${SCRIPT_DIR}/check-install-scripts.sh"

trap - ERR INT TERM
rm -f "${LOCKFILE}.bak"

echo ""
echo "==> Installing frontend (npm ci)..."
(cd "$FRONTEND_DIR" && npm ci)

echo ""
echo "Done."
