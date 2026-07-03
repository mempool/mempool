#!/usr/bin/env bash
#
# update-umbrel-mempool.sh
#
# Interactively update the Mempool Umbrel app's mempool/frontend and
# mempool/backend Docker images.
#
# What it does:
#   1. Picks (or prompts for) the SSH target for your Umbrel.
#   2. Reads the current versions from the app's docker-compose.yml (over SSH).
#   3. Shows the last 10 tags for each image from Docker Hub and lets you choose.
#   4. Shows a before/after diff (warns if frontend/backend versions differ).
#   5. After you confirm, edits the compose file in place (with a .bak backup) and
#      runs `umbreld client apps.update.mutate --appId mempool` to apply.
#
# Usage:
#   ./scripts/update-umbrel-mempool.sh [ssh-target]
#
#   With no argument it prompts for the target (default umbrel@umbrel.local).
#   e.g.  ./scripts/update-umbrel-mempool.sh pi@192.168.1.50
#
# Re-exec under bash if started another way (e.g. `sh script`), and leave POSIX
# mode so arrays and other bash features work regardless of how it was launched.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
set +o posix 2>/dev/null || true

set -euo pipefail

DEFAULT_TARGET="umbrel@umbrel.local"
FRONTEND_REPO="mempool/frontend"
BACKEND_REPO="mempool/backend"
TAG_LIST_COUNT=10

# Candidate locations for the app's docker-compose.yml on the device. The first
# one that exists is used. The bare relative path matches the umbrel user's home.
COMPOSE_REL="umbrel/app-stores/getumbrel-umbrel-apps-github-53f74447/mempool/docker-compose.yml"
COMPOSE_CANDIDATES=(
  "\$HOME/$COMPOSE_REL"
  "/home/umbrel/$COMPOSE_REL"
  "$COMPOSE_REL"
)

err()  { printf 'error: %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }
info() { printf '%s\n' "$*"; }

# --- Step 1: preflight ------------------------------------------------------
command -v jq   >/dev/null 2>&1 || die "jq is required (install: brew install jq)"
command -v ssh  >/dev/null 2>&1 || die "ssh is required"
command -v curl >/dev/null 2>&1 || die "curl is required"
[ -e /dev/tty ] || die "this script is interactive and needs a terminal (/dev/tty)"

# --- Step 2: choose SSH target ----------------------------------------------
if [ "$#" -ge 1 ] && [ -n "$1" ]; then
  SSH_TARGET="$1"
  info "Using SSH target: ${SSH_TARGET}"
else
  printf 'SSH target [%s]: ' "$DEFAULT_TARGET" >/dev/tty
  read -r SSH_TARGET </dev/tty || true
  [ -n "$SSH_TARGET" ] || SSH_TARGET="$DEFAULT_TARGET"
fi

# --- Step 3: locate compose file + read current values (over SSH) -----------
# Output contract from the remote read:
#   line 1: COMPOSE_PATH=<resolved absolute path>
#   then:   the matching `image: mempool/...` lines
REMOTE_READ=$(cat <<REMOTE
set -e
compose=""
for p in ${COMPOSE_CANDIDATES[*]}; do
  if [ -f "\$p" ]; then compose="\$p"; break; fi
done
if [ -z "\$compose" ]; then echo "COMPOSE_NOT_FOUND" >&2; exit 3; fi
echo "COMPOSE_PATH=\$compose"
grep -E 'image:[[:space:]]*mempool/(frontend|backend):' "\$compose"
REMOTE
)

info "Connecting to ${SSH_TARGET} to read current versions..."
REMOTE_OUT="$(ssh "$SSH_TARGET" "$REMOTE_READ")" || {
  err "Could not read the compose file on ${SSH_TARGET}."
  err "Checked: ${COMPOSE_CANDIDATES[*]}"
  die "Verify the SSH target and that the Mempool app is installed."
}

COMPOSE_PATH="$(printf '%s\n' "$REMOTE_OUT" | sed -n 's/^COMPOSE_PATH=//p')"
[ -n "$COMPOSE_PATH" ] || die "could not resolve compose path on device"

# Extract current "repo:tag@sha256:digest" tokens and the bare current tag.
cur_ref() { # $1 = repo
  printf '%s\n' "$REMOTE_OUT" | grep -oE "$1:[^[:space:]\"']+" | head -1
}
cur_tag() { # $1 = full ref (repo:tag@sha256:...)
  printf '%s' "$1" | sed -E 's#^[^:]+:([^@]+)@.*#\1#'
}
FE_CUR="$(cur_ref "$FRONTEND_REPO" || true)"
BE_CUR="$(cur_ref "$BACKEND_REPO" || true)"
FE_CUR_TAG="$(cur_tag "$FE_CUR")"
BE_CUR_TAG="$(cur_tag "$BE_CUR")"

info ""
info "Currently installed on ${SSH_TARGET}:"
info "  frontend: ${FE_CUR_TAG:-<not found>}"
info "  backend:  ${BE_CUR_TAG:-<not found>}"

# --- Step 4: interactive tag selection from Docker Hub ----------------------
# Choose a tag filter once; it applies to both images for consistency.
echo "" >/dev/tty
echo "Tag filter:" >/dev/tty
echo "  1) Stable releases only (vX.Y.Z)" >/dev/tty
echo "  2) All tags (including -dev / -rc / -beta)" >/dev/tty
while :; do
  printf "Enter number [1-2] (default 1): " >/dev/tty
  read -r FILTER_SEL </dev/tty || true
  [ -n "$FILTER_SEL" ] || FILTER_SEL=1
  case "$FILTER_SEL" in
    1) FILTER_MODE="stable"; break ;;
    2) FILTER_MODE="all";    break ;;
    *) echo "  Please enter 1 or 2." >/dev/tty ;;
  esac
