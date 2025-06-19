import { GetServerSideProps } from 'next';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import toast, { Toaster } from 'react-hot-toast';
import React from 'react';

import MarketAndBettingInterface from '../../components/MarketAndBettingInterface';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorBoundary from '../../components/ErrorBoundary';
import { LiveOddsDisplay } from '../../components/LiveOddsDisplay';
import { useCLOBWebSocket } from '../../hooks/useWebSocket';
import { validateSession, placeBet } from '../../lib/api';
import { Market, SessionData, BetOutcome } from '../../types';

interface BettingPageProps {
  token: string;
  initialSessionData: SessionData;
  initialMarket: Market;
  error?: string;
}

export default function BettingPage({ 
  token, 
  initialSessionData, 
  initialMarket, 
  error 
}: BettingPageProps) {
  const router = useRouter();
  
  // State management
  const [market, setMarket] = useState<Market>(initialMarket);
  const [sessionData, setSessionData] = useState<SessionData>(initialSessionData);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isRefreshingOdds, setIsRefreshingOdds] = useState(false);
  
  // Extract data for CLOB WebSocket
  const tokenIds = market?.outcomes?.map(o => o.tokenId).filter((id): id is string => Boolean(id)) || [];
  const outcomes = market?.outcomes?.map(o => o.title) || [];
  
  // CLOB WebSocket for live odds
  const clobState = useCLOBWebSocket({
    marketId: market?.id || '',
    tokenIds,
    outcomes,
    autoReconnect: true,
  });

  // Debug logging for WebSocket connection
  useEffect(() => {
    console.log('🔍 CLOB WebSocket Config:', {
      marketId: market?.id,
      tokenIds,
      outcomes,
      totalOutcomes: market?.outcomes?.length,
      mappedOutcomes: market?.outcomes?.map(o => ({ title: o.title, tokenId: o.tokenId }))
    });
  }, [market, tokenIds, outcomes]);

  // Session expiry timer
  const timerRef = useRef<NodeJS.Timeout>();
  // Price refresh timer
  const priceRefreshRef = useRef<NodeJS.Timeout>();

  // Helper function to parse and convert odds
  const parseMarketOdds = (marketData: any) => {
    try {
      let outcomes: string[] = [];
      let prices: number[] = [];

      // Parse outcomes
      if (typeof marketData.outcomes === 'string') {
        outcomes = JSON.parse(marketData.outcomes);
      } else if (Array.isArray(marketData.outcomes)) {
        outcomes = marketData.outcomes;
      }

      // Parse outcome prices
      if (typeof marketData.outcomePrices === 'string') {
        const priceStrings = JSON.parse(marketData.outcomePrices);
        prices = priceStrings.map((p: string) => parseFloat(p));
      } else if (Array.isArray(marketData.outcomePrices)) {
        prices = marketData.outcomePrices.map((p: any) => typeof p === 'string' ? parseFloat(p) : p);
      }

      if (outcomes.length === prices.length && outcomes.length > 0) {
        // Try to get real CLOB token IDs from the API response
        let realTokenIds: string[] = [];
        if (marketData.clobTokenIds) {
          try {
            realTokenIds = JSON.parse(marketData.clobTokenIds);
            console.log('✅ Successfully parsed CLOB token IDs:', realTokenIds);
          } catch (e) {
            console.warn('❌ Failed to parse clobTokenIds:', e, 'Raw value:', marketData.clobTokenIds);
          }
        } else {
          console.warn('⚠️ No clobTokenIds found in market data');
        }

        const processedOutcomes = outcomes.map((outcome, index) => ({
          id: `outcome_${index}`,
          title: outcome,
          price: prices[index],
          name: outcome,
          tokenId: realTokenIds[index] || `token_${marketData.id}_${index}`, // Use real token ID if available
        }));
        
        console.log('📋 Processed outcomes with token IDs:', processedOutcomes.map(o => ({ title: o.title, tokenId: o.tokenId })));
        
        return processedOutcomes;
      }
    } catch (parseError) {
      console.warn('Failed to parse market odds:', parseError);
    }

    // Fallback to default structure
    return [
      { id: 'yes', title: 'YES', price: 0.5, name: 'YES', tokenId: 'token_0_0' },
      { id: 'no', title: 'NO', price: 0.5, name: 'NO', tokenId: 'token_0_1' }
    ];
  };

  // Function to refresh market prices (keeping for fallback)
  const refreshMarketPrices = async () => {
    if (!market?.id || isRefreshingOdds) return;

    try {
      setIsRefreshingOdds(true);
      
      // Use local proxy in development to avoid CORS
      const apiUrl = process.env.NODE_ENV === 'development'
        ? '/api/proxy/gamma'
        : process.env.NEXT_PUBLIC_POLYMARKET_API_URL || 'https://gamma-api.polymarket.com';
        
      const response = await axios.get(
        `${apiUrl}/markets/${market.id}`,
        { timeout: 5000 }
      );

      if (response.data) {
        const newOutcomes = parseMarketOdds(response.data);
        
        setMarket(prev => ({
          ...prev,
          outcomes: newOutcomes,
          lastUpdated: new Date().toISOString(),
        }));

        // Show subtle notification for price updates (only if prices actually changed)
        const oldPrices = market.outcomes?.map(o => o.price).join(',') || '';
        const newPrices = newOutcomes.map(o => o.price).join(',');
        
        if (oldPrices !== newPrices) {
          toast.success('Live odds updated', {
            duration: 1500,
            icon: '📈',
            style: {
              background: '#10B981',
              color: 'white',
              fontSize: '14px',
            },
          });
        }
      }
    } catch (error) {
      console.warn('Failed to refresh market prices:', error);
      // Don't show error toast for failed refreshes to avoid spam
    } finally {
      setIsRefreshingOdds(false);
    }
  };

  // Set up price refresh interval (keeping for fallback when WebSocket fails)
  useEffect(() => {
    if (!market?.id) return;

    // Only use polling as fallback if CLOB WebSocket is not connected
    if (!clobState.isConnected) {
      // Refresh immediately on mount
      refreshMarketPrices();

      // Set up 2-second interval
      priceRefreshRef.current = setInterval(refreshMarketPrices, 2000);
    }

    return () => {
      if (priceRefreshRef.current) {
        clearInterval(priceRefreshRef.current);
      }
    };
  }, [market?.id, clobState.isConnected]);

  // Handle errors
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Error</h1>
          <p className="text-gray-600 mb-6">
            {error === 'Session validation failed. Please try again.' 
              ? 'Your betting session has expired or been used. Please return to Discord and use the /markets command again to place a new bet.'
              : error
            }
          </p>
          
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">What to do next:</h3>
            <ol className="text-left text-blue-800 text-sm space-y-1">
              <li>1. Return to your Discord server</li>
              <li>2. Use the <code className="bg-blue-100 px-1 py-0.5 rounded">/markets</code> command</li>
              <li>3. Select your desired market</li>
              <li>4. Click the new betting link</li>
            </ol>
          </div>

          <button
            onClick={() => {
              let closed = false;
              
              try {
                // Strategy 1: Try window.close() for popup windows
                if (window.opener || window.parent !== window) {
                  window.close();
                  closed = true;
                }
              } catch (e) {
                console.log('Strategy 1 failed:', e);
              }

              if (!closed) {
                try {
                  // Strategy 2: Try to go back in history
                  if (window.history.length > 1) {
                    window.history.back();
                    closed = true;
                  }
                } catch (e) {
                  console.log('Strategy 2 failed:', e);
                }
              }

              if (!closed) {
                try {
                  // Strategy 3: Force close attempt
                  window.close();
                  
                  // Check if window is still open after a short delay
                  setTimeout(() => {
                    if (!window.closed) {
                      // Redirect to close-tab page with error context
                      router.push('/close-tab?context=session-error');
                    }
                  }, 500);
                } catch (e) {
                  console.log('Strategy 3 failed:', e);
                  // Redirect to close-tab page
                  router.push('/close-tab?context=session-error');
                }
              }
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors font-semibold flex items-center justify-center space-x-2 mx-auto"
          >
            <span>✖️</span>
            <span>Close Window</span>
          </button>
        </div>
      </div>
    );
  }

  // Function to show session expired countdown
  const showSessionExpiredCountdown = () => {
    let countdown = 3;
    
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    
    // Create content
    const content = document.createElement('div');
    content.style.cssText = `
      text-align: center;
      padding: 2rem;
      background: rgba(251, 146, 60, 0.95);
      border-radius: 1rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      max-width: 400px;
      margin: 0 1rem;
    `;
    
    const updateContent = () => {
      content.innerHTML = `
        <div style="font-size: 4rem; margin-bottom: 1rem;">⏰</div>
        <h2 style="font-size: 1.875rem; font-weight: bold; margin-bottom: 1rem;">Session Expired</h2>
        <p style="font-size: 1.125rem; margin-bottom: 1.5rem; opacity: 0.9;">
          Your betting session has expired for security.
        </p>
        <div style="background: rgba(255, 255, 255, 0.2); border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
          <p style="font-size: 1rem; margin-bottom: 0.5rem;">Closing in:</p>
          <div style="font-size: 3rem; font-weight: bold; color: #FEF3C7;">${countdown}</div>
        </div>
        <button id="cancelExpiredClose" style="
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" 
           onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
          Stay Open
        </button>
      `;
    };
    
    updateContent();
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    // Set up countdown timer
    const timer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        updateContent();
        
        // Add cancel close event listener
        const cancelButton = document.getElementById('cancelExpiredClose');
        if (cancelButton) {
          cancelButton.onclick = () => {
            clearInterval(timer);
            document.body.removeChild(overlay);
            
            // Show message that auto-close was cancelled
            toast.success('Window will stay open. Please return to Discord to start a new session.', {
              duration: 5000,
              style: {
                background: '#F59E0B',
                color: 'white',
              },
            });
          };
        }
      } else {
        clearInterval(timer);
        document.body.removeChild(overlay);
        
        // Now attempt to close the window
        closeWindow();
      }
    }, 1000);
  };

  // Session expiry countdown
  useEffect(() => {
    if (!sessionData?.expiresAt) return;

    const checkExpiry = () => {
      const now = new Date().getTime();
      const expiry = new Date(sessionData.expiresAt).getTime();
      const timeLeft = expiry - now;

      if (timeLeft <= 0) {
        setIsSessionExpired(true);
        toast.error('Session expired!', { duration: 2000 });
        
        // Show countdown overlay for session expiry
        setTimeout(() => {
          showSessionExpiredCountdown();
        }, 1000);
      } else if (timeLeft <= 60000) { // 1 minute warning
        toast.error(`Session expires in ${Math.ceil(timeLeft / 1000)} seconds`, {
          duration: 5000,
        });
      }
    };

    checkExpiry();
    timerRef.current = setInterval(checkExpiry, 10000); // Check every 10 seconds

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionData, router]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (priceRefreshRef.current) {
        clearInterval(priceRefreshRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Helper function to close the window/tab with multiple strategies
  const closeWindow = () => {
    let closed = false;
    
    try {
      // Strategy 1: Try window.close() for popup windows
      if (window.opener || window.parent !== window) {
        window.close();
        closed = true;
      }
    } catch (e) {
      console.log('Strategy 1 failed:', e);
    }

    if (!closed) {
      try {
        // Strategy 2: Try to go back in history
        if (window.history.length > 1) {
          window.history.back();
          closed = true;
        }
      } catch (e) {
        console.log('Strategy 2 failed:', e);
      }
    }

    if (!closed) {
      try {
        // Strategy 3: Force close attempt
        window.close();
        
        // Check if window is still open after a short delay
        setTimeout(() => {
          if (!window.closed) {
            // Show user instructions for manual close
            showManualCloseInstructions();
          }
        }, 500);
      } catch (e) {
        console.log('Strategy 3 failed:', e);
        showManualCloseInstructions();
      }
    }
  };

  // Function to show manual close instructions
  const showManualCloseInstructions = () => {
    // Remove any existing toasts
    toast.dismiss();
    
    // Add bounce animation if not already present
    if (!document.getElementById('bounceAnimation')) {
      const style = document.createElement('style');
      style.id = 'bounceAnimation';
      style.textContent = `
        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
          40%, 43% { transform: translate3d(0,-20px,0); }
          70% { transform: translate3d(0,-10px,0); }
          90% { transform: translate3d(0,-4px,0); }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Create overlay element for manual close instructions
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    
    // Create content
    const content = document.createElement('div');
    content.style.cssText = `
      text-align: center;
      padding: 2rem;
      background: rgba(16, 185, 129, 0.95);
      border-radius: 1rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      max-width: 450px;
      margin: 0 1rem;
    `;
    
    // Detect platform for close instructions
    const isMac = navigator.userAgent.includes('Mac');
    const closeKey = isMac ? 'Cmd+W' : 'Ctrl+W';
    
    content.innerHTML = `
      <div style="font-size: 4rem; margin-bottom: 1rem; animation: bounce 1s infinite;">✅</div>
      <h2 style="font-size: 1.875rem; font-weight: bold; margin-bottom: 1rem;">Bet Placed Successfully!</h2>
      <p style="font-size: 1.125rem; margin-bottom: 1.5rem; opacity: 0.9;">
        Your bet has been placed and Discord notified.
      </p>
      <div style="background: rgba(255, 255, 255, 0.2); border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
        <p style="font-size: 1rem; margin-bottom: 1rem;">Please close this tab manually:</p>
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1rem;">
          <kbd style="background: rgba(255, 255, 255, 0.9); color: #374151; padding: 0.5rem 0.75rem; border-radius: 0.375rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            ${closeKey}
          </kbd>
        </div>
        <p style="font-size: 0.875rem; opacity: 0.8;">or use your browser's close tab button</p>
      </div>
      <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <button id="tryCloseAgain" style="
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" 
           onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
          Try Close Again
        </button>
        <button id="goToCloseInstructions" style="
          background: rgba(59, 130, 246, 0.8);
          border: 1px solid rgba(59, 130, 246, 0.9);
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='rgba(59, 130, 246, 0.9)'" 
           onmouseout="this.style.background='rgba(59, 130, 246, 0.8)'">
          Detailed Instructions
        </button>
      </div>
    `;
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    // Add event listeners
    document.getElementById('tryCloseAgain')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      closeWindow();
    });
    
    document.getElementById('goToCloseInstructions')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      router.push('/close-tab?context=bet-success');
    });
  };

  // Handle bet placement
  const handlePlaceBet = async (outcome: BetOutcome, amount: number) => {
    if (isSessionExpired) {
      toast.error('Session has expired!');
      return;
    }

    setIsPlacingBet(true);
    
    try {
      const response = await placeBet(token, {
        outcome,
        amount,
      });

      if (response.success && response.data) {
        // Show success toast
        toast.success('🎉 Bet placed successfully!', {
          duration: 6000,
          style: {
            background: '#10B981',
            color: 'white',
            fontSize: '16px',
            padding: '16px',
          },
        });

        // Show countdown overlay
        showClosingCountdown();
      } else {
        toast.error(response.error || 'Failed to place bet');
      }
    } catch (error: any) {
      console.error('Bet placement error:', error);
      toast.error(error.response?.data?.error || 'Failed to place bet');
    } finally {
      setIsPlacingBet(false);
    }
  };

  // Function to show closing countdown overlay
  const showClosingCountdown = () => {
    let countdown = 5;
    
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    
    // Create content
    const content = document.createElement('div');
    content.style.cssText = `
      text-align: center;
      padding: 2rem;
      background: rgba(16, 185, 129, 0.95);
      border-radius: 1rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      max-width: 400px;
      margin: 0 1rem;
    `;
    
    const updateContent = () => {
      content.innerHTML = `
        <div style="font-size: 4rem; margin-bottom: 1rem; animation: bounce 1s infinite;">🎉</div>
        <h2 style="font-size: 1.875rem; font-weight: bold; margin-bottom: 1rem;">Bet Placed Successfully!</h2>
        <p style="font-size: 1.125rem; margin-bottom: 1.5rem; opacity: 0.9;">
          Your bet has been placed and Discord has been notified.
        </p>
        <div style="background: rgba(255, 255, 255, 0.2); border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
          <p style="font-size: 1rem; margin-bottom: 0.5rem;">This window will close in:</p>
          <div style="font-size: 3rem; font-weight: bold; color: #FEF3C7;">${countdown}</div>
        </div>
        <button id="cancelClose" style="
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" 
           onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
          Cancel Auto-Close
        </button>
      `;
    };
    
    // Add bounce animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes bounce {
        0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
        40%, 43% { transform: translate3d(0,-20px,0); }
        70% { transform: translate3d(0,-10px,0); }
        90% { transform: translate3d(0,-4px,0); }
      }
    `;
    document.head.appendChild(style);
    
    updateContent();
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    // Set up countdown timer
    const timer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        updateContent();
        
        // Add cancel close event listener
        const cancelButton = document.getElementById('cancelClose');
        if (cancelButton) {
          cancelButton.onclick = () => {
            clearInterval(timer);
            document.body.removeChild(overlay);
            document.head.removeChild(style);
            
            // Show message that auto-close was cancelled
            toast.success('Auto-close cancelled. You can manually close this tab when ready.', {
              duration: 5000,
              style: {
                background: '#3B82F6',
                color: 'white',
              },
            });
          };
        }
      } else {
        clearInterval(timer);
        document.body.removeChild(overlay);
        document.head.removeChild(style);
        
        // Now attempt to close the window
        closeWindow();
      }
    }, 1000);
  };

  if (!market || !sessionData) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary>
      <div key={`betting-page-${market.id}`}>
        <Head>
          <title>{`Place Bet - ${market.question || market.title || 'Polymarket'}`}</title>
          <meta name="description" content="Place your bet on Polymarket" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>

        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <Toaster position="top-right" />
          
          {/* Header */}
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-4xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">P</span>
                  </div>
                  <h1 className="text-xl font-bold text-gray-900">Polymarket Betting</h1>
                </div>
                
                <div className="flex items-center space-x-4">
                  {/* CLOB Connection Status */}
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      clobState.isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm text-gray-600">
                      {clobState.connectionStatus}
                    </span>
                  </div>

                  {/* Live refresh indicator */}
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      isRefreshingOdds ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                    }`} />
                    <span className="text-sm text-gray-600">
                      Live odds
                    </span>
                  </div>

                  {/* Session Timer */}
                  {sessionData.expiresAt && (
                    <SessionTimer expiresAt={sessionData.expiresAt} />
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-4xl mx-auto px-4 py-8">
            <div className="space-y-6">
              {/* Combined Market Info and Betting Interface */}
              <MarketAndBettingInterface
                market={market}
                onPlaceBet={handlePlaceBet}
                isPlacingBet={isPlacingBet}
                sessionData={sessionData}
              />

              {/* Live Odds Display (CLOB WebSocket Section) */}
              <LiveOddsDisplay 
                liveOdds={clobState.liveOdds}
                executedTrades={clobState.executedTrades}
                outcomes={outcomes}
                tokenIds={tokenIds}
                isConnected={clobState.isConnected}
                connectionStatus={clobState.connectionStatus}
                lastUpdate={clobState.lastUpdate}
              />
            </div>
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 mt-12">
            <div className="max-w-4xl mx-auto px-4 py-8">
              <div className="text-center text-gray-600">
                <p>Powered by Polymarket • Secure Betting Platform</p>
                <p className="text-sm mt-2">
                  Session expires at {new Date(sessionData.expiresAt).toLocaleString()}
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  );
}

// Session Timer Component
function SessionTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const left = Math.max(0, expiry - now);
      setTimeLeft(left);
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <div className="text-sm text-gray-600">
      <span className="font-medium">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

// Server-side props with session validation
export const getServerSideProps: GetServerSideProps = async (context) => {
  const { token } = context.params as { token: string };

  if (!token) {
    return {
      redirect: {
        destination: '/expired',
        permanent: false,
      },
    };
  }

  try {
    // Validate session token using our new Next.js API endpoint
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const sessionResponse = await axios.get(
      `${baseUrl}/api/session/validate/${token}`,
      {
        timeout: 10000,
      }
    );

    if (!sessionResponse.data.success || !sessionResponse.data.valid) {
      return {
        redirect: {
          destination: '/expired',
          permanent: false,
        },
      };
    }

    const { jti, userId, marketId, sessionData } = sessionResponse.data.data;

    // Fetch market data
    let market;
    try {
      // Use local proxy to avoid CORS issues in development
      const apiBaseUrl = process.env.NODE_ENV === 'development' 
        ? `${baseUrl}/api/proxy/gamma`
        : process.env.NEXT_PUBLIC_POLYMARKET_API_URL || 'https://gamma-api.polymarket.com';
        
      console.log('🔍 Fetching market data from:', `${apiBaseUrl}/markets/${marketId}`);
      
      const marketResponse = await axios.get(
        `${apiBaseUrl}/markets/${marketId}`,
        {
          timeout: 10000,
        }
      );
      market = marketResponse.data;
      
      console.log('📊 Market data received:', {
        id: market?.id,
        question: market?.question,
        clobTokenIds: market?.clobTokenIds,
        outcomes: market?.outcomes,
        outcomePrices: market?.outcomePrices
      });
      
    } catch (marketError) {
      console.warn('Failed to fetch market data, using fallback:', marketError instanceof Error ? marketError.message : marketError);
    }

    // Ensure market has proper structure with fallback
    const processedMarket = {
      id: marketId,
      question: market?.question || 'Sample Market Question',
      title: market?.title || market?.question || 'Sample Market',
      description: market?.description || null,
      active: market?.active !== false,
      volume: market?.volume ? parseFloat(market.volume) : null,
      liquidity: market?.liquidity ? parseFloat(market.liquidity) : null,
      endDate: market?.endDate || null,
      lastUpdated: new Date().toISOString(),
      outcomes: (() => {
        // Parse real market data from Polymarket API format
        try {
          let outcomes: string[] = [];
          let prices: number[] = [];

          // Parse outcomes - could be JSON string or array
          if (typeof market?.outcomes === 'string') {
            outcomes = JSON.parse(market.outcomes);
          } else if (Array.isArray(market?.outcomes)) {
            outcomes = market.outcomes;
          }

          // Parse outcome prices - could be JSON string or array
          if (typeof market?.outcomePrices === 'string') {
            const priceStrings = JSON.parse(market.outcomePrices);
            prices = priceStrings.map((p: string) => parseFloat(p));
          } else if (Array.isArray(market?.outcomePrices)) {
            prices = market.outcomePrices.map((p: any) => typeof p === 'string' ? parseFloat(p) : p);
          }

          // If we successfully parsed both and they match in length
          if (outcomes.length === prices.length && outcomes.length > 0) {
            // Try to get real CLOB token IDs from the API response
            let realTokenIds: string[] = [];
            if (market?.clobTokenIds) {
              try {
                realTokenIds = JSON.parse(market.clobTokenIds);
                console.log('✅ Successfully parsed CLOB token IDs:', realTokenIds);
              } catch (e) {
                console.warn('❌ Failed to parse clobTokenIds:', e, 'Raw value:', market.clobTokenIds);
              }
            } else {
              console.warn('⚠️ No clobTokenIds found in market data');
            }

            const processedOutcomes = outcomes.map((outcome, index) => ({
              id: `outcome_${index}`,
              title: outcome,
              price: prices[index],
              name: outcome,
              tokenId: realTokenIds[index] || `token_${marketId}_${index}`, // Use real token ID if available
            }));
            
            console.log('📋 Processed outcomes with token IDs:', processedOutcomes.map(o => ({ title: o.title, tokenId: o.tokenId })));
            
            return processedOutcomes;
          }
        } catch (parseError) {
          console.warn('Failed to parse market data on server:', parseError);
        }

        // Check for alternative structure with tokens array
        if (market?.tokens && Array.isArray(market.tokens)) {
          return market.tokens.map((token: any, index: number) => ({
            id: token.id || `token_${index}`,
            title: token.outcome || (index === 0 ? 'Option A' : 'Option B'),
            price: typeof token.price === 'string' ? parseFloat(token.price) : (token.price || 0.5),
            name: token.outcome || (index === 0 ? 'Option A' : 'Option B'),
            ...(token.description ? { description: token.description } : {}),
            tokenId: token.id || `token_${marketId}_${index}`,
          }));
        } else {
          // Final fallback to neutral structure (avoid showing fake 65%/35%)
          return [
            {
              id: 'yes',
              title: 'Option A',
              price: 0.5,
              name: 'Option A',
              tokenId: 'token_0_0',
            },
            {
              id: 'no',
              title: 'Option B', 
              price: 0.5,
              name: 'Option B',
              tokenId: 'token_0_1',
            }
          ];
        }
      })()
    };

    return {
      props: {
        token,
        initialSessionData: {
          jti,
          userId,
          marketId,
          expiresAt: sessionData?.expiresAt || new Date(Date.now() + 300000).toISOString(), // 5 min default
          discordUser: sessionData?.discordUser || null,
          guildName: sessionData?.guildName || null,
        },
        initialMarket: processedMarket,
      },
    };

  } catch (error: any) {
    console.error('Server-side validation error:', error.message);

    return {
      props: {
        token,
        initialSessionData: {
          jti: '',
          userId: '',
          marketId: '',
          expiresAt: new Date().toISOString(),
          discordUser: null,
          guildName: null,
        },
        initialMarket: {
          id: '',
          title: 'Error Loading Market',
          question: 'Error Loading Market',
          description: null,
          active: false,
          volume: null,
          liquidity: null,
          endDate: null,
          lastUpdated: new Date().toISOString(),
          outcomes: [],
        },
        error: 'Session validation failed. Please try again.',
      },
    };
  }
}; 