#!/bin/bash

# Polymarket Discord Bot - Service Launcher
echo "🚀 Starting Polymarket Discord Bot services..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a service is running
check_service() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${GREEN}✅ $service is running on port $port${NC}"
        return 0
    else
        echo -e "${RED}❌ $service is not running on port $port${NC}"
        return 1
    fi
}

# Function to wait for service to start
wait_for_service() {
    local port=$1
    local service=$2
    local max_wait=60  # Increased from 30 to 60 seconds for Next.js
    local wait_time=0
    
    echo -e "${YELLOW}⏳ Waiting for $service to start on port $port...${NC}"
    
    while [ $wait_time -lt $max_wait ]; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
            echo -e "${GREEN}✅ $service is ready!${NC}"
            # Additional check for HTTP services
            if [ "$port" == "3000" ]; then
                if curl -f -s http://localhost:3000 >/dev/null 2>&1; then
                    return 0
                fi
            elif [ "$port" == "3001" ]; then
                if curl -f -s http://localhost:3001/health >/dev/null 2>&1; then
                    return 0
                fi
            else
                return 0
            fi
        fi
        sleep 3  # Increased from 2 to 3 seconds
        wait_time=$((wait_time + 3))
        echo -ne "${YELLOW}   Waiting... ${wait_time}s${NC}\r"
    done
    
    echo -e "${RED}❌ $service failed to start within ${max_wait}s${NC}"
    return 1
}

# Check if Redis is running
echo -e "${BLUE}🔍 Checking Redis connection...${NC}"
if redis-cli ping >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is running${NC}"
elif docker ps | grep -q polymarket-redis; then
    echo -e "${GREEN}✅ Redis Docker container is running${NC}"
else
    echo -e "${YELLOW}⚠️  Redis not detected. Starting Docker container...${NC}"
    if [ -f "docker-compose.redis.yml" ]; then
        docker-compose -f docker-compose.redis.yml up -d
        sleep 3
        if docker ps | grep -q polymarket-redis; then
            echo -e "${GREEN}✅ Redis Docker container started${NC}"
        else
            echo -e "${RED}❌ Failed to start Redis. Please install Redis manually.${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Redis not available and docker-compose.redis.yml not found.${NC}"
        echo -e "${BLUE}Run the setup script first: ./setup-env.sh${NC}"
        exit 1
    fi
fi

# Kill existing processes on ports (optional cleanup)
echo -e "${BLUE}🧹 Checking for existing processes...${NC}"
for port in 3000 3001; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}⚠️  Port $port is in use. Killing existing process...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
done

# Create log directory
mkdir -p logs

echo -e "${BLUE}🎯 Starting services in sequence...${NC}"

# Start Session API first (backend dependency)
echo -e "${YELLOW}1. Starting Session API...${NC}"
cd session-api
npm run dev > ../logs/session-api.log 2>&1 &
SESSION_API_PID=$!
cd ..

# Wait for Session API to be ready
if wait_for_service 3001 "Session API"; then
    echo -e "${GREEN}✅ Session API started (PID: $SESSION_API_PID)${NC}"
else
    echo -e "${RED}❌ Failed to start Session API${NC}"
    kill $SESSION_API_PID 2>/dev/null || true
    exit 1
fi

# Start Betting UI
echo -e "${YELLOW}2. Starting Betting UI...${NC}"
cd betting-ui
npm run dev > ../logs/betting-ui.log 2>&1 &
BETTING_UI_PID=$!
cd ..

# Wait for Betting UI to be ready
if wait_for_service 3000 "Betting UI"; then
    echo -e "${GREEN}✅ Betting UI started (PID: $BETTING_UI_PID)${NC}"
else
    echo -e "${RED}❌ Failed to start Betting UI${NC}"
    kill $SESSION_API_PID $BETTING_UI_PID 2>/dev/null || true
    exit 1
fi

# Start Discord Bot (last, as it depends on the other services)
echo -e "${YELLOW}3. Starting Discord Bot...${NC}"
cd discord-bot

# Check if Discord token is configured
if grep -q "your_discord_bot_token_here" .env; then
    echo -e "${RED}❌ Discord bot token not configured!${NC}"
    echo -e "${BLUE}Please edit discord-bot/.env and add your Discord bot token${NC}"
    echo -e "${BLUE}Get it from: https://discord.com/developers/applications${NC}"
    
    # Keep other services running
    echo -e "${YELLOW}⚠️  Discord bot not started, but other services are running:${NC}"
    echo -e "${GREEN}   - Session API: http://localhost:3001${NC}"
    echo -e "${GREEN}   - Betting UI: http://localhost:3000${NC}"
    echo -e "${BLUE}Configure Discord token and run: cd discord-bot && npm run dev${NC}"
else
    npm run dev > ../logs/discord-bot.log 2>&1 &
    DISCORD_BOT_PID=$!
    echo -e "${GREEN}✅ Discord Bot started (PID: $DISCORD_BOT_PID)${NC}"
fi

cd ..

echo ""
echo -e "${GREEN}🎉 Services are running!${NC}"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
check_service 3001 "Session API"
check_service 3000 "Betting UI"
echo ""
echo -e "${BLUE}🌐 Access URLs:${NC}"
echo -e "${GREEN}   • Betting UI: http://localhost:3000${NC}"
echo -e "${GREEN}   • Session API: http://localhost:3001${NC}"
echo -e "${GREEN}   • API Health: http://localhost:3001/health${NC}"
echo ""
echo -e "${BLUE}📝 Logs:${NC}"
echo -e "${GREEN}   • Session API: tail -f logs/session-api.log${NC}"
echo -e "${GREEN}   • Betting UI: tail -f logs/betting-ui.log${NC}"
echo -e "${GREEN}   • Discord Bot: tail -f logs/discord-bot.log${NC}"
echo ""
echo -e "${YELLOW}💡 To stop all services: ./stop-services.sh${NC}"
echo -e "${YELLOW}🎮 To test Discord bot: Use /market command in your Discord server${NC}"

# Save PIDs for cleanup script
cat > .service-pids << EOF
SESSION_API_PID=$SESSION_API_PID
BETTING_UI_PID=$BETTING_UI_PID
DISCORD_BOT_PID=${DISCORD_BOT_PID:-}
EOF

echo ""
echo -e "${GREEN}✨ Setup complete! Your Discord betting bot is ready to use.${NC}" 