done

# jq selector for the chosen filter. Stable = plain semver vX.Y.Z (no suffix).
# Both modes require a non-null top-level digest (needed for the @sha256: pin;
# some old tags lack one).
case "$FILTER_MODE" in
  stable) JQ_SELECT='select(.digest != null and (.name | test("^v[0-9]+\\.[0-9]+\\.[0-9]+$")))' ;;
  all)    JQ_SELECT='select(.digest != null and .name != "latest")' ;;
esac

# Prints the chosen "<tag> <sha256:digest>" to stdout; menu/prompts go to /dev/tty
# so they don't pollute the captured value. $3 = current tag (annotated as such).
# Paginates through Docker Hub (newest first) until TAG_LIST_COUNT matches are
# collected or pages run out — needed for stable tags buried behind many dev builds.
choose_image() {
  local repo="$1" label="$2" current="${3:-}"
  local url="https://hub.docker.com/v2/repositories/${repo}/tags?page_size=100&ordering=last_updated"
  local tags=() digests=() t d resp parsed page=0

  while [ -n "$url" ] && [ "$page" -lt 10 ] && [ "${#tags[@]}" -lt "$TAG_LIST_COUNT" ]; do
    page=$((page + 1))
    resp="$(curl -fsSL "$url")" || { err "Docker Hub query failed for ${repo}"; return 1; }
    parsed="$(printf '%s' "$resp" \
      | jq -r ".results | map(${JQ_SELECT}) | .[] | \"\(.name)\t\(.digest)\"")"
    # heredoc (not process substitution) so the loop runs in this shell and the
    # array appends persist, and so it works even under bash POSIX mode.
    while IFS=$'\t' read -r t d; do
      [ -n "$t" ] || continue
      tags+=("$t"); digests+=("$d")
      [ "${#tags[@]}" -ge "$TAG_LIST_COUNT" ] && break
    done <<EOF
