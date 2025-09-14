#!/usr/bin/env bash
set -euo pipefail

# Minimal runner for the docs server (detached)
# Usage: scripts/server.sh start|stop|restart|status|logs|doctor|kill-orphans|open [port]
#   Flags: [--dev] [--nowait] [--kill-orphans] [--anyport] [--wait SECONDS]

PORT="${2:-${PORT:-3000}}"
DEV_MODE=0
NOWAIT=0
KILL_ORPHANS=0
ANYPORT=0
WAIT_SECS=0
if [[ "${3:-}" == "--dev" ]] || [[ "${DEV:-0}" == "1" ]]; then DEV_MODE=1; fi
if [[ "$*" == *"--nowait"* ]] || [[ "${NOWAIT:-0}" == "1" ]]; then NOWAIT=1; fi
if [[ "$*" == *"--kill-orphans"* ]] || [[ "${KILL_ORPHANS:-0}" == "1" ]]; then KILL_ORPHANS=1; fi
if [[ "$*" == *"--anyport"* ]] || [[ "${ANYPORT:-0}" == "1" ]]; then ANYPORT=1; fi
if [[ "$*" == *"--wait "* ]]; then WAIT_SECS=$(echo "$*" | sed -n 's/.*--wait \([0-9][0-9]*\).*/\1/p'); fi
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="/tmp/docs-web-${PORT}.pid"
LOG_FILE="/tmp/docs-web-${PORT}.log"

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null || true)
    if [[ -n "$pid" ]] && ps -p "$pid" >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

kill_group() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null || true)
    if [[ -n "$pid" ]]; then
      kill -- -"$pid" 2>/dev/null || true
      sleep 0.5
      kill -9 -- -"$pid" 2>/dev/null || true
    fi
  fi
}

kill_port() {
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti :"$PORT" -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      echo "Killing processes on port $PORT: $pids"
      echo "$pids" | xargs -r kill -9 || true
    fi
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "$PORT"/tcp || true
  fi
}

