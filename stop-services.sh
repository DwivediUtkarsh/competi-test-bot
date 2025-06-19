#!/bin/bash

# Polymarket Discord Bot - Service Stopper
echo "🛑 Stopping Polymarket Discord Bot services..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to stop a process
stop_process() {
    local pid=$1
    local service=$2
    
    if [ -n "$pid" ] && kill -0 $pid 2>/dev/null; then
        echo -e "${YELLOW}Stopping $service (PID: $pid)...${NC}"
        kill $pid
        
        # Wait for graceful shutdown
        local count=0
        while [ $count -lt 10 ] && kill -0 $pid 2>/dev/null; do
            sleep 1
            count=$((count + 1))
        done
        
        # Force kill if still running
        if kill -0 $pid 2>/dev/null; then
            echo -e "${RED}Force killing $service...${NC}"
            kill -9 $pid 2>/dev/null
        fi
        
        echo -e "${GREEN}✅ $service stopped${NC}"
    else
        echo -e "${BLUE}$service not running${NC}"
    fi
}

# Stop processes by port
stop_by_port() {
    local port=$1
    local service=$2
    
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Stopping $service on port $port...${NC}"
        echo $pids | xargs kill -9 2>/dev/null
        echo -e "${GREEN}✅ $service stopped${NC}"
    else
        echo -e "${BLUE}No process running on port $port${NC}"
    fi
}

# Read PIDs from file if it exists
if [ -f ".service-pids" ]; then
    echo -e "${BLUE}📋 Reading service PIDs...${NC}"
    source .service-pids
    
    stop_process $DISCORD_BOT_PID "Discord Bot"
    stop_process $BETTING_UI_PID "Betting UI"
    stop_process $SESSION_API_PID "Session API"
    
    # Clean up PID file
    rm -f .service-pids
else
    echo -e "${YELLOW}⚠️  No PID file found, stopping by port...${NC}"
    stop_by_port 3000 "Betting UI"
    stop_by_port 3001 "Session API"
fi

# Stop Redis Docker container if running
if docker ps | grep -q polymarket-redis; then
    echo -e "${YELLOW}Stopping Redis Docker container...${NC}"
    docker stop polymarket-redis >/dev/null 2>&1
    echo -e "${GREEN}✅ Redis container stopped${NC}"
fi

# Clean up log files (optional)
if [ -d "logs" ]; then
    echo -e "${BLUE}🧹 Cleaning up log files...${NC}"
    rm -rf logs
    echo -e "${GREEN}✅ Log files cleaned${NC}"
fi

echo ""
echo -e "${GREEN}🎉 All services stopped successfully!${NC}"
echo ""
echo -e "${BLUE}💡 To start services again: ./run-services.sh${NC}" 