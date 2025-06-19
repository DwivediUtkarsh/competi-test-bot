#!/bin/bash

# Polymarket Discord Bot - Status Checker
echo "🔍 Checking Polymarket Discord Bot status..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check service status
check_service_status() {
    local port=$1
    local service=$2
    local url=$3
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        if curl -f -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service is running and responding${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  $service is running but not responding${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ $service is not running${NC}"
        return 1
    fi
}

echo ""
echo -e "${BLUE}📊 Service Status Check:${NC}"
echo ""

# Check Redis
echo -n "🗄️  Redis: "
if redis-cli ping >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not running${NC}"
fi

# Check Session API
echo -n "🔗 Session API: "
check_service_status 3001 "Session API" "http://localhost:3001/health"

# Check Betting UI
echo -n "🎮 Betting UI: "
check_service_status 3000 "Betting UI" "http://localhost:3000"

echo ""
echo -e "${BLUE}🌐 Service URLs:${NC}"
echo -e "${GREEN}   • Betting UI: http://localhost:3000${NC}"
echo -e "${GREEN}   • Session API: http://localhost:3001${NC}"
echo -e "${GREEN}   • API Health: http://localhost:3001/health${NC}"

echo ""
echo -e "${BLUE}🧪 Testing API Endpoints:${NC}"

# Test API Health
echo -n "📋 API Health Check: "
if response=$(curl -s http://localhost:3001/health 2>/dev/null); then
    if echo "$response" | grep -q '"status":"OK"'; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  Unhealthy response${NC}"
    fi
else
    echo -e "${RED}❌ No response${NC}"
fi

# Test Betting UI Homepage
echo -n "🏠 Betting UI Homepage: "
if curl -f -s http://localhost:3000 | grep -q "Polymarket Betting Interface" 2>/dev/null; then
    echo -e "${GREEN}✅ Loading correctly${NC}"
else
    echo -e "${RED}❌ Not loading correctly${NC}"
fi

echo ""
echo -e "${BLUE}📝 Recent Logs (last 5 lines):${NC}"

if [ -f "logs/session-api.log" ]; then
    echo -e "${YELLOW}Session API:${NC}"
    tail -5 logs/session-api.log | sed 's/^/  /'
fi

if [ -f "logs/betting-ui.log" ]; then
    echo -e "${YELLOW}Betting UI:${NC}"
    tail -5 logs/betting-ui.log | sed 's/^/  /'
fi

echo ""
echo -e "${BLUE}💡 Next Steps:${NC}"

# Check if Discord bot token is configured
if [ -f "discord-bot/.env" ] && grep -q "your_discord_bot_token_here" discord-bot/.env; then
    echo -e "${YELLOW}1. Configure Discord Bot Token:${NC}"
    echo -e "   Edit discord-bot/.env and add your Discord bot token"
    echo -e "   Get it from: https://discord.com/developers/applications"
    echo -e "   Then run: cd discord-bot && npm run dev"
    echo ""
fi

echo -e "${GREEN}2. Deploy Discord Commands:${NC}"
echo -e "   cd discord-bot && node src/deploy-commands.js"
echo ""
echo -e "${GREEN}3. Test the Discord Bot:${NC}"
echo -e "   Use /market command in your Discord server"
echo ""
echo -e "${GREEN}4. Test Betting Flow:${NC}"
echo -e "   Click the bet buttons to see if they redirect to localhost:3000"

echo ""
echo -e "${GREEN}🎉 Your Discord betting bot is ready to use!${NC}" 