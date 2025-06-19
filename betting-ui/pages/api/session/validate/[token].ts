import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { useSession } from '../../../../lib/kv';
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
      console.log(`❌ JWT validation failed: ${jwtError.message}`);
      
      return sendError(res, 401, 'Invalid or expired token', 'TOKEN_INVALID');
    }

    const { jti, userId, marketId } = decoded;

    // Check and use session in KV store (single-use enforcement)
    const sessionData = await useSession(jti);

    if (!sessionData) {
      console.log(`❌ Session not found or already used: ${jti}`);
      
      return sendError(res, 401, 'Session not found or already used', 'SESSION_INVALID');
    }

    console.log(`✅ Session validated and marked as used: ${jti}`);

    return sendSuccess(res, {
      valid: true,
      data: {
        jti,
        userId,
        marketId,
        sessionData,
      },
    });

  } catch (error) {
    console.error('Error validating session:', error);
    return sendError(res, 500, 'Failed to validate session', 'SESSION_VALIDATION_ERROR');
  }
} 