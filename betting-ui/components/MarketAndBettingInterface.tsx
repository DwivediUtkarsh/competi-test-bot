import React, { useState } from 'react';
import { Market, BetOutcome, SessionData } from '../types';
import OddsCard from './OddsCard';

interface MarketAndBettingInterfaceProps {
  market: Market;
  onPlaceBet: (outcome: BetOutcome, amount: number) => Promise<void>;
  isPlacingBet: boolean;
  sessionData: SessionData;
}

export default function MarketAndBettingInterface({ 
  market, 
  onPlaceBet, 
  isPlacingBet, 
  sessionData 
}: MarketAndBettingInterfaceProps) {
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
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <h2 className="text-xl font-bold text-yellow-800 mb-2">Market Data Missing</h2>
        <p className="text-yellow-700">Unable to load market information. Please try again.</p>
      </div>
    );
  }

  // Ensure outcomes is an array
  const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header Section with Market Info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-100 p-6 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {market.question || market.title || 'Market Information'}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Market ID: {market.id || 'Unknown'}</span>
              {market.lastUpdated && (
                <span>Updated: {new Date(market.lastUpdated).toLocaleTimeString()}</span>
              )}
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                market.active 
                  ? 'bg-green-100 text-green-800 border border-green-200' 
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
                {market.active ? 'Active' : 'Closed'}
              </span>
            </div>
            {market.description && (
              <p className="text-gray-700 mt-3 text-sm">{market.description}</p>
            )}
          </div>
          
          {/* User Session Info */}
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200 min-w-[200px]">
            <h3 className="font-semibold text-gray-900 mb-2 text-sm">Session Info</h3>
            <p className="text-gray-700 text-xs flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              {sessionData?.discordUser?.username || 'Anonymous'}
            </p>
            <p className="text-gray-600 text-xs mt-1">
              Server: {sessionData?.guildName || 'Unknown'}
            </p>
          </div>
        </div>

        {/* Market Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 font-medium">Volume</p>
            <p className="text-lg font-bold text-gray-900">
              ${market.volume?.toLocaleString() || 'N/A'}
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 font-medium">Liquidity</p>
            <p className="text-lg font-bold text-gray-900">
              ${market.liquidity?.toLocaleString() || 'N/A'}
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 font-medium">End Date</p>
            <p className="text-lg font-bold text-gray-900">
              {market.endDate ? new Date(market.endDate).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 font-medium">Last Updated</p>
            <p className="text-lg font-bold text-gray-900">
              {market.lastUpdated ? new Date(market.lastUpdated).toLocaleTimeString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Betting Interface Section */}
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          🎯 Place Your Bet
          {selectedOutcome && (
            <span className="text-sm font-normal text-gray-600">
              on {selectedOutcome.title}
            </span>
          )}
        </h2>
        
        {/* Betting Options */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
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
            <div className="col-span-2 bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Betting Options Available</h3>
              <p className="text-yellow-700">This market currently has no outcomes available for betting.</p>
            </div>
          )}
        </div>

        {/* Bet Amount and Actions */}
        {selectedOutcome && (
          <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Bet Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  💰 Bet Amount (USD)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
                  placeholder="Enter amount..."
                  required
                />
              </div>

              {/* Bet Summary */}
              {betAmount && parseFloat(betAmount) > 0 && selectedOutcome.price && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">📊 Bet Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Outcome:</span>
                      <span className="font-semibold text-gray-900">{selectedOutcome.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bet Amount:</span>
                      <span className="font-semibold text-gray-900">${betAmount}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600">Potential Win:</span>
                      <span className="font-bold text-green-600">
                        ${(parseFloat(betAmount) / selectedOutcome.price).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Profit:</span>
                      <span className="font-bold text-green-600">
                        ${((parseFloat(betAmount) / selectedOutcome.price) - parseFloat(betAmount)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-6">
              {!showConfirm ? (
                <>
                  <button
                    type="submit"
                    disabled={!betAmount || parseFloat(betAmount) <= 0 || isPlacingBet}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    <span>👀</span>
                    Review Bet
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={isPlacingBet}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    {isPlacingBet ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Placing Bet...
                      </>
                    ) : (
                      <>
                        <span>✅</span>
                        Confirm Bet
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    disabled={isPlacingBet}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
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