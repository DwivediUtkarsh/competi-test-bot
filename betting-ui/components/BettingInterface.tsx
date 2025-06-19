import React, { useState } from 'react';
import { Market, BetOutcome, SessionData } from '../types';
import OddsCard from './OddsCard';

interface BettingInterfaceProps {
  market: Market;
  onPlaceBet: (outcome: BetOutcome, amount: number) => Promise<void>;
  isPlacingBet: boolean;
  sessionData: SessionData;
}

export default function BettingInterface({ 
  market, 
  onPlaceBet, 
  isPlacingBet, 
  sessionData 
}: BettingInterfaceProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<BetOutcome | null>(null);
  const [betAmount, setBetAmount] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutcome || !betAmount || parseFloat(betAmount) <= 0) return;

    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    await onPlaceBet(selectedOutcome, parseFloat(betAmount));
    setShowConfirm(false);
    setBetAmount('');
    setSelectedOutcome(null);
  };

  const resetForm = () => {
    setShowConfirm(false);
    setBetAmount('');
    setSelectedOutcome(null);
  };

  // Defensive check for market data
  if (!market) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Market Data Missing</h2>
          <p className="text-yellow-700">Unable to load market information. Please try again.</p>
        </div>
      </div>
    );
  }

  // Ensure outcomes is an array
  const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Market Information */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {market.question || market.title || 'Market Information'}
          </h1>
          <p className="text-gray-600 text-sm">
            Market ID: {market.id || 'Unknown'}
          </p>
          {market.description && (
            <p className="text-gray-700 mt-3">{market.description}</p>
          )}
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Volume</p>
            <p className="text-lg font-semibold">${market.volume?.toLocaleString() || 'N/A'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Liquidity</p>
            <p className="text-lg font-semibold">${market.liquidity?.toLocaleString() || 'N/A'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">End Date</p>
            <p className="text-lg font-semibold">
              {market.endDate ? new Date(market.endDate).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-lg font-semibold capitalize">{market.active ? 'Active' : 'Closed'}</p>
          </div>
        </div>
      </div>

      {/* Betting Interface */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Place Your Bet</h2>
        
        {/* User Info */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Session Info</h3>
          <p className="text-blue-800 text-sm">
            User: {sessionData?.discordUser?.username || 'Anonymous'}
          </p>
          <p className="text-blue-800 text-sm">
            Server: {sessionData?.guildName || 'Unknown'}
          </p>
        </div>

        {/* Outcomes */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {outcomes.length > 0 ? (
            outcomes.map((outcome, idx) => (
              <OddsCard
                key={outcome.id}
                title={outcome.title}
                probability={outcome.price || 0}
                accentColor={idx === 0 ? 'green' : 'red'}
                selected={selectedOutcome?.id === outcome.id}
                onClick={() => setSelectedOutcome(outcome)}
              />
            ))
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Betting Options Available</h3>
              <p className="text-yellow-700">This market currently has no outcomes available for betting.</p>
            </div>
          )}
        </div>

        {/* Bet Amount */}
        {selectedOutcome && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bet Amount (USD)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter amount..."
                required
              />
            </div>

            {/* Bet Summary */}
            {betAmount && parseFloat(betAmount) > 0 && selectedOutcome.price && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Bet Summary</h4>
                <div className="space-y-1 text-sm">
                  <p>Outcome: <span className="font-medium">{selectedOutcome.title}</span></p>
                  <p>Amount: <span className="font-medium">${betAmount}</span></p>
                  <p>Potential Win: <span className="font-medium text-green-600">
                    ${(parseFloat(betAmount) / selectedOutcome.price).toFixed(2)}
                  </span></p>
                  <p>Profit: <span className="font-medium text-green-600">
                    ${((parseFloat(betAmount) / selectedOutcome.price) - parseFloat(betAmount)).toFixed(2)}
                  </span></p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {!showConfirm ? (
                <>
                  <button
                    type="submit"
                    disabled={!betAmount || parseFloat(betAmount) <= 0 || isPlacingBet}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Review Bet
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={isPlacingBet}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    {isPlacingBet ? 'Placing Bet...' : 'Confirm Bet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Back
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 