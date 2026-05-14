#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════
# 5*A App - Unified Run Script
# Usage: ./run.sh [start|start-bg|up|stop|restart|status|ta-demo]
# ═══════════════════════════════════════════

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/five_star_a/backend"
FRONTEND_DIR="$ROOT_DIR/five_star_a/frontend_new"
SEARCH_DIR="$ROOT_DIR/5A_Search"
VENV_DIR="$BACKEND_DIR/.venv"
LOG_DIR="$ROOT_DIR/.run_logs"
PID_DIR="$ROOT_DIR/.run_pids"
EVIDENCE_DIR="$ROOT_DIR/TA_EVIDENCE_FILES"

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

mkdir -p "$LOG_DIR" "$PID_DIR" "$EVIDENCE_DIR"

# ═══════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════

show_usage() {
  cat <<EOF
5*A Application Manager

Usage: $0 [command]

Commands:
  start          Start all services in foreground (default; Ctrl+C stops all)
  start-bg, up   Start all services in background
  stop           Stop all running servers
  restart        Restart all servers
  status         Show running processes
  ta-demo        Regenerate TA evidence files and print the TA checklist

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
  $0
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

timestamp_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

write_evidence_header() {
  local file="$1"
  local title="$2"
  {
    echo "$title"
    echo "Generated: $(timestamp_utc)"
    echo "Project root: $ROOT_DIR"
    echo "============================================================"
    echo
  } >"$file"
}

append_command_output() {
  local file="$1"
  local label="$2"
  local cmd="$3"

  {
    echo
    echo "## $label"
    echo "$ $cmd"
  } >>"$file"

  if bash -o pipefail -lc "$cmd" >>"$file" 2>&1; then
    echo "[OK] Command completed" >>"$file"
  else
    echo "[WARN] Command failed or service is unavailable" >>"$file"
  fi
}

docker_is_ready() {
  command_exists docker && docker info >/dev/null 2>&1
}

compose_run() {
  (cd "$ROOT_DIR" && docker compose "$@")
}

generate_sqlite_tables_evidence() {
  local file="$1"
  local db_file="$BACKEND_DIR/five_star_a.db"
  {
    echo "## SQLite fallback database"
    echo "Database file: $db_file"
  } >>"$file"

  if [[ ! -f "$db_file" ]]; then
    echo "[WARN] SQLite database file was not found." >>"$file"
    return 0
  fi

  python3 - "$db_file" <<'PY' >>"$file" 2>&1
import sqlite3
import sys

db_path = sys.argv[1]
conn = sqlite3.connect(db_path)
cur = conn.cursor()

print("\nTables:")
for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
    print(f"- {row[0]}")

print("\nRow counts:")
for (table_name,) in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall():
    try:
        count = cur.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()[0]
        print(f"{table_name}: {count}")
    except Exception as exc:
        print(f"{table_name}: unable to count ({exc})")

conn.close()
PY
}

generate_sqlite_users_evidence() {
  local file="$1"
  local db_file="$BACKEND_DIR/five_star_a.db"
  {
    echo "## SQLite fallback database"
    echo "Database file: $db_file"
  } >>"$file"

  if [[ ! -f "$db_file" ]]; then
    echo "[WARN] SQLite database file was not found." >>"$file"
    return 0
  fi

  python3 - "$db_file" <<'PY' >>"$file" 2>&1
import sqlite3
import sys

db_path = sys.argv[1]
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

tables = {row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")}
if "users" not in tables:
    print("[WARN] users table does not exist.")
else:
    cols = [row[1] for row in cur.execute("PRAGMA table_info(users)")]
    wanted = [col for col in ("id", "email", "username", "role", "is_active", "is_verified", "created_at") if col in cols]
    query = f"SELECT {', '.join(wanted)} FROM users ORDER BY id"
    rows = cur.execute(query).fetchall()
    if not rows:
        print("[INFO] users table is empty.")
    else:
        print("Users:")
        print(" | ".join(wanted))
        print("-" * 80)
        for row in rows:
            print(" | ".join(str(row[col]) for col in wanted))

conn.close()
PY
}

generate_database_evidence() {
  local tables_file="$EVIDENCE_DIR/01_DB_Tables.txt"
  local users_file="$EVIDENCE_DIR/02_DB_Users.txt"

  write_evidence_header "$tables_file" "TA Evidence 01 - Database Tables and Row Counts"
  write_evidence_header "$users_file" "TA Evidence 02 - Database Users"

  if docker_is_ready && compose_run exec -T postgres psql -U user -d five_star_a -c '\dt' >>"$tables_file" 2>&1; then
    append_command_output "$tables_file" "PostgreSQL row counts" "cd '$ROOT_DIR' && docker compose exec -T postgres psql -U user -d five_star_a -c \"SELECT schemaname, relname AS table_name, n_live_tup AS estimated_rows FROM pg_stat_user_tables ORDER BY relname;\""
    append_command_output "$users_file" "PostgreSQL users" "cd '$ROOT_DIR' && docker compose exec -T postgres psql -U user -d five_star_a -c \"SELECT id, email, username, role, is_active, is_verified FROM users ORDER BY id;\""
  else
    echo "[INFO] PostgreSQL evidence unavailable. Using local SQLite fallback." >>"$tables_file"
    echo "[INFO] PostgreSQL evidence unavailable. Using local SQLite fallback." >>"$users_file"
    generate_sqlite_tables_evidence "$tables_file"
    generate_sqlite_users_evidence "$users_file"
  fi
}

generate_cache_evidence() {
  local memory_file="$EVIDENCE_DIR/03_CACHE_Redis_Memory.txt"
  local ping_file="$EVIDENCE_DIR/04_CACHE_Redis_Ping.txt"

  write_evidence_header "$memory_file" "TA Evidence 03 - Redis Cache Memory"
  write_evidence_header "$ping_file" "TA Evidence 04 - Redis Cache Ping"

  if docker_is_ready; then
    append_command_output "$memory_file" "Redis INFO memory" "cd '$ROOT_DIR' && docker compose exec -T redis redis-cli INFO memory"
    append_command_output "$memory_file" "Redis keyspace and stats" "cd '$ROOT_DIR' && docker compose exec -T redis redis-cli INFO stats"
    append_command_output "$ping_file" "Redis PING" "cd '$ROOT_DIR' && docker compose exec -T redis redis-cli PING"
  else
    echo "[WARN] Docker is not available, so Redis container evidence cannot be collected." >>"$memory_file"
    echo "[WARN] Docker is not available, so Redis PING cannot be collected." >>"$ping_file"
  fi

  append_command_output "$ping_file" "Backend cache health through API" "curl -fsS http://127.0.0.1:$BACKEND_PORT/system/metrics"
}

generate_docker_evidence() {
  local file="$EVIDENCE_DIR/05_DOCKER_Status.txt"
  write_evidence_header "$file" "TA Evidence 05 - Docker and Service Status"

  if docker_is_ready; then
    append_command_output "$file" "Docker containers" "docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'"
    append_command_output "$file" "Docker Compose services" "cd '$ROOT_DIR' && docker compose ps"
  else
    echo "[WARN] Docker is not running or not installed." >>"$file"
  fi

  append_command_output "$file" "Local managed processes" "ls -la '$PID_DIR'"
}

generate_api_testing_evidence() {
  local file="$EVIDENCE_DIR/06_API_Testing_Results.txt"
  write_evidence_header "$file" "TA Evidence 06 - API Testing Results"

  append_command_output "$file" "Backend health endpoint" "curl -fsS http://127.0.0.1:$BACKEND_PORT/health"
  append_command_output "$file" "OpenAPI endpoint" "curl -fsS http://127.0.0.1:$BACKEND_PORT/openapi.json | python3 -c 'import json,sys; data=json.load(sys.stdin); print(json.dumps({\"title\": data.get(\"info\", {}).get(\"title\"), \"version\": data.get(\"info\", {}).get(\"version\"), \"path_count\": len(data.get(\"paths\", {})), \"sample_paths\": sorted(data.get(\"paths\", {}))[:20]}, indent=2))'"

  if [[ -x "$VENV_DIR/bin/pytest" ]]; then
    append_command_output "$file" "Local pytest API tests" "cd '$BACKEND_DIR' && '$VENV_DIR/bin/pytest' -q --tb=line"
  else
    echo "[WARN] pytest is not available in the local virtual environment." >>"$file"
  fi

  if docker_is_ready; then
    append_command_output "$file" "Docker backend health check" "cd '$ROOT_DIR' && docker compose ps backend"
  fi
}

generate_logs_evidence() {
  local backend_file="$EVIDENCE_DIR/07_LOGS_Backend.txt"
  local monitoring_file="$EVIDENCE_DIR/08_LOGS_Monitoring.txt"

  write_evidence_header "$backend_file" "TA Evidence 07 - Backend Logs"
  write_evidence_header "$monitoring_file" "TA Evidence 08 - Monitoring Logs"

  append_command_output "$backend_file" "Backend health endpoint" "curl -fsS http://127.0.0.1:$BACKEND_PORT/health"
  append_command_output "$backend_file" "Backend metrics snapshot" "curl -fsS http://127.0.0.1:$BACKEND_PORT/system/metrics"

  if docker_is_ready; then
    append_command_output "$backend_file" "Recent Docker backend logs" "cd '$ROOT_DIR' && docker compose logs --since=5m backend"
    append_command_output "$monitoring_file" "Recent Docker Prometheus and Grafana logs" "cd '$ROOT_DIR' && docker compose logs --since=5m prometheus grafana"
  elif [[ -f "$LOG_DIR/backend.log" ]]; then
    append_command_output "$backend_file" "Recent local backend log file" "tail -n 120 '$LOG_DIR/backend.log'"
  else
    echo "[INFO] Local backend log file does not exist yet: $LOG_DIR/backend.log" >>"$backend_file"
  fi

  append_command_output "$monitoring_file" "Prometheus metrics endpoint" "curl -fsS http://127.0.0.1:$BACKEND_PORT/system/metrics"
}

generate_endpoint_evidence() {
  local file="$EVIDENCE_DIR/09_API_Endpoints.txt"
  write_evidence_header "$file" "TA Evidence 09 - API Endpoints and Swagger"

  append_command_output "$file" "Health endpoint" "curl -fsS http://127.0.0.1:$BACKEND_PORT/health"
  append_command_output "$file" "List OpenAPI paths" "curl -fsS http://127.0.0.1:$BACKEND_PORT/openapi.json | python3 -c 'import json,sys; data=json.load(sys.stdin); [print(path) for path in sorted(data.get(\"paths\", {}))]'"
  {
    echo
    echo "Swagger UI: http://127.0.0.1:$BACKEND_PORT/docs"
    echo "Frontend:   http://127.0.0.1:$FRONTEND_PORT"
    echo "Search UI:  http://127.0.0.1:$SEARCH_PORT"
  } >>"$file"
}

generate_jwt_evidence() {
  local file="$EVIDENCE_DIR/10_JWT_Login_Demo.txt"
  write_evidence_header "$file" "TA Evidence 10 - JWT Login Demo"

  {
    echo "Default demo credentials:"
    echo "email: admin@5stara.com"
    echo "password: admin12345"
  } >>"$file"

  append_command_output "$file" "JSON login returns access and refresh tokens" "curl -fsS -X POST http://127.0.0.1:$BACKEND_PORT/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin@5stara.com\",\"password\":\"admin12345\"}' | python3 -m json.tool"
  append_command_output "$file" "Swagger form login returns JWT tokens" "curl -fsS -X POST http://127.0.0.1:$BACKEND_PORT/auth/swagger -H 'Content-Type: application/x-www-form-urlencoded' -d 'username=admin@5stara.com&password=admin12345' | python3 -m json.tool"
}

generate_validation_clean_code_evidence() {
  local file="$EVIDENCE_DIR/11_VALIDATION_Clean_Code.txt"
  write_evidence_header "$file" "TA Evidence 11 - Validation, Clean Code, and Project Structure"

  append_command_output "$file" "Backend test files" "find '$BACKEND_DIR/tests' -maxdepth 1 -type f -name 'test_*.py' | sort"
  append_command_output "$file" "Validation/security helpers" "find '$BACKEND_DIR/app' -type f | sort | grep -E '(schemas|validators|security|dependencies|middleware)'"
  append_command_output "$file" "Requirements file" "sed -n '1,220p' '$BACKEND_DIR/requirements.txt'"
  if [[ -x "$VENV_DIR/bin/pytest" ]]; then
    append_command_output "$file" "Focused validation/security tests" "cd '$BACKEND_DIR' && '$VENV_DIR/bin/pytest' tests/test_auth.py tests/test_role_authorization.py tests/test_rate_limiting.py -q --tb=line"
  fi
}

generate_git_evidence() {
  local file="$EVIDENCE_DIR/12_GIT_GitHub.txt"
  write_evidence_header "$file" "TA Evidence 12 - Git and GitHub"

  if [[ -d "$ROOT_DIR/.git" ]]; then
    append_command_output "$file" "Git repository status from project root" "cd '$ROOT_DIR' && git status --short"
    append_command_output "$file" "Git remotes" "cd '$ROOT_DIR' && git remote -v"
    append_command_output "$file" "Recent commits" "cd '$ROOT_DIR' && git log --oneline -10"
  else
    cat >>"$file" <<EOF
Git is the only checklist item that is not currently complete from this folder.

Current result:
  This project root does not contain a .git directory, so git status/log/remote cannot be shown yet.

TA demo command once GitHub is set:
  git status
  git log --oneline -10
  git remote -v

To complete the Git/GitHub mark before presentation:
  1. Create a GitHub repository.
  2. Run these commands from the project root:
     git init
     git add .
     git commit -m "Prepare DSC 306 final project"
     git branch -M main
     git remote add origin <YOUR_GITHUB_REPO_URL>
     git push -u origin main
  3. Run ./run.sh again so this evidence file captures the real git log and remote.
EOF
  fi
}

generate_frontend_evidence() {
  local file="$EVIDENCE_DIR/13_FRONTEND_Status.txt"
  write_evidence_header "$file" "TA Evidence 13 - Frontend and Search UI"

  append_command_output "$file" "Frontend package" "sed -n '1,180p' '$FRONTEND_DIR/package.json'"
  append_command_output "$file" "Frontend URL check" "curl -I http://127.0.0.1:$FRONTEND_PORT"
  if [[ "$SKIP_SEARCH" != "1" && -d "$SEARCH_DIR" ]]; then
    append_command_output "$file" "Search package" "sed -n '1,180p' '$SEARCH_DIR/package.json'"
    append_command_output "$file" "Search URL check" "curl -I http://127.0.0.1:$SEARCH_PORT"
  fi
}

generate_rubric_evidence() {
  local file="$EVIDENCE_DIR/14_RUBRIC_Marking_Guide.txt"
  write_evidence_header "$file" "TA Evidence 14 - Rubric Marking Guide"

  cat >>"$file" <<EOF
Course:
  DSC 306 R and Python Programming Language - Winter 2026

Selected project idea:
  5) Task Management System

Main demo command:
  ./run.sh

Project URLs:
  Backend health: http://127.0.0.1:$BACKEND_PORT/health
  Swagger API:    http://127.0.0.1:$BACKEND_PORT/docs
  Frontend UI:    http://127.0.0.1:$FRONTEND_PORT
  Search UI:      http://127.0.0.1:$SEARCH_PORT
  Prometheus:     http://127.0.0.1:9090
  Grafana:        http://127.0.0.1:3000
  Grafana login:  admin / admin

Rubric evidence map:
  JWT - 3 marks
    File: 10_JWT_Login_Demo.txt
    Shows: /auth/login and /auth/swagger returning bearer JWT access_token and refresh_token.

  Data Base - 2 marks
    Files: 01_DB_Tables.txt, 02_DB_Users.txt
    Shows: PostgreSQL tables, row counts, and demo users.

  Validation of Project - 3 marks
    File: 11_VALIDATION_Clean_Code.txt
    Shows: Pydantic schemas, validation/security helpers, focused validation tests.

  Clean Code - 2 marks
    File: 11_VALIDATION_Clean_Code.txt
    Shows: structured backend modules, service/router/schema split, requirements, tests.

  Individual discussion - 8 marks
    File: 15_INDIVIDUAL_Discussion.txt
    Shows: member-by-member responsibility areas and files to discuss.

  Logging & Monitoring Dashboard - 3 marks
    Files: 07_LOGS_Backend.txt, 08_LOGS_Monitoring.txt
    Shows: backend logs, request metrics, Prometheus/Grafana logs, monitoring metrics.

  Caching - 2 marks
    Files: 03_CACHE_Redis_Memory.txt, 04_CACHE_Redis_Ping.txt
    Shows: Redis memory/stats, PING, and backend cache metrics.

  API Testing - 1 mark
    Files: 06_API_Testing_Results.txt, 09_API_Endpoints.txt
    Shows: health endpoint, OpenAPI summary, pytest results, endpoint list.

  Git & Github - 1 mark
    File: 12_GIT_GitHub.txt
    Shows: git status/log/remotes when a GitHub repo is configured.

  Front End (Bonus) - 2 marks
    File: 13_FRONTEND_Status.txt
    Shows: React/Vite frontend and search UI package files plus HTTP 200 checks.

  Docker (Bonus) - 2 marks
    File: 05_DOCKER_Status.txt
    Shows: Docker containers and Compose services.
EOF
}

generate_individual_discussion_evidence() {
  local file="$EVIDENCE_DIR/15_INDIVIDUAL_Discussion.txt"
  write_evidence_header "$file" "TA Evidence 15 - Individual Discussion"

  cat >>"$file" <<EOF
Use this file during the individual discussion. Each student can open the listed files and explain their responsibility.

Student 1 - Backend architecture, middleware, AI/search
  Files:
    five_star_a/backend/app/main.py
    five_star_a/backend/app/config.py
    five_star_a/backend/app/database.py
    five_star_a/backend/app/middleware/
    five_star_a/backend/app/utils/nlp_parser.py
    5A_Search/
  Discussion points:
    API startup, database connection, request logging, rate limiting, AI/search interface.

Student 2 - Database models, validation, migrations, uploads/export
  Files:
    five_star_a/backend/app/models/
    five_star_a/backend/app/schemas/
    five_star_a/backend/alembic/
    five_star_a/backend/app/routers/attachments.py
    five_star_a/backend/app/routers/export.py
    five_star_a/backend/app/routers/bulk_ops.py
  Discussion points:
    SQLAlchemy tables, Pydantic validation, migrations, attachments, export flows.

Student 3 - JWT, authentication, users, roles, chat/social features
  Files:
    five_star_a/backend/app/routers/auth.py
    five_star_a/backend/app/routers/users.py
    five_star_a/backend/app/services/auth_service.py
    five_star_a/backend/app/services/user_service.py
    five_star_a/backend/app/utils/dependencies.py
    five_star_a/backend/app/routers/team_chat.py
    five_star_a/backend/app/routers/friends.py
    five_star_a/backend/app/routers/notifications.py
  Discussion points:
    JWT login, password hashing, access control, admin/project-manager/employee roles.

Student 4 - Tasks, projects, workflow, frontend pages
  Files:
    five_star_a/backend/app/routers/tasks.py
    five_star_a/backend/app/routers/projects.py
    five_star_a/backend/app/services/task_service.py
    five_star_a/backend/app/services/project_service.py
    five_star_a/frontend_new/src/pages/
    five_star_a/frontend_new/src/components/
  Discussion points:
    Task/project CRUD, status transitions, comments, search, React UI interactions.

Student 5 - DevOps, Docker, tests, analytics, monitoring, integrations
  Files:
    run.sh
    docker-compose.yml
    five_star_a/backend/Dockerfile
    five_star_a/frontend_new/Dockerfile
    five_star_a/backend/tests/
    five_star_a/backend/app/routers/system.py
    five_star_a/infra/prometheus/prometheus.yml
    five_star_a/infra/grafana/tms-dashboard.json
    five_star_a/backend/app/routers/analytics.py
    five_star_a/backend/app/services/analytics_service.py
    five_star_a/backend/app/routers/integrations.py
  Discussion points:
    One-command startup, Docker services, pytest API tests, Prometheus/Grafana monitoring.

Student 6 - If required by the team
  Assign this member to one of the remaining support areas before the TA discussion:
    frontend polishing, API testing, documentation, Git/GitHub, or monitoring demo.
EOF

  if [[ -f "$ROOT_DIR/five_star_a/TEAM_SPLIT.md" ]]; then
    {
      echo
      echo "## Original team split document"
      sed -n '1,260p' "$ROOT_DIR/five_star_a/TEAM_SPLIT.md"
    } >>"$file"
  fi
}

generate_ta_readme() {
  local file="$EVIDENCE_DIR/00_TA_README_Checklist.txt"
  write_evidence_header "$file" "TA Evidence 00 - Presentation Checklist"

  cat >>"$file" <<EOF
Recommended TA command:
  ./run.sh

If services are already running and you only want to refresh the evidence files:
  ./run.sh ta-demo

Main URLs:
  Backend health: http://127.0.0.1:$BACKEND_PORT/health
  Swagger API:    http://127.0.0.1:$BACKEND_PORT/docs
  Frontend:       http://127.0.0.1:$FRONTEND_PORT
  Search UI:      http://127.0.0.1:$SEARCH_PORT
  Prometheus:     http://127.0.0.1:9090
  Grafana:        http://127.0.0.1:3000 (admin/admin)

Evidence file map:
  01_DB_Tables.txt              Database tables and row counts
  02_DB_Users.txt               Demo users/admin account
  03_CACHE_Redis_Memory.txt     Redis memory and stats
  04_CACHE_Redis_Ping.txt       Redis ping and cache metrics
  05_DOCKER_Status.txt          Docker/container status
  06_API_Testing_Results.txt    API tests and health/OpenAPI checks
  07_LOGS_Backend.txt           Backend logs
  08_LOGS_Monitoring.txt        Prometheus/Grafana logs and metrics
  09_API_Endpoints.txt          API endpoint list
  10_JWT_Login_Demo.txt         JWT login output
  11_VALIDATION_Clean_Code.txt  Validation, test, and structure evidence
  12_GIT_GitHub.txt             Git/GitHub evidence if repo metadata exists
  13_FRONTEND_Status.txt        Frontend and search UI evidence
  14_RUBRIC_Marking_Guide.txt   Marking-sheet item-to-file map
  15_INDIVIDUAL_Discussion.txt  Team member responsibility discussion guide

Marking checklist covered:
  JWT, Data Base, Validation of Project, Clean Code, Individual discussion support,
  Logging & Monitoring Dashboard, Caching, API Testing, Git & GitHub, Front End,
  Docker.
EOF
}

generate_ta_evidence() {
  echo -e "\033[1;35m==> Generating TA evidence files in ./TA_EVIDENCE_FILES ...\033[0m"
  mkdir -p "$EVIDENCE_DIR"

  generate_ta_readme
  generate_database_evidence
  generate_cache_evidence
  generate_docker_evidence
  generate_api_testing_evidence
  generate_logs_evidence
  generate_endpoint_evidence
  generate_jwt_evidence
  generate_validation_clean_code_evidence
  generate_git_evidence
  generate_frontend_evidence
  generate_rubric_evidence
  generate_individual_discussion_evidence

  echo "[OK] TA evidence files updated: $EVIDENCE_DIR"
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
      echo "==> Starting Docker services (postgres, redis, search, prometheus, grafana)"
      (cd "$ROOT_DIR" && docker compose up -d --no-deps postgres redis search prometheus grafana)
    fi
  else
    echo "==> Continuing without Docker-managed services"
  fi

  echo "==> Preparing backend environment"
  if [[ -d "$VENV_DIR" ]] && venv_is_broken; then
    echo "    Removing stale virtual environment with invalid interpreter paths..."
    rm -rf "$VENV_DIR"
  fi

  if [[ ! -d "$VENV_DIR" ]]; then
    echo "    Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/python3" -m pip install --upgrade pip --quiet
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

  sleep 2
  do_status
  echo
  echo -e "\033[1;36m  > Press Ctrl+C to stop all servers\033[0m"
  echo -e "\033[1;36m==========================================================\033[0m"
  echo
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
    (cd "$ROOT_DIR" && docker compose stop postgres redis search prometheus grafana >/dev/null 2>&1 || true)
  fi

  if [[ "$stopped" -eq 0 ]]; then
    echo "[INFO]  No running processes found"
  else
    echo "[OK] Application stopped"
  fi
}

do_status() {
  generate_ta_evidence
  echo "═══════════════════════════════════════════"
  echo " 5*A Application Status"
  echo "═══════════════════════════════════════════"

  local backend_pid
  backend_pid=$(cat "$PID_DIR/backend.pid" 2>/dev/null || true)
  local health_response
  health_response=$(curl -s "http://127.0.0.1:$BACKEND_PORT/health" 2>/dev/null || echo '{"status":"error"}')
  local health_status
  health_status=$(echo "$health_response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

  if is_running "$PID_DIR/backend.pid" || [[ "$health_status" == "ok" ]]; then
    echo "[OK] Backend:  Running (PID: ${backend_pid:-unknown}, Port: $BACKEND_PORT)"
    echo "   URL:    http://127.0.0.1:$BACKEND_PORT"
    echo "   Health: http://127.0.0.1:$BACKEND_PORT/health"

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

  local frontend_pid
  frontend_pid=$(cat "$PID_DIR/frontend.pid" 2>/dev/null || true)
  local frontend_accessible=0
  if curl -fsS "http://127.0.0.1:$FRONTEND_PORT" >/dev/null 2>&1; then
    frontend_accessible=1
  fi

  if is_running "$PID_DIR/frontend.pid" || [[ "$frontend_accessible" == "1" ]]; then
    echo "[OK] Frontend: Running (PID: ${frontend_pid:-unknown}, Port: $FRONTEND_PORT)"
    echo "   URL:    http://127.0.0.1:$FRONTEND_PORT"

    if [[ "$frontend_accessible" == "1" ]]; then
      echo "   Status: [OK] Accessible"
    else
      echo "   Status: [WARN]  Not responding"
    fi
  else
    echo "[ERROR] Frontend: Stopped"
    echo "   Status: Not running"
  fi

  echo

  local search_pid
  search_pid=$(cat "$PID_DIR/search.pid" 2>/dev/null || true)
  local search_accessible=0
  if curl -fsS "http://127.0.0.1:$SEARCH_PORT" >/dev/null 2>&1; then
    search_accessible=1
  fi

  if is_running "$PID_DIR/search.pid" || [[ "$search_accessible" == "1" ]]; then
    echo "[OK] Search: Running (PID: ${search_pid:-unknown}, Port: $SEARCH_PORT)"
    echo "   URL:    http://127.0.0.1:$SEARCH_PORT"
    if [[ "$search_accessible" == "1" ]]; then
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
    (cd "$ROOT_DIR" && docker compose ps backend frontend postgres redis search prometheus grafana 2>/dev/null || true)
    echo
  fi


  echo -e "\033[1;36m==========================================================\033[0m"
  echo -e "\033[1;33m  🎓 DSC 306 FINAL PROJECT TA PRESENTATION CHECKLIST 🎓\033[0m"
  echo -e "\033[1;36m==========================================================\033[0m"
  echo -e "\033[1;35m  📂 DIRECTORY: ./TA_EVIDENCE_FILES/\033[0m"
  echo -e "  (Evidence files are auto-generated when this screen appears!)"
  echo -e "\033[1;32m✓ 1. FRONT END (2 Marks Bonus)\033[0m"
  echo -e "   -> Local Vite UI. View in browser:"
  echo -e "   \033[4m\`\`\`bash\033[0m"
  echo -e "   \033[1;36mopen http://localhost:$FRONTEND_PORT\033[0m"
  echo -e "   \033[4m\`\`\`\033[0m"
  echo -e ""
  echo -e "\033[1;32m✓ 2. JWT & API TESTING (4 Marks)\033[0m"
  echo -e "   -> \033[1;35mSee Evidence:\033[0m 06_API_Testing_Results.txt"
  echo -e "   -> Swagger UI: open http://localhost:8000/docs"
  echo -e "   -> Test JWT Login via CLI:"
  echo -e "   \033[4m\`\`\`bash\033[0m"
  echo -e "   \033[1;36mcurl -X POST http://localhost:8000/auth/swagger -d 'username=admin@5stara.com&password=admin12345'\033[0m"
  echo -e "   \033[4m\`\`\`\033[0m"
  echo -e ""
  echo -e "\033[1;32m✓ 3. DATA BASE (2 Marks) [FOCUS]\033[0m"
  echo -e "   -> \033[1;35mSee Evidence:\033[0m 01_DB_Tables.txt & 02_DB_Users.txt"
  echo -e "   -> Live Database check via SQL:"
  echo -e "   \033[4m\`\`\`bash\033[0m"
  echo -e "   \033[1;36mdocker compose exec postgres psql -U user -d five_star_a -c '\dt'\033[0m"
  echo -e "   \033[1;36mdocker compose exec postgres psql -U user -d five_star_a -c 'SELECT email FROM users;'\033[0m"
  echo -e "   \033[4m\`\`\`\033[0m"
  echo -e ""
  echo -e "\033[1;32m✓ 4. CACHING (2 Marks)\033[0m"
  echo -e "   -> \033[1;35mSee Evidence:\033[0m 03_CACHE_Redis_Memory.txt & 04_CACHE_Redis_Ping.txt"
  echo -e "   -> Test the Redis Cache heartbeat:"
  echo -e "   \033[4m\`\`\`bash\033[0m"
  echo -e "   \033[1;36mdocker compose exec redis redis-cli ping\033[0m"
  echo -e "   \033[4m\`\`\`\033[0m"
  echo -e ""
  echo -e "\033[1;32m✓ 5. LOGGING & MONITORING DASHBOARD (3 Marks)\033[0m"
  echo -e "   -> \033[1;35mSee Evidence:\033[0m 07_LOGS_Backend.txt & 08_LOGS_Monitoring.txt"
  echo -e "   -> Open the Grafana Dashboard directly:"
  echo -e "   \033[4m\`\`\`bash\033[0m"
  echo -e "   \033[1;36mopen http://localhost:3000\033[0m"
  echo -e "   \033[4m\`\`\`\033[0m"
  echo -e "   (Login: admin / admin)"
  echo -e ""
  echo -e "\033[1;32m✓ 6. DOCKER & GIT/GITHUB (3 Marks Bonus/Core)\033[0m"
  echo -e "   -> \033[1;35mSee Evidence:\033[0m 05_DOCKER_Status.txt"
  echo -e "   -> Show Docker services plus local managed processes:"
  echo -e "   \033[4m\`\`\`bash\033[0m"
  echo -e "   \033[1;36mdocker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'\033[0m"
  echo -e "   \033[4m\`\`\`\033[0m"
  echo -e "\033[1;36m==========================================================\033[0m"


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
  ta-demo)
    do_status
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
