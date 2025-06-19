import { Redis } from '@upstash/redis';

// Session management types
export interface SessionData {
  userId: string;
  marketId: string;
  discordUser?: any;
  guildName?: string;
  status: 'UNUSED' | 'USED';
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Set session data with expiry
 */
export async function setSession(jti: string, data: SessionData, expirySeconds: number = 300): Promise<boolean> {
  try {
    const key = `session:${jti}`;
    const value = JSON.stringify(data);

    // Use SETNX to ensure single-use (set if not exists)
    const result = await redis.set(key, value, { 
      nx: true, // Only set if key doesn't exist
      ex: expirySeconds // Set expiry in seconds
    });
    
    return result === 'OK';
  } catch (error) {
    console.error('Error setting session in Upstash Redis:', error);
    throw error;
  }
}

/**
 * Get session data
 */
export async function getSession(jti: string): Promise<SessionData | null> {
  try {
    const key = `session:${jti}`;
    const data = await redis.get(key);

    if (data && typeof data === 'string') {
      return JSON.parse(data) as SessionData;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting session from Upstash Redis:', error);
    throw error;
  }
}

/**
 * Use session (mark as used and return original data)
 */
export async function useSession(jti: string): Promise<SessionData | null> {
  try {
    const key = `session:${jti}`;
    
    // Get current session data
    const sessionData = await getSession(jti);
    
    if (!sessionData) {
      return null; // Session doesn't exist
    }
    
    if (sessionData.status === 'USED') {
      return null; // Session already used
    }
    
    // Mark as used
    const usedData: SessionData = { 
      ...sessionData, 
      status: 'USED', 
      usedAt: new Date().toISOString() 
    };
    
    // Update the session data (only if it still exists)
    const result = await redis.set(key, JSON.stringify(usedData), { xx: true });
    
    if (result === 'OK') {
      return sessionData; // Return original session data
    }
    
    return null;
  } catch (error) {
    console.error('Error using session in Upstash Redis:', error);
    throw error;
  }
}

/**
 * Get session TTL (time to live)
 */
export async function getSessionTTL(jti: string): Promise<number> {
  try {
    const key = `session:${jti}`;
    return await redis.ttl(key);
  } catch (error) {
    console.error('Error getting session TTL from Upstash Redis:', error);
    throw error;
  }
}

/**
 * Delete session
 */
export async function deleteSession(jti: string): Promise<boolean> {
  try {
    const key = `session:${jti}`;
    const result = await redis.del(key);
    return result > 0;
  } catch (error) {
    console.error('Error deleting session from Upstash Redis:', error);
    throw error;
  }
}

/**
 * Health check for Upstash Redis
 */
export async function healthCheck(): Promise<{ status: string; storage: string; latency?: number }> {
  try {
    const start = Date.now();
    
    // Test with a simple ping-like operation
    const testKey = `health:${Date.now()}`;
    await redis.set(testKey, 'ok', { ex: 10 });
    const result = await redis.get(testKey);
    await redis.del(testKey);
    
    const latency = Date.now() - start;
    
    if (result === 'ok') {
      return { 
        status: 'healthy', 
        storage: 'upstash-redis',
        latency 
      };
    } else {
      return { 
        status: 'unhealthy', 
        storage: 'upstash-redis' 
      };
    }
  } catch (error) {
    console.error('Upstash Redis health check failed:', error);
    return { 
      status: 'unhealthy', 
      storage: 'upstash-redis' 
    };
  }
}

/**
 * Get Redis client for advanced operations
 */
export function getRedisClient(): Redis {
  return redis;
}

export default redis; 