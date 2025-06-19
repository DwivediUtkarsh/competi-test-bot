#!/usr/bin/env ts-node

/**
 * Polymarket CLOB WebSocket Market Channel Tester
 * -----------------------------------------------
 * Usage:
 *   npx ts-node scripts/clob-websocket-test.ts <marketId>
 *
 * Implementation based on:
 * https://docs.polymarket.com/developers/CLOB/websocket/market-channel
 *
 * - Connects to Polymarket CLOB WebSocket endpoint
 * - Subscribes to MARKET channel (public, no auth required)
 * - Listens for book, price_change, and tick_size_change events
 * - Calculates and displays live odds from order book data
 *
 * Environment variables (optional):
 *   CLOB_WS_URL            – WebSocket URL (default from docs)
 *   POLYMARKET_API_URL     – Gamma REST API base
 */

import axios from 'axios';
import WebSocket from 'ws';

// Message types based on official documentation
interface BookMessage {
  event_type: 'book';
  asset_id: string;
  market: string;
  timestamp: string;
  hash: string;
  bids: { price: string; size: string }[];   // Actual format from WebSocket
  asks: { price: string; size: string }[];   // Actual format from WebSocket
}

interface PriceChangeMessage {
  event_type: 'price_change';
  asset_id: string;
  market: string;
  changes: {
    price: string;
    size: string;
    side: string;
  }[];
  hash: string;
  timestamp: string;
}

interface TickSizeChangeMessage {
  event_type: 'tick_size_change';
  asset_id: string;
  market: string;
  old_tick_size: string;
  new_tick_size: string;
  timestamp: string;
}

interface LastTradePriceMessage {
  event_type: 'last_trade_price';
  asset_id: string;
  market: string;
  price: string;
  side: string;
  size: string;
  fee_rate_bps: string;
  timestamp: string;
}

type CLOBWebSocketMessage = BookMessage | PriceChangeMessage | TickSizeChangeMessage | LastTradePriceMessage;

interface MarketResponse {
  id: string;
  clobTokenIds?: string;
  question?: string;
  title?: string;
  outcomes?: string | string[];
}

// Subscription message format from documentation
interface MarketSubscription {
  type: 'MARKET';
  assets_ids: string[];
  initial_dump?: boolean; // New field from May 28, 2025 changelog
}

// Try different endpoint formats to debug 404 issue
const WS_ENDPOINTS = [
  'wss://ws-subscriptions-clob.polymarket.com/ws/',
  'wss://ws-subscriptions-clob.polymarket.com/ws',
  'wss://ws-subscriptions-clob.polymarket.com/',
  'wss://ws-subscriptions-clob.polymarket.com'
];


const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const API_BASE = process.env.POLYMARKET_API_URL || 'https://gamma-api.polymarket.com';

/** Calculate mid-price from order book */
function calculateMidPrice(buys: { price: string; size: string }[], sells: { price: string; size: string }[]): number {
  if (!buys.length && !sells.length) return 0.5;
  
  // Sort to get best bid (highest buy) and best ask (lowest sell)
  const bestBid = buys.length ? Math.max(...buys.map(b => parseFloat(b.price))) : 0;
  const bestAsk = sells.length ? Math.min(...sells.map(s => parseFloat(s.price))) : 1;
  
  return (bestBid + bestAsk) / 2;
}

/** Calculate spread from order book */
function calculateSpread(buys: { price: string; size: string }[], sells: { price: string; size: string }[]): number {
  if (!buys.length || !sells.length) return 0;
  
  const bestBid = Math.max(...buys.map(b => parseFloat(b.price)));
  const bestAsk = Math.min(...sells.map(s => parseFloat(s.price)));
  
  return bestAsk - bestBid;
}

