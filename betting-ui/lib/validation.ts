import { NextApiRequest, NextApiResponse } from 'next';

export interface ValidationError {
  success: false;
  error: string;
  code: string;
  details?: string[];
}

/**
 * Validate session creation request
 */
export const validateSessionCreate = (req: NextApiRequest): ValidationError | null => {
  const { userId, marketId } = req.body;
  const errors: string[] = [];

  // Validate userId
  if (!userId) {
    errors.push('userId is required');
  } else if (typeof userId !== 'string') {
    errors.push('userId must be a string');
  } else if (userId.length < 1 || userId.length > 100) {
    errors.push('userId must be between 1 and 100 characters');
  }

  // Validate marketId
  if (!marketId) {
    errors.push('marketId is required');
  } else if (typeof marketId !== 'string') {
    errors.push('marketId must be a string');
  } else if (marketId.length < 1 || marketId.length > 100) {
    errors.push('marketId must be between 1 and 100 characters');
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors,
    };
  }

  return null;
};

/**
 * Validate token parameter
 */
export const validateToken = (token: string): ValidationError | null => {
  if (!token) {
    return {
      success: false,
      error: 'Token is required',
      code: 'TOKEN_REQUIRED',
    };
  }

  if (typeof token !== 'string') {
    return {
      success: false,
      error: 'Token must be a string',
      code: 'INVALID_TOKEN_FORMAT',
    };
  }

  // Basic JWT format validation (3 parts separated by dots)
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    return {
      success: false,
      error: 'Invalid token format',
      code: 'INVALID_TOKEN_FORMAT',
    };
  }

  return null;
};

/**
 * Validate bet placement request
 */
export const validateBetPlacement = (req: NextApiRequest): ValidationError | null => {
  const { outcome, amount } = req.body;
  const errors: string[] = [];

  // Validate outcome
  if (!outcome) {
    errors.push('outcome is required');
  } else if (!['YES', 'NO'].includes(outcome)) {
    errors.push('outcome must be either "YES" or "NO"');
  }

  // Validate amount
  if (!amount) {
    errors.push('amount is required');
  } else if (typeof amount !== 'number') {
    errors.push('amount must be a number');
  } else if (amount <= 0) {
    errors.push('amount must be greater than 0');
  } else if (amount > 10000) {
    errors.push('amount must not exceed 10,000');
  } else if (!Number.isFinite(amount)) {
    errors.push('amount must be a finite number');
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors,
    };
  }

  return null;
};

/**
 * Validate market ID from Polymarket
 */
export const validateMarketId = (marketId: string): boolean => {
  if (!marketId || typeof marketId !== 'string') {
    return false;
  }

  // Polymarket market IDs are typically UUIDs or hex strings
  const marketIdPattern = /^[a-fA-F0-9\-]{1,100}$/;
  return marketIdPattern.test(marketId);
};

/**
 * Validate Discord user ID
 */
export const validateDiscordUserId = (userId: string): boolean => {
  if (!userId || typeof userId !== 'string') {
    return false;
  }

  // Discord user IDs are snowflakes (17-19 digit numbers)
  const userIdPattern = /^\d{17,19}$/;
  return userIdPattern.test(userId);
};

/**
 * General purpose data sanitization
 */
export const sanitizeInput = (input: any, maxLength: number = 1000): any => {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, ''); // Remove potential XSS characters
};

/**
 * Error response helper
 */
export const sendError = (
  res: NextApiResponse,
  statusCode: number,
  error: string,
  code: string,
  details?: string[]
) => {
  res.status(statusCode).json({
    success: false,
    error,
    code,
    ...(details && { details }),
  });
};

/**
 * Success response helper
 */
export const sendSuccess = (
  res: NextApiResponse,
  data: any,
  statusCode: number = 200
) => {
  res.status(statusCode).json({
    success: true,
    ...data,
  });
}; 