$parsed
EOF
    url="$(printf '%s' "$resp" | jq -r '.next // empty')"
  done

  if [ "${#tags[@]}" -eq 0 ]; then
    err "no ${FILTER_MODE} tags found for ${repo} in the most recent ~1000 tags"
    [ "$FILTER_MODE" = "stable" ] && err "try re-running and choosing 'All tags'"
    return 1
  fi

  {
    echo ""
    echo "Select ${label} version (${repo}) — newest first:"
    local i mark
    for i in "${!tags[@]}"; do
      mark=""
      [ "${tags[$i]}" = "$current" ] && mark="  <- current"
      printf "  %2d) %s%s\n" "$((i + 1))" "${tags[$i]}" "$mark"
    done
  } >/dev/tty

  local sel idx
  while :; do
    printf "Enter number [1-%d] (default 1): " "${#tags[@]}" >/dev/tty
    read -r sel </dev/tty || true
    [ -n "$sel" ] || sel=1
    case "$sel" in
      *[!0-9]*) echo "  Please enter a number." >/dev/tty; continue ;;
    esac
    if [ "$sel" -ge 1 ] && [ "$sel" -le "${#tags[@]}" ]; then idx=$((sel - 1)); break; fi
    echo "  Out of range." >/dev/tty
  done

  printf '%s %s\n' "${tags[$idx]}" "${digests[$idx]}"
}

read -r FE_TAG FE_DIGEST <<<"$(choose_image "$FRONTEND_REPO" frontend "$FE_CUR_TAG")"
[ -n "${FE_TAG:-}" ] && [ -n "${FE_DIGEST:-}" ] && [ "$FE_DIGEST" != "null" ] \
  || die "frontend selection failed"

read -r BE_TAG BE_DIGEST <<<"$(choose_image "$BACKEND_REPO" backend "$BE_CUR_TAG")"
[ -n "${BE_TAG:-}" ] && [ -n "${BE_DIGEST:-}" ] && [ "$BE_DIGEST" != "null" ] \
  || die "backend selection failed"

FE_NEW="${FRONTEND_REPO}:${FE_TAG}@${FE_DIGEST}"
BE_NEW="${BACKEND_REPO}:${BE_TAG}@${BE_DIGEST}"

# --- Step 5: show diff + confirm --------------------------------------------
info ""
info "Compose file: ${COMPOSE_PATH}  (on ${SSH_TARGET})"
info ""
info "frontend:"
info "  current: ${FE_CUR:-<not found>}"
info "  new:     ${FE_NEW}"
info "backend:"
info "  current: ${BE_CUR:-<not found>}"
info "  new:     ${BE_NEW}"
info ""

if [ "$FE_TAG" != "$BE_TAG" ]; then
  info "WARNING: selected frontend (${FE_TAG}) and backend (${BE_TAG}) versions differ."
  info ""
fi

if [ "$FE_CUR" = "$FE_NEW" ] && [ "$BE_CUR" = "$BE_NEW" ]; then
  info "Both images already match the selected versions. Nothing to do."
  exit 0
fi

printf 'Apply update and restart mempool? [y/N] ' >/dev/tty
read -r REPLY </dev/tty || true
case "${REPLY:-}" in
  y|Y) ;;
  *) info "Aborted. No changes made."; exit 0 ;;
esac

# --- Step 6: edit compose file in place over SSH (with backup) --------------
# mempool/frontend: and mempool/backend: are distinct prefixes, so the two
# substitutions never collide. Replace the whole whitespace/quote-delimited token.
REMOTE_EDIT=$(cat <<REMOTE
set -e
cp "$COMPOSE_PATH" "$COMPOSE_PATH.bak"
sed -i \
  -e 's#${FRONTEND_REPO}:[^[:space:]"'\'']*#${FE_NEW}#' \
  -e 's#${BACKEND_REPO}:[^[:space:]"'\'']*#${BE_NEW}#' \
  "$COMPOSE_PATH"
echo "--- updated image lines ---"
grep -E 'image:[[:space:]]*mempool/(frontend|backend):' "$COMPOSE_PATH"
REMOTE
)

info ""
info "Editing compose file on ${SSH_TARGET} (backup: ${COMPOSE_PATH}.bak)..."
ssh "$SSH_TARGET" "$REMOTE_EDIT" || die "failed to edit compose file"

# --- Step 7: trigger the update ---------------------------------------------
info ""
info "Triggering app update..."
ssh "$SSH_TARGET" "umbreld client apps.update.mutate --appId mempool" \
  || die "umbreld update command failed (compose backup at ${COMPOSE_PATH}.bak)"

info ""
info "Done. Mempool updated:"
info "  frontend -> ${FE_TAG}"
info "  backend  -> ${BE_TAG}"
info "Backup of previous compose: ${COMPOSE_PATH}.bak"
