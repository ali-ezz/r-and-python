#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════
# 5*A App - Unified Run Script
# Usage: ./run.sh [start|start-bg|up|stop|restart|status]
# ═══════════════════════════════════════════

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/five_star_a/backend"
FRONTEND_DIR="$ROOT_DIR/five_star_a/frontend_new"
SEARCH_DIR="$ROOT_DIR/5A_Search"
VENV_DIR="$BACKEND_DIR/.venv"
LOG_DIR="$ROOT_DIR/.run_logs"
PID_DIR="$ROOT_DIR/.run_pids"

OS_TYPE="$(uname)"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-2000}"
SEARCH_PORT="${SEARCH_PORT:-5173}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"
SKIP_TESTS="${SKIP_TESTS:-0}"
SKIP_SEARCH="${SKIP_SEARCH:-0}"
SKIP_DOCKER="${SKIP_DOCKER:-0}"
DOCKER_WAIT_SECONDS="${DOCKER_WAIT_SECONDS:-120}"

RUNTIME_DATABASE_URL="${DATABASE_URL_OVERRIDE:-}"

BACKEND_PID=""
FRONTEND_PID=""
SEARCH_PID=""

mkdir -p "$LOG_DIR" "$PID_DIR"

# ═══════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════

show_usage() {
  cat <<EOF
5*A Application Manager

Usage: $0 <command>

Commands:
  start          Start all services in foreground (Ctrl+C stops all)
  start-bg, up   Start all services in background
  stop           Stop all running servers
  restart        Restart all servers
  status         Show running processes

Environment Variables:
  BACKEND_PORT        Backend port (default: 8000)
  FRONTEND_PORT       Frontend port (default: 2000)
  SEARCH_PORT         Search port (default: 5173)
  SKIP_INSTALL        Skip pip install (set to 1)
  SKIP_TESTS          Skip tests (set to 1)
  SKIP_SEARCH         Skip search engine (set to 1)
  SKIP_DOCKER         Skip Docker startup/check (set to 1)
  DOCKER_WAIT_SECONDS Seconds to wait for Docker daemon (default: 120)
  DATABASE_URL_OVERRIDE  Custom database URL

Examples:
  $0 start
  $0 start-bg
  $0 stop
  SKIP_SEARCH=1 $0 start
EOF
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

ensure_prerequisites() {
  if ! command_exists python3; then
    echo "[ERROR] python3 is required"
    exit 1
  fi
  if ! command_exists curl; then
    echo "[ERROR] curl is required"
    exit 1
  fi
  if ! command_exists npm; then
    echo "[ERROR] npm is required"
    exit 1
  fi
}

wait_for_docker() {
  local waited=0
  while (( waited < DOCKER_WAIT_SECONDS )); do
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
  done
  return 1
}

ensure_docker_running() {
  if [[ "$SKIP_DOCKER" == "1" ]]; then
    echo "==> Docker checks skipped (SKIP_DOCKER=1)"
    return 1
  fi

  if ! command_exists docker; then
    echo "[WARN] Docker CLI not found; continuing without Docker services"
    return 1
  fi

  if docker info >/dev/null 2>&1; then
    echo "==> Docker daemon is already running"
    return 0
  fi

  echo "==> Docker daemon is not running. Attempting to start Docker..."
  if [[ "$OS_TYPE" == "Darwin" ]]; then
    if command_exists open; then
      open -a Docker >/dev/null 2>&1 || true
    fi
  elif [[ "$OS_TYPE" == "Linux" ]]; then
    if command_exists systemctl; then
      echo "    Attempting to start docker service via systemctl..."
      sudo systemctl start docker >/dev/null 2>&1 || true
    fi
  fi

  if wait_for_docker; then
    echo "[OK] Docker daemon is running"
    return 0
  fi

  echo "[WARN] Docker daemon did not become ready in ${DOCKER_WAIT_SECONDS}s"
  if [[ "$OS_TYPE" == "Linux" ]]; then
    echo "    Try running: sudo systemctl start docker"
  fi
  return 1
}

venv_is_broken() {
  if [[ ! -x "$VENV_DIR/bin/python" || ! -f "$VENV_DIR/bin/pip" ]]; then
    return 0
  fi

  local shebang
  shebang=$(head -n 1 "$VENV_DIR/bin/pip" 2>/dev/null || true)
  if [[ "$shebang" == \#\!* ]]; then
    local interpreter="${shebang#\#!}"
    if [[ ! -x "$interpreter" ]]; then
      return 0
    fi
  fi

  return 1
}

is_port_open() {
  local host="$1"
  local port="$2"
  python3 - "$host" "$port" <<'PY' >/dev/null 2>&1
import socket, sys
host = sys.argv[1]
port = int(sys.argv[2])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(0.7)
try:
    s.connect((host, port))
    sys.exit(0)
except Exception:
    sys.exit(1)
finally:
    s.close()
PY
}

ensure_node_dependencies() {
  local app_dir="$1"
  local label="$2"

  if [[ ! -f "$app_dir/package.json" ]]; then
    echo "[WARN] $label has no package.json, skipping npm install"
    return 0
  fi

  if ! command_exists npm; then
    echo "[ERROR] npm is required for $label but was not found"
    exit 1
  fi

  if [[ "$SKIP_INSTALL" == "1" ]]; then
    echo "==> Skipping npm install for $label (SKIP_INSTALL=1)"
    return 0
  fi

  echo "==> Installing/updating npm dependencies for $label"
  (cd "$app_dir" && npm install --silent)
}

is_running() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid=$(cat "$pid_file" 2>/dev/null || true)
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

stop_if_running() {
  local pid="$1"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
  fi
}

kill_port_listener() {
  local port="$1"
  if command_exists lsof; then
    local pids
    pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      kill $pids >/dev/null 2>&1 || true
    fi
  fi
}

clear_stale_instances() {
  if [[ -f "$PID_DIR/backend.pid" ]]; then
    stop_if_running "$(cat "$PID_DIR/backend.pid" 2>/dev/null || true)"
    rm -f "$PID_DIR/backend.pid"
  fi

  if [[ -f "$PID_DIR/frontend.pid" ]]; then
    stop_if_running "$(cat "$PID_DIR/frontend.pid" 2>/dev/null || true)"
    rm -f "$PID_DIR/frontend.pid"
  fi

  if [[ -f "$PID_DIR/search.pid" ]]; then
    stop_if_running "$(cat "$PID_DIR/search.pid" 2>/dev/null || true)"
    rm -f "$PID_DIR/search.pid"
  fi

  pkill -f "uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT" >/dev/null 2>&1 || true
  kill_port_listener "$BACKEND_PORT"
  kill_port_listener "$FRONTEND_PORT"
  kill_port_listener "$SEARCH_PORT"
}

cleanup() {
  set +e
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null
  fi

  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null
  fi

  if [[ -n "$SEARCH_PID" ]] && kill -0 "$SEARCH_PID" 2>/dev/null; then
    kill "$SEARCH_PID" 2>/dev/null
  fi
}

# ═══════════════════════════════════════════
# Commands
# ═══════════════════════════════════════════

do_start() {
  local run_mode="${1:-foreground}"

  ensure_prerequisites
  clear_stale_instances

  local docker_ready=0
  if ensure_docker_running; then
    docker_ready=1
    if [[ -f "$ROOT_DIR/docker-compose.yml" ]]; then
      echo "==> Starting Docker services (postgres, redis, search)"
      (cd "$ROOT_DIR" && docker compose up -d postgres redis search)
    fi
  else
    echo "==> Continuing without Docker-managed services"
  fi

  echo "==> Preparing backend environment"
  if [[ -d "$VENV_DIR" && venv_is_broken ]]; then
    echo "    Removing stale virtual environment with invalid interpreter paths..."
    rm -rf "$VENV_DIR"
  fi

  if [[ ! -d "$VENV_DIR" ]]; then
    echo "    Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
  fi

  if [[ ! -f "$BACKEND_DIR/.env" && -f "$BACKEND_DIR/.env.example" ]]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  fi

  if [[ "$SKIP_INSTALL" != "1" ]]; then
    echo "    Installing dependencies..."
    if ! "$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt" --quiet; then
      echo "[ERROR] Failed to install backend dependencies"
      exit 1
    fi
  fi

  ensure_node_dependencies "$FRONTEND_DIR" "five_star_a frontend_new"
  if [[ "$SKIP_SEARCH" != "1" && -d "$SEARCH_DIR" ]]; then
    ensure_node_dependencies "$SEARCH_DIR" "5A_Search"
  fi

  if [[ -z "$RUNTIME_DATABASE_URL" ]]; then
    if is_port_open "127.0.0.1" "5432"; then
      RUNTIME_DATABASE_URL="postgresql://user:password@localhost:5432/five_star_a"
    else
      RUNTIME_DATABASE_URL="sqlite:///./five_star_a.db"
      echo "    PostgreSQL not reachable, using SQLite fallback"
    fi
  fi

  export DATABASE_URL="$RUNTIME_DATABASE_URL"

  if [[ "$SKIP_TESTS" != "1" ]]; then
    echo "==> Running backend tests (SKIP_TESTS=1 to skip)"
    (cd "$BACKEND_DIR" && "$VENV_DIR/bin/pytest" -q --tb=line 2>&1 | tail -10)
  else
    echo "    Tests skipped (SKIP_TESTS=1)"
  fi

  echo
  echo "==> Starting backend server on port $BACKEND_PORT"
  (
    cd "$BACKEND_DIR"
    exec "$VENV_DIR/bin/uvicorn" app.main:app --host 0.0.0.0 --port "$BACKEND_PORT"
  ) >"$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID="$!"
  echo "$BACKEND_PID" >"$PID_DIR/backend.pid"

  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "[ERROR] Backend process exited immediately. Check logs:"
    tail -n 80 "$LOG_DIR/backend.log" || true
    exit 1
  fi

  echo "    Waiting for backend health..."
  backend_ready=0
  for i in $(seq 1 45); do
    if curl -fsS "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then
      backend_ready=1
      break
    fi
    if (( i % 10 == 0 )); then
      echo "    ... still waiting ($i/45)"
    fi
    sleep 1
  done

  if [[ "$backend_ready" != "1" ]]; then
    echo "[ERROR] Backend failed health check. Check logs:"
    tail -n 80 "$LOG_DIR/backend.log" || true
    exit 1
  fi

  echo "[OK] Backend started (PID: $BACKEND_PID)"

  echo "==> Starting frontend server on port $FRONTEND_PORT"
  (
    cd "$FRONTEND_DIR"
    export PATH="./node_modules/.bin:$PATH"
    unset NODE_ENV
    exec npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" 2>&1
  ) >"$LOG_DIR/frontend.log" 2>&1 &
  FRONTEND_PID="$!"
  echo "$FRONTEND_PID" >"$PID_DIR/frontend.pid"

  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "[ERROR] Frontend process exited immediately"
    exit 1
  fi

  sleep 2

  if [[ "$docker_ready" != "1" && "$SKIP_SEARCH" != "1" && -d "$SEARCH_DIR" ]]; then
    echo "==> Starting search engine on port $SEARCH_PORT"
    (
      cd "$SEARCH_DIR"
      export PATH="./node_modules/.bin:$PATH"
      unset NODE_ENV
      exec npx vite --host 0.0.0.0 --port "$SEARCH_PORT" 2>&1
    ) >"$LOG_DIR/search.log" 2>&1 &
    SEARCH_PID="$!"
    echo "$SEARCH_PID" >"$PID_DIR/search.pid"

    if ! kill -0 "$SEARCH_PID" 2>/dev/null; then
      echo "[WARN] Search process exited immediately"
    fi
  fi

  sleep 1

  echo
  echo "=========================================================="
  echo " 5*A Application Started Successfully"
  echo "=========================================================="
  echo
  echo "  5*A Frontend:  http://127.0.0.1:$FRONTEND_PORT"
  echo "  Backend:   http://127.0.0.1:$BACKEND_PORT"
  echo "  API Docs:  http://127.0.0.1:$BACKEND_PORT/docs"
  echo "  Health:    http://127.0.0.1:$BACKEND_PORT/health"
  echo "  Metrics:   http://127.0.0.1:$BACKEND_PORT/system/metrics"
  echo "  Monitoring page: http://127.0.0.1:$FRONTEND_PORT/monitoring"
  if [[ "$SKIP_SEARCH" != "1" && -d "$SEARCH_DIR" ]]; then
    echo "  Search:    http://127.0.0.1:$SEARCH_PORT"
  fi
  if [[ "$docker_ready" == "1" ]]; then
    echo "  Docker:    postgres+redis started via docker compose"
    echo "  Full monitoring stack: docker compose up -d"
  fi
  echo
  echo "  Default Admin:"
  echo "     Email: admin@5stara.com"
  echo "     Password: admin12345"
  echo
  echo "=========================================================="
  echo
  echo "  Press Ctrl+C to stop all servers"
  echo "  Or run: ./run.sh stop"
  echo "=========================================================="
  echo

  if [[ "$run_mode" == "background" ]]; then
    echo "Running in background mode. Use './run.sh status' or './run.sh stop'."
    return 0
  fi

  trap cleanup EXIT INT TERM
  if [[ -n "$SEARCH_PID" ]]; then
    wait "$BACKEND_PID" "$FRONTEND_PID" "$SEARCH_PID"
  else
    wait "$BACKEND_PID" "$FRONTEND_PID"
  fi
}

do_stop() {
  echo "==> Stopping 5*A application..."

  local stopped=0

  if is_running "$PID_DIR/backend.pid"; then
    local pid
    pid=$(cat "$PID_DIR/backend.pid" 2>/dev/null || true)
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
      echo "[OK] Backend stopped (PID: $pid)"
      stopped=1
    fi
    rm -f "$PID_DIR/backend.pid"
  fi

  if is_running "$PID_DIR/frontend.pid"; then
    local pid
    pid=$(cat "$PID_DIR/frontend.pid" 2>/dev/null || true)
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
      echo "[OK] Frontend stopped (PID: $pid)"
      stopped=1
    fi
    rm -f "$PID_DIR/frontend.pid"
  fi

  if is_running "$PID_DIR/search.pid"; then
    local pid
    pid=$(cat "$PID_DIR/search.pid" 2>/dev/null || true)
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
      echo "[OK] Search stopped (PID: $pid)"
      stopped=1
    fi
    rm -f "$PID_DIR/search.pid"
  fi

  # Kill any remaining listeners on managed ports
  kill_port_listener "$BACKEND_PORT"
  kill_port_listener "$FRONTEND_PORT"
  kill_port_listener "$SEARCH_PORT"

  if [[ "$SKIP_DOCKER" != "1" ]] && command_exists docker && [[ -f "$ROOT_DIR/docker-compose.yml" ]]; then
    (cd "$ROOT_DIR" && docker compose stop postgres redis search >/dev/null 2>&1 || true)
  fi

  if [[ "$stopped" -eq 0 ]]; then
    echo "[INFO]  No running processes found"
  else
    echo "[OK] Application stopped"
  fi
}

do_status() {
  echo "═══════════════════════════════════════════"
  echo " 5*A Application Status"
  echo "═══════════════════════════════════════════"

  if is_running "$PID_DIR/backend.pid"; then
    local pid
    pid=$(cat "$PID_DIR/backend.pid" 2>/dev/null || true)
    echo "[OK] Backend:  Running (PID: $pid, Port: $BACKEND_PORT)"
    echo "   URL:    http://127.0.0.1:$BACKEND_PORT"
    echo "   Health: http://127.0.0.1:$BACKEND_PORT/health"
    
    # Check health endpoint
    local health_response
    health_response=$(curl -s "http://127.0.0.1:$BACKEND_PORT/health" 2>/dev/null || echo '{"status":"error"}')
    local health_status
    health_status=$(echo "$health_response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    if [[ "$health_status" == "ok" ]]; then
      echo "   Status: [OK] Healthy - $health_response"
    else
      echo "   Status: [ERROR] Unhealthy - $health_response"
    fi
  else
    echo "[ERROR] Backend:  Stopped"
    echo "   Status: Not running"
  fi

  echo

  if is_running "$PID_DIR/frontend.pid"; then
    local pid
    pid=$(cat "$PID_DIR/frontend.pid" 2>/dev/null || true)
    echo "[OK] Frontend: Running (PID: $pid, Port: $FRONTEND_PORT)"
    echo "   URL:    http://127.0.0.1:$FRONTEND_PORT"
    
    # Check if frontend is accessible
    if curl -fsS "http://127.0.0.1:$FRONTEND_PORT" >/dev/null 2>&1; then
      echo "   Status: [OK] Accessible"
    else
      echo "   Status: [WARN]  Not responding"
    fi
  else
    echo "[ERROR] Frontend: Stopped"
    echo "   Status: Not running"
  fi

  echo

  if is_running "$PID_DIR/search.pid"; then
    local pid
    pid=$(cat "$PID_DIR/search.pid" 2>/dev/null || true)
    echo "[OK] Search: Running (PID: $pid, Port: $SEARCH_PORT)"
    echo "   URL:    http://127.0.0.1:$SEARCH_PORT"
    if curl -fsS "http://127.0.0.1:$SEARCH_PORT" >/dev/null 2>&1; then
      echo "   Status: [OK] Accessible"
    else
      echo "   Status: [WARN] Not responding"
    fi
  else
    echo "[INFO] Search: Stopped (use SKIP_SEARCH=0 to enable)"
  fi

  echo
  if [[ "$SKIP_DOCKER" != "1" ]] && command_exists docker && [[ -f "$ROOT_DIR/docker-compose.yml" ]]; then
    echo "Docker services:"
    (cd "$ROOT_DIR" && docker compose ps postgres redis 2>/dev/null || true)
    echo
  fi

  echo "Logs: $LOG_DIR"
  echo "=========================================================="
}

# ═══════════════════════════════════════════
# Main
# ═══════════════════════════════════════════

case "${1:-start}" in
  start)
    do_start foreground
    ;;
  start-bg|up)
    do_start background
    ;;
  stop)
    do_stop
    ;;
  restart)
    do_stop
    sleep 2
    do_start foreground
    ;;
  status)
    do_status
    ;;
  -h|--help|help)
    show_usage
    ;;
  *)
    echo "[ERROR] Unknown command: $1"
    echo
    show_usage
    exit 1
    ;;
esac
