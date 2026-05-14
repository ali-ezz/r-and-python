#!/usr/bin/env bash

echo "=== 5*A Quick System Check ==="
echo

# Check Python
if command -v python3 &> /dev/null; then
    echo "✓ Python: $(python3 --version)"
else
    echo "✗ Python not found"
fi

# Check Node
if command -v node &> /dev/null; then
    echo "✓ Node.js: $(node --version)"
else
    echo "✗ Node.js not found"
fi

# Check npm
if command -v npm &> /dev/null; then
    echo "✓ npm: $(npm --version)"
else
    echo "✗ npm not found"
fi

echo
echo "=== Backend Check ==="

# Check backend files
if [ -f "backend/app/main.py" ]; then
    echo "✓ Backend main.py exists"
else
    echo "✗ Backend main.py missing"
fi

if [ -f "backend/.env" ]; then
    echo "✓ Backend .env exists"
else
    echo "✗ Backend .env missing"
fi

if [ -d "backend/.venv" ]; then
    echo "✓ Virtual environment exists"
else
    echo "⚠ Virtual environment not found"
fi

echo
echo "=== Frontend Check ==="

# Check frontend files
if [ -f "frontend_new/package.json" ]; then
    echo "✓ Frontend package.json exists"
else
    echo "✗ Frontend package.json missing"
fi

if [ -f "frontend_new/src/App.jsx" ]; then
    echo "✓ Frontend App.jsx exists"
else
    echo "✗ Frontend App.jsx missing"
fi

if [ -d "frontend_new/node_modules" ]; then
    echo "✓ Frontend dependencies installed"
else
    echo "⚠ Frontend dependencies not installed"
fi

echo
echo "=== Search Engine Check ==="

if [ -d "../5A_Search" ]; then
    echo "✓ Search engine directory exists"
    if [ -f "../5A_Search/package.json" ]; then
        echo "✓ Search package.json exists"
    fi
else
    echo "⚠ Search engine not found"
fi

echo
echo "=== Running Services Check ==="

# Check if backend is running
if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
    echo "✓ Backend is running (port 8000)"
else
    echo "⚠ Backend not running"
fi

# Check if frontend is running
if curl -s http://127.0.0.1:2000 > /dev/null 2>&1; then
    echo "✓ Frontend is running (port 2000)"
else
    echo "⚠ Frontend not running"
fi

# Check if search is running
if curl -s http://127.0.0.1:5173 > /dev/null 2>&1; then
    echo "✓ Search engine is running (port 5173)"
else
    echo "⚠ Search engine not running"
fi

echo
echo "=== Quick Check Complete ==="
echo
echo "To start all services: ./run.sh start"
echo "To check status: ./run.sh status"
echo "To run full validation: ./validate_system.sh"
