#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to display status
status() {
    echo -e "${BLUE}🔍 $1${NC}"
}

# Function to display error
error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to display success
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Create logs directory if it doesn't exist
mkdir -p logs/{localstack,frontend,lambda}

# Function to aggregate logs
aggregate_logs() {
    local service=$1
    local log_file="logs/${service}/combined.log"
    
    status "Aggregating logs for ${service}..."
    
    # Get container logs
    docker-compose logs --no-color "$service" > "$log_file" 2>&1
    
    # Add service-specific logs if they exist
    if [ -d "logs/${service}" ]; then
        find "logs/${service}" -type f -name "*.log" ! -name "combined.log" -exec cat {} >> "$log_file" \;
    fi
    
    success "Logs aggregated in ${log_file}"
}

# Watch logs in real-time
watch_logs() {
    status "Watching logs in real-time..."
    docker-compose logs -f --tail=100
}

# Clean old logs
clean_logs() {
    status "Cleaning old logs..."
    find logs -type f -name "*.log" -mtime +7 -exec rm {} \;
    success "Old logs cleaned"
}

# Main execution
case "$1" in
    "watch")
        watch_logs
        ;;
    "clean")
        clean_logs
        ;;
    "aggregate")
        aggregate_logs "localstack"
        aggregate_logs "frontend"
        aggregate_logs "lambda-deployer"
        aggregate_logs "backend-builder"
        ;;
    *)
        echo "Usage: $0 {watch|clean|aggregate}"
        echo "  watch     - Watch logs in real-time"
        echo "  clean     - Clean logs older than 7 days"
        echo "  aggregate - Aggregate logs from all services"
        exit 1
        ;;
esac
