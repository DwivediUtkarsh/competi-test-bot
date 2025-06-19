/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Experimental features for better hot reload
  experimental: {
    webpackBuildWorker: true,
    optimizePackageImports: ['axios', 'react-hot-toast'],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },

  // Rewrites for API proxy (optional)
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/proxy/gamma/:path*',
          destination: 'https://gamma-api.polymarket.com/:path*',
        },
      ];
    }
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${process.env.INTERNAL_API_URL || 'http://localhost:3001'}/:path*`,
      },
    ];
  },

  // Enhanced Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // WebSocket support
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Development optimizations
    if (dev) {
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
      };
      
      // Prevent webpack from watching node_modules
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
        aggregateTimeout: 300,
        poll: 1000,
      };
    }

    return config;
  },

  // Image optimization configuration
  images: {
    domains: [
      'polymarket.com',
      'img.icons8.com',
      'via.placeholder.com',
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/bet',
        destination: '/expired',
        permanent: false,
      },
    ];
  },

  // Compress responses
  compress: true,

  // Power by header
  poweredByHeader: false,

  // Generate ETags
  generateEtags: true,

  // Development configuration
  ...(process.env.NODE_ENV === 'development' && {
    eslint: {
      ignoreDuringBuilds: false,
    },
    typescript: {
      ignoreBuildErrors: false,
    },
    // Better error overlay
    onDemandEntries: {
      maxInactiveAge: 60 * 1000,
      pagesBufferLength: 5,
    },
  }),
};

module.exports = nextConfig; 