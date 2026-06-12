#!/usr/bin/env bash
# Menu helper for the mempool dev stack (dev/docker-compose.yml).
# Runs bitcoin-cli inside the running bitcoind container, auto-detects
# whether it was started in mainnet or regtest mode, and shells out to
# docker compose for stack-level operations.

set -uo pipefail

echo '╭────────────╮'
echo '│████████████│                                               _ '
echo '│████████████│    _ __ ___   ___ _ __ ___  _ __   ___   ___ | |'
echo '│████████████│   | '\''_ ` _ \ / _ \ '\''_ ` _ \| '\''_ \ / _ \ / _ \| |'
echo '│▒▒▒▒▒▒▒▒▒▒▒▒│   | | | | | |  __/ | | | | | |_) | (_) | (_) | |'
echo '│▒▒▒▒▒▒▒▒▒▒▒▒│   |_| |_| |_|\___|_| |_| |_| .__/ \___/ \___/|_|'
echo '│▒▒▒▒▒▒▒▒▒▒▒▒│                            |_|                  '
echo '╰────────────╯'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
DC=(docker compose -f "$COMPOSE_FILE")

have_jq=0
command -v jq >/dev/null 2>&1 && have_jq=1

bitcoind_cid() {
  "${DC[@]}" ps -q bitcoind 2>/dev/null
}

require_running() {
  local cid
  cid=$(bitcoind_cid)
  if [[ -z "$cid" ]]; then
    echo "bitcoind container is not running."
    echo "Start the stack first (option 2)."
    return 1
  fi
  if ! docker inspect --format '{{.State.Running}}' "$cid" 2>/dev/null | grep -q true; then
    echo "bitcoind container exists but is not running."
    return 1
  fi
}

detect_chain() {
  local cid
  cid=$(bitcoind_cid)
  [[ -z "$cid" ]] && { echo "main"; return; }
  if docker inspect "$cid" --format '{{range .Config.Cmd}}{{println .}}{{end}}' \
     | grep -q 'chain=regtest'; then
    echo "regtest"
  else
    echo "main"
  fi
}

btccli() {
  local cid chain
  cid=$(bitcoind_cid) || return 1
  chain=$(detect_chain)
  if [[ "$chain" == "regtest" ]]; then
    docker exec "$cid" bitcoin-cli -regtest -rpcuser=mempool -rpcpassword=mempool "$@"
  else
    docker exec "$cid" bitcoin-cli -rpcuser=mempool -rpcpassword=mempool "$@"
  fi
}

pretty_json() {
  if [[ $have_jq -eq 1 ]]; then jq .; else cat; fi
}

human_bytes() {
  awk -v b="$1" 'BEGIN {
    split("B KB MB GB TB PB", u);
    i = 1;
    while (b >= 1024 && i < 6) { b /= 1024; i++ }
    printf("%.2f %s\n", b, u[i]);
  }'
}

human_seconds() {
  awk -v s="$1" 'BEGIN {
    if (s < 0) s = 0;
    h = int(s/3600); m = int((s%3600)/60); sec = int(s%60);
    if (h > 0) printf("%dh %dm %ds\n", h, m, sec);
    else if (m > 0) printf("%dm %ds\n", m, sec);
    else printf("%ds\n", sec);
  }'
}

# Render a 20-cell progress bar for a percentage in [0,100].
progress_bar() {
  awk -v p="$1" -v w=20 'BEGIN {
    if (p < 0) p = 0; if (p > 100) p = 100;
    f = int((p/100)*w + 0.5);
    s = "[";
    for (i = 0; i < f; i++) s = s "#";
    for (i = f; i < w; i++) s = s "-";
    s = s "]";
    printf("%s", s);
  }'
}

press_enter() {
  echo
  read -r -p "Press Enter to continue... " _ || true
}

#---------------------------------------------- actions

stack_status() {
  "${DC[@]}" ps
}

stack_up() {
  "${DC[@]}" up -d
}

stack_down() {
  "${DC[@]}" down
}

