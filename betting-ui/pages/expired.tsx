import Head from 'next/head';

export default function Expired() {
  const handleCloseWindow = () => {
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
  };

  return (
    <>
      <Head>
        <title>Session Expired - Polymarket Betting</title>
        <meta name="description" content="Your betting session has expired" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-orange-500 text-6xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Expired</h1>
          <p className="text-gray-600 mb-6">
            Your betting session has expired for security reasons. Please return to Discord and use the <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">/markets</code> command again to place a new bet.
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
            onClick={handleCloseWindow}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors font-semibold flex items-center justify-center space-x-2 mx-auto"
          >
            <span>✖️</span>
            <span>Close Window</span>
          </button>
        </div>
      </div>
    </>
  );
} 