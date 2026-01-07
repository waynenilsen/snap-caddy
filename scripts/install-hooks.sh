#!/bin/bash
# Install git hooks for snap-caddy

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR/hooks"
GIT_HOOKS_DIR="$SCRIPT_DIR/../.git/hooks"

# Ensure .git/hooks directory exists
if [ ! -d "$GIT_HOOKS_DIR" ]; then
    echo "Error: .git/hooks directory not found. Are you in a git repository?"
    exit 1
fi

# Install pre-commit hook
if [ -f "$HOOKS_DIR/pre-commit" ]; then
    cp "$HOOKS_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
    chmod +x "$GIT_HOOKS_DIR/pre-commit"
    echo "Installed pre-commit hook"
fi

echo "Git hooks installed successfully!"