async function main() {
  const marketId = process.argv[2];
  if (!marketId) {
    console.error('❌  Usage: npx ts-node scripts/clob-websocket-test.ts <marketId>');
    process.exit(1);
  }

  console.log(`📡  Fetching market ${marketId} from ${API_BASE}...`);
  let market: MarketResponse;
  try {
    const { data } = await axios.get<MarketResponse>(`${API_BASE}/markets/${marketId}`);
    market = data;
  } catch (err: any) {
    console.error('❌  Failed to fetch market:', err.message);
    process.exit(1);
  }

  // Parse token IDs
  let tokenIds: string[] = [];
  if (market.clobTokenIds) {
    try {
      tokenIds = JSON.parse(market.clobTokenIds);
    } catch {
      console.warn('⚠️  Could not parse clobTokenIds');
      process.exit(1);
    }
  }

  if (!tokenIds.length) {
    console.error('❌  No tokenIds found for this market');
    process.exit(1);
  }

  console.log(`✅  Found ${tokenIds.length} tokenIds:`);
  tokenIds.forEach((id, i) => console.log(`   • [${i}] ${id}`));

  // Parse outcomes for display
  let outcomes: string[] = [];
  if (typeof market.outcomes === 'string') {
    try {
      outcomes = JSON.parse(market.outcomes);
    } catch {
      outcomes = ['Option A', 'Option B'];
    }
  } else if (Array.isArray(market.outcomes)) {
    outcomes = market.outcomes;
  } else {
    outcomes = ['Option A', 'Option B'];
  }

  // Create mapping from tokenId to outcome
  const tokenToOutcome: Record<string, string> = {};
  tokenIds.forEach((tokenId, index) => {
    tokenToOutcome[tokenId] = outcomes[index] || `Token ${index}`;
  });

  console.log(`📋  Token → Outcome mapping:`);
  Object.entries(tokenToOutcome).forEach(([tokenId, outcome]) => {
    console.log(`   • ${outcome.padEnd(12)} → ${tokenId.slice(0, 8)}...`);
  });

  // Make tokenToOutcome available to handlers
  (global as any).tokenToOutcome = tokenToOutcome;

  console.log(`\n🔗  Connecting to ${WS_URL}...`);
  
  const ws = new WebSocket(WS_URL);
  
  console.log('🔍  Testing WebSocket connection with official endpoint format...');
  console.log('📝  If this fails with 404, it indicates:');
  console.log('   • The documented endpoint may be outdated');
  console.log('   • Authentication might be required (contrary to docs)');
  console.log('   • Service may be temporarily unavailable');
  console.log('   • Additional headers/protocols may be needed');

  // Store current odds for each token
  const currentOdds: Record<string, { price: number; spread: number; lastUpdate: string }> = {};

  ws.on('open', () => {
    console.log('🟢  WebSocket connected!');
    console.log('📤  Subscribing to MARKET channel...');
    
    // Send subscription message according to docs
    const subscription: MarketSubscription = {
      type: 'MARKET',
      assets_ids: tokenIds,
      initial_dump: true  // Get initial order book state
    };
    
    ws.send(JSON.stringify(subscription));
    console.log(`📋  Subscribed to ${tokenIds.length} assets\n`);
  });

  ws.on('message', (data) => {
    let messages: CLOBWebSocketMessage | CLOBWebSocketMessage[];
    
    try {
      const rawData = data.toString();
      
      // Handle ping/pong
      if (rawData === 'pong' || rawData === 'ping') {
        return;
      }
      
      messages = JSON.parse(rawData);
    } catch (err) {
      // console.log('📨  Non-JSON message:', data.toString());
      return;
    }

    const timestamp = new Date().toLocaleTimeString();
    
    // Handle single message or array of messages
    const messageArray = Array.isArray(messages) ? messages : [messages];
    
    messageArray.forEach(message => {
      // Handle different message types according to documentation
      switch (message.event_type) {
        case 'book':
          handleBookMessage(message, timestamp, outcomes, currentOdds);
          break;
          
        case 'price_change':
          handlePriceChangeMessage(message, timestamp, outcomes);
          break;
          
        case 'tick_size_change':
          handleTickSizeChangeMessage(message, timestamp, outcomes);
          break;
          
        case 'last_trade_price':
          handleLastTradePriceMessage(message, timestamp, outcomes);
          break;
          
        default:
          console.log('📨  Unknown message type:', JSON.stringify(message, null, 2));
      }
    });
  });

  ws.on('close', (code, reason) => {
    console.log(`\n🔌  WebSocket closed (${code}): ${reason.toString()}`);
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error('❌  WebSocket error:', err.message);
    process.exit(1);
  });

  // Keep connection alive with ping
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('ping');
    }
  }, 30000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋  Shutting down...');
    clearInterval(pingInterval);
    ws.close();
  });
}

function handleBookMessage(
  message: BookMessage, 
  timestamp: string, 
  outcomes: string[], 
  currentOdds: Record<string, { price: number; spread: number; lastUpdate: string }>
) {
  // Use the tokenToOutcome mapping created in main()
  const outcomeLabel = (global as any).tokenToOutcome?.[message.asset_id] || `Token ${message.asset_id.slice(0, 8)}...`;
  
  // Uncomment for debugging:
  // console.log('🔍  Raw book data structure:');
  // console.log('   Bids sample:', JSON.stringify(message.bids?.slice(0, 2) || [], null, 2));
  // console.log('   Asks sample:', JSON.stringify(message.asks?.slice(0, 2) || [], null, 2));
  
  const midPrice = calculateMidPrice(message.bids || [], message.asks || []);
  const spread = calculateSpread(message.bids || [], message.asks || []);
  
  currentOdds[message.asset_id] = {
    price: midPrice,
    spread: spread,
    lastUpdate: timestamp
  };
  
  console.log(`📊  ${timestamp} [BOOK] ${outcomeLabel.padEnd(12)} → ${(midPrice * 100).toFixed(2)}% (spread: ${(spread * 100).toFixed(2)}%)`);
}

function handlePriceChangeMessage(message: PriceChangeMessage, timestamp: string, outcomes: string[]) {
  // Use the tokenToOutcome mapping created in main()
  const outcomeLabel = (global as any).tokenToOutcome?.[message.asset_id] || `Token ${message.asset_id.slice(0, 8)}...`;
  
  // Handle multiple price changes in one message
  message.changes.forEach(change => {
    console.log(`💱  ${timestamp} [PRICE] ${outcomeLabel.padEnd(12)} → ${change.side} @ $${change.price} (${change.size} units)`);
  });
}

function handleTickSizeChangeMessage(message: TickSizeChangeMessage, timestamp: string, outcomes: string[]) {
  const tokenIndex = outcomes.findIndex((_, i) => message.asset_id.includes(String(i)));
  const outcomeLabel = outcomes[tokenIndex] || `Token ${message.asset_id.slice(0, 8)}...`;
  
  console.log(`📏  ${timestamp} [TICK] ${outcomeLabel.padEnd(12)} → ${message.old_tick_size} → ${message.new_tick_size}`);
}

function handleLastTradePriceMessage(message: LastTradePriceMessage, timestamp: string, outcomes: string[]) {
  // Use the tokenToOutcome mapping created in main()
  const outcomeLabel = (global as any).tokenToOutcome?.[message.asset_id] || `Token ${message.asset_id.slice(0, 8)}...`;
  
  console.log(`🔄  ${timestamp} [TRADE] ${outcomeLabel.padEnd(12)} → ${message.side} @ $${message.price} (${message.size} units)`);
}

main().catch((err) => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
}); 