# CLOB WebSocket Implementation

## Overview

This document outlines the implementation of the new CLOB (Central Limit Order Book) WebSocket system for live odds display, replacing the previous generic WebSocket implementation while maintaining all existing functionality.

## Changes Made

### 1. Updated Types (`types/index.ts`)
- **Removed**: Old WebSocket types (`WebSocketMessage`, `WebSocketConfig`, `WebSocketState`)
- **Added**: CLOB-specific types:
  - `CLOBBookData`: Book data structure from CLOB API
  - `CLOBTradeData`: Trade data structure
  - `CLOBWebSocketMessage`: Message format for CLOB WebSocket
  - `CLOBSubscription`: Subscription configuration
  - `CLOBLiveOdds`: Live odds data structure
  - `CLOBWebSocketState`: WebSocket connection state
- **Enhanced**: `Market` and `MarketOutcome` types with `tokenId` fields for CLOB subscription

### 2. New CLOB WebSocket Hook (`hooks/useWebSocket.ts`)
- **Complete replacement** of the old WebSocket implementation
- **Features**:
  - Connects to `wss://ws-subscriptions-clob.polymarket.com`
  - Subscribes to book updates for multiple token IDs
  - Calculates live odds from bid/ask spreads
  - Automatic reconnection with exponential backoff
  - Ping/pong for connection health
  - Real-time odds calculation from CLOB data

### 3. New Live Odds Display Component (`components/LiveOddsDisplay.tsx`)
- **Purpose**: Display live odds from CLOB WebSocket in a dedicated section
- **Features**:
  - Real-time connection status indicator
  - Live vs offline status for each outcome
  - Animated probability bars
  - Spread and last trade information
  - Fallback to static prices when WebSocket is offline
  - Clean, modern UI with green/red indicators

### 4. Updated Betting Page (`pages/bet/[token].tsx`)
- **Removed**: Old WebSocket implementation (`useWebSocket` import and usage)
- **Added**: CLOB WebSocket integration with `useCLOBWebSocket` hook
- **Added**: `LiveOddsDisplay` component as a new section
- **Enhanced**: Fallback polling only activates when CLOB WebSocket is disconnected
- **Preserved**: All existing functionality (betting, session management, etc.)

### 5. Environment Configuration
- **Added**: `NEXT_PUBLIC_CLOB_WS_URL` environment variable
- **Default**: `wss://ws-subscriptions-clob.polymarket.com`
- **Already configured** in `.env.local` and `.env.example`

## Architecture

### Data Flow
```
CLOB WebSocket → useCLOBWebSocket → LiveOddsDisplay Component
                      ↓
              Real-time odds calculation
                      ↓
              UI updates with live data
```

### Fallback Strategy
```
CLOB WebSocket Connected → Use live data
CLOB WebSocket Offline → Fall back to 2-second HTTP polling
```

## Key Features

### 1. **Hybrid Approach**
- Primary: CLOB WebSocket for real-time data
- Fallback: HTTP polling when WebSocket fails
- Seamless transition between modes

### 2. **Live Odds Section**
- Dedicated section showing CLOB live odds
- Visual indicators for live vs static data
- Connection status and last update timestamps

### 3. **Maintained Functionality**
- All existing betting functionality preserved
- Session management unchanged
- Error handling and UI components unchanged
- Only the odds fetching mechanism was enhanced

### 4. **Type Safety**
- Full TypeScript support
- Proper type definitions for all CLOB data structures
- Compile-time error checking

## WebSocket Message Format

### Subscription
```json
{
  "type": "subscribe",
  "channel": "book",
  "market": "market_id",
  "assets_ids": ["token_id_1", "token_id_2"]
}
```

### Book Update Response
```json
{
  "channel": "book",
  "market": "market_id",
  "data": {
    "market": "market_id",
    "asset_id": "token_id",
    "hash": "hash_value",
    "bids": [["0.65", "100.0"], ["0.64", "200.0"]],
    "asks": [["0.66", "150.0"], ["0.67", "100.0"]]
  }
}
```

## Deployment Notes

### Environment Variables Required
```bash
NEXT_PUBLIC_CLOB_WS_URL=wss://ws-subscriptions-clob.polymarket.com
```

### Testing
- ✅ TypeScript compilation passes
- ✅ Build process successful
- ✅ All existing functionality preserved
- ✅ New live odds section displays correctly

## Migration Status

- ✅ **Completed**: Old WebSocket implementation removed
- ✅ **Completed**: CLOB WebSocket implemented
- ✅ **Completed**: Live odds display component created
- ✅ **Completed**: Types updated for CLOB support
- ✅ **Completed**: Environment configuration added
- ✅ **Completed**: Fallback mechanism implemented

## Future Enhancements

1. **Real Token IDs**: Replace sample token IDs with actual Polymarket token IDs
2. **Trade Data**: Subscribe to trade channel for last trade prices
3. **Volume Data**: Display 24h volume information
4. **Historical Charts**: Add price history visualization
5. **Multiple Markets**: Support for multiple market subscriptions

## Testing Locally

1. Ensure `.env.local` has the CLOB WebSocket URL configured
2. Run `npm run dev`
3. Navigate to a betting page
4. Observe the new "Live Odds (CLOB)" section
5. Check browser console for WebSocket connection logs
6. Connection status indicator shows real-time state 