import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function ThankYou() {
  const [countdown, setCountdown] = useState(10);
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Try to redirect back to Discord or close
          try {
            window.history.back();
          } catch {
            window.close();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Head>
        <title>Thank You - Polymarket Bet Placed</title>
        <meta name="description" content="Thank you for placing your bet on Polymarket" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full text-center">
          {/* Thank You Icon */}
          <div className="text-purple-500 text-6xl mb-4">🙏</div>
          
          {/* Thank You Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Thank You!</h1>
          <p className="text-gray-600 mb-6 text-lg">
            Your bet has been successfully placed and a notification has been sent to your Discord server.
          </p>
          
          {/* Next Steps */}
          <div className="bg-purple-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-purple-900 mb-3">🚀 Next Steps:</h3>
            <div className="space-y-2 text-left text-purple-800 text-sm">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span>Return to Discord to see your bet confirmation</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span>Track your bet progress in real-time</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span>Get notified of market updates</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span>Collect winnings when market resolves</span>
              </div>
            </div>
          </div>

          {/* Auto redirect notice */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              🔄 Redirecting you back in <span className="font-bold">{countdown}</span> second{countdown !== 1 ? 's' : ''}...
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3">
            <button
              onClick={() => {
                try {
                  window.history.back();
                } catch {
                  window.close();
                }
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg transition-colors font-semibold"
            >
              🔙 Return to Discord
            </button>
            
            <button
              onClick={() => window.close()}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors text-sm"
            >
              ✖️ Close This Tab
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              🔒 Powered by Polymarket • Secure & Decentralized Betting
            </p>
          </div>
        </div>
      </div>
    </>
  );
} 