#!/usr/bin/env ts-node

/**
 * Odds Calculator - Convert CLOB WebSocket data to UI format
 * ---------------------------------------------------------
 * 
 * Demonstrates how to convert raw WebSocket order book data
 * into the betting odds format shown in the Discord bot UI:
 * 
 * • Thunder — -217 (EU 1.46)
 * • Pacers — +217 (EU 3.17)
 * 
 * Input: WebSocket BOOK message with mid-prices
 * Output: American odds, European odds, implied probabilities
 */

interface BookData {
  outcome: string;
  midPrice: number;      // From WebSocket: (bestBid + bestAsk) / 2
  probability: number;   // midPrice * 100
}

function calculateAmericanOdds(probability: number): number {
  // Probability as decimal (68.5% = 0.685)
  const prob = probability / 100;
  
  if (prob > 0.5) {
    // Favorite (negative odds): -(prob / (1 - prob)) * 100
    return Math.round(-(prob / (1 - prob)) * 100);
  } else {
    // Underdog (positive odds): ((1 - prob) / prob) * 100
    return Math.round(((1 - prob) / prob) * 100);
  }
}

function calculateEuropeanOdds(probability: number): number {
  // European odds = 1 / probability (as decimal)
  const prob = probability / 100;
  return Math.round((1 / prob) * 100) / 100; // Round to 2 decimal places
}

function formatOddsDisplay(data: BookData): string {
  const americanOdds = calculateAmericanOdds(data.probability);
  const europeanOdds = calculateEuropeanOdds(data.probability);
  
  const americanSign = americanOdds > 0 ? '+' : '';
  
  return `• ${data.outcome} — ${americanSign}${americanOdds} (EU ${europeanOdds})`;
}

// Example: Convert WebSocket data to UI format
console.log('🎯 Converting WebSocket BOOK data to UI odds format:\n');

// Sample data from our WebSocket (Thunder vs Pacers)
const thunderData: BookData = {
  outcome: 'Thunder',
  midPrice: 0.685,    // From WebSocket: (0.68 + 0.69) / 2
  probability: 68.5   // midPrice * 100
};

const pacersData: BookData = {
  outcome: 'Pacers', 
  midPrice: 0.315,    // From WebSocket: (0.31 + 0.32) / 2
  probability: 31.5   // midPrice * 100
};

console.log('📊 Current Market Data:');
console.log(`   Thunder: $${thunderData.midPrice} (${thunderData.probability}%)`);
console.log(`   Pacers:  $${pacersData.midPrice} (${pacersData.probability}%)`);

console.log('\n🎲 Formatted for Discord Bot UI:');
console.log(formatOddsDisplay(thunderData));
console.log(formatOddsDisplay(pacersData));

console.log('\n📈 Calculation Breakdown:');
console.log('Thunder (68.5% probability):');
console.log(`   • American Odds: ${calculateAmericanOdds(68.5)} (negative = favorite)`);
console.log(`   • European Odds: ${calculateEuropeanOdds(68.5)} (lower = more likely)`);
console.log(`   • $100 bet wins: $${Math.abs(100 / (calculateAmericanOdds(68.5) / 100)).toFixed(2)}`);

console.log('\nPacers (31.5% probability):');
console.log(`   • American Odds: +${calculateAmericanOdds(31.5)} (positive = underdog)`);
console.log(`   • European Odds: ${calculateEuropeanOdds(31.5)} (higher = less likely)`);
console.log(`   • $100 bet wins: $${Math.abs(100 * (calculateAmericanOdds(31.5) / 100)).toFixed(2)}`);

console.log('\n💡 Key Insights:');
console.log('   • Thunder is the FAVORITE (negative odds, higher probability)');
console.log('   • Pacers is the UNDERDOG (positive odds, lower probability)');
console.log('   • Probabilities add up to 100% (efficient market)');
console.log('   • WebSocket provides real-time updates of these calculations');

export { calculateAmericanOdds, calculateEuropeanOdds, formatOddsDisplay }; 