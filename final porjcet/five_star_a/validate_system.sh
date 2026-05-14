#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# 5*A System Validation Script
# Comprehensive validation of all components and connections
# ═══════════════════════════════════════════════════════════════════════════

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend_new"
SEARCH_DIR="$ROOT_DIR/../5A_Search"
VENV_DIR="$BACKEND_DIR/.venv"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-2000}"
SEARCH_PORT="${SEARCH_PORT:-5173}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0
PASSED=0

# ═══════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════

print_header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════${NC}\n"
}

print_section() {
  echo -e "\n${YELLOW}▶ $1${NC}"
}

pass() {
  echo -e "  ${GREEN}✓${NC} $1"
  ((PASSED++))
}

fail() {
  echo -e "  ${RED}✗${NC} $1"
  ((ERRORS++))
}

warn() {
  echo -e "  ${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

info() {
  echo -e "  ${BLUE}ℹ${NC} $1"
}

# ═══════════════════════════════════════════════════════════════════════════
# Validation Functions
# ═══════════════════════════════════════════════════════════════════════════

validate_prerequisites() {
  print_section "Checking Prerequisites"
  
  # Python
  if command -v python3 &> /dev/null; then
    local py_version=$(python3 --version 2>&1 | awk '{print $2}')
    pass "Python 3 installed: $py_version"
  else
    fail "Python 3 not found"
  fi
  
  # Node.js
  if command -v node &> /dev/null; then
    local node_version=$(node --version)
    pass "Node.js installed: $node_version"
  else
    fail "Node.js not found"
  fi
  
  # npm
  if command -v npm &> /dev/null; then
    local npm_version=$(npm --version)
    pass "npm installed: $npm_version"
  else
    fail "npm not found"
  fi
  
  # curl
  if command -v curl &> /dev/null; then
    pass "curl installed"
  else
    fail "curl not found"
  fi
  
  # PostgreSQL (optional)
  if timeout 1 bash -c "</dev/tcp/127.0.0.1/5432" 2>/dev/null; then
    pass "PostgreSQL is running on port 5432"
  else
    warn "PostgreSQL not detected (will use SQLite fallback)"
  fi
}

validate_backend_structure() {
  print_section "Validating Backend Structure"
  
  # Check directories
  local dirs=("app" "app/models" "app/routers" "app/services" "app/schemas" "app/utils" "app/middleware")
  for dir in "${dirs[@]}"; do
    if [[ -d "$BACKEND_DIR/$dir" ]]; then
      pass "Directory exists: $dir"
    else
      fail "Missing directory: $dir"
    fi
  done
  
  # Check key files
  local files=("app/main.py" "app/config.py" "app/database.py" "requirements.txt" ".env")
  for file in "${files[@]}"; do
    if [[ -f "$BACKEND_DIR/$file" ]]; then
      pass "File exists: $file"
    else
      fail "Missing file: $file"
    fi
  done
  
  # Check virtual environment
  if [[ -d "$VENV_DIR" ]]; then
    pass "Virtual environment exists"
  else
    warn "Virtual environment not found (will be created)"
  fi
}

validate_backend_dependencies() {
  print_section "Validating Backend Dependencies"
  
  if [[ ! -d "$VENV_DIR" ]]; then
    info "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
  fi
  
  info "Installing/checking dependencies..."
  "$VENV_DIR/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt" 2>&1 | grep -v "already satisfied" || true
  
  # Check critical packages
  local packages=("fastapi" "uvicorn" "sqlalchemy" "pydantic" "python-jose")
  for pkg in "${packages[@]}"; do
    if "$VENV_DIR/bin/pip" show "$pkg" &> /dev/null; then
      pass "Package installed: $pkg"
    else
      fail "Package missing: $pkg"
    fi
  done
}

validate_backend_config() {
  print_section "Validating Backend Configuration"
  
  if [[ -f "$BACKEND_DIR/.env" ]]; then
    pass ".env file exists"
    
    # Check critical env vars
    source "$BACKEND_DIR/.env"
    
    if [[ -n "$SECRET_KEY" && "$SECRET_KEY" != "change-me-in-production" ]]; then
      pass "SECRET_KEY is configured"
    else
      warn "SECRET_KEY is using default value (change in production)"
    fi
    
    if [[ -n "$DATABASE_URL" ]]; then
      pass "DATABASE_URL is configured: ${DATABASE_URL:0:30}..."
    else
      fail "DATABASE_URL not configured"
    fi
    
    if [[ -n "$CORS_ORIGINS" ]]; then
      pass "CORS_ORIGINS configured"
    else
      warn "CORS_ORIGINS not configured"
    fi
  else
    fail ".env file not found"
  fi
}

validate_backend_models() {
  print_section "Validating Backend Models"
  
  local models=("user.py" "task.py" "project.py" "label.py" "collection.py" "notification.py")
  for model in "${models[@]}"; do
    if [[ -f "$BACKEND_DIR/app/models/$model" ]]; then
      pass "Model exists: $model"
    else
      fail "Missing model: $model"
    fi
  done
}

validate_backend_routers() {
  print_section "Validating Backend Routers"
  
  local routers=("auth.py" "tasks.py" "projects.py" "users.py" "labels.py" "collections.py" "notifications.py" "search.py")
  for router in "${routers[@]}"; do
    if [[ -f "$BACKEND_DIR/app/routers/$router" ]]; then
      pass "Router exists: $router"
    else
      fail "Missing router: $router"
    fi
  done
}

validate_frontend_structure() {
  print_section "Validating Frontend Structure"
  
  # Check directories
  local dirs=("src" "src/components" "src/pages" "src/stores" "src/services" "public")
  for dir in "${dirs[@]}"; do
    if [[ -d "$FRONTEND_DIR/$dir" ]]; then
      pass "Directory exists: $dir"
    else
      fail "Missing directory: $dir"
    fi
  done
  
  # Check key files
  local files=("package.json" "vite.config.js" "index.html" "src/main.jsx" "src/App.jsx" "src/services/api.js")
  for file in "${files[@]}"; do
    if [[ -f "$FRONTEND_DIR/$file" ]]; then
      pass "File exists: $file"
    else
      fail "Missing file: $file"
    fi
  done
}

validate_frontend_dependencies() {
  print_section "Validating Frontend Dependencies"
  
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    info "Installing frontend dependencies..."
    (cd "$FRONTEND_DIR" && npm install --silent 2>&1 | tail -5)
  fi
  
  # Check critical packages
  if [[ -f "$FRONTEND_DIR/package.json" ]]; then
    pass "package.json exists"
    
    local packages=("react" "react-dom" "react-router-dom" "zustand" "lucide-react")
    for pkg in "${packages[@]}"; do
      if grep -q "\"$pkg\"" "$FRONTEND_DIR/package.json"; then
        pass "Package declared: $pkg"
      else
        fail "Package missing: $pkg"
      fi
    done
  else
    fail "package.json not found"
  fi
}

validate_frontend_config() {
  print_section "Validating Frontend Configuration"
  
  # Check vite.config.js
  if [[ -f "$FRONTEND_DIR/vite.config.js" ]]; then
    pass "vite.config.js exists"
    
    if grep -q "port: 2000" "$FRONTEND_DIR/vite.config.js"; then
      pass "Frontend port configured: 2000"
    else
      warn "Frontend port not set to 2000"
    fi
    
    if grep -q "proxy" "$FRONTEND_DIR/vite.config.js"; then
      pass "API proxy configured"
    else
      warn "API proxy not configured"
    fi
  else
    fail "vite.config.js not found"
  fi
  
  # Check API service
  if [[ -f "$FRONTEND_DIR/src/services/api.js" ]]; then
    pass "API service exists"
    
    if grep -q "localhost:8000" "$FRONTEND_DIR/src/services/api.js"; then
      pass "API base URL configured"
    else
      warn "API base URL might not be configured correctly"
    fi
  else
    fail "API service not found"
  fi
}

validate_search_engine() {
  print_section "Validating Search Engine"
  
  if [[ -d "$SEARCH_DIR" ]]; then
    pass "Search engine directory exists"
    
    if [[ -f "$SEARCH_DIR/package.json" ]]; then
      pass "Search package.json exists"
    else
      fail "Search package.json not found"
    fi
    
    if [[ -f "$SEARCH_DIR/src/App.tsx" ]]; then
      pass "Search App.tsx exists"
    else
      fail "Search App.tsx not found"
    fi
    
    if [[ ! -d "$SEARCH_DIR/node_modules" ]]; then
      info "Installing search dependencies..."
      (cd "$SEARCH_DIR" && npm install --silent 2>&1 | tail -5)
    fi
    pass "Search dependencies checked"
  else
    warn "Search engine directory not found at $SEARCH_DIR"
  fi
}

validate_api_endpoints() {
  print_section "Validating API Endpoints (requires running backend)"
  
  if ! curl -fsS "http://127.0.0.1:$BACKEND_PORT/health" &> /dev/null; then
    warn "Backend not running - skipping API endpoint tests"
    info "Start backend with: ./run.sh start"
    return
  fi
  
  # Health check
  local health=$(curl -fsS "http://127.0.0.1:$BACKEND_PORT/health" 2>/dev/null || echo '{"status":"error"}')
  if echo "$health" | grep -q '"status":"ok"'; then
    pass "Health endpoint: OK"
  else
    fail "Health endpoint: Failed"
  fi
  
  # API docs
  if curl -fsS "http://127.0.0.1:$BACKEND_PORT/docs" &> /dev/null; then
    pass "API docs accessible"
  else
    fail "API docs not accessible"
  fi
  
  # Test auth endpoints
  local endpoints=("/api/auth/register" "/api/auth/login" "/api/tasks" "/api/projects" "/api/users/me")
  for endpoint in "${endpoints[@]}"; do
    local status=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$BACKEND_PORT$endpoint" 2>/dev/null || echo "000")
    if [[ "$status" != "000" ]]; then
      pass "Endpoint exists: $endpoint (HTTP $status)"
    else
      fail "Endpoint unreachable: $endpoint"
    fi
  done
}

validate_database_connection() {
  print_section "Validating Database Connection"
  
  if [[ ! -d "$VENV_DIR" ]]; then
    warn "Virtual environment not found - skipping database check"
    return
  fi
  
  # Create a test script
  cat > /tmp/test_db.py << 'EOF'
import sys
sys.path.insert(0, '/Users/ali-ezz/Downloads/Project/R_Project_Ahmed_Abobakr(reEVO)/five_star_a/backend')

try:
    from app.database import engine, SessionLocal
    from app.models.user import User
    
    # Test connection
    with engine.connect() as conn:
        print("✓ Database connection successful")
    
    # Test session
    db = SessionLocal()
    try:
        count = db.query(User).count()
        print(f"✓ Database query successful (found {count} users)")
    finally:
        db.close()
    
    print("✓ Database validation passed")
except Exception as e:
    print(f"✗ Database error: {e}")
    sys.exit(1)
EOF
  
  if "$VENV_DIR/bin/python" /tmp/test_db.py 2>&1; then
    pass "Database connection validated"
  else
    fail "Database connection failed"
  fi
  
  rm -f /tmp/test_db.py
}

validate_cors_configuration() {
  print_section "Validating CORS Configuration"
  
  if [[ -f "$BACKEND_DIR/.env" ]]; then
    source "$BACKEND_DIR/.env"
    
    if echo "$CORS_ORIGINS" | grep -q "localhost:2000"; then
      pass "Frontend origin allowed in CORS"
    else
      fail "Frontend origin not in CORS_ORIGINS"
    fi
    
    if echo "$CORS_ORIGINS" | grep -q "127.0.0.1:2000"; then
      pass "127.0.0.1:2000 allowed in CORS"
    else
      warn "127.0.0.1:2000 not in CORS_ORIGINS"
    fi
  fi
}

validate_authentication_flow() {
  print_section "Validating Authentication Flow (requires running backend)"
  
  if ! curl -fsS "http://127.0.0.1:$BACKEND_PORT/health" &> /dev/null; then
    warn "Backend not running - skipping auth flow test"
    return
  fi
  
  # Test registration endpoint
  local reg_response=$(curl -s -X POST "http://127.0.0.1:$BACKEND_PORT/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","username":"test","password":"test123","full_name":"Test User"}' 2>/dev/null || echo '{"detail":"error"}')
  
  if echo "$reg_response" | grep -q -E '(email|username|already exists|created)'; then
    pass "Registration endpoint responding"
  else
    warn "Registration endpoint might have issues"
  fi
  
  # Test login with default admin
  local login_response=$(curl -s -X POST "http://127.0.0.1:$BACKEND_PORT/api/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=admin@5stara.com&password=admin12345" 2>/dev/null || echo '{"detail":"error"}')
  
  if echo "$login_response" | grep -q "access_token"; then
    pass "Login endpoint working (admin credentials valid)"
  else
    warn "Login endpoint might have issues or admin not seeded"
  fi
}

validate_frontend_backend_connection() {
  print_section "Validating Frontend-Backend Connection"
  
  # Check if API base URL matches backend
  if [[ -f "$FRONTEND_DIR/src/services/api.js" ]]; then
    local api_url=$(grep -o "localhost:[0-9]*" "$FRONTEND_DIR/src/services/api.js" | head -1)
    if [[ "$api_url" == "localhost:$BACKEND_PORT" ]]; then
      pass "Frontend API URL matches backend port"
    else
      warn "Frontend API URL ($api_url) might not match backend port ($BACKEND_PORT)"
    fi
  fi
  
  # Check CORS configuration
  if [[ -f "$BACKEND_DIR/app/config.py" ]]; then
    if grep -q "localhost:2000" "$BACKEND_DIR/app/config.py"; then
      pass "Backend CORS includes frontend URL"
    else
      warn "Backend CORS might not include frontend URL"
    fi
  fi
}

validate_theme_system() {
  print_section "Validating Theme System"
  
  # Check ThemeContext
  if [[ -f "$FRONTEND_DIR/src/context/ThemeContext.jsx" ]]; then
    pass "ThemeContext exists"
  else
    fail "ThemeContext not found"
  fi
  
  # Check CSS variables
  if [[ -f "$FRONTEND_DIR/src/index.css" ]]; then
    if grep -q "var(--" "$FRONTEND_DIR/src/index.css"; then
      pass "CSS variables defined"
    else
      warn "CSS variables might not be defined"
    fi
  fi
  
  # Check search theme integration
  if [[ -f "$SEARCH_DIR/src/App.tsx" ]]; then
    if grep -q "theme-change" "$SEARCH_DIR/src/App.tsx"; then
      pass "Search engine theme integration exists"
    else
      warn "Search engine theme integration might be missing"
    fi
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# Main Execution
# ═══════════════════════════════════════════════════════════════════════════

main() {
  print_header "5*A System Validation"
  
  validate_prerequisites
  validate_backend_structure
  validate_backend_dependencies
  validate_backend_config
  validate_backend_models
  validate_backend_routers
  validate_database_connection
  validate_cors_configuration
  
  validate_frontend_structure
  validate_frontend_dependencies
  validate_frontend_config
  validate_frontend_backend_connection
  validate_theme_system
  
  validate_search_engine
  
  validate_api_endpoints
  validate_authentication_flow
  
  # Summary
  print_header "Validation Summary"
  echo -e "${GREEN}Passed:${NC}   $PASSED"
  echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
  echo -e "${RED}Errors:${NC}   $ERRORS"
  echo
  
  if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}✓ System validation completed successfully!${NC}"
    echo
    echo "Next steps:"
    echo "  1. Start the application: ./run.sh start"
    echo "  2. Access frontend: http://localhost:2000"
    echo "  3. Access API docs: http://localhost:8000/docs"
    echo "  4. Login with: admin@5stara.com / admin12345"
    exit 0
  else
    echo -e "${RED}✗ System validation found $ERRORS error(s)${NC}"
    echo
    echo "Please fix the errors above before starting the application."
    exit 1
  fi
}

main "$@"
