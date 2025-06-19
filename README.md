# 🎯 Polymarket Discord Bot & Betting Platform

A comprehensive Discord-to-Web betting system that integrates Discord bot commands with a modern web-based betting interface, featuring real-time market data from Polymarket's CLOB (Central Limit Order Book) WebSocket API.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discord Bot   │    │  Session API    │    │  Betting UI     │
│                 │    │                 │    │                 │
│ /markets cmd    │◄──►│ JWT + Redis     │◄──►│ Next.js App     │
│ Category Select │    │ Token Validation│    │ Live WebSocket  │
│ Market Display  │    │ Secure Sessions │    │ Real-time Odds  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │  Polymarket API │
                    │                 │
                    │ REST + CLOB WS  │
                    │ Live Odds Feed  │
                    └─────────────────┘
```

## 📋 Project Structure

```
polymarket-bot/
├── 📄 README.md                 # This comprehensive documentation
├── 🤖 discord-bot/              # Discord bot service (Node.js)
│   ├── 📦 package.json
│   ├── 🔐 .env.example
│   ├── 📁 src/
│   │   ├── 🚀 index.js          # Bot initialization & event handling
│   │   ├── 📁 commands/
│   │   │   └── 📊 markets.js    # /markets slash command with categories
│   │   └── 📁 utils/
│   │       ├── 🔗 session.js    # Secure session token generation
│   │       └── 📈 polymarket.js # Market data fetching & filtering
│   └── 🐳 deploy-commands.js    # Discord slash command deployment
├── 🌐 betting-ui/               # Next.js web interface
│   ├── 📦 package.json
│   ├── 🔐 .env.example
│   ├── 📁 pages/
│   │   ├── 🎯 bet/[token].tsx   # Main betting page with live odds
│   │   └── 🔧 api/              # API routes for session validation
│   ├── 📁 components/
│   │   ├── 💰 MarketAndBettingInterface.tsx # Market info & bet placement
│   │   ├── 📊 LiveOddsDisplay.tsx          # Real-time CLOB WebSocket odds
│   │   ├── 🎲 OddsCard.tsx                 # Interactive betting buttons
│   │   └── 🛡️ ErrorBoundary.tsx           # Error handling
│   ├── 📁 hooks/
│   │   └── 🔌 useWebSocket.ts   # CLOB WebSocket integration
│   ├── 📁 lib/
│   │   └── 🔐 api.ts            # Session validation & bet placement
│   ├── 📁 types/
│   │   └── 📝 index.ts          # TypeScript definitions
│   └── 📁 scripts/              # Testing & development tools
│       ├── 🧪 clob-websocket-test.ts      # WebSocket testing
│       ├── 🧮 odds-calculator.ts          # Odds conversion utilities
│       └── 📡 clob-test.ts                # CLOB API testing
├── 📁 deployment/               # Deployment configurations
├── 📊 tags.json                # Market category mappings
├── 🔧 config.js                # Configuration constants
└── 📜 *.sh scripts             # Automation & deployment scripts
```

## ✨ Key Features

### 🤖 Discord Bot Features

#### **📊 /markets Command**
- **Category Selection**: Interactive dropdown with 6 major categories:
  - 🏀 **NBA** - Basketball games and futures (with sub-types)
  - ⚾ **MLB** - Baseball games and futures  
  - 🏒 **NHL** - Hockey games and futures
  - ⚽ **FIFA Club World Cup** - International football
  - 🥊 **UFC** - Mixed martial arts
  - 🎮 **ESPORTS** - Gaming competitions

#### **🏀 NBA Market Sub-Categories**
- **💰 Moneyline** - Straight win/loss bets
- **📊 Over/Under** - Total points markets  
- **📏 Spread** - Point spread markets

#### **📈 Live Market Display**
- **Paginated Results**: 5 markets per page with navigation
- **Real-time Odds**: American & European formats
- **Market Information**: Volume, dates, teams, and probabilities
- **Interactive Buttons**: Direct links to betting interface
- **Smart Filtering**: Removes expired markets and wide spreads

#### **🔐 Secure Session Management**
- **Single-use Tokens**: JWT tokens with 5-minute expiry
- **User Context**: Preserves Discord user info and server context
- **Secure Handoff**: Seamless transition from Discord to web interface

### 🌐 Web Betting Interface Features

#### **📱 Modern Responsive Design**
- **Light Mode UI**: Clean, professional interface optimized for betting
- **Glass-morphism Effects**: Modern visual design with backdrop blur
- **Mobile-first**: Fully responsive across all device sizes
- **Accessibility**: Proper focus states and keyboard navigation

#### **🎯 Interactive Betting Experience**
- **Visual Clickability**: Enhanced button design with hover effects and clear CTAs
- **Selection Feedback**: Immediate visual feedback for outcome selection
- **Bet Calculator**: Real-time profit calculations and bet summaries
- **Two-step Confirmation**: Review → Confirm flow for bet placement

#### **📊 Live Market Data Integration**

##### **🔌 CLOB WebSocket Connection**
- **Real-time Updates**: Live connection to Polymarket's CLOB WebSocket
- **Multi-token Subscription**: Simultaneous tracking of all market outcomes
- **Connection Monitoring**: Visual indicators for connection status
- **Auto-reconnection**: Automatic reconnection with exponential backoff

##### **📈 Live Odds Display**
- **📊 Odds Format Toggle**: Switch between American (+/-217) and European (1.46) odds
- **Real-time Probabilities**: Live percentage updates from order book
- **Best Bid/Ask**: Current market prices with spread calculations
- **Connection Status**: Visual indicators (🟢 Connected, 🔴 Disconnected)
- **Last Update Timestamps**: Precise timing of last data refresh

##### **🔄 Recent Trades Feed**
- **Trade History**: Real-time feed of executed trades
- **Buy/Sell Indicators**: Color-coded trade direction
- **Trade Details**: Price, size, timestamp for each transaction
- **Rolling History**: Last 50 trades with automatic scrolling

#### **🛡️ Security & Session Management**
- **JWT Validation**: Secure token verification for all requests
- **Session Expiry**: Visual countdown with automatic redirect
- **CORS Protection**: Secure cross-origin request handling
- **Error Boundaries**: Graceful error handling and user feedback

#### **⚡ Performance Optimizations**
- **WebSocket Efficiency**: Single connection for multiple market subscriptions
- **Lazy Loading**: Components load as needed
- **Caching Strategy**: Smart caching of market data and user sessions
- **Fast Refresh**: Development-optimized hot reloading

## 🚀 Quick Start Guide

### 1. 📋 Prerequisites
```bash
# Required software
- Node.js 18+ 
- npm or yarn
- Discord Developer Account
- Redis instance (local or cloud)
```

### 2. 🔧 Environment Setup
```bash
# Clone repository
git clone <your-repo-url>
cd polymarket-bot

