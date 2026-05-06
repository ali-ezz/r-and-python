#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  FastAPI SMS — Backend Launcher
#  Usage: ./run.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { echo -e "${CYAN}[FastAPI SMS]${NC} $*"; }
sep()  { echo -e "${CYAN}─────────────────────────────────────────────────────${NC}"; }

banner() {
  echo ""
  echo -e "${BOLD}${CYAN}"
  echo "  ███████╗ █████╗ ███████╗████████╗ █████╗ ██████╗ ██╗"
  echo "  ██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██║"
  echo "  █████╗  ███████║███████╗   ██║   ███████║██████╔╝██║"
  echo "  ██╔══╝  ██╔══██║╚════██║   ██║   ██╔══██║██╔═══╝ ██║"
  echo "  ██║     ██║  ██║███████║   ██║   ██║  ██║██║     ██║"
  echo "  ╚═╝     ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝     ╚═╝"
  echo -e "${NC}${BOLD}  Student Management System Backend${NC}"
  echo ""
}

print_links() {
  sep
  echo -e "${BOLD}  🔗 Application Links${NC}"
  sep
  echo -e "  ${GREEN}●${NC} ${BOLD}FastAPI Swagger Docs${NC}   →  ${CYAN}http://localhost:8000/docs${NC}"
  echo -e "  ${GREEN}●${NC} ${BOLD}Redoc API Reference${NC}    →  ${CYAN}http://localhost:8000/redoc${NC}"
  echo -e "  ${GREEN}●${NC} ${BOLD}API Base URL${NC}           →  ${CYAN}http://localhost:8000/api/v1${NC}"
  echo -e "  ${GREEN}●${NC} ${BOLD}Prometheus Metrics${NC}     →  ${CYAN}http://localhost:8000/metrics${NC}"
  echo -e "  ${GREEN}●${NC} ${BOLD}Prometheus UI${NC}          →  ${CYAN}http://localhost:9091${NC}"
  echo -e "  ${GREEN}●${NC} ${BOLD}Grafana Dashboard${NC}      →  ${CYAN}http://localhost:3002${NC}  (admin / admin)"
  echo -e "  ${GREEN}●${NC} ${BOLD}PostgreSQL${NC}             →  ${CYAN}localhost:5433${NC}  (sms_user / sms_password)"
  echo -e "  ${GREEN}●${NC} ${BOLD}Redis${NC}                  →  ${CYAN}localhost:6380${NC}"
  sep
  echo -e "  ${BOLD}🔑 Endpoints Guide${NC}"
  sep
  echo -e "  ${YELLOW}Register:${NC} POST /api/v1/auth/register"
  echo -e "  ${YELLOW}Login:${NC}    POST /api/v1/auth/login"
  sep
  echo ""
}

main() {
  banner
  log "Starting FastAPI SMS via Docker Compose..."
  sep

  cd "$ROOT_DIR"
  docker compose up --build -d

  log "Waiting for services to become healthy..."
  sleep 5 # Give it a moment to boot

  log "All Docker services running!"
  print_links

  echo -e "  ${BOLD}📋 Useful commands:${NC}"
  echo -e "  Stop all:    ${CYAN}docker compose down${NC}"
  echo -e "  View logs:   ${CYAN}docker compose logs -f api${NC}"
  echo ""
}

main
