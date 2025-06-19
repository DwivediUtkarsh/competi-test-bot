# 📡 Polymarket CLOB WebSocket Guide

A comprehensive guide to understanding and implementing Polymarket's Central Limit Order Book (CLOB) WebSocket for real-time market data.

## 🌐 Overview

Polymarket provides a real-time WebSocket API through their CLOB (Central Limit Order Book) system that delivers live market data including order book updates, price changes, trade executions, and market events. This WebSocket is essential for building real-time betting applications and market monitoring tools.

## 🔌 Connection Details

### **WebSocket Endpoint**
```
wss://ws-subscriptions-clob.polymarket.com/ws/market
```

### **Connection Characteristics**
- **Protocol**: WebSocket (WSS - Secure)
- **Authentication**: None required (public market data)
- **Rate Limiting**: Generous limits for real-time data
- **Heartbeat**: Ping/Pong mechanism every 30 seconds
- **Reconnection**: Client-side implementation required

### **Connection Example**
```javascript
const ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');

ws.on('open', () => {
  console.log('🟢 CLOB WebSocket Connected');
  
  // Subscribe to market data
  ws.send(JSON.stringify({
    type: 'MARKET',
    assets_ids: ['token_id_1', 'token_id_2'],
    initial_dump: true
  }));
});
```

## 📋 Subscription Format

### **Market Subscription Message**
```typescript
interface MarketSubscription {
  type: 'MARKET';
  assets_ids: string[];           // Array of token IDs to subscribe to
  initial_dump?: boolean;         // Get current order book state
}
```

### **Example Subscription**
```javascript
// Subscribe to multiple tokens
const subscription = {
  type: 'MARKET',
  assets_ids: [
    '0x1a15354f06e5e8e79dd69e6e9b9b6b4b2b2b2b2b',
    '0x2b25354f06e5e8e79dd69e6e9b9b6b4b2b2b2b2b'
  ],
  initial_dump: true
};

ws.send(JSON.stringify(subscription));
```

## 📨 Message Types & Events

### **1. Book Updates (Most Important)**

#### **Event Type: `book`**
Real-time order book updates with current bids and asks.

```typescript
interface BookMessage {
  event_type: 'book';
  asset_id: string;               // Token ID
  market: string;                 // Market ID
  timestamp: string;              // ISO timestamp
  hash: string;                   // Data integrity hash
  bids: OrderEntry[];             // Buy orders (highest first)
  asks: OrderEntry[];             // Sell orders (lowest first)
}

interface OrderEntry {
  price: string;                  // Price as string (e.g., "0.65")
  size: string;                   // Size as string (e.g., "1000.5")
}
```

#### **Example Book Message**
```json
{
  "event_type": "book",
  "asset_id": "0x1a15354f06e5e8e79dd69e6e9b9b6b4b2b2b2b2b",
  "market": "0x123...",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "hash": "0xabc123...",
  "bids": [
    { "price": "0.68", "size": "1500.0" },
    { "price": "0.67", "size": "2000.0" },
    { "price": "0.66", "size": "500.0" }
  ],
  "asks": [
    { "price": "0.69", "size": "1200.0" },
    { "price": "0.70", "size": "800.0" },
    { "price": "0.71", "size": "1000.0" }
  ]
}
```

### **2. Price Changes**

#### **Event Type: `price_change`**
Incremental updates when order book prices change.

```typescript
interface PriceChangeMessage {
  event_type: 'price_change';
  asset_id: string;
  market: string;
  timestamp: string;
  hash: string;
  changes: PriceChange[];
}

interface PriceChange {
  price: string;                  // Price level
  size: string;                   // New size (0 = removed)
  side: 'bid' | 'ask';           // Order side
}
```

#### **Example Price Change**
```json
{
  "event_type": "price_change",
  "asset_id": "0x1a15354f06e5e8e79dd69e6e9b9b6b4b2b2b2b2b",
  "market": "0x123...",
  "timestamp": "2024-01-15T10:30:46.456Z",
  "hash": "0xdef456...",
  "changes": [
    { "price": "0.68", "size": "1200.0", "side": "bid" },
    { "price": "0.69", "size": "0", "side": "ask" }
  ]
}
```

### **3. Trade Executions**

#### **Event Type: `last_trade_price`**
Real-time trade execution data.

```typescript
interface LastTradePriceMessage {
  event_type: 'last_trade_price';
  asset_id: string;
  market: string;
  price: string;                  // Execution price
  side: 'BUY' | 'SELL';          // Trade direction
  size: string;                   // Trade size
  fee_rate_bps: string;          // Fee in basis points
  timestamp: string;              // Execution timestamp
}
```

