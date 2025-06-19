import axios from 'axios';

/**
 * Convert decimal probability to American odds format
 * @param {number} probability - Decimal probability (0-1)
 * @returns {string} American odds format
 */
export function decimalToAmericanOdds(probability) {
  if (probability > 0.5) {
    const odds = Math.round(-100 * probability / (1 - probability));
    return odds.toString();
  } else {
    const odds = Math.round(100 * (1 - probability) / probability);
    return `+${odds}`;
  }
}

/**
 * Calculate European odds from share price
 * @param {number} sharePrice - Share price (0-1)
 * @returns {string} European odds format
 */
export function calculateEuropeanOdds(sharePrice) {
  try {
    const europeanOdds = Math.round((1 / sharePrice) * 100) / 100;
    return europeanOdds.toString();
  } catch (error) {
    return 'N/A';
  }
}

/**
 * Get market emojis based on market type
 * @param {string} marketType - Type of market (NBA, NFL, etc.)
 * @returns {object} Object with team1, team2, and draw emojis
 */
export function getMarketEmojis(marketType) {
  const emojis = {
    'NBA': { team1: '🏀', team2: '🏀', draw: '🤝' },
    'NFL': { team1: '🏈', team2: '🏈', draw: '🤝' },
    'Soccer': { team1: '⚽', team2: '⚽', draw: '🤝' },
    'MLB': { team1: '⚾', team2: '⚾', draw: '🤝' },
    'ESPORTS': { team1: '🎮', team2: '🎮', draw: '🤝' },
    'DEFAULT': { team1: '🔥', team2: '🔥', draw: '🤝' }
  };
  return emojis[marketType] || emojis['DEFAULT'];
}

/**
 * Fetch markets from Polymarket Gamma API
 * @param {object} params - Query parameters
 * @param {number} maxAttempts - Maximum retry attempts
 * @returns {Promise<Array|null>} Array of markets or null if failed
 */
