import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { getSession, getSessionTTL } from '../../../../lib/upstash-redis';
import { validateToken, sendError, sendSuccess } from '../../../../lib/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET method
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
  }

  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return sendError(res, 400, 'Token is required', 'TOKEN_REQUIRED');
    }

    // Validate token format
    const validationError = validateToken(token);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    // Verify JWT
    let decoded;
    try {
      const sessionSecret = process.env.SESSION_SECRET;
      if (!sessionSecret) {
        console.error('SESSION_SECRET not configured');
        return sendError(res, 500, 'Server configuration error', 'CONFIG_ERROR');
      }

      decoded = jwt.verify(token, sessionSecret, {
        algorithms: ['HS256'],
      }) as any;
    } catch (jwtError: any) {
      return sendError(res, 401, 'Invalid or expired token', 'TOKEN_INVALID');
    }

    const { jti, userId, marketId } = decoded;

    // Get session data without consuming it
    const sessionData = await getSession(jti);

    if (!sessionData) {
      return sendError(res, 404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    // Get TTL
    const ttl = await getSessionTTL(jti);

    return sendSuccess(res, {
      data: {
        jti,
        userId,
        marketId,
        status: sessionData.status,
        ttl: ttl > 0 ? ttl : 0,
        createdAt: sessionData.createdAt,
        expiresAt: sessionData.expiresAt,
        usedAt: sessionData.usedAt || null,
      },
    });

  } catch (error) {
    console.error('Error checking session status:', error);
    return sendError(res, 500, 'Failed to check session status', 'SESSION_STATUS_ERROR');
  }
} 