#### **Example Trade Execution**
```json
{
  "event_type": "last_trade_price",
  "asset_id": "0x1a15354f06e5e8e79dd69e6e9b9b6b4b2b2b2b2b",
  "market": "0x123...",
  "price": "0.685",
  "side": "BUY",
  "size": "250.0",
  "fee_rate_bps": "100",
  "timestamp": "2024-01-15T10:30:47.789Z"
}
```

### **4. Tick Size Changes**

#### **Event Type: `tick_size_change`**
When market tick size (minimum price increment) changes.

```typescript
interface TickSizeChangeMessage {
  event_type: 'tick_size_change';
  asset_id: string;
  market: string;
  old_tick_size: string;
  new_tick_size: string;
  timestamp: string;
}
```

## 📊 Calculating Live Odds from WebSocket Data

### **From Order Book to Betting Odds**

```javascript
function calculateOddsFromBook(bookMessage) {
  const { bids, asks } = bookMessage;
  
  // Sort orders for best prices
  const sortedBids = bids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  const sortedAsks = asks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  
  // Get best bid (highest) and best ask (lowest)
  const bestBid = sortedBids.length ? parseFloat(sortedBids[0].price) : 0;
  const bestAsk = sortedAsks.length ? parseFloat(sortedAsks[0].price) : 1;
  
  // Calculate mid-price (implied probability)
  const midPrice = (bestBid + bestAsk) / 2;
  const probability = midPrice * 100; // Convert to percentage
  
  // Calculate spread
  const spread = bestAsk - bestBid;
  const spreadPercent = (spread / midPrice) * 100;
  
  return {
    probability: probability,           // 68.5%
    midPrice: midPrice,                // 0.685
    bestBid: bestBid,                  // 0.68
    bestAsk: bestAsk,                  // 0.69
    spread: spreadPercent,             // 1.46%
    americanOdds: calculateAmericanOdds(probability),
    europeanOdds: calculateEuropeanOdds(probability)
  };
}

function calculateAmericanOdds(probability) {
  const decimal = probability / 100;
  if (decimal > 0.5) {
    return Math.round(-(decimal / (1 - decimal)) * 100); // -217
  } else {
    return Math.round(((1 - decimal) / decimal) * 100);  // +217
  }
}

function calculateEuropeanOdds(probability) {
  return parseFloat((100 / probability).toFixed(2)); // 1.46
}
```

## 🔄 Connection Management

### **Heartbeat Implementation**
```javascript
// Send ping every 30 seconds
const pingInterval = setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send('ping');
  }
}, 30000);

// Handle pong responses
ws.on('message', (data) => {
  const message = data.toString();
  if (message === 'pong') {
    console.log('💓 Heartbeat received');
    return;
  }
  
  // Process actual market data
  handleMarketMessage(JSON.parse(message));
});
```

### **Auto-Reconnection Logic**
```javascript
class CLOBWebSocket {
  constructor(tokenIds) {
    this.tokenIds = tokenIds;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.connect();
  }
  
  connect() {
    this.ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');
    
    this.ws.onopen = () => {
      console.log('🟢 Connected to CLOB WebSocket');
      this.reconnectAttempts = 0;
      this.subscribe();
    };
    
    this.ws.onclose = () => {
      console.log('🔴 CLOB WebSocket closed');
      this.attemptReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
  }
  
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('💀 Max reconnection attempts reached');
    }
  }
  
  subscribe() {
    const subscription = {
      type: 'MARKET',
      assets_ids: this.tokenIds,
      initial_dump: true
    };
    
    this.ws.send(JSON.stringify(subscription));
  }
}
```

## 📈 Real-Time Data Processing

