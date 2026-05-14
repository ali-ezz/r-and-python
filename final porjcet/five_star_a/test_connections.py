#!/usr/bin/env python3
"""
5*A Connection Test Script
Tests all API endpoints and validates frontend-backend connectivity
"""

import sys
import json
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

try:
    import requests
except ImportError:
    print("Installing requests library...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests

# Configuration
BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:2000"
SEARCH_URL = "http://127.0.0.1:5173"

# Colors
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

passed = 0
failed = 0
warnings = 0

def print_header(text):
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}{text}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")

def print_section(text):
    print(f"\n{YELLOW}▶ {text}{RESET}")

def test_pass(text):
    global passed
    print(f"  {GREEN}✓{RESET} {text}")
    passed += 1

def test_fail(text):
    global failed
    print(f"  {RED}✗{RESET} {text}")
    failed += 1

def test_warn(text):
    global warnings
    print(f"  {YELLOW}⚠{RESET} {text}")
    warnings += 1

def test_info(text):
    print(f"  {BLUE}ℹ{RESET} {text}")

def test_backend_health():
    """Test backend health endpoint"""
    print_section("Testing Backend Health")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "ok":
                test_pass(f"Backend health check: {data}")
                return True
            else:
                test_fail(f"Backend unhealthy: {data}")
                return False
        else:
            test_fail(f"Backend health check failed: HTTP {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        test_fail("Cannot connect to backend - is it running?")
        test_info("Start backend with: ./run.sh start")
        return False
    except Exception as e:
        test_fail(f"Backend health check error: {e}")
        return False

def test_api_docs():
    """Test API documentation"""
    print_section("Testing API Documentation")
    try:
        response = requests.get(f"{BACKEND_URL}/docs", timeout=5)
        if response.status_code == 200:
            test_pass("API documentation accessible")
            return True
        else:
            test_fail(f"API docs failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        test_fail(f"API docs error: {e}")
        return False

def test_auth_endpoints():
    """Test authentication endpoints"""
    print_section("Testing Authentication Endpoints")
    
    # Test registration endpoint structure
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/register",
            json={
                "email": f"test_{int(time.time())}@test.com",
                "username": f"test_{int(time.time())}",
                "password": "Test123!@#",
                "confirm_password": "Test123!@#",
                "full_name": "Test User"
            },
            timeout=5
        )
        if response.status_code in [200, 201, 400, 422]:
            test_pass(f"Registration endpoint responding (HTTP {response.status_code})")
        else:
            test_warn(f"Registration endpoint unexpected status: {response.status_code}")
    except Exception as e:
        test_fail(f"Registration endpoint error: {e}")
    
    # Test login with admin credentials
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json={
                "username": "admin@5stara.com",
                "password": "admin12345"
            },
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                test_pass("Admin login successful - token received")
                return data["access_token"]
            else:
                test_fail("Login response missing access_token")
                return None
        else:
            test_fail(f"Admin login failed: HTTP {response.status_code}")
            test_info("Response: " + response.text[:200])
            return None
    except Exception as e:
        test_fail(f"Login endpoint error: {e}")
        return None

def test_protected_endpoints(token):
    """Test protected endpoints with authentication"""
    print_section("Testing Protected Endpoints")
    
    if not token:
        test_warn("Skipping protected endpoint tests - no auth token")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    endpoints = [
        ("/users/me", "GET", "User profile"),
        ("/tasks", "GET", "Tasks list"),
        ("/projects", "GET", "Projects list"),
        ("/labels", "GET", "Labels list"),
        ("/collections", "GET", "Collections list"),
        ("/notifications", "GET", "Notifications"),
    ]
    
    for endpoint, method, description in endpoints:
        try:
            if method == "GET":
                response = requests.get(f"{BACKEND_URL}{endpoint}", headers=headers, timeout=5)
            else:
                response = requests.request(method, f"{BACKEND_URL}{endpoint}", headers=headers, timeout=5)
            
            if response.status_code in [200, 201]:
                test_pass(f"{description}: HTTP {response.status_code}")
            elif response.status_code == 401:
                test_fail(f"{description}: Unauthorized (token might be invalid)")
            else:
                test_warn(f"{description}: HTTP {response.status_code}")
        except Exception as e:
            test_fail(f"{description} error: {e}")

def test_crud_operations(token):
    """Test CRUD operations"""
    print_section("Testing CRUD Operations")
    
    if not token:
        test_warn("Skipping CRUD tests - no auth token")
        return
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # First, create a project
    project_data = {
        "name": f"Test Project {int(time.time())}",
        "description": "Automated test project"
    }
    
    project_id = None
    try:
        response = requests.post(
            f"{BACKEND_URL}/projects",
            json=project_data,
            headers=headers,
            timeout=5
        )
        if response.status_code in [200, 201]:
            project = response.json()
            project_id = project.get("id")
            test_pass(f"Project created: ID {project_id}")
        else:
            test_warn(f"Project creation failed: HTTP {response.status_code}")
    except Exception as e:
        test_warn(f"Project creation error: {e}")
    
    # Create a task
    task_data = {
        "title": f"Test Task {int(time.time())}",
        "description": "Automated test task",
        "status": "todo",
        "priority": "medium"
    }
    
    # Add project_id if we have one
    if project_id:
        task_data["project_id"] = project_id
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/tasks",
            json=task_data,
            headers=headers,
            timeout=5
        )
        if response.status_code in [200, 201]:
            task = response.json()
            task_id = task.get("id")
            test_pass(f"Task created: ID {task_id}")
            
            # Read the task
            response = requests.get(
                f"{BACKEND_URL}/tasks/{task_id}",
                headers=headers,
                timeout=5
            )
            if response.status_code == 200:
                test_pass(f"Task retrieved: ID {task_id}")
            else:
                test_fail(f"Task retrieval failed: HTTP {response.status_code}")
            
            # Update the task
            update_data = {"title": f"Updated Task {int(time.time())}"}
            response = requests.put(
                f"{BACKEND_URL}/tasks/{task_id}",
                json=update_data,
                headers=headers,
                timeout=5
            )
            if response.status_code in [200, 204]:
                test_pass(f"Task updated: ID {task_id}")
            else:
                test_fail(f"Task update failed: HTTP {response.status_code}")
            
            # Delete the task
            response = requests.delete(
                f"{BACKEND_URL}/tasks/{task_id}",
                headers=headers,
                timeout=5
            )
            if response.status_code in [200, 204]:
                test_pass(f"Task deleted: ID {task_id}")
            else:
                test_fail(f"Task deletion failed: HTTP {response.status_code}")
        else:
            test_fail(f"Task creation failed: HTTP {response.status_code}")
            test_info("Response: " + response.text[:200])
    except Exception as e:
        test_fail(f"CRUD operations error: {e}")
    
    # Clean up project if created
    if project_id:
        try:
            requests.delete(
                f"{BACKEND_URL}/projects/{project_id}",
                headers=headers,
                timeout=5
            )
        except:
            pass

