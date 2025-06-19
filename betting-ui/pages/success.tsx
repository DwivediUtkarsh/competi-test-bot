import Head from 'next/head';
import { useEffect, useState } from 'react';

export default function Success() {
  const [countdown, setCountdown] = useState(5);
  const [autoClose, setAutoClose] = useState(true);

  useEffect(() => {
    if (!autoClose) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Try multiple methods to close the window/tab
          if (window.opener) {
            window.close(); // Close if opened by another window
          } else {
            // If can't close, try to go back to Discord
            try {
              window.history.back();
            } catch {
              // Fallback: try to close anyway
              window.close();
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoClose]);

  const handleCloseNow = () => {
    // Try multiple methods to close the window/tab
    if (window.opener) {
      window.close(); // Close if opened by another window
    } else {
      // If can't close, try to go back
      try {
        window.history.back();
      } catch {
        // Try to close anyway
        window.close();
      }
    }
  };

  const handleStopAutoClose = () => {
    setAutoClose(false);
  };

  return (
    <>
      <Head>
        <title>Bet Placed Successfully - Polymarket</title>
        <meta name="description" content="Your bet has been placed successfully" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          {/* Success Icon */}
          <div className="text-green-500 text-6xl mb-4 animate-bounce">🎉</div>
          
          {/* Success Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Bet Placed Successfully!</h1>
          <p className="text-gray-600 mb-6">
            Your bet has been successfully placed on Polymarket. Check Discord for confirmation and updates!
          </p>
          
          {/* What Happens Next */}
          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-900 mb-2">✅ What happens next:</h3>
            <ul className="text-left text-green-800 text-sm space-y-1">
              <li>• Discord notification sent to your server</li>
              <li>• Your bet is now active on Polymarket</li>
              <li>• Track bet progress in Discord</li>
              <li>• Receive updates on price changes</li>
              <li>• Collect winnings when market resolves</li>
            </ul>
          </div>

          {/* Countdown and Auto-close */}
          {autoClose && countdown > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{countdown}</span>
                </div>
                <span className="text-blue-800 text-sm">
                  Auto-closing in {countdown} second{countdown !== 1 ? 's' : ''}...
                </span>
              </div>
              <button
                onClick={handleStopAutoClose}
                className="text-blue-600 hover:text-blue-800 text-xs underline"
              >
                Cancel auto-close
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3">
            <button
              onClick={handleCloseNow}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg transition-colors font-semibold flex items-center justify-center space-x-2"
            >
              <span>✖️</span>
              <span>Close Window</span>
            </button>
            
            {!autoClose && (
              <button
                onClick={() => {
                  setAutoClose(true);
                  setCountdown(3);
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors text-sm"
              >
                🔄 Restart Auto-close (3s)
              </button>
            )}
          </div>

          {/* Additional Info */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              🔒 Secure transaction completed<br/>
              💬 Return to Discord to see your bet confirmation
            </p>
          </div>
        </div>
      </div>
    </>
  );
} 