stack_restart() {
  stack_down && stack_up
}

tail_logs() {
  local svc="$1"
  echo "Tailing logs for '$svc' (Ctrl-C to stop)..."
  "${DC[@]}" logs -f --tail=100 "$svc" || true
}

sync_status() {
  require_running || return
  local info
  info=$(btccli -rpcclienttimeout=10 getblockchaininfo 2>/dev/null) || {
    echo "RPC not responding yet (bitcoind may still be starting)."
    return
  }

  if [[ $have_jq -eq 1 ]]; then
    local chain blocks headers progress ibd pruned size_bytes diff best_hash best_time
    chain=$(jq -r .chain <<<"$info")
    blocks=$(jq -r .blocks <<<"$info")
    headers=$(jq -r .headers <<<"$info")
    progress=$(jq -r .verificationprogress <<<"$info")
    ibd=$(jq -r .initialblockdownload <<<"$info")
    pruned=$(jq -r .pruned <<<"$info")
    size_bytes=$(jq -r .size_on_disk <<<"$info")
    diff=$(jq -r .difficulty <<<"$info")
    best_hash=$(jq -r .bestblockhash <<<"$info")
    best_time=$(jq -r .time <<<"$info")

    local now age verify_pct block_pct
    now=$(date +%s)
    age=$(( now - best_time ))
    verify_pct=$(awk -v p="$progress" 'BEGIN{ printf("%.4f", p*100) }')
    if [[ "$headers" -gt 0 ]]; then
      block_pct=$(awk -v b="$blocks" -v h="$headers" 'BEGIN{ printf("%.2f", (b/h)*100) }')
    else
      block_pct="0.00"
    fi

    printf "Chain:                %s\n" "$chain"
    printf "Sync (verified):      %s%% %s\n" "$verify_pct" "$(progress_bar "$verify_pct")"
    printf "Blocks / headers:     %s / %s  (%s%% %s)\n" \
      "$blocks" "$headers" "$block_pct" "$(progress_bar "$block_pct")"
    printf "Initial download:     %s\n" "$ibd"
    printf "Pruned:               %s\n" "$pruned"
    printf "Chain size on disk:   %s\n" "$(human_bytes "$size_bytes")"
    printf "Difficulty:           %s\n" "$diff"
    printf "Best block:           %s\n" "$best_hash"
    printf "Last block age:       %s\n" "$(human_seconds "$age")"

    # Halving info — skip regtest (halving interval is not meaningful there).
    if [[ "$chain" != "regtest" && "$blocks" -ge 0 ]]; then
      local epoch reward next_halving blocks_left eta_seconds
      epoch=$(( blocks / 210000 ))
      next_halving=$(( (epoch + 1) * 210000 ))
      blocks_left=$(( next_halving - blocks ))
      eta_seconds=$(( blocks_left * 600 ))
      reward=$(awk -v e="$epoch" 'BEGIN{ printf("%.8f", 50.0 / (2^e)) }')
      printf "Block subsidy:        %s BTC (epoch %d)\n" "$reward" "$epoch"
      printf "Next halving:         block %d  (%d blocks, ~%s @ 10min/blk)\n" \
        "$next_halving" "$blocks_left" "$(human_seconds "$eta_seconds")"
    fi

    if [[ "$ibd" == "true" ]]; then
      echo
      echo "Note: 'verified' is chainwork-weighted and lags during IBD because"
      echo "      most of the chain's work sits in recent blocks. The blocks/"
      echo "      headers ratio gives a closer feel for download progress."
    fi
  else
    echo "$info"
  fi
}

