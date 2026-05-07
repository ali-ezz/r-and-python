#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  SMS — Student Management System — Full Stack Launcher
#  Usage: ./run.sh [--docker | --local | --stop | --clean]
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/fastapi_backend"
FRONTEND_DIR="$ROOT_DIR/5A_Search"
INFRA_DIR="$ROOT_DIR/infra"
LOG_DIR="$ROOT_DIR/logs"
PID_FILE="$ROOT_DIR/.sms_pids"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo -e "${BLUE}[SMS]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; }
sep()  { echo -e "${CYAN}─────────────────────────────────────────────────────${NC}"; }

banner() {
  echo ""
  echo -e "${BOLD}${CYAN}"
  echo "  ███████╗███╗   ███╗███████╗"
  echo "  ██╔════╝████╗ ████║██╔════╝"
  echo "  ███████╗██╔████╔██║███████╗"
  echo "  ╚════██║██║╚██╔╝██║╚════██║"
  echo "  ███████║██║ ╚═╝ ██║███████║"
  echo "  ╚══════╝╚═╝     ╚═╝╚══════╝"
  echo -e "${NC}${BOLD}  Student Management System${NC}"
  echo ""
}

print_links() {
  sep
  echo -e "${BOLD}  🔗 Application Links${NC}"
  sep
  echo -e "  ${GREEN}●${NC} ${BOLD}Frontend (SMS App)${NC}     →  ${CYAN}http://localhost:80${NC}"
  echo -e "  ${GREEN}●${NC} ${BOLD}Backend API${NC}            →  ${CYAN}http://localhost:8000${NC}"
  echo -e "  ${GREEN}●${NC} ${BOLD}API Docs (Swagger)${NC}     →  ${CYAN}http://localhost:8000/docs${NC}"
  echo -e "  ${GREEN}●${NC} ${BOLD}Prometheus Metrics${NC}     →  ${CYAN}http://localhost:8000/metrics${NC}"
  echo -e "  ${GREEN}●${NC} ${BOLD}Grafana Dashboard${NC}      →  ${CYAN}http://localhost:3000${NC}  (admin / sms_grafana_2026)"
  echo -e "  ${GREEN}●${NC} ${BOLD}Prometheus UI${NC}          →  ${CYAN}http://localhost:9090${NC}"
  echo -e "  ${GREEN}●${NC} ${BOLD}PostgreSQL${NC}             →  ${CYAN}localhost:5432${NC}  (sms_user / sms_password)"
  echo -e "  ${GREEN}●${NC} ${BOLD}Redis${NC}                  →  ${CYAN}localhost:6379${NC}"
  sep
  echo -e "  ${BOLD}🔑 Demo Credentials${NC}"
  sep
  echo -e "  ${YELLOW}Admin:${NC}      admin@sms.edu           /  Admin@2026"
  echo -e "  ${YELLOW}Instructor:${NC} dr.ahmed@sms.edu        /  Instructor@2026"
  echo -e "  ${YELLOW}Student:${NC}    dr.sarah@sms.edu        /  Instructor@2026"
  sep
  echo ""
}

wait_for_port() {
  local host="$1" port="$2" label="$3" retries="${4:-30}"
  log "Waiting for $label ($host:$port)..."
  for i in $(seq 1 $retries); do
    if nc -z "$host" "$port" 2>/dev/null; then
      ok "$label is ready"
      return 0
    fi
    sleep 1
    printf "."
  done
  echo ""
  err "$label did not start in time"
  return 1
}

# ── Stop mode ─────────────────────────────────────────────────────────────────
stop_all() {
  log "Stopping SMS services..."
  if [[ -f "$PID_FILE" ]]; then
    while IFS= read -r pid; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" && ok "Stopped PID $pid"
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  # Also kill by port if needed
  for port in 8000 5173; do
    local pid
    pid=$(lsof -ti ":$port" 2>/dev/null || true)
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
      ok "Freed port $port"
    fi
  done
  ok "All services stopped"
}