# Setup Discord Bot
cd discord-bot
cp .env.example .env
# Configure: DISCORD_TOKEN, DISCORD_CLIENT_ID, SESSION_API_URL
npm install

# Setup Betting UI  
cd ../betting-ui
cp .env.example .env
# Configure: NEXT_PUBLIC_API_URL, SESSION_SECRET
npm install
```

### 3. 🤖 Discord Bot Configuration

Create a Discord application at https://discord.com/developers/applications

```bash
# .env configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
SESSION_API_URL=http://localhost:3001  # or your deployed URL

# Deploy slash commands
npm run deploy-commands

# Start bot
npm run dev
```

### 4. 🌐 Web Interface Setup

```bash
# .env.local configuration  
NEXT_PUBLIC_API_URL=http://localhost:3001
SESSION_SECRET=your_jwt_secret_here
NEXT_PUBLIC_CLOB_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market

# Start development server
npm run dev
```

### 5. 🎯 Testing the Full Flow

1. **Discord**: Use `/markets` command in your Discord server
2. **Select Category**: Choose NBA, MLB, etc. from dropdown
3. **Browse Markets**: Navigate through paginated market listings  
4. **Click "Bet"**: Click betting button for desired market
5. **Web Interface**: Automatically opens secure betting page
6. **Live Odds**: View real-time odds with WebSocket connection
7. **Place Bet**: Select outcome, enter amount, confirm bet

## 🔧 Development & Testing

### 🧪 Testing Tools

#### **WebSocket Testing**
```bash
# Test CLOB WebSocket connection
cd betting-ui
npx ts-node scripts/clob-websocket-test.ts <market_id>

# Test odds calculations  
npx ts-node scripts/odds-calculator.ts

# Test market data fetching
npx ts-node scripts/clob-test.ts <market_id>
```

#### **Market Data Testing**
```bash
# Fetch NBA markets
./get_nba_markets.sh

# Check service status
./check-status.sh

# Start all services
./run-services.sh
```

### 🛠️ Development Commands

```bash
# Discord Bot
cd discord-bot
npm run dev          # Start with nodemon
npm run deploy       # Deploy slash commands
npm run start        # Production start

# Betting UI
cd betting-ui  
npm run dev          # Next.js development server
npm run build        # Production build
npm run start        # Production server
npm run type-check   # TypeScript validation
```

## 📚 API Documentation

### 🤖 Discord Bot Commands

#### `/markets`
- **Description**: Display live betting markets by category
- **Usage**: `/markets` → Select category → Browse → Click "Bet"
- **Categories**: NBA, MLB, NHL, FIFA, UFC, ESPORTS
- **Output**: Paginated market listings with betting buttons

### 🌐 Web API Endpoints

#### `GET /api/session/validate/:token`
- **Purpose**: Validate betting session token
- **Response**: Session data with user context and market info
- **Security**: JWT validation with expiry checking

#### `POST /api/bet/place`
- **Purpose**: Place a bet on selected outcome
- **Auth**: Required (JWT token)
- **Payload**: Outcome selection and bet amount
- **Response**: Bet confirmation with transaction details

### 🔌 WebSocket Integration

#### **CLOB WebSocket Endpoint**
- **URL**: `wss://ws-subscriptions-clob.polymarket.com/ws/market`
- **Protocol**: Subscribe to multiple token IDs for live odds
- **Data**: Real-time book updates, trades, and price changes
- **Reconnection**: Automatic with exponential backoff

