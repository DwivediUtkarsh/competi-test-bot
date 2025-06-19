import axios from 'axios';
import jwt from 'jsonwebtoken';

/**
 * Create a new betting session for a user and market
 * @param {object} userInfo - Discord user information
 * @param {object} guildInfo - Discord guild information  
 * @param {object} marketData - Market data including marketId and question
 * @param {object} interactionContext - Additional Discord interaction context
 * @returns {Promise<string>} Session URL or fallback URL
 */
export async function createSession(userInfo, guildInfo, marketData, interactionContext = {}) {
  try {
    // Prepare enhanced session payload with Discord context
    const sessionPayload = {
      userId: userInfo.id,                    // String: Discord user ID
      marketId: marketData.marketId,          // String: Market ID
      discordUser: {
        id: userInfo.id,
        username: userInfo.username,
        discriminator: userInfo.discriminator,
        avatar: userInfo.avatar
      },
      guildName: guildInfo?.name || 'Unknown Guild',
      // Enhanced Discord context for webhook notifications
      guildId: guildInfo?.id,
      channelId: interactionContext.channelId,
      channelName: interactionContext.channelName,
      market: {
        id: marketData.marketId,
        question: marketData.question || marketData.title,
        title: marketData.title || marketData.question
      }
    };

    console.log('Creating enhanced session with payload:', JSON.stringify(sessionPayload, null, 2));

    // Updated to use Next.js API endpoint
    const sessionApiUrl = process.env.SESSION_API_URL || 'http://localhost:3000';
    const response = await axios.post(`${sessionApiUrl}/api/session/create`, sessionPayload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });

    console.log('Session API Response:', response.status, response.data);

    if (response.data.success && response.data.token) {
      // Create the betting URL using the Next.js domain
      const uiDomain = process.env.UI_DOMAIN || 'http://localhost:3000';
      const bettingUrl = `${uiDomain}/bet/${response.data.token}`;
      
      console.log('✅ Session created successfully. Betting URL:', bettingUrl);
      return bettingUrl;
    } else {
      console.error('❌ Session creation failed:', response.data);
      // Return fallback URL to Polymarket
      return `https://polymarket.com/event/${marketData.marketId}`;
    }

  } catch (error) {
    console.error('❌ Error creating session:', error.message);
    
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    
    // Return fallback URL to Polymarket
    return `https://polymarket.com/event/${marketData.marketId}`;
  }
}

/**
 * Validate a session token (for debugging/testing)
 * @param {string} token - JWT token to validate
 * @returns {Promise<object|null>} Session data or null if invalid
 */
export async function validateSession(token) {
  try {
    const sessionApiUrl = process.env.SESSION_API_URL || 'http://localhost:3000';
    const response = await axios.get(`${sessionApiUrl}/api/session/validate/${token}`, {
      timeout: 5000,
    });

    if (response.data.success && response.data.valid) {
      return response.data.data;
    }
    
    return null;
  } catch (error) {
    console.error('Error validating session:', error.message);
    return null;
  }
}

/**
 * Check session status without consuming it
 * @param {string} token - JWT token to check
 * @returns {Promise<object|null>} Session status or null if invalid
 */
export async function getSessionStatus(token) {
  try {
    const sessionApiUrl = process.env.SESSION_API_URL || 'http://localhost:3000';
    const response = await axios.get(`${sessionApiUrl}/api/session/status/${token}`, {
      timeout: 5000,
    });

    if (response.data.success) {
      return response.data.data;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting session status:', error.message);
    return null;
  }
}

/**
 * Create a local session token for development/testing
 * @param {object} userInfo - Discord user information
 * @param {string} marketId - Polymarket market ID
 * @returns {string} JWT token
 */
function createLocalSession(userInfo, marketId) {
  try {
    const payload = {
      jti: generateJTI(),
      userId: userInfo.id,                    // String: Discord user ID
      marketId: marketId,                     // String: Market ID
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (5 * 60), // 5 minutes
      type: 'betting_session'
    };

    return jwt.sign(payload, process.env.SESSION_SECRET || 'fallback-secret', {
      algorithm: 'HS256',
    });
  } catch (error) {
    console.error('Error creating local session:', error);
    return 'fallback-token';
  }
}

/**
 * Generate a unique JWT ID
 * @returns {string} Unique identifier
 */
function generateJTI() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
} 