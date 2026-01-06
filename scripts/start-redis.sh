#!/bin/bash
# start-redis.sh - Start Redis on a non-standard port for snap-caddy
# Uses port 6397 to avoid collisions with default Redis (6379)

set -e

REDIS_PORT=${REDIS_PORT:-6397}
REDIS_DATA_DIR="${REDIS_DATA_DIR:-/tmp/snap-caddy-redis}"
REDIS_LOG_FILE="${REDIS_DATA_DIR}/redis.log"
REDIS_PID_FILE="${REDIS_DATA_DIR}/redis.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Redis is installed
check_redis_installed() {
    if ! command -v redis-server &> /dev/null; then
        log_error "redis-server not found. Installing..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y redis-server
        elif command -v apk &> /dev/null; then
            apk add --no-cache redis
        elif command -v yum &> /dev/null; then
            sudo yum install -y redis
        else
            log_error "Cannot install Redis. Please install manually."
            exit 1
        fi
    fi
}

# Check if Redis is already running on our port
is_redis_running() {
    if [ -f "$REDIS_PID_FILE" ]; then
        local pid=$(cat "$REDIS_PID_FILE" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    # Also check if something is listening on the port
    if command -v nc &> /dev/null; then
        nc -z localhost "$REDIS_PORT" 2>/dev/null && return 0
    elif command -v redis-cli &> /dev/null; then
        redis-cli -p "$REDIS_PORT" ping &>/dev/null && return 0
    fi
    return 1
}

# Start Redis
start_redis() {
    log_info "Creating data directory: $REDIS_DATA_DIR"
    mkdir -p "$REDIS_DATA_DIR"

    log_info "Starting Redis on port $REDIS_PORT..."

    # Start Redis with custom configuration
    redis-server \
        --port "$REDIS_PORT" \
        --daemonize yes \
        --pidfile "$REDIS_PID_FILE" \
        --logfile "$REDIS_LOG_FILE" \
        --dir "$REDIS_DATA_DIR" \
        --appendonly no \
        --save "" \
        --bind 127.0.0.1 \
        --maxmemory 100mb \
        --maxmemory-policy allkeys-lru

    # Wait for Redis to start
    local retries=10
    while [ $retries -gt 0 ]; do
        if redis-cli -p "$REDIS_PORT" ping &>/dev/null; then
            log_info "Redis started successfully on port $REDIS_PORT"
            return 0
        fi
        retries=$((retries - 1))
        sleep 0.5
    done

    log_error "Failed to start Redis"
    if [ -f "$REDIS_LOG_FILE" ]; then
        log_error "Log output:"
        tail -20 "$REDIS_LOG_FILE"
    fi
    exit 1
}

# Stop Redis
stop_redis() {
    if [ -f "$REDIS_PID_FILE" ]; then
        local pid=$(cat "$REDIS_PID_FILE" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping Redis (PID: $pid)..."
            redis-cli -p "$REDIS_PORT" shutdown nosave 2>/dev/null || kill "$pid" 2>/dev/null
            rm -f "$REDIS_PID_FILE"
            log_info "Redis stopped"
            return 0
        fi
    fi
    # Try to stop via redis-cli if pid file doesn't exist
    if redis-cli -p "$REDIS_PORT" ping &>/dev/null; then
        log_info "Stopping Redis on port $REDIS_PORT..."
        redis-cli -p "$REDIS_PORT" shutdown nosave 2>/dev/null
        log_info "Redis stopped"
        return 0
    fi
    log_warn "Redis is not running"
}

# Get Redis status
status_redis() {
    if is_redis_running; then
        log_info "Redis is running on port $REDIS_PORT"
        redis-cli -p "$REDIS_PORT" info server 2>/dev/null | grep -E "^(redis_version|uptime_in_seconds|connected_clients):" || true
        return 0
    else
        log_warn "Redis is not running on port $REDIS_PORT"
        return 1
    fi
}

# Print connection URL
print_url() {
    echo "redis://localhost:$REDIS_PORT"
}

# Main
case "${1:-start}" in
    start)
        check_redis_installed
        if is_redis_running; then
            log_info "Redis is already running on port $REDIS_PORT"
        else
            start_redis
        fi
        print_url
        ;;
    stop)
        stop_redis
        ;;
    restart)
        stop_redis
        sleep 1
        check_redis_installed
        start_redis
        print_url
        ;;
    status)
        status_redis
        ;;
    url)
        print_url
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|url}"
        echo ""
        echo "Environment variables:"
        echo "  REDIS_PORT     - Port to run Redis on (default: 6397)"
        echo "  REDIS_DATA_DIR - Data directory (default: /tmp/snap-caddy-redis)"
        exit 1
        ;;
esac