def test_search_functionality(token):
    """Test search functionality"""
    print_section("Testing Search Functionality")
    
    if not token:
        test_warn("Skipping search tests - no auth token")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/search",
            params={"q": "test"},
            headers=headers,
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            test_pass(f"Search endpoint working: {len(data.get('tasks', []))} tasks found")
        else:
            test_warn(f"Search endpoint: HTTP {response.status_code}")
    except Exception as e:
        test_fail(f"Search functionality error: {e}")

def test_cors_headers():
    """Test CORS headers"""
    print_section("Testing CORS Configuration")
    
    try:
        response = requests.options(
            f"{BACKEND_URL}/tasks",
            headers={
                "Origin": "http://localhost:2000",
                "Access-Control-Request-Method": "GET"
            },
            timeout=5
        )
        
        cors_headers = {
            "Access-Control-Allow-Origin": response.headers.get("Access-Control-Allow-Origin"),
            "Access-Control-Allow-Methods": response.headers.get("Access-Control-Allow-Methods"),
            "Access-Control-Allow-Headers": response.headers.get("Access-Control-Allow-Headers"),
        }
        
        if cors_headers["Access-Control-Allow-Origin"]:
            test_pass(f"CORS headers present: {cors_headers['Access-Control-Allow-Origin']}")
        else:
            test_warn("CORS headers might not be configured")
            
    except Exception as e:
        test_warn(f"CORS test error: {e}")

def test_frontend_accessibility():
    """Test frontend accessibility"""
    print_section("Testing Frontend Accessibility")
    
    try:
        response = requests.get(FRONTEND_URL, timeout=5)
        if response.status_code == 200:
            test_pass("Frontend accessible")
        else:
            test_fail(f"Frontend returned HTTP {response.status_code}")
    except requests.exceptions.ConnectionError:
        test_warn("Frontend not running")
        test_info("Start frontend with: ./run.sh start")
    except Exception as e:
        test_fail(f"Frontend test error: {e}")

def test_search_engine_accessibility():
    """Test search engine accessibility"""
    print_section("Testing Search Engine Accessibility")
    
    try:
        response = requests.get(SEARCH_URL, timeout=5)
        if response.status_code == 200:
            test_pass("Search engine accessible")
        else:
            test_fail(f"Search engine returned HTTP {response.status_code}")
    except requests.exceptions.ConnectionError:
        test_warn("Search engine not running")
        test_info("Start with: ./run.sh start (or SKIP_SEARCH=0 ./run.sh start)")
    except Exception as e:
        test_warn(f"Search engine test error: {e}")

def test_database_connection():
    """Test database connection"""
    print_section("Testing Database Connection")
    
    try:
        from app.database import engine, SessionLocal
        from app.models.user import User
        
        # Test connection
        with engine.connect() as conn:
            test_pass("Database connection successful")
        
        # Test query
        db = SessionLocal()
        try:
            count = db.query(User).count()
            test_pass(f"Database query successful: {count} users in database")
            
            # Check for admin user
            admin = db.query(User).filter(User.email == "admin@5stara.com").first()
            if admin:
                test_pass("Admin user exists in database")
            else:
                test_warn("Admin user not found - might need to seed database")
        finally:
            db.close()
            
    except ImportError as e:
        test_warn(f"Cannot import database modules: {e}")
    except Exception as e:
        test_fail(f"Database connection error: {e}")

def main():
    print_header("5*A Connection & API Test Suite")
    
    # Test backend
    backend_running = test_backend_health()
    
    if backend_running:
        test_api_docs()
        token = test_auth_endpoints()
        test_protected_endpoints(token)
        test_crud_operations(token)
        test_search_functionality(token)
        test_cors_headers()
    else:
        test_warn("Skipping API tests - backend not running")
    
    # Test frontend
    test_frontend_accessibility()
    
    # Test search engine
    test_search_engine_accessibility()
    
    # Test database
    test_database_connection()
    
    # Summary
    print_header("Test Summary")
    print(f"{GREEN}Passed:{RESET}   {passed}")
    print(f"{YELLOW}Warnings:{RESET} {warnings}")
    print(f"{RED}Failed:{RESET}   {failed}")
    print()
    
    if failed == 0:
        print(f"{GREEN}✓ All critical tests passed!{RESET}")
        if warnings > 0:
            print(f"{YELLOW}⚠ {warnings} warning(s) - review above{RESET}")
        return 0
    else:
        print(f"{RED}✗ {failed} test(s) failed{RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