# ── Clean mode ────────────────────────────────────────────────────────────────
clean_all() {
  stop_all
  log "Cleaning build artifacts..."
  rm -rf "$BACKEND_DIR/dist" "$FRONTEND_DIR/dist"
  ok "Clean complete"
}

# ── Check Docker ──────────────────────────────────────────────────────────────
check_docker() {
  if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# ── Setup .env ────────────────────────────────────────────────────────────────
setup_env() {
  if [[ ! -f "$BACKEND_DIR/.env" ]]; then
    warn ".env not found — creating from .env.example"
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    # Generate random JWT secrets
    if command -v openssl &>/dev/null; then
      local secret
      secret=$(openssl rand -hex 32)
      sed -i "s/change_me_to_a_secure_random_string/$secret/" "$BACKEND_DIR/.env"
      ok "Generated secure JWT secret"
    fi
  else
    ok ".env already exists"
  fi
}

# ── Install dependencies ──────────────────────────────────────────────────────
install_deps() {
  log "Installing Python dependencies (Local mode only)..."
  if [[ "$1" == "--local" ]]; then
    cd "$BACKEND_DIR"
    if [[ ! -d "venv" ]]; then
      python3 -m venv venv
      source venv/bin/activate
      pip install -r requirements.txt
    fi
  fi
  ok "Backend dependencies ready"

  log "Installing frontend dependencies..."
  cd "$FRONTEND_DIR"
  if [[ ! -d "node_modules" ]]; then
    npm install --prefer-offline 2>&1 | tail -3
  fi
  ok "Frontend dependencies ready"
}

# ─────────────────────────────────────────────────────────────────────────────
#  MODE: DOCKER (full stack via docker-compose)
# ─────────────────────────────────────────────────────────────────────────────
run_docker() {
  banner
  log "Starting SMS in Docker mode..."
  sep

  setup_env
  install_deps "--docker"

  log "Building and starting all containers (no cache)..."
  cd "$INFRA_DIR"
  docker compose build --no-cache
  docker compose up -d

  sep
  log "Waiting for services to become healthy..."

  wait_for_port localhost 5432 "PostgreSQL" 30
  wait_for_port localhost 6379 "Redis"      15
  wait_for_port localhost 8000 "Backend"    40
  wait_for_port localhost 3000 "Grafana"    30

  # FastAPI auto-migrates via main.py startup event
  log "FastAPI Database is ready!"

  ok "All Docker services running!"
  print_links

  echo -e "  ${BOLD}📋 Useful commands:${NC}"
  echo -e "  Stop all:    ${CYAN}cd infra && docker compose down${NC}"
  echo -e "  View logs:   ${CYAN}cd infra && docker compose logs -f backend${NC}"
  echo -e "  Shell into:  ${CYAN}docker exec -it sms_backend sh${NC}"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
#  MODE: LOCAL (Postgres + Redis must be installed locally)
# ─────────────────────────────────────────────────────────────────────────────
run_local() {
  banner
  log "Starting SMS in Local development mode..."
  sep

  mkdir -p "$LOG_DIR"
  > "$PID_FILE"

  # ── Check local Postgres ────────────────────────────────────────────────────
  if ! command -v psql &>/dev/null; then
    err "PostgreSQL not found. Install it or use: ./run.sh --docker"
    exit 1
  fi

  # ── Check local Redis ───────────────────────────────────────────────────────
  if ! command -v redis-cli &>/dev/null; then
    warn "Redis not found locally. Trying to start via Docker..."
    if check_docker; then
      docker run -d --name sms_redis_local -p 6379:6379 redis:7-alpine &>/dev/null || true
      ok "Redis started via Docker"
    else
      err "Redis not available. Install Redis or Docker."
      exit 1
    fi
  else
    # Start Redis if not running
    if ! redis-cli ping &>/dev/null 2>&1; then
      log "Starting Redis..."
      redis-server --daemonize yes --logfile "$LOG_DIR/redis.log"
      sleep 1
    fi
    ok "Redis is running"
  fi

  # ── Setup Postgres DB ───────────────────────────────────────────────────────
  if ! psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw sms_db; then
    log "Creating sms_db database..."
    psql -U postgres -c "CREATE USER sms_user WITH PASSWORD 'sms_password';" 2>/dev/null || true
    psql -U postgres -c "CREATE DATABASE sms_db OWNER sms_user;" 2>/dev/null || true
    psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE sms_db TO sms_user;" 2>/dev/null || true
    ok "Database sms_db created"
  else
    ok "Database sms_db already exists"
  fi

  setup_env
  install_deps

  # ── Start Backend ───────────────────────────────────────────────────────────
  log "Starting FastAPI Backend on port 8000..."
  cd "$BACKEND_DIR"
  source venv/bin/activate
  nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!
  echo "$BACKEND_PID" >> "$PID_FILE"
  wait_for_port localhost 8000 "Backend API" 30

  # ── Start Frontend ──────────────────────────────────────────────────────────
  log "Starting Frontend on port 5173..."
  cd "$FRONTEND_DIR"
  nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" >> "$PID_FILE"
  wait_for_port localhost 5173 "Frontend" 30

  ok "All services running!"
  print_links

  echo -e "  ${BOLD}📋 Useful commands:${NC}"
  echo -e "  Stop all:      ${CYAN}./run.sh --stop${NC}"
  echo -e "  Backend logs:  ${CYAN}tail -f $LOG_DIR/backend.log${NC}"
  echo -e "  Frontend logs: ${CYAN}tail -f $LOG_DIR/frontend.log${NC}"
  echo ""
  echo -e "  ${YELLOW}Note:${NC} Grafana/Prometheus only available in Docker mode (${CYAN}./run.sh --docker${NC})"
  echo ""

  # ── Keep alive — show combined logs ─────────────────────────────────────────
  sep
  echo -e "${BOLD}  Live logs (Ctrl+C to stop):${NC}"
  sep
  trap stop_all EXIT INT TERM
  tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
}

# ─────────────────────────────────────────────────────────────────────────────
#  MODE: SEARCH (Run only the frontend 5A_Search app)
# ─────────────────────────────────────────────────────────────────────────────
run_search() {
  banner
  log "Starting 5A_Search application locally..."
  sep
  mkdir -p "$LOG_DIR"
  
  log "Installing frontend dependencies if needed..."
  cd "$FRONTEND_DIR"
  if [[ ! -d "node_modules" ]]; then
    npm install --prefer-offline 2>&1 | tail -3
  fi
  
  log "Starting Frontend on port 5173..."
  npm run dev
}

# ─────────────────────────────────────────────────────────────────────────────
#  MAIN — Auto-detect mode
# ─────────────────────────────────────────────────────────────────────────────
main() {
  local mode="${1:-auto}"

  case "$mode" in
    --docker)  run_docker ;;
    --local)   run_local ;;
    --search)  run_search ;;
    --stop)    stop_all ;;
    --clean)   clean_all ;;
    --links)   print_links ;;
    auto)
      if check_docker; then
        log "Docker detected → using Docker mode (recommended)"
        log "To force local mode: ${CYAN}./run.sh --local${NC}"
        echo ""
        run_docker
      else
        warn "Docker not found → falling back to local mode"
        run_local
      fi
      ;;
    *)
      echo "Usage: $0 [--docker | --local | --search | --stop | --clean | --links]"
      echo ""
      echo "  --docker   Run everything in Docker containers (recommended)"
      echo "  --local    Run backend + frontend locally (Postgres + Redis required)"
      echo "  --search   Run only the frontend search application"
      echo "  --stop     Stop all local processes"
      echo "  --clean    Stop + remove build artifacts"
      echo "  --links    Print all application links"
      exit 1
      ;;
  esac
}

main "${1:-auto}"