kill_orphans() {
  if command -v ps >/dev/null 2>&1; then
    mapfile -t pids < <(ps -eo pid,command | grep -E "next (dev|start)" | grep -F "$APP_DIR" | grep -v grep | awk '{print $1}')
    if (( ${#pids[@]} )); then
      echo "Killing orphan next processes: ${pids[*]}"
      kill -9 "${pids[@]}" 2>/dev/null || true
    fi
  fi
}

start() {
  mkdir -p "$(dirname "$LOG_FILE")"
  echo "Starting docs server (detached), base port $PORT..."
  kill_port || true
  if [[ "$KILL_ORPHANS" -eq 1 ]]; then kill_orphans || true; fi
  if [[ "$DEV_MODE" -ne 1 ]]; then
    # ensure build exists for prod
    (cd "$APP_DIR" && npm run build >/dev/null 2>&1)
  fi
  # attempt ports: exact by default; or multiple when --anyport
  local candidates=("$PORT")
  if [[ "$ANYPORT" -eq 1 ]]; then
    candidates=("$PORT" "$((PORT+1000))" "$((PORT+2000))" 0)
  fi
  for p in "${candidates[@]}"; do
    if [[ "$p" == "0" ]]; then
      # pick a random high port
      p=$(( 40000 + (RANDOM % 20000) ))
    fi
    echo "Trying port $p..."
    : >"$LOG_FILE"
    if [[ "$DEV_MODE" -eq 1 ]]; then
      (cd "$APP_DIR" && nohup setsid env HOST=0.0.0.0 npm run dev -- -p "$p" >>"$LOG_FILE" 2>&1 & echo $! >"$PID_FILE")
    else
      (cd "$APP_DIR" && nohup setsid env HOST=0.0.0.0 npm run start -- -p "$p" >>"$LOG_FILE" 2>&1 & echo $! >"$PID_FILE")
    fi
    # Do not rely on transient parent PID; wait for readiness below
    echo "$p" >"${PID_FILE}.port"
    echo "URL: http://$(hostname -I 2>/dev/null | awk '{print $1}'):$p or http://127.0.0.1:$p"
    if [[ "$NOWAIT" -eq 1 && "$WAIT_SECS" -eq 0 ]]; then
      local pidval=""
      [[ -f "$PID_FILE" ]] && pidval=$(cat "$PID_FILE" 2>/dev/null || true)
      echo "Started (no-wait) on port $p (pid ${pidval}) | logs: $LOG_FILE"; return 0
    fi
    # Wait for readiness (fast and bounded)
    local loops=10
    if [[ "$WAIT_SECS" -gt 0 ]]; then loops=$(( WAIT_SECS * 3 )); fi
    for ((i=1;i<=loops;i++)); do
      if curl -fsS --max-time 1 "http://127.0.0.1:$p/api/tree" >/dev/null 2>&1; then
        local pidval=""
        [[ -f "$PID_FILE" ]] && pidval=$(cat "$PID_FILE" 2>/dev/null || true)
        echo "Started on port $p (pid ${pidval}) | logs: $LOG_FILE"; return 0
      fi
      if grep -q "EADDRINUSE" "$LOG_FILE" 2>/dev/null; then echo "Port $p in use; trying next..."; break; fi
      sleep 0.3
    done
    echo "Failed to confirm readiness on $p; check logs: $LOG_FILE"; tail -n 20 "$LOG_FILE" || true
  done
  echo "Failed to start on available ports. Last logs:"
  tail -n 50 "$LOG_FILE" || true
  exit 1
}

stop() {
  local stopped=0
  if is_running; then
    local pid
    pid=$(cat "$PID_FILE")
    echo "Stopping pid $pid..."
    kill_group || kill "$pid" 2>/dev/null || true
    sleep 1
    if ps -p "$pid" >/dev/null 2>&1; then
      echo "Force killing pid $pid..."
      kill -9 -- -"$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
    stopped=1
  fi
  kill_port || true
  if [[ "$stopped" -eq 1 ]]; then echo "Stopped"; else echo "No running server on $PORT"; fi
}

status() {
  if is_running; then
    local p="unknown"; [[ -f "${PID_FILE}.port" ]] && p=$(cat "${PID_FILE}.port")
    local pidval=""; [[ -f "$PID_FILE" ]] && pidval=$(cat "$PID_FILE" 2>/dev/null || true)
    echo "Running (pid ${pidval}) on port ${p} (base $PORT)"; echo "Log: $LOG_FILE"; tail -n 5 "$LOG_FILE" 2>/dev/null || true
  else
    echo "Not running on port $PORT"; echo "Recent log (if any):"; tail -n 5 "$LOG_FILE" 2>/dev/null || true
  fi
}

logs() {
  if [[ -f "$LOG_FILE" ]]; then
    tail -n 50 "$LOG_FILE"
  else
    echo "No log file at $LOG_FILE"
  fi
}

doctor() {
  echo "Doctor checks for port $PORT"
  if command -v lsof >/dev/null 2>&1; then lsof -ni :"$PORT" -sTCP:LISTEN || true; fi
  if [[ -f "${PID_FILE}.port" ]]; then P=$(cat "${PID_FILE}.port"); else P=$PORT; fi
  echo -n "Health /api/tree: "; curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:$P/api/tree" || true
  echo -n "Health /index.html: "; curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:$P/index.html" || true
  if command -v node >/dev/null 2>&1 && [[ -f "$APP_DIR/scripts/health.mjs" ]]; then
    echo "Running detailed health.mjs..."
    node "$APP_DIR/scripts/health.mjs" "http://127.0.0.1:$P" || true
  fi
}

open_url() {
  if [[ -f "${PID_FILE}.port" ]]; then P=$(cat "${PID_FILE}.port"); else P=$PORT; fi
  echo "URL: http://$(hostname -I 2>/dev/null | awk '{print $1}'):$P or http://127.0.0.1:$P"
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  logs) logs ;;
  doctor) doctor ;;
  kill-orphans) kill_orphans ;;
  open) open_url ;;
  *) echo "Usage: $0 {start|stop|restart|status|logs|doctor|kill-orphans|open} [port] [--dev] [--nowait] [--anyport] [--kill-orphans] [--wait SECONDS]"; exit 2 ;;
esac
