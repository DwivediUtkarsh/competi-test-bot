#!/usr/bin/env ts-node

/**
 * Stand-alone CLOB REST API tester (fallback from WebSocket)
 * ----------------------------------------------------------
 * Usage:
 *   npx ts-node scripts/clob-test.ts <marketId>
 *
 * - Fetches the specified market from Gamma API
 * - Extracts real tokenIds from the `clobTokenIds` field
 * - Polls the Polymarket CLOB REST API /books endpoint for live order book data
 * - Calculates mid-price odds from bid/ask spreads
 * - Displays them in the console every 2 seconds
 *
 * Environment variables (optional):
 *   CLOB_REST_URL          – CLOB REST API base (default https://clob.polymarket.com)
 *   POLYMARKET_API_URL     – Gamma REST API base (default https://gamma-api.polymarket.com)
 */

import axios from 'axios';

interface CLOBBookResponse {
  market: string;
  asset_id: string;
  hash: string;
  bids: { price: string; size: string }[]; // order book entries
  asks: { price: string; size: string }[]; // order book entries
}

interface MarketResponse {
  id: string;
  clobTokenIds?: string; // JSON string array from API
  question?: string;
  title?: string;
  outcomes?: string | string[];
}

const CLOB_REST_URL = process.env.CLOB_REST_URL || 'https://clob.polymarket.com';
const API_BASE = process.env.POLYMARKET_API_URL || 'https://gamma-api.polymarket.com';

/** Calculate mid-price odds from order-book arrays */
function calcMidPrice(bids: { price: string; size: string }[], asks: { price: string; size: string }[]): number {
  // Sort bids descending (highest price first - best bid)
  const sortedBids = [...bids].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  // Sort asks ascending (lowest price first - best ask)
  const sortedAsks = [...asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  
  const bestBid = sortedBids.length ? parseFloat(sortedBids[0].price) : 0;
  const bestAsk = sortedAsks.length ? parseFloat(sortedAsks[0].price) : 1;
  if (!bids.length && !asks.length) return 0.5;
  return (bestBid + bestAsk) / 2;
}

/** Fetch live book data for a token ID */
async function fetchBookData(tokenId: string): Promise<CLOBBookResponse | null> {
  try {
    const { data } = await axios.get<CLOBBookResponse>(`${CLOB_REST_URL}/book?token_id=${tokenId}`);
    return data;
  } catch (err: any) {
    console.warn(`⚠️  Failed to fetch book for ${tokenId.slice(0, 8)}…: ${err.message}`);
    return null;
  }
}

async function main() {
  const marketId = process.argv[2];
  if (!marketId) {
    console.error('❌  Usage: npx ts-node scripts/clob-test.ts <marketId>');
    process.exit(1);
  }

  console.log(`📡  Fetching market ${marketId} from ${API_BASE} ...`);
  let market: MarketResponse;
  try {
    const { data } = await axios.get<MarketResponse>(`${API_BASE}/markets/${marketId}`);
    market = data;
  } catch (err: any) {
    console.error('❌  Failed to fetch market:', err.message || err);
    process.exit(1);
  }

  // Parse token IDs
  let tokenIds: string[] = [];
  if (market.clobTokenIds) {
    try {
      tokenIds = JSON.parse(market.clobTokenIds);
    } catch {
      console.warn('⚠️  Could not parse clobTokenIds – falling back to empty array');
    }
  }

  if (!tokenIds.length) {
    console.error('❌  No tokenIds found for this market. Aborting.');
    process.exit(1);
  }

  console.log(`✅  Found ${tokenIds.length} tokenIds`);
  tokenIds.forEach((t, i) => console.log(`   • [${i}] ${t}`));

  console.log(`📊  Starting live odds polling from ${CLOB_REST_URL}/book ...`);
  console.log('   (Press Ctrl+C to stop)\n');

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

  const pollBooks = async () => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`📈  ${timestamp} - Live Odds:`);
    
    for (let i = 0; i < tokenIds.length; i++) {
      const tokenId = tokenIds[i];
      const outcome = outcomes[i] || `Option ${i + 1}`;
      
      const bookData = await fetchBookData(tokenId);
      if (bookData) {
        const mid = calcMidPrice(bookData.bids, bookData.asks);
        
        // Calculate spread using properly sorted data
        let spread = 0;
        if (bookData.bids.length && bookData.asks.length) {
          const sortedBids = [...bookData.bids].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
          const sortedAsks = [...bookData.asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
          spread = parseFloat(sortedAsks[0].price) - parseFloat(sortedBids[0].price);
        }
        
        console.log(`   ${outcome.padEnd(12)} → ${(mid * 100).toFixed(2)}% (spread: ${(spread * 100).toFixed(2)}%)`);
      } else {
        console.log(`   ${outcome.padEnd(12)} → No data`);
      }
    }
    console.log('');
  };

  // Initial poll
  await pollBooks();

  // Poll every 2 seconds
  const interval = setInterval(pollBooks, 2000);

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n👋  Stopping live odds polling...');
    clearInterval(interval);
    process.exit(0);
  });
}

main().catch((e) => {
  console.error('❌  Fatal:', e);
  process.exit(1);
}); 