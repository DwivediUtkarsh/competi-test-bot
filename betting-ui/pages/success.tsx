import Head from 'next/head';
import { useEffect } from 'react';

export default function Success() {
  useEffect(() => {
    // Auto-close window after 5 seconds
    const timer = setTimeout(() => {
      window.close();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

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
          <div className="text-green-500 text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Bet Placed Successfully!</h1>
          <p className="text-gray-600 mb-6">
            Your bet has been successfully placed on Polymarket. You'll receive updates in Discord about your bet status.
          </p>
          
          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-900 mb-2">What happens next:</h3>
            <ul className="text-left text-green-800 text-sm space-y-1">
              <li>• Your bet is now active on Polymarket</li>
              <li>• You'll get notifications about price changes</li>
              <li>• Track your bet progress in Discord</li>
              <li>• Collect winnings when the market resolves</li>
            </ul>
          </div>

          <div className="text-sm text-gray-500 mb-4">
            This window will close automatically in a few seconds...
          </div>

          <button
            onClick={() => window.close()}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    </>
  );
} 