## 🎨 User Interface Features

### 📊 Live Odds Display

#### **Odds Format Toggle**
- **American Odds**: +/-217 format with favorite/underdog indicators
- **European Odds**: 1.46 decimal format with probability context
- **Real-time Toggle**: Instant switching between formats
- **Visual Distinction**: Color-coded display (Green for favorites, Orange for underdogs)

#### **Market Information Cards**
- **Probability**: Real-time percentage from order book mid-price
- **Best Bid/Ask**: Current market prices with clear labeling
- **Spread**: Bid-ask spread as percentage
- **Volume & Liquidity**: Market depth information
- **Last Trade**: Most recent execution details

#### **Connection Status Indicators**
- **🟢 Connected**: Live data flowing from CLOB WebSocket
- **🟡 Connecting**: Establishing connection
- **🟠 Reconnecting**: Attempting to restore connection  
- **🔴 Disconnected**: No live data available

### 🎯 Betting Interface

#### **Enhanced Clickability**
- **Hover Effects**: Cards lift and scale on hover (105%)
- **Visual Feedback**: Immediate response to user interactions
- **Clear CTAs**: "👆 Tap to Select" and "🎯 Selected for Betting"
- **Status Indicators**: Color-coded selection dots and badges

#### **Bet Calculation**
- **Real-time Updates**: Instant profit calculations as user types
- **Potential Winnings**: Clear display of possible returns
- **Profit Breakdown**: Shows net profit after initial bet
- **Two-step Process**: Review → Confirm for safety

## 🔐 Security Implementation

### 🛡️ Session Security
- **Single-use Tokens**: JWT tokens become invalid after use
- **Short Expiry**: 5-minute session windows
- **User Context**: Preserves Discord identity through transition
- **Secure Handoff**: Encrypted data transfer between services

### 🔒 API Security  
- **CORS Protection**: Configured allowed origins
- **Rate Limiting**: Prevents abuse and spam
- **Input Validation**: Sanitized user inputs
- **Error Handling**: Secure error messages without data leakage

## 🚀 Deployment Options

### 🐳 Containerized Deployment
```bash
# Build and run with Docker
docker-compose up --build

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

### ☁️ Cloud Deployment

#### **Recommended Stack**
- **Discord Bot**: Railway, Render, or DigitalOcean
- **Betting UI**: Vercel, Netlify, or AWS Amplify  
- **Redis**: Upstash, AWS ElastiCache, or Redis Cloud
- **Domain**: Cloudflare for CDN and security

#### **Environment Variables**
```bash
# Production Discord Bot
DISCORD_TOKEN=prod_bot_token
SESSION_API_URL=https://your-api-domain.com

# Production Web UI
NEXT_PUBLIC_API_URL=https://your-api-domain.com
SESSION_SECRET=strong_production_secret
NEXT_PUBLIC_CLOB_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
```

## 🤝 Contributing

### 📝 Development Guidelines
1. **Code Style**: Follow existing TypeScript and JavaScript patterns
2. **Testing**: Add tests for new features and API endpoints
3. **Documentation**: Update README for significant changes
4. **Security**: Never commit sensitive tokens or keys

### 🔧 Pull Request Process
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request with detailed description

## 📊 Performance Metrics

### ⚡ Speed Benchmarks
- **Discord Response**: < 2 seconds for market listings
- **WebSocket Connection**: < 1 second initial connection
- **Live Odds Updates**: Real-time (< 100ms latency)
- **Page Load**: < 3 seconds for betting interface
- **Bet Placement**: < 5 seconds end-to-end

### 📈 Scalability Features
- **Horizontal Scaling**: Stateless design supports multiple instances
- **Caching**: Redis for session management and market data
- **WebSocket Pooling**: Efficient connection management
- **Database Optimization**: Indexed queries for fast market lookups

## 🆘 Troubleshooting

### 🔍 Common Issues

#### **Discord Bot Not Responding**
```bash
# Check bot token and permissions
npm run deploy-commands
# Verify bot has "applications.commands" scope
```

#### **WebSocket Connection Failed**
```bash
# Test CLOB endpoint directly
npx ts-node scripts/clob-websocket-test.ts <market_id>
# Check network connectivity and firewall settings
```

#### **Session Token Invalid**
```bash
# Verify JWT secret matches between services
# Check token expiry (5-minute limit)  
# Ensure Redis is running and accessible
```

### 📞 Support & Feedback

For issues, feature requests, or contributions:
- 🐛 **Bug Reports**: Open GitHub issue with reproduction steps
- 💡 **Feature Requests**: Describe use case and expected behavior  
- 📧 **Security Issues**: Contact maintainers directly
- 💬 **Questions**: Check existing issues or start a discussion

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Polymarket**: For providing robust CLOB WebSocket API
- **Discord.js**: Excellent Discord bot framework
- **Next.js**: Powerful React framework for web interface
- **TailwindCSS**: Beautiful utility-first CSS framework
- **Contributors**: All developers who have contributed to this project

---

**Built with ❤️ for the prediction market community** 