### **Order Book State Management**
```javascript
class OrderBookManager {
  constructor() {
    this.orderBooks = new Map(); // tokenId -> orderBook
  }
  
  handleBookMessage(message) {
    const { asset_id, bids, asks, timestamp } = message;
    
    // Update full order book
    this.orderBooks.set(asset_id, {
      bids: this.sortOrders(bids, 'desc'),
      asks: this.sortOrders(asks, 'asc'),
      lastUpdate: timestamp
    });
    
    // Calculate and emit live odds
    const odds = this.calculateOdds(asset_id);
    this.emitOddsUpdate(asset_id, odds);
  }
  
  handlePriceChange(message) {
    const { asset_id, changes } = message;
    const orderBook = this.orderBooks.get(asset_id);
    
    if (!orderBook) return;
    
    // Apply incremental changes
    changes.forEach(change => {
      const { price, size, side } = change;
      const orders = side === 'bid' ? orderBook.bids : orderBook.asks;
      
      if (parseFloat(size) === 0) {
        // Remove price level
        this.removePriceLevel(orders, price);
      } else {
        // Update or add price level
        this.updatePriceLevel(orders, price, size);
      }
    });
    
    // Re-sort and recalculate odds
    orderBook.bids = this.sortOrders(orderBook.bids, 'desc');
    orderBook.asks = this.sortOrders(orderBook.asks, 'asc');
    
    const odds = this.calculateOdds(asset_id);
    this.emitOddsUpdate(asset_id, odds);
  }
  
  sortOrders(orders, direction) {
    return orders.sort((a, b) => {
      const priceA = parseFloat(a.price);
      const priceB = parseFloat(b.price);
      return direction === 'desc' ? priceB - priceA : priceA - priceB;
    });
  }
}
```

## 🎯 Usage in React Applications

### **Custom Hook Implementation**
```typescript
import { useState, useEffect, useRef, useCallback } from 'react';

interface LiveOdds {
  tokenId: string;
  probability: number;
  midPrice: number;
  spread: number;
  americanOdds: number;
  europeanOdds: number;
  bestBid: number;
  bestAsk: number;
  timestamp: number;
}

export function useCLOBWebSocket(tokenIds: string[]) {
  const [liveOdds, setLiveOdds] = useState<Record<string, LiveOdds>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setConnectionStatus('connecting');
    wsRef.current = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');
    
    wsRef.current.onopen = () => {
      console.log('🟢 CLOB WebSocket connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      
      // Subscribe to tokens
      const subscription = {
        type: 'MARKET',
        assets_ids: tokenIds,
        initial_dump: true
      };
      
      wsRef.current?.send(JSON.stringify(subscription));
    };
    
    wsRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.event_type === 'book') {
          handleBookMessage(message);
        } else if (message.event_type === 'last_trade_price') {
          handleTradeMessage(message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    wsRef.current.onclose = () => {
      console.log('🔴 CLOB WebSocket disconnected');
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      // Attempt reconnection
      reconnectTimeoutRef.current = setTimeout(() => {
        setConnectionStatus('reconnecting');
        connect();
      }, 3000);
    };
    
    wsRef.current.onerror = (error) => {
      console.error('❌ CLOB WebSocket error:', error);
      setConnectionStatus('error');
    };
  }, [tokenIds]);
  
  const handleBookMessage = useCallback((message: any) => {
    const odds = calculateOddsFromBook(message);
    
    setLiveOdds(prev => ({
      ...prev,
      [message.asset_id]: {
        ...odds,
        tokenId: message.asset_id,
        timestamp: Date.now()
      }
    }));
  }, []);
  
  useEffect(() => {
    if (tokenIds.length > 0) {
      connect();
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect, tokenIds]);
  
  return {
    liveOdds,
    isConnected,
    connectionStatus
  };
}
```

## 🔍 Testing & Debugging

### **WebSocket Testing Script**
```bash
# Test WebSocket connection with a specific market
npx ts-node scripts/clob-websocket-test.ts <market_id>
```

### **Sample Test Output**
```
📡  Fetching market 0x123... from https://gamma-api.polymarket.com...
✅  Found 2 tokenIds:
   • [0] 0x1a15354f06e5e8e79dd69e6e9b9b6b4b2b2b2b2b
   • [1] 0x2b25354f06e5e8e79dd69e6e9b9b6b4b2b2b2b2b

🔗  Connecting to wss://ws-subscriptions-clob.polymarket.com/ws/market...
🟢  WebSocket connected!
📤  Subscribing to MARKET channel...
📋  Subscribed to 2 assets

📊  10:30:45 [BOOK] Thunder        → 68.50% (spread: 1.46%)
📊  10:30:45 [BOOK] Pacers         → 31.50% (spread: 1.59%)
🔄  10:30:47 [TRADE] Thunder       → BUY @ $0.685 (250 units)
📊  10:30:48 [BOOK] Thunder        → 68.75% (spread: 1.42%)
```

### **Debugging Connection Issues**
```javascript
// Enable detailed logging
const ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');

ws.onopen = () => {
  console.log('✅ WebSocket opened');
  console.log('ReadyState:', ws.readyState);
};

ws.onclose = (event) => {
  console.log('❌ WebSocket closed');
  console.log('Code:', event.code);
  console.log('Reason:', event.reason);
  console.log('WasClean:', event.wasClean);
};

ws.onerror = (error) => {
  console.error('🚨 WebSocket error:', error);
  console.log('ReadyState:', ws.readyState);
};

// Test network connectivity
fetch('https://gamma-api.polymarket.com/health')
  .then(response => console.log('API Health:', response.status))
  .catch(error => console.error('API Error:', error));
```

