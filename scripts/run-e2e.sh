#!/bin/bash

# E2E Test Orchestration Script for Snap Caddy
# This script checks prerequisites, installs missing dependencies, starts services, and runs tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
DEV_SERVER_PORT=${PORT:-56577}
DEV_SERVER_URL="http://localhost:$DEV_SERVER_PORT"
DEV_SERVER_TIMEOUT=120
HEALTH_CHECK_INTERVAL=2

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Cleanup function to kill dev server on exit
cleanup() {
    if [ -n "$DEV_SERVER_PID" ]; then
        log_info "Stopping dev server (PID: $DEV_SERVER_PID)..."
        kill $DEV_SERVER_PID 2>/dev/null || true
        wait $DEV_SERVER_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if a port is in use
port_in_use() {
    local port=$1
    if command_exists lsof; then
        lsof -i ":$port" >/dev/null 2>&1
    elif command_exists ss; then
        ss -tuln | grep -q ":$port "
    elif command_exists netstat; then
        netstat -tuln | grep -q ":$port "
    else
        # Try to connect to the port
        (echo >/dev/tcp/localhost/$port) 2>/dev/null
    fi
}

# Wait for server to be ready
wait_for_server() {
    local url=$1
    local timeout=$2
    local elapsed=0

    log_info "Waiting for server at $url (timeout: ${timeout}s)..."

    while [ $elapsed -lt $timeout ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "200\|304"; then
            return 0
        fi
        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
        echo -n "."
    done

    echo ""
    return 1
}

# Main orchestration
main() {
    log_step "Snap Caddy E2E Test Orchestration"

    cd "$PROJECT_ROOT"

    # Step 1: Check Node.js
    log_step "Checking Node.js"
    if command_exists node; then
        NODE_VERSION=$(node --version)
        log_success "Node.js is installed: $NODE_VERSION"
    else
        log_error "Node.js is not installed. Please install Node.js 20+ and try again."
        log_info "Visit https://nodejs.org/ to download and install Node.js"
        exit 1
    fi

    # Step 2: Check npm
    log_step "Checking npm"
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        log_success "npm is installed: $NPM_VERSION"
    else
        log_error "npm is not installed. Please install npm and try again."
        exit 1
    fi

    # Step 3: Check/Install node_modules
    log_step "Checking project dependencies"
    if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ]; then
        log_success "Node modules are installed"
    else
        log_warn "Node modules not found. Installing dependencies..."
        npm install
        log_success "Dependencies installed"
    fi

    # Step 4: Check if Playwright is installed
    log_step "Checking Playwright"
    if [ -d "node_modules/@playwright/test" ]; then
        log_success "Playwright is installed"
    else
        log_warn "Playwright not found in dependencies. Installing..."
        npm install -D @playwright/test
        log_success "Playwright installed"
    fi

    # Step 5: Check/Install Playwright browsers
    log_step "Checking Playwright browsers"
    if npx playwright --version >/dev/null 2>&1; then
        # Check if chromium is installed
        if [ -d "$HOME/.cache/ms-playwright/chromium-"* ] 2>/dev/null; then
            log_success "Playwright browsers are installed"
        else
            log_warn "Playwright browsers not found. Installing..."
            npx playwright install chromium
            log_success "Playwright browsers installed"
        fi
    else
        log_error "Failed to verify Playwright installation"
        exit 1
    fi

    # Step 6: Check if dev server is already running
    log_step "Checking dev server"
    EXISTING_SERVER=false
    if port_in_use $DEV_SERVER_PORT; then
        # Verify it's actually responding
        if curl -s -o /dev/null -w "%{http_code}" "$DEV_SERVER_URL" 2>/dev/null | grep -q "200\|304"; then
            log_success "Dev server is already running at $DEV_SERVER_URL"
            EXISTING_SERVER=true
        else
            log_warn "Port $DEV_SERVER_PORT is in use but not responding as expected"
            log_info "Attempting to use the existing server anyway..."
            EXISTING_SERVER=true
        fi
    fi

    # Step 7: Start dev server if not running
    if [ "$EXISTING_SERVER" = false ]; then
        log_info "Starting dev server..."
        npm run dev &
        DEV_SERVER_PID=$!

        if wait_for_server "$DEV_SERVER_URL" $DEV_SERVER_TIMEOUT; then
            log_success "Dev server started successfully (PID: $DEV_SERVER_PID)"
        else
            log_error "Failed to start dev server within ${DEV_SERVER_TIMEOUT}s"
            exit 1
        fi
    fi

    # Step 8: Run E2E tests
    log_step "Running E2E tests"

    # Pass any additional arguments to playwright
    TEST_ARGS="${@:-}"

    if [ -n "$TEST_ARGS" ]; then
        log_info "Running with arguments: $TEST_ARGS"
        npx playwright test $TEST_ARGS
    else
        npx playwright test
    fi

    TEST_EXIT_CODE=$?

    if [ $TEST_EXIT_CODE -eq 0 ]; then
        log_success "All E2E tests passed!"
    else
        log_error "Some E2E tests failed (exit code: $TEST_EXIT_CODE)"
    fi

    # Return the test exit code
    exit $TEST_EXIT_CODE
}

# Run main function with all arguments
main "$@"
