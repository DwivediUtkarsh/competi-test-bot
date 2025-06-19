#!/bin/bash

# Polymarket Discord Bot - Environment Setup Script
echo "🚀 Setting up Polymarket Discord Bot environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Generate a secure JWT secret
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d "=+/" | cut -c1-64
}

JWT_SECRET=$(generate_jwt_secret)

echo -e "${BLUE}📝 Creating environment files...${NC}"

# Create Discord Bot .env
echo -e "${YELLOW}Creating discord-bot/.env...${NC}"
cat > discord-bot/.env << EOF
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# Session API Configuration
SESSION_API_URL=http://localhost:3001
SESSION_SECRET=${JWT_SECRET}

# UI Domain Configuration
UI_DOMAIN=http://localhost:3000

# Polymarket API Configuration
POLYMARKET_API_URL=https://gamma-api.polymarket.com

# Environment
NODE_ENV=development
EOF

# Create Session API .env
echo -e "${YELLOW}Creating session-api/.env...${NC}"
cat > session-api/.env << EOF
# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Configuration
SESSION_SECRET=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_EXPIRY=5m

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Polymarket API
POLYMARKET_API_URL=https://gamma-api.polymarket.com
POLYMARKET_WS_URL=wss://stream.polymarket.com
EOF

# Create Betting UI .env
echo -e "${YELLOW}Creating betting-ui/.env.local...${NC}"
cat > betting-ui/.env.local << EOF
# Next.js Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=wss://stream.polymarket.com

# Internal API Configuration (for server-side)
SESSION_SECRET=${JWT_SECRET}
INTERNAL_API_URL=http://localhost:3001

# Polymarket API Configuration
NEXT_PUBLIC_POLYMARKET_API_URL=https://gamma-api.polymarket.com
POLYMARKET_WS_URL=wss://stream.polymarket.com/markets

# Environment
NODE_ENV=development
NEXT_PUBLIC_NODE_ENV=development
EOF

echo -e "${GREEN}✅ Environment files created successfully!${NC}"

# Check if Docker is available for Redis
if command -v docker &> /dev/null; then
    echo -e "${BLUE}🐳 Docker detected. Creating Redis container setup...${NC}"
    
    # Create docker-compose for Redis
    cat > docker-compose.redis.yml << EOF
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    container_name: polymarket-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
EOF

    echo -e "${GREEN}✅ Redis Docker setup created (docker-compose.redis.yml)${NC}"
    
    # Start Redis container
    echo -e "${YELLOW}Starting Redis container...${NC}"
    docker-compose -f docker-compose.redis.yml up -d
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Redis container started successfully!${NC}"
    else
        echo -e "${RED}❌ Failed to start Redis container. Please start it manually.${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Docker not found. Please install Redis manually or via Docker.${NC}"
    echo -e "${BLUE}   Ubuntu/Debian: sudo apt update && sudo apt install redis-server${NC}"
    echo -e "${BLUE}   macOS: brew install redis${NC}"
    echo -e "${BLUE}   Windows: Download from https://redis.io/download${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Setup complete! Next steps:${NC}"
echo ""
echo -e "${BLUE}1. Configure Discord Bot Token:${NC}"
echo -e "   - Go to https://discord.com/developers/applications"
echo -e "   - Create a new application and bot"
echo -e "   - Copy the bot token and replace 'your_discord_bot_token_here' in discord-bot/.env"
echo -e "   - Copy the application ID and replace 'your_discord_client_id_here' in discord-bot/.env"
echo ""
echo -e "${BLUE}2. Install dependencies and start services:${NC}"
echo -e "   ${YELLOW}# Install dependencies${NC}"
echo -e "   cd discord-bot && npm install && cd .."
echo -e "   cd session-api && npm install && cd .."
echo -e "   cd betting-ui && npm install && cd .."
echo ""
echo -e "   ${YELLOW}# Start all services (run each in separate terminal)${NC}"
echo -e "   cd session-api && npm run dev"
echo -e "   cd betting-ui && npm run dev"
echo -e "   cd discord-bot && npm run dev"
echo ""
echo -e "${BLUE}3. Deploy Discord commands:${NC}"
echo -e "   cd discord-bot && node src/deploy-commands.js"
echo ""
echo -e "${GREEN}🚀 Your Discord bot will be ready at http://localhost:3000${NC}" 