## ⚠️ Common Issues & Solutions

### **1. Connection Refused (Error Code 1006)**
```
Cause: Network issues or endpoint changes
Solution: Check network connectivity and verify endpoint URL
```

### **2. No Data After Subscription**
```
Cause: Invalid token IDs or market not active
Solution: Verify token IDs from Polymarket API first
```

### **3. Frequent Disconnections**
```
Cause: Missing heartbeat implementation
Solution: Implement ping/pong every 30 seconds
```

### **4. Memory Leaks**
```
Cause: Not cleaning up WebSocket connections
Solution: Always close connections in cleanup functions
```

### **5. Stale Data**
```
Cause: Not handling reconnection properly
Solution: Re-subscribe after each reconnection
```

## 📊 Performance Considerations

### **Message Volume**
- **Book Updates**: 1-5 per second per token during active trading
- **Price Changes**: 0-10 per second per token during high activity
- **Trades**: Sporadic, depends on market activity
- **Bandwidth**: ~1-5 KB/s per token on average

### **Optimization Tips**
```javascript
// 1. Debounce rapid updates
const debouncedOddsUpdate = debounce((tokenId, odds) => {
  updateUI(tokenId, odds);
}, 100);

// 2. Limit order book depth
function limitOrderBookDepth(orders, maxDepth = 10) {
  return orders.slice(0, maxDepth);
}

// 3. Use object pooling for frequent calculations
const calculationCache = new Map();

// 4. Batch DOM updates
requestAnimationFrame(() => {
  // Update all UI elements at once
  updateAllOddsDisplays();
});
```

## 🔐 Security Considerations

### **Data Validation**
```javascript
function validateBookMessage(message) {
  if (!message.asset_id || !message.timestamp) {
    throw new Error('Invalid book message format');
  }
  
  if (!Array.isArray(message.bids) || !Array.isArray(message.asks)) {
    throw new Error('Invalid order book structure');
  }
  
  // Validate price and size formats
  [...message.bids, ...message.asks].forEach(order => {
    if (isNaN(parseFloat(order.price)) || isNaN(parseFloat(order.size))) {
      throw new Error('Invalid order price or size');
    }
  });
  
  return true;
}
```

### **Rate Limiting Protection**
```javascript
class RateLimitedProcessor {
  constructor(maxUpdatesPerSecond = 10) {
    this.maxUpdates = maxUpdatesPerSecond;
    this.updateQueue = [];
    this.lastProcessTime = 0;
  }
  
  addUpdate(update) {
    this.updateQueue.push(update);
    this.processQueue();
  }
  
  processQueue() {
    const now = Date.now();
    const timeSinceLastProcess = now - this.lastProcessTime;
    
    if (timeSinceLastProcess < (1000 / this.maxUpdates)) {
      return; // Rate limit exceeded
    }
    
    const update = this.updateQueue.shift();
    if (update) {
      this.processUpdate(update);
      this.lastProcessTime = now;
    }
  }
}
```

## 🚀 Production Deployment

### **Environment Variables**
```bash
# WebSocket configuration
CLOB_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
WS_RECONNECT_DELAY=3000
WS_MAX_RECONNECT_ATTEMPTS=10
WS_HEARTBEAT_INTERVAL=30000

# Performance tuning
MAX_ORDER_BOOK_DEPTH=20
ODDS_UPDATE_DEBOUNCE=100
MAX_TRADE_HISTORY=50
```

### **Monitoring & Logging**
```javascript
// WebSocket metrics
const metrics = {
  messagesReceived: 0,
  connectionUptime: 0,
  reconnectionCount: 0,
  lastMessageTime: null
};

// Health check endpoint
app.get('/ws-health', (req, res) => {
  const isHealthy = Date.now() - metrics.lastMessageTime < 60000;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    metrics: metrics
  });
});
```

## 📖 Additional Resources

- **Polymarket API Documentation**: https://docs.polymarket.com/
- **CLOB Technical Specification**: https://docs.polymarket.com/developers/CLOB/
- **WebSocket RFC**: https://tools.ietf.org/html/rfc6455
- **Order Book Basics**: Understanding bid/ask spreads and market depth

---

**⚡ Pro Tip**: Always implement proper error handling, connection management, and data validation when working with real-time financial data streams! 