network_info() {
  require_running || return
  local netinfo peerinfo
  netinfo=$(btccli getnetworkinfo 2>/dev/null) || { echo "RPC error."; return; }
  peerinfo=$(btccli getpeerinfo 2>/dev/null) || peerinfo="[]"

  if [[ $have_jq -eq 1 ]]; then
    printf "Subversion:           %s\n" "$(jq -r .subversion <<<"$netinfo")"
    printf "Protocol version:     %s\n" "$(jq -r .protocolversion <<<"$netinfo")"
    printf "Connections:          %s in / %s out (total %s)\n" \
      "$(jq -r .connections_in <<<"$netinfo")" \
      "$(jq -r .connections_out <<<"$netinfo")" \
      "$(jq -r .connections <<<"$netinfo")"
    printf "Network active:       %s\n" "$(jq -r .networkactive <<<"$netinfo")"
    # Bitcoin Core 31 removed `startingheight` from getpeerinfo. Use the new
    # synced_headers / synced_blocks fields on >= 31, fall back otherwise.
    local core_version
    core_version=$(jq -r '.version' <<<"$netinfo")
    if [[ "$core_version" -ge 310000 ]]; then
      printf "\nTop peers:\n"
      {
        printf 'HEADERS\tBLOCKS\tSUBVER\n'
        jq -r '.[] | "\(.synced_headers)\t\(.synced_blocks)\t\(.subver)"' <<<"$peerinfo" | head -10
      } | column -t -s $'\t' | sed 's/^/  /'
    else
      printf "\nTop peers:\n"
      {
        printf 'HEIGHT\tSUBVER\n'
        jq -r '.[] | "\(.startingheight)\t\(.subver)"' <<<"$peerinfo" | head -10
      } | column -t -s $'\t' | sed 's/^/  /'
    fi
  else
    echo "$netinfo"
  fi
}

mempool_info() {
  require_running || return
  local info
  info=$(btccli getmempoolinfo 2>/dev/null) || { echo "RPC error."; return; }

  if [[ $have_jq -eq 1 ]]; then
    printf "Loaded:               %s\n" "$(jq -r .loaded <<<"$info")"
    printf "Tx count:             %s\n" "$(jq -r .size <<<"$info")"
    printf "Bytes:                %s\n" "$(human_bytes "$(jq -r .bytes <<<"$info")")"
    printf "Memory used:          %s\n" "$(human_bytes "$(jq -r .usage <<<"$info")")"
    printf "Total fee (BTC):      %s\n" "$(jq -r .total_fee <<<"$info")"
    printf "Min relay fee:        %s\n" "$(jq -r .minrelaytxfee <<<"$info")"
    printf "Mempool min fee:      %s\n" "$(jq -r .mempoolminfee <<<"$info")"
    printf "Max mempool:          %s\n" "$(human_bytes "$(jq -r .maxmempool <<<"$info")")"

    # Fee estimates (sats/vB) for common confirmation targets.
    printf "\nFee estimates (sat/vB):\n"
    local target btcperkb satvb
    for target in 1 3 6 25 144; do
      btcperkb=$(btccli estimatesmartfee "$target" 2>/dev/null | jq -r '.feerate // empty' 2>/dev/null)
      if [[ -n "$btcperkb" ]]; then
        # BTC/kB -> sat/vB == BTC/kB * 1e8 / 1000 == BTC/kB * 1e5
        satvb=$(awk -v f="$btcperkb" 'BEGIN{ printf("%.2f", f*1e5) }')
        printf "  next %3d blocks:    %s\n" "$target" "$satvb"
      else
        printf "  next %3d blocks:    (no estimate yet)\n" "$target"
      fi
    done
  else
    echo "$info"
  fi
}

index_status() {
  require_running || return
  local info
  info=$(btccli getindexinfo 2>/dev/null) || { echo "RPC error."; return; }
  if [[ "$info" == "{}" || -z "$info" ]]; then
    echo "No indexes configured."
    return
  fi
  if [[ $have_jq -eq 1 ]]; then
    jq -r 'to_entries[] | "  \(.key): synced=\(.value.synced)  best_height=\(.value.best_block_height)"' <<<"$info"
  else
    echo "$info"
  fi
}