export async function getMarketsFromGammaAPI(params, maxAttempts = 2) {
  const baseUrl = process.env.POLYMARKET_API_URL || 'https://gamma-api.polymarket.com';
  const url = `${baseUrl}/markets`;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Fetching markets from ${url}, attempt ${attempt}/${maxAttempts}`, params);
      
      const response = await axios.get(url, {
        params,
        timeout: 10000
      });
      
      const data = response.data;
      console.log(`Received ${data.length || 0} markets from API`);
      
      return data;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxAttempts) {
        console.error('All attempts failed, returning null');
        return null;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return null;
}

/**
 * Update markets with real-time CLOB prices
 * @param {Array} markets - Array of market objects
 * @returns {Promise<Array>} Updated markets array
 */
export async function updateMarketsWithCLOBPrices(markets) {
  if (!markets || markets.length === 0) {
    return [];
  }
  
  // For production, implement CLOB API integration
  // For now, return markets as-is
  console.log(`Updating CLOB prices for ${markets.length} markets`);
  
  try {
    // This would integrate with the CLOB API to get real-time prices
    // Similar to the Python implementation
    const updatedMarkets = [];
    
    for (const market of markets) {
      try {
        // Placeholder for CLOB price fetching
        // In production: const updatedMarket = await fetchCLOBPrice(market.conditionId);
        updatedMarkets.push(market);
      } catch (error) {
        console.error(`Error updating price for market ${market.id}:`, error);
        updatedMarkets.push(market);
      }
    }
    
    return updatedMarkets;
  } catch (error) {
    console.error('Error in updateMarketsWithCLOBPrices:', error);
    return markets;
  }
}

const SPECIAL_NBA_CONDITION_IDS = [
  '0x6edc6c77c16ef3ba1bcd646159f12f8b8a39528e500dcff95b9220ccfbb75141', // OKC Thunder Finals
  '0xf2a89afeddff5315e37211b0b0e4e93ed167fba2694cd35c252672d0aca73711'
];

function filterFutureMarketsNBA(markets) {
  if (!Array.isArray(markets)) return [];
  const nowMinus24h = Date.now() - 24 * 60 * 60 * 1000; // 24 h back buffer
  return markets.filter(mkt => {
    // Always keep special markets
    if (SPECIAL_NBA_CONDITION_IDS.includes(mkt.conditionId)) return true;

    const spread = parseFloat(mkt.spread ?? 0);
    if (spread > 0.05) return false;

    if (!mkt.gameStartTime) return false;
    const gameTs = Date.parse(mkt.gameStartTime);
    if (isNaN(gameTs)) return false;

    return gameTs > nowMinus24h; // keep if game start is in the future (with −24 h tolerance)
  });
}

// Generic future-filter for other sports
function filterFutureMarketsGeneric(markets) {
  if (!Array.isArray(markets)) return [];

  const nowMinus2h = Date.now() - 2 * 60 * 60 * 1000; // look-back buffer of 2 h

  return markets.filter(mkt => {
    // Filter out wide-spread derivative markets
    const spread = parseFloat(mkt.spread ?? 0);
    if (spread > 0.05) return false;

    // Prefer gameStartTime when available
    if (mkt.gameStartTime) {
      const ts = Date.parse(mkt.gameStartTime);
      if (isNaN(ts)) return false;
      return ts > nowMinus2h; // keep upcoming or very recent (≤2 h ago)
    }

    // Fallback to endDate if provided
    if (mkt.endDate) {
      const ts = Date.parse(mkt.endDate);
      if (isNaN(ts)) return false;
      return ts > Date.now();
    }

    // If no timing info, keep (cannot determine) – upstream filters may drop later
    return true;
  });
}

// Update main filterFutureMarkets switch to use new function
export function filterFutureMarkets(markets, tagName) {
  if (!Array.isArray(markets)) return [];
  switch (tagName) {
    case 'NBA':
      return filterFutureMarketsNBA(markets);
    case 'NFL':
      return filterFutureMarketsGeneric(markets);
    case 'Soccer':
      return filterFutureMarketsGeneric(markets);
    case 'Sports':
      return filterFutureMarketsGeneric(markets);
    default:
      return filterFutureMarketsGeneric(markets);
  }
}

/**
 * Filter NBA markets for relevant content
 * @param {object} market - Market object
 * @returns {boolean} Whether market should be included
 */
function filterNBAMarkets(market) {
  const question = (market.question || '').toLowerCase();
  
  // Include team vs team, player props, totals, etc.
  const relevantKeywords = [
    'vs', 'over', 'under', 'spread', 'moneyline', 'total', 'points',
    'rebounds', 'assists', 'steals', 'blocks', 'three-pointers'
  ];
  
  return relevantKeywords.some(keyword => question.includes(keyword));
}

/**
 * Filter NFL markets for relevant content
 * @param {object} market - Market object
 * @returns {boolean} Whether market should be included
 */
function filterNFLMarkets(market) {
  const question = (market.question || '').toLowerCase();
  
  const relevantKeywords = [
    'vs', 'over', 'under', 'spread', 'moneyline', 'total', 'touchdown',
    'yards', 'passing', 'rushing', 'receiving'
  ];
  
  return relevantKeywords.some(keyword => question.includes(keyword));
}

/**
 * Filter Soccer markets for relevant content
 * @param {object} market - Market object
 * @returns {boolean} Whether market should be included
 */
function filterSoccerMarkets(market) {
  const question = (market.question || '').toLowerCase();
  
  const relevantKeywords = [
    'vs', 'over', 'under', 'goals', 'win', 'draw', 'corners',
    'cards', 'first goal', 'clean sheet'
  ];
  
  return relevantKeywords.some(keyword => question.includes(keyword));
}

/**
 * Filter MLB markets for relevant content
 * @param {object} market - Market object
 * @returns {boolean} Whether market should be included
 */
function filterMLBMarkets(market) {
  const question = (market.question || '').toLowerCase();
  
  const relevantKeywords = [
    'vs', 'over', 'under', 'runs', 'hits', 'home runs', 'strikeouts',
    'innings', 'rbi', 'stolen bases'
  ];
  
  return relevantKeywords.some(keyword => question.includes(keyword));
}

/**
 * Filter NBA markets specifically for moneyline bets
 * @param {Array} markets - Array of market objects
 * @returns {Array} Filtered markets array
 */
export function filterNBAMoneylineMarkets(markets) {
  if (!Array.isArray(markets)) return [];
  const moneyline = [];
  markets.forEach(mkt => {
    // Always include special finals markets
    if (SPECIAL_NBA_CONDITION_IDS.includes(mkt.conditionId)) {
      moneyline.push(mkt);
      return;
    }
    const type = (mkt.sportsMarketType || '').toLowerCase();
    if (type === 'spreads' || type === 'totals') return;
    let outcomes;
    try {
      outcomes = JSON.parse(mkt.outcomes || '[]');
    } catch {
      outcomes = [];
    }
    if (outcomes.length === 2) moneyline.push(mkt);
  });
  return moneyline;
}

/**
 * Filter NBA markets specifically for over/under bets
 * @param {Array} markets - Array of market objects
 * @returns {Array} Filtered markets array
 */
export function filterNBAOverUnderMarkets(markets) {
  if (!Array.isArray(markets)) return [];
  return markets.filter(mkt => {
    const type = (mkt.sportsMarketType || '').toLowerCase();
    const spread = parseFloat(mkt.spread ?? 0);
    return type === 'totals' && spread <= 0.05;
  });
}

/**
 * Filter NBA markets specifically for spread bets
 * @param {Array} markets - Array of market objects
 * @returns {Array} Filtered markets array
 */
export function filterNBASpreadMarkets(markets) {
  if (!Array.isArray(markets)) return [];
  return markets.filter(mkt => {
    const type = (mkt.sportsMarketType || '').toLowerCase();
    const spread = parseFloat(mkt.spread ?? 0);
    return type === 'spreads' && spread <= 0.05;
  });
}

/**
 * Create a formatted market string for display
 * @param {object} market - Market object
 * @param {string} marketType - Type of market
 * @returns {string} Formatted market string
 */
export function createMarketString(market, marketType = 'DEFAULT') {
  try {
    const outcomes = JSON.parse(market.outcomes || '[]');
    const prices = JSON.parse(market.outcomePrices || '[]');
    
    let result = '';
    
    if (outcomes.length >= 2 && prices.length >= 2) {
      const price1 = parseFloat(prices[0]) || 0;
      const price2 = parseFloat(prices[1]) || 0;
      
      const americanOdds1 = decimalToAmericanOdds(price1);
      const americanOdds2 = decimalToAmericanOdds(price2);
      
      const emojis = getMarketEmojis(marketType);
      
      result += `${emojis.team1} **${outcomes[0]}:** ${americanOdds1} | `;
      result += `${emojis.team2} **${outcomes[1]}:** ${americanOdds2}\n`;
    }
    
    if (market.volume) {
      result += `💰 Volume: ${formatVolume(market.volume)} | `;
    }
    
    if (market.endDate) {
      result += `⏰ Ends: ${formatDate(market.endDate)}`;
    }
    
    return result || 'Market data loading...';
  } catch (error) {
    console.error('Error creating market string:', error);
    return 'Market data unavailable';
  }
}

/**
 * Format volume for display
 * @param {string|number} volume - Volume value
 * @returns {string} Formatted volume string
 */
export function formatVolume(volume) {
  if (!volume) return 'N/A';
  
  const num = parseFloat(volume);
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}K`;
  }
  return `$${num.toFixed(0)}`;
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
export function formatDate(dateString) {
  if (!dateString) return 'TBD';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get event title from market
 * @param {object} market - Market object
 * @returns {string} Event title
 */
export function getEventTitleFromMarket(market) {
  const question = market.question || market.title || '';
  
  // Extract team names for vs matches
  const vsMatch = question.match(/(.+?)\s+vs\s+(.+?)(\s|$)/i);
  if (vsMatch) {
    return `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}`;
  }
  
  // Return first 50 characters for other events
  return question.substring(0, 50);
}

// ADD: fetch single market by id helper
export async function getMarketById(marketId) {
  try {
    const baseUrl = process.env.POLYMARKET_API_URL || 'https://gamma-api.polymarket.com';
    const url = `${baseUrl}/markets/${marketId}`;
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  } catch (err) {
    console.error('Error fetching market by id:', err.message);
    return null;
  }
} 