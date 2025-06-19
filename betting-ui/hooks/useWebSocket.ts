import { useState, useEffect, useRef, useCallback } from 'react';

// Types for the new WebSocket implementation
interface BookMessage {
  event_type: 'book';
  asset_id: string;
  market: string;
  timestamp: string;
  hash: string;
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
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

type CLOBWebSocketMessage = BookMessage | PriceChangeMessage | LastTradePriceMessage;

interface MarketSubscription {
  type: 'MARKET';
  assets_ids: string[];
  initial_dump?: boolean;
}

interface LiveOdds {
  tokenId: string;
  probability: number;           // 0-100%
  midPrice: number;             // 0-1 price
  spread: number;               // bid-ask spread
  americanOdds: number;         // -217, +217, etc.
  europeanOdds: number;         // 1.46, 3.17, etc.
  bestBid: number;
  bestAsk: number;
  timestamp: number;
}

interface ExecutedTrade {
  id: string;
  tokenId: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  timestamp: number;
}

interface CLOBWebSocketState {
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  liveOdds: Record<string, LiveOdds>;
  executedTrades: ExecutedTrade[];
  error: string | null;
  lastUpdate: number | null;
}

interface CLOBWebSocketConfig {
  marketId: string;
  tokenIds: string[];
  outcomes: string[];
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

// Odds calculation functions
function calculateAmericanOdds(probability: number): number {
  const prob = probability / 100;
  if (prob > 0.5) {
    return Math.round(-(prob / (1 - prob)) * 100);
  } else {
    return Math.round(((1 - prob) / prob) * 100);
  }
}

function calculateEuropeanOdds(probability: number): number {
  const prob = probability / 100;
  return Math.round((1 / prob) * 100) / 100;
}

export function useCLOBWebSocket(config: CLOBWebSocketConfig): CLOBWebSocketState {
  const [state, setState] = useState<CLOBWebSocketState>({
    isConnected: false,
    connectionStatus: 'disconnected',
    liveOdds: {},
    executedTrades: [],
    error: null,
    lastUpdate: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const shouldReconnectRef = useRef(true);

  const {
    marketId,
    tokenIds,
    outcomes,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = config;

  // Use the working WebSocket endpoint
  const wsUrl = process.env.NEXT_PUBLIC_CLOB_WS_URL || 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

  // Create token-to-outcome mapping
  const tokenToOutcome = useRef<Record<string, string>>({});
  useEffect(() => {
    tokenIds.forEach((tokenId, index) => {
      tokenToOutcome.current[tokenId] = outcomes[index] || `Token ${index}`;
    });
  }, [tokenIds, outcomes]);

  const updateState = useCallback((updates: Partial<CLOBWebSocketState>) => {
    if (mountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const calculateOddsFromBook = useCallback((message: BookMessage): LiveOdds => {
    const { bids, asks, asset_id } = message;
    
    // Sort to get best prices
    const sortedBids = [...bids].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    const sortedAsks = [...asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    
    const bestBid = sortedBids.length ? parseFloat(sortedBids[0].price) : 0;
    const bestAsk = sortedAsks.length ? parseFloat(sortedAsks[0].price) : 1;
    
    const midPrice = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;
    const probability = midPrice * 100;
    
    return {
      tokenId: asset_id,
      probability,
      midPrice,
      spread,
      americanOdds: calculateAmericanOdds(probability),
      europeanOdds: calculateEuropeanOdds(probability),
      bestBid,
      bestAsk,
      timestamp: Date.now(),
    };
  }, []);

  const handleBookMessage = useCallback((message: BookMessage) => {
    const odds = calculateOddsFromBook(message);
    
    setState(prev => ({
      ...prev,
      liveOdds: {
        ...prev.liveOdds,
        [odds.tokenId]: odds,
      },
      lastUpdate: Date.now(),
    }));
  }, [calculateOddsFromBook]);

  const handleTradeMessage = useCallback((message: LastTradePriceMessage) => {
    const outcome = tokenToOutcome.current[message.asset_id] || 'Unknown';
    
    const trade: ExecutedTrade = {
      id: `${message.asset_id}-${message.timestamp}`,
      tokenId: message.asset_id,
      outcome,
      side: message.side as 'BUY' | 'SELL',
      price: parseFloat(message.price),
      size: parseFloat(message.size),
      timestamp: parseInt(message.timestamp),
    };

    setState(prev => ({
      ...prev,
      executedTrades: [trade, ...prev.executedTrades].slice(0, 50), // Keep last 50 trades
      lastUpdate: Date.now(),
    }));
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        console.log('📤 CLOB WS Message sent:', message);
      } catch (error) {
        console.error('❌ Failed to send CLOB WebSocket message:', error);
        updateState({ error: 'Failed to send message' });
      }
    }
  }, [updateState]);

  const subscribeToMarket = useCallback(() => {
    if (!marketId || tokenIds.length === 0) {
      console.warn('❌ Cannot subscribe: missing marketId or tokenIds', { marketId, tokenIds });
      return;
    }

    console.log('📤 Subscribing to CLOB market:', { marketId, tokenIds });

    const subscriptionMessage: MarketSubscription = {
      type: 'MARKET',
      assets_ids: tokenIds,
      initial_dump: true,
    };
    
    sendMessage(subscriptionMessage);
  }, [marketId, tokenIds, sendMessage]);

  const connect = useCallback(() => {
    shouldReconnectRef.current = true;
    if (!mountedRef.current || !marketId || tokenIds.length === 0) {
      console.warn('❌ Cannot connect: conditions not met', { 
        mounted: mountedRef.current, 
        marketId, 
        tokenIds: tokenIds.length,
        tokenIdsArray: tokenIds
      });
      return;
    }

    console.log('✅ Connection conditions met - proceeding with WebSocket connection');
    console.log('🔗 Connecting to CLOB WebSocket:', { url: wsUrl, marketId, tokenIds });
    console.log('🌐 Browser WebSocket support:', typeof WebSocket !== 'undefined');

    try {
      updateState({ connectionStatus: 'connecting', error: null });

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🟢 CLOB WebSocket connected!');
        console.log('🔗 Connection ready state:', ws.readyState);
        reconnectAttemptsRef.current = 0;
        
        updateState({
          isConnected: true,
          connectionStatus: 'connected',
          error: null,
        });

        // Add a small delay before subscribing
        setTimeout(() => {
          subscribeToMarket();
        }, 100);

        // Keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log('📤 Sending ping...');
            ws.send('ping');
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          console.log('📨 Raw WebSocket message:', event.data);
          
          // Handle ping/pong
          if (event.data === 'pong' || event.data === 'ping') {
            console.log('🏓 Received ping/pong:', event.data);
            return;
          }

          const messages: CLOBWebSocketMessage | CLOBWebSocketMessage[] = JSON.parse(event.data);
          const messageArray = Array.isArray(messages) ? messages : [messages];

          console.log('📋 Parsed messages:', messageArray.length, 'items');

          messageArray.forEach(message => {
            console.log('📨 Processing message type:', message.event_type);
            switch (message.event_type) {
              case 'book':
                console.log('📊 Processing BOOK message for:', message.asset_id);
                handleBookMessage(message);
                break;
              case 'last_trade_price':
                console.log('🔄 Processing TRADE message for:', message.asset_id);
                handleTradeMessage(message);
                break;
              case 'price_change':
                console.log('💱 Processing PRICE_CHANGE message for:', message.asset_id);
                // Can add price change handling if needed
                break;
              default:
                console.log('📨 Unknown message type:', message);
            }
          });
        } catch (error) {
          console.error('❌ Failed to parse CLOB WebSocket message:', error);
          console.error('❌ Raw message data:', event.data);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 CLOB WebSocket disconnected:', { code: event.code, reason: event.reason, wasClean: event.wasClean });
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        updateState({
          isConnected: false,
          connectionStatus: 'disconnected',
        });

        // Auto-reconnect if enabled and should reconnect
        if (autoReconnect && shouldReconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`🔄 Attempting reconnection ${reconnectAttemptsRef.current}/${maxReconnectAttempts}...`);
          updateState({ connectionStatus: 'reconnecting' });
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ CLOB WebSocket error:', error);
        console.error('❌ WebSocket state:', ws.readyState);
        console.error('❌ Error event details:', {
          type: error.type,
          target: error.target,
          timeStamp: error.timeStamp
        });
        updateState({ error: 'WebSocket connection error' });
      };

    } catch (error) {
      console.error('❌ Failed to create CLOB WebSocket:', error);
      updateState({ error: 'Failed to create WebSocket connection' });
    }
  }, [wsUrl, marketId, tokenIds, updateState, subscribeToMarket, handleBookMessage, handleTradeMessage, autoReconnect, maxReconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    updateState({
      isConnected: false,
      connectionStatus: 'disconnected',
    });
  }, [updateState]);

  // Connect on mount and when config changes
  useEffect(() => {
    if (marketId && tokenIds.length > 0) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [marketId, tokenIds.join(',')]);

  // Cleanup on unmount only (not on re-renders)
  useEffect(() => {
    mountedRef.current = true; // Ensure mounted is true after mount
    
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, []); // Empty dependency array - only runs on mount/unmount

  return state;
}