latest_block() {
  require_running || return
  local hash block
  hash=$(btccli getbestblockhash 2>/dev/null | tr -d '\r\n') || { echo "RPC error."; return; }
  block=$(btccli getblock "$hash" 1 2>/dev/null) || { echo "RPC error."; return; }

  if [[ $have_jq -eq 1 ]]; then
    printf "Hash:                 %s\n" "$(jq -r .hash <<<"$block")"
    printf "Height:               %s\n" "$(jq -r .height <<<"$block")"
    printf "Time:                 %s (%s)\n" "$(jq -r .time <<<"$block")" \
      "$(date -r "$(jq -r .time <<<"$block")" 2>/dev/null || date -d "@$(jq -r .time <<<"$block")")"
    printf "Tx count:             %s\n" "$(jq -r .nTx <<<"$block")"
    printf "Size:                 %s\n" "$(human_bytes "$(jq -r .size <<<"$block")")"
    printf "Weight:               %s WU\n" "$(jq -r .weight <<<"$block")"
    printf "Difficulty:           %s\n" "$(jq -r .difficulty <<<"$block")"
    printf "Miner (coinbase):     see 'getblock %s 2' for full tx list\n" "$hash"
  else
    echo "$block"
  fi
}

datadir_usage() {
  require_running || return
  local cid
  cid=$(bitcoind_cid)
  echo "Bitcoin datadir:"
  docker exec "$cid" du -sh /home/bitcoin/.bitcoin 2>/dev/null \
    || echo "  (failed to read)"
  echo
  # Enumerate every entry (dirs + files, including dotfiles) sorted by size.
  # NOTE: this datadir is also where sibling host directories show up — e.g.
  # the electrs DB volumes mounted as ~/bitcoin/mainnet/electrs-* will appear
  # here as /home/bitcoin/.bitcoin/electrs-* from inside the bitcoind container.
  echo "All entries (sorted by size):"
  docker exec "$cid" sh -c '
    cd /home/bitcoin/.bitcoin 2>/dev/null || exit 0
    du -sh -- * .[!.]* ..?* 2>/dev/null | sort -rh
  ' 2>/dev/null | sed 's|^|  |' || true
}

cli_passthrough() {
  require_running || return
  echo "Type a bitcoin-cli command (without 'bitcoin-cli'); blank to cancel."
  echo "Examples:  getblockcount   |   getblockhash 700000   |   help getrawmempool"
  read -r -p "> " line
  [[ -z "$line" ]] && return
  # shellcheck disable=SC2086
  btccli $line | pretty_json
}

electrs_info() {
  local cid status
  cid=$("${DC[@]}" ps -q electrs 2>/dev/null)
  if [[ -z "$cid" ]]; then
    echo "electrs container is not running."
    return
  fi
  status=$(docker inspect "$cid" --format '{{.State.Status}} (started {{.State.StartedAt}})' 2>/dev/null || echo "unknown")
  printf "Container:            %s\n" "$status"

  # Detect fork: mempool/electrs sets --http-addr; romanz/electrs does not.
  local cmd fork
  cmd=$(docker inspect "$cid" --format '{{range .Config.Cmd}}{{println .}}{{end}}' 2>/dev/null)
  if grep -q -- '--http-addr' <<<"$cmd"; then
    fork="mempool/electrs (esplora HTTP + Electrum RPC)"
  else
    fork="romanz/electrs (Electrum RPC only)"
  fi
  printf "Fork:                 %s\n" "$fork"

  # esplora-style HTTP REST API (mempool fork only)
  local indexed_tip="" indexed_hash=""
  local http_resp
  http_resp=$(curl -sS --max-time 5 http://localhost:3000/blocks/tip/height 2>/dev/null || echo "")
  if [[ -n "$http_resp" ]]; then
    indexed_tip="$http_resp"
    indexed_hash=$(curl -sS --max-time 5 http://localhost:3000/blocks/tip/hash 2>/dev/null || echo "")
    printf "HTTP API (3000):      reachable\n"
  else
    printf "HTTP API (3000):      not reachable\n"
  fi

  # Electrum RPC — probe both common ports (mainnet 50001/50002, regtest 60401).
  local electrum_port=""
  for p in 50002 50001 60401; do
    if (echo > "/dev/tcp/localhost/$p") >/dev/null 2>&1; then
      electrum_port="$p"; break
    fi
  done
  if [[ -n "$electrum_port" ]]; then
    printf "Electrum RPC:         reachable on :%s\n" "$electrum_port"
    # Fall back to Electrum protocol for the tip when HTTP API is absent.
    if [[ -z "$indexed_tip" && $have_jq -eq 1 ]] && command -v nc >/dev/null 2>&1; then
      local resp
      resp=$(printf '{"id":1,"method":"blockchain.headers.subscribe","params":[]}\n' \
              | nc -w 3 localhost "$electrum_port" 2>/dev/null | head -1)
      if [[ -n "$resp" ]]; then
        indexed_tip=$(jq -r '.result.height // empty' <<<"$resp" 2>/dev/null)
      fi
    fi
  else
    printf "Electrum RPC:         not reachable on 50001/50002/60401\n"
  fi

  if [[ -n "$indexed_tip" ]]; then
    printf "Indexed tip height:   %s\n" "$indexed_tip"
    [[ -n "$indexed_hash" ]] && printf "Indexed tip hash:     %s\n" "$indexed_hash"
    if require_running >/dev/null 2>&1; then
      local btc_tip lag
      btc_tip=$(btccli getblockcount 2>/dev/null | tr -d '\r\n')
      if [[ -n "$btc_tip" ]]; then
        lag=$(( btc_tip - indexed_tip ))
        printf "Bitcoind tip:         %s\n" "$btc_tip"
        printf "Lag (blocks behind):  %s\n" "$lag"
      fi
    fi
  fi

  # Disk usage — read from inside the container; works for any fork or path.
  local total
  total=$(docker exec "$cid" du -sh /electrs-db 2>/dev/null | cut -f1)
  if [[ -n "$total" ]]; then
    printf "Index DB on disk:     %s  (container path /electrs-db)\n" "$total"
    local sub
    sub=$(docker exec "$cid" sh -c 'du -sh /electrs-db/*/ 2>/dev/null | sort -rh' 2>/dev/null)
    if [[ -n "$sub" ]]; then
      printf "Index DB sub-dirs:\n"
      sed 's|^|  |' <<<"$sub"
    fi
  else
    printf "Index DB on disk:     (could not stat /electrs-db inside container)\n"
  fi

  # Container resource usage — one-shot, ~1s.
  local stats
  stats=$(docker stats --no-stream --format '{{.CPUPerc}} cpu, {{.MemUsage}} ({{.MemPerc}})' "$cid" 2>/dev/null)
  [[ -n "$stats" ]] && printf "Resource usage:       %s\n" "$stats"
}

section() {
  echo
  printf -- '== %s ' "$1"
  local pad=$(( 50 - ${#1} ))
  (( pad < 4 )) && pad=4
  printf -- '=%.0s' $(seq 1 "$pad")
  echo
}

overall_status() {
  section "STACK"
  stack_status

  if ! require_running >/dev/null 2>&1; then
    echo
    echo "(bitcoind not running — skipping bitcoin sections)"
  else
    section "SYNC"
    sync_status
    section "NETWORK & PEERS"
    network_info
    section "MEMPOOL"
    mempool_info
    section "INDEXES"
    index_status
    section "UTXO SET"
    utxo_set
    section "LATEST BLOCK"
    latest_block
    section "DATA-DIR USAGE"
    datadir_usage
  fi

  section "ELECTRS"
  electrs_info

  section "DATABASE"
  db_ping

  section "RESOURCE USAGE"
  container_stats
}

db_ping() {
  local cid
  cid=$("${DC[@]}" ps -q db 2>/dev/null)
  if [[ -z "$cid" ]]; then
    echo "db container is not running."
    return
  fi
  docker exec "$cid" mysqladmin ping -h localhost -u mempool -pmempool 2>&1
}

# UTXO set summary — fast when -coinstatsindex is enabled (it is, in this compose).
utxo_set() {
  require_running || return
  local info
  info=$(btccli gettxoutsetinfo none 2>/dev/null) || {
    echo "RPC error (coinstatsindex may still be syncing)."
    return
  }
  if [[ $have_jq -eq 1 ]]; then
    printf "Height:               %s\n" "$(jq -r .height <<<"$info")"
    printf "Best block:           %s\n" "$(jq -r .bestblock <<<"$info")"
    printf "UTXOs:                %s\n" "$(jq -r .txouts <<<"$info")"
    printf "Transactions:         %s\n" "$(jq -r '.transactions // "n/a"' <<<"$info")"
    printf "Total amount:         %s BTC\n" "$(jq -r .total_amount <<<"$info")"
    printf "Total unspendable:    %s BTC\n" "$(jq -r '.total_unspendable_amount // "n/a"' <<<"$info")"
    if jq -e '.block_info' <<<"$info" >/dev/null 2>&1; then
      printf "\nLast block (%s):\n" "$(jq -r .height <<<"$info")"
      printf "  Coinbase out:       %s BTC\n" "$(jq -r '.block_info.coinbase // "n/a"' <<<"$info")"
      printf "  Inputs spent:       %s BTC\n" "$(jq -r '.block_info.prevout_spent // "n/a"' <<<"$info")"
      printf "  Outputs (ex-cb):    %s BTC\n" "$(jq -r '.block_info.new_outputs_ex_coinbase // "n/a"' <<<"$info")"
      printf "  Unspendable burned: %s BTC\n" "$(jq -r '.block_info.unspendable // "n/a"' <<<"$info")"
    fi
  else
    echo "$info"
  fi
}

# CPU / memory / IO snapshot for every container in the stack.
container_stats() {
  local ids
  ids=$("${DC[@]}" ps -q 2>/dev/null)
  if [[ -z "$ids" ]]; then
    echo "No stack containers running."
    return
  fi
  # shellcheck disable=SC2086
  docker stats --no-stream \
    --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}' \
    $ids
}

#---------------------------------------------- menu

show_menu() {
  local chain="(stack down)"
  if [[ -n "$(bitcoind_cid)" ]]; then
    chain=$(detect_chain)
  fi
  cat <<EOF

==============================================
  mempool dev stack helper       chain: $chain
==============================================

  Quick:
    0) Snapshot — everything at a glance

  Stack:
    1) Status                      (docker compose ps)
    2) Start stack                 (up -d)
    3) Stop stack                  (down)
    4) Restart stack               (down, then up -d)
    5) Tail bitcoind logs
    6) Tail electrs logs

  Bitcoin:
    7) Sync status
    8) Network & peers
    9) Mempool info
   10) Index status (txindex / coinstatsindex)
   11) Latest block
   12) Data-dir disk usage
   13) bitcoin-cli passthrough

  Other:
   14) Electrs info
   15) MariaDB ping
   16) UTXO set / coin stats   (uses coinstatsindex, fast)
   17) Container resource usage (docker stats snapshot)

    q) Quit

EOF
}

main() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "Compose file not found at $COMPOSE_FILE" >&2
    exit 1
  fi
  while true; do
    show_menu
    read -r -p "Choice: " choice
    echo
    case "$choice" in
      0) overall_status ;;
      1) stack_status ;;
      2) stack_up ;;
      3) stack_down ;;
      4) stack_restart ;;
      5) tail_logs bitcoind ;;
      6) tail_logs electrs ;;
      7) sync_status ;;
      8) network_info ;;
      9) mempool_info ;;
      10) index_status ;;
      11) latest_block ;;
      12) datadir_usage ;;
      13) cli_passthrough ;;
      14) electrs_info ;;
      15) db_ping ;;
      16) utxo_set ;;
      17) container_stats ;;
      q|Q|quit|exit) echo "Bye."; exit 0 ;;
      "") continue ;;
      *) echo "Unknown option: $choice" ;;
    esac
    press_enter
  done
}

main "$@"
