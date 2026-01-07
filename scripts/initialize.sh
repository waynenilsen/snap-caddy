#!/bin/bash
# initialize.sh - Initialize the Snap Caddy development environment
# This script sets up everything needed for a good running environment in Claude Code web

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Main initialization
main() {
    log_step "Snap Caddy Environment Initialization"

    cd "$PROJECT_ROOT"

    # Step 1: Check Bun (preferred) or Node.js
    log_step "Checking Runtime"
    if command_exists bun; then
        BUN_VERSION=$(bun --version)
        log_success "Bun is installed: v$BUN_VERSION"
        PKG_MANAGER="bun"
    elif command_exists node; then
        NODE_VERSION=$(node --version)
        log_warn "Bun not found. Using Node.js: $NODE_VERSION"
        PKG_MANAGER="npm"
    else
        log_error "Neither Bun nor Node.js is installed."
        log_info "Please install Bun (recommended): curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi

    # Step 2: Install dependencies
    log_step "Installing Dependencies"
    if [ -d "node_modules" ] && [ -f "bun.lock" ] || [ -f "node_modules/.package-lock.json" ]; then
        log_info "Dependencies appear to be installed. Running install to ensure they're up to date..."
    fi

    if [ "$PKG_MANAGER" = "bun" ]; then
        bun install
    else
        npm install
    fi
    log_success "Dependencies installed"

    # Step 3: Install git hooks
    log_step "Installing Git Hooks"
    if [ -f "$SCRIPT_DIR/install-hooks.sh" ]; then
        chmod +x "$SCRIPT_DIR/install-hooks.sh"
        "$SCRIPT_DIR/install-hooks.sh"
    else
        log_warn "install-hooks.sh not found. Skipping hook installation."
    fi

    # Step 4: Verify TypeScript compilation
    log_step "Verifying TypeScript"
    log_info "Running typecheck..."
    if [ "$PKG_MANAGER" = "bun" ]; then
        if bun run typecheck; then
            log_success "TypeScript compilation successful"
        else
            log_warn "TypeScript has some errors (non-blocking for development)"
        fi
    else
        if npm run typecheck; then
            log_success "TypeScript compilation successful"
        else
            log_warn "TypeScript has some errors (non-blocking for development)"
        fi
    fi

    # Step 5: Run linting check
    log_step "Checking Code Quality"
    log_info "Running Biome lint check..."
    if [ "$PKG_MANAGER" = "bun" ]; then
        bun run lint || log_warn "Some lint issues found (run 'bun lint:fix' to auto-fix)"
    else
        npm run lint || log_warn "Some lint issues found (run 'npm run lint:fix' to auto-fix)"
    fi

    # Step 6: Create temp directories
    log_step "Creating Required Directories"
    TEMP_DIR="${TEMP_DIR:-/tmp/snap-caddy}"
    mkdir -p "$TEMP_DIR"
    log_success "Temp directory ready: $TEMP_DIR"

    # Summary
    log_step "Initialization Complete"
    echo ""
    log_success "Environment is ready for development!"
    echo ""
    echo "Quick commands:"
    echo "  ${GREEN}bun dev${NC}          - Start development server"
    echo "  ${GREEN}bun test${NC}         - Run unit tests"
    echo "  ${GREEN}bun lint:fix${NC}     - Fix lint issues"
    echo "  ${GREEN}bun format${NC}       - Format code"
    echo ""
}

# Run main function
main "$@"
