import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function CloseTab() {
  const [userAgent, setUserAgent] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const { context } = router.query;

  useEffect(() => {
    setUserAgent(navigator.userAgent);
    setIsMobile(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    
    // Try one more time to close the window
    const timer = setTimeout(() => {
      try {
        window.close();
      } catch (e) {
        console.log('Final close attempt failed');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const getCloseInstructions = () => {
    const isChrome = userAgent.includes('Chrome');
    const isFirefox = userAgent.includes('Firefox');
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    const isEdge = userAgent.includes('Edge');

    if (isMobile) {
      if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        return 'Tap the "Done" button or close this tab in Safari';
      } else if (userAgent.includes('Android')) {
        return 'Tap the X button or use your browser\'s close tab option';
      } else {
        return 'Use your browser\'s close tab option';
      }
    } else {
      const baseInstruction = userAgent.includes('Mac') ? 'Press Cmd+W' : 'Press Ctrl+W';
      
      if (isChrome) {
        return `${baseInstruction} to close this tab (Chrome)`;
      } else if (isFirefox) {
        return `${baseInstruction} to close this tab (Firefox)`;
      } else if (isSafari) {
        return `${baseInstruction} to close this tab (Safari)`;
      } else if (isEdge) {
        return `${baseInstruction} to close this tab (Edge)`;
      } else {
        return `${baseInstruction} to close this tab`;
      }
    }
  };

  const isSessionError = context === 'session-error';
  const isBetSuccess = context === 'bet-success';

  return (
    <>
      <Head>
        <title>{isSessionError ? 'Session Error - Close Tab' : 'Bet Placed Successfully - Close Tab'}</title>
        <meta name="description" content={isSessionError ? 'Session error occurred' : 'Your bet has been placed successfully'} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className={`min-h-screen bg-gradient-to-br ${isSessionError ? 'from-orange-50 to-red-50' : 'from-green-50 to-blue-50'} flex items-center justify-center p-4`}>
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full text-center">
          {/* Icon */}
          <div className={`text-6xl mb-4 ${isSessionError ? 'text-orange-500' : 'text-green-500 animate-bounce'}`}>
            {isSessionError ? '⏰' : '🎉'}
          </div>
          
          {/* Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {isSessionError ? 'Session Expired' : 'Bet Placed Successfully!'}
          </h1>
          <p className="text-gray-600 mb-6 text-lg">
            {isSessionError 
              ? 'Your betting session has expired. Please return to Discord and use the /markets command again.'
              : 'Your bet has been successfully placed on Polymarket and a notification has been sent to your Discord server.'
            }
          </p>
          
          {/* Close Instructions */}
          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-blue-900 mb-3">📱 Close This Tab:</h3>
            <div className="text-blue-800 text-lg font-medium mb-2">
              {getCloseInstructions()}
            </div>
            
            {!isMobile && (
              <div className="bg-blue-100 rounded-lg p-3 mt-3">
                <div className="flex items-center justify-center space-x-2">
                  <kbd className="px-2 py-1 bg-white rounded border shadow text-sm">
                    {userAgent.includes('Mac') ? 'Cmd' : 'Ctrl'}
                  </kbd>
                  <span className="text-blue-800">+</span>
                  <kbd className="px-2 py-1 bg-white rounded border shadow text-sm">W</kbd>
                </div>
              </div>
            )}
          </div>

          {/* What Happens Next */}
          <div className={`${isSessionError ? 'bg-orange-50' : 'bg-green-50'} rounded-lg p-4 mb-6`}>
            <h3 className={`font-semibold ${isSessionError ? 'text-orange-900' : 'text-green-900'} mb-2`}>
              {isSessionError ? '🔄 What to do next:' : '✅ What happens next:'}
            </h3>
            {isSessionError ? (
              <ol className="text-left text-orange-800 text-sm space-y-1">
                <li>1. Return to your Discord server</li>
                <li>2. Use the <code className="bg-orange-100 px-1 py-0.5 rounded">/markets</code> command</li>
                <li>3. Select your desired market</li>
                <li>4. Click the new betting link</li>
              </ol>
            ) : (
              <ul className="text-left text-green-800 text-sm space-y-1">
                <li>• Return to Discord to see your bet confirmation</li>
                <li>• Track your bet progress in real-time</li>
                <li>• Receive notifications about market updates</li>
                <li>• Collect winnings when the market resolves</li>
              </ul>
            )}
          </div>

          {/* Alternative Actions */}
          <div className="flex flex-col space-y-3">
            <button
              onClick={() => {
                try {
                  // Try various close methods
                  window.close();
                  setTimeout(() => window.history.back(), 100);
                } catch (e) {
                  alert('Please close this tab manually using your browser controls');
                }
              }}
              className={`${isSessionError ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'} text-white px-6 py-3 rounded-lg transition-colors font-semibold flex items-center justify-center space-x-2`}
            >
              <span>✖️</span>
              <span>Try to Close Tab</span>
            </button>
            
            <button
              onClick={() => {
                window.location.href = 'discord://';
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors text-sm"
            >
              🔗 Open Discord App
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