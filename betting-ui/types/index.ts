// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// Session Types
export interface SessionData {
  jti: string;
  userId: string;
  marketId: string;
  status?: 'UNUSED' | 'USED';
  createdAt?: string;
  expiresAt: string;
  usedAt?: string;
  discordUser?: DiscordUser;
  guildName?: string;
}

// Market Types
export interface Market {
  id: string;
  question?: string;
  title: string;
  description?: string;
  outcomes: MarketOutcome[];
  active: boolean;
  volume?: number;
  liquidity?: number;
  endDate?: string;
  lastUpdated?: string;
  conditionId?: string;
  tokens?: string[]; // Token IDs for CLOB subscription
}

export interface MarketOutcome {
  id: string;
  title: string;
  price: number;
  name?: string;
  description?: string;
  tokenId?: string; // For CLOB subscription
}

// Betting Types
export type BetOutcome = MarketOutcome;

export interface BetRequest {
  outcome: BetOutcome;
  amount: number;
}

export interface Bet {
  id: string;
  userId: string;
  marketId: string;
  outcome: BetOutcome;
  amount: number;
  price: number;
  potentialPayout: number;
  status: 'placed' | 'active' | 'settled' | 'cancelled';
  placedAt: string;
  settledAt?: string;
  market: {
    question: string;
    title: string;
  };
}

// CLOB WebSocket Types
export interface CLOBBookData {
  asset_id: string;
  bids: [string, string][]; // [price, size]
  asks: [string, string][];
}

export interface CLOBTradeData {
  market: string;
  asset_id: string;
  side: 'BUY' | 'SELL';
  size: string;
  price: string;
  timestamp: number;
}

export interface CLOBWebSocketMessage {
  event_type?: 'book' | 'price_change' | 'tick_size_change';
  asset_id?: string;
  market?: string;
  timestamp?: string;
  hash?: string;
  buys?: [string, string][]; // [price, size] 
  sells?: [string, string][]; // [price, size]
  // Generic type field used for ping/pong and other control messages
  type?: string;
  // Legacy fields (keeping for compatibility)
  channel?: 'book' | 'trades' | 'ticker';
  data?: CLOBBookData | CLOBTradeData | any;
}

export interface CLOBSubscription {
  type: 'subscribe' | 'unsubscribe';
  channel: 'market' | 'user';
  assets_ids?: string[];
  markets?: string[];
}

export interface CLOBLiveOdds {
  tokenId: string;
  price: number;
  spread: number;
  lastTradePrice?: number;
  volume24h?: number;
  timestamp: number;
}

export interface CLOBWebSocketState {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';
  liveOdds: Record<string, CLOBLiveOdds>;
  error: string | null;
  lastUpdate: number | null;
}

// Component Props
export interface BettingInterfaceProps {
  market: Market;
  onPlaceBet: (outcome: BetOutcome, amount: number) => Promise<void>;
  isPlacingBet: boolean;
  isSessionExpired: boolean;
}

// Utility Types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Discord Types
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
}

// JWT Payload Types
export interface SessionJWTPayload {
  jti: string;
  userId: string;
  marketId: string;
  iat: number;
  exp: number;
  type: 'betting_session';
} 