import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  // Auto-redirect users who shouldn't be here
  useEffect(() => {
    // If there's a token in the query params, redirect to betting page
    const { token } = router.query;
    if (token) {
      router.push(`/bet/${token}`);
    }
  }, [router]);

  return (
    <>
      <Head>
        <title>Polymarket Betting Interface</title>
        <meta name="description" content="Discord-integrated Polymarket betting interface" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6">
                <span className="text-white font-bold text-2xl"></span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Polymarket Betting Interface
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Seamless betting integration for Discord communities
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                How to Get Started
              </h2>
              <div className="space-y-4 text-left">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <p className="text-gray-700">
                    Use the <code className="bg-gray-100 px-2 py-1 rounded text-sm">/market</code> command in your Discord server
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <p className="text-gray-700">
                    Select a prediction market from the available options
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <p className="text-gray-700">
                    Click the betting link to access this secure interface
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                    4
                  </div>
                  <p className="text-gray-700">
                    Place your bet and return to Discord for updates
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                🔒 Secure Access Required
              </h3>
              <p className="text-yellow-700">
                This betting interface requires a valid session token from Discord. 
                If you're seeing this page, please use the <code className="bg-yellow-100 px-1 py-0.5 rounded">/market</code> command 
                in your Discord server to get started.
              </p>
            </div>

            <div className="mt-8 text-sm text-gray-500">
              <p>
                Powered by Polymarket API • Secure Discord Integration
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 