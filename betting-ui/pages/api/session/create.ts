import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { setSession } from '../../../lib/kv';
import { SessionData } from '../../../types';
import { validateSessionCreate, sendError, sendSuccess, sanitizeInput } from '../../../lib/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
  }

  try {
    // Validate request body
    const validationError = validateSessionCreate(req);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const { 
      userId, 
      marketId, 
      discordUser, 
      guildName,
      // Enhanced Discord context
      guildId,
      channelId,
      channelName,
      market
    } = req.body;

    // Sanitize inputs
    const sanitizedUserId = sanitizeInput(userId, 100);
    const sanitizedMarketId = sanitizeInput(marketId, 100);
    const sanitizedGuildName = guildName ? sanitizeInput(guildName, 200) : null;

    // Generate unique JWT ID
    const jti = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + (5 * 60); // 5 minutes

    // Enhanced session data for JWT payload and storage
    const enhancedSessionData: SessionData = {
      jti,
      userId: sanitizedUserId,
      marketId: sanitizedMarketId,
      discordUser: discordUser || null,
      guildName: sanitizedGuildName,
      guildId: guildId || null,
      channelId: channelId || null,
      channelName: channelName || null,
      market: market || null,
      status: 'UNUSED' as const,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(expiry * 1000).toISOString(),
    };

    // JWT payload with only essential data (keep token short for Discord URL limits)
    const payload = {
      jti,
      userId: sanitizedUserId,
      marketId: sanitizedMarketId,
      iat: now,
      exp: expiry,
      type: 'betting_session'
      // Note: Full session data is stored in KV store, accessed by jti
    };

    // Sign JWT
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
      console.error('SESSION_SECRET not configured');
      return sendError(res, 500, 'Server configuration error', 'CONFIG_ERROR');
    }

    const token = jwt.sign(payload, sessionSecret, {
      algorithm: 'HS256',
    });

    // Store enhanced session data in KV store
    const sessionStored = await setSession(jti, enhancedSessionData, 5 * 60); // 5 minutes

    if (!sessionStored) {
      return sendError(res, 409, 'Session already exists', 'SESSION_EXISTS');
    }

    console.log(`✅ Created enhanced session for user ${sanitizedUserId}, market ${sanitizedMarketId}, guild ${guildName}, jti: ${jti}`);

    return sendSuccess(res, {
      token,
      data: {
        jti,
        userId: sanitizedUserId,
        marketId: sanitizedMarketId,
        guildName: sanitizedGuildName,
        market: market,
        expiresAt: enhancedSessionData.expiresAt,
        expiresIn: 300, // seconds
      },
    }, 201);

  } catch (error) {
    console.error('Error creating enhanced session:', error);
    return sendError(res, 500, 'Failed to create session', 'SESSION_CREATE_ERROR');
  }
} 