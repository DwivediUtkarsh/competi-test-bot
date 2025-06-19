import { Redis } from '@upstash/redis';
import { createClient, RedisClientType } from 'redis';

// Session management types
export interface SessionData {
  jti: string;
  userId: string;
  marketId: string;
  discordUser?: any;
  guildName?: string;
  // Enhanced Discord context for webhook notifications
  guildId?: string;
  channelId?: string;
  channelName?: string;
  market?: {
    id: string;
    question: string;
    title: string;
  };
  status?: 'UNUSED' | 'USED';
  createdAt?: string;
  expiresAt: string;
  usedAt?: string;
}

// Local Redis client for development
let redisClient: RedisClientType | null = null;
let upstashClient: Redis | null = null;

const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

/**
 * Initialize storage client based on environment
 */
async function getStorageClient() {
  if (isProduction || isVercel) {
    // Use Upstash Redis in production
    if (!upstashClient) {
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        throw new Error('Upstash Redis environment variables not configured');
      }
      
      upstashClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      console.log('✅ Connected to Upstash Redis for production');
    }
    return upstashClient;
  } else {
    // Use Redis in development
    if (!redisClient || !redisClient.isOpen) {
      redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DB || '0'),
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              console.error('❌ Too many Redis reconnection attempts');
              return new Error('Too many retries');
            }
            return Math.min(retries * 100, 1000);
          },
          connectTimeout: 5000,
        },
      });

      await redisClient.connect();
      console.log('✅ Connected to local Redis for development');
    }
    return redisClient;
  }
}

/**
 * Set session data with expiry
 */
export async function setSession(jti: string, data: SessionData, expirySeconds: number = 300): Promise<boolean> {
  try {
    const client = await getStorageClient();
    const key = `session:${jti}`;
    const value = JSON.stringify(data);

    if (client instanceof Redis) {
      // Use Upstash Redis
      const result = await client.set(key, value, { 
        ex: expirySeconds,
        nx: true // Only set if key doesn't exist (single-use enforcement)
      });
      return result === 'OK';
    } else {
      // Use Redis for development
      const result = await (client as RedisClientType).setNX(key, value);
      if (result) {
        await (client as RedisClientType).expire(key, expirySeconds);
        return true;
      }
      return false;
    }
  } catch (error) {
    console.error('Error setting session:', error);
    throw error;
  }
}

/**
 * Get session data
 */
export async function getSession(jti: string): Promise<SessionData | null> {
  try {
    const client = await getStorageClient();
    const key = `session:${jti}`;

    let data: string | null = null;

    if (client instanceof Redis) {
      // Use Upstash Redis
      data = await client.get(key);
    } else {
      // Use Redis for development
      data = await (client as RedisClientType).get(key);
    }

    if (data) {
      if (typeof data === 'string') {
        return JSON.parse(data) as SessionData;
      } else if (typeof data === 'object' && data !== null) {
        return data as SessionData;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting session:', error);
    throw error;
  }
}

/**
 * Use session (mark as used and return original data)
 */
export async function useSession(jti: string): Promise<SessionData | null> {
  try {
    const client = await getStorageClient();
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
    
    if (client instanceof Redis) {
      // Use Upstash Redis - overwrite existing key
      await client.set(key, JSON.stringify(usedData));
    } else {
      // Use Redis for development
      await (client as RedisClientType).set(key, JSON.stringify(usedData), { XX: true });
    }
    
    return sessionData; // Return original session data
  } catch (error) {
    console.error('Error using session:', error);
    throw error;
  }
}

/**
 * Get session TTL (time to live)
 */
export async function getSessionTTL(jti: string): Promise<number> {
  try {
    const client = await getStorageClient();
    const key = `session:${jti}`;

    if (client instanceof Redis) {
      // Use Upstash Redis
      return await client.ttl(key);
    } else {
      // Use Redis for development
      return await (client as RedisClientType).ttl(key);
    }
  } catch (error) {
    console.error('Error getting session TTL:', error);
    throw error;
  }
}

/**
 * Delete session
 */
export async function deleteSession(jti: string): Promise<boolean> {
  try {
    const client = await getStorageClient();
    const key = `session:${jti}`;

    if (client instanceof Redis) {
      // Use Upstash Redis
      const result = await client.del(key);
      return result > 0;
    } else {
      // Use Redis for development
      const result = await (client as RedisClientType).del(key);
      return result > 0;
    }
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
}

/**
 * Health check for storage
 */
export async function healthCheck(): Promise<{ status: string; storage: string }> {
  try {
    const client = await getStorageClient();
    const testKey = `health:${Date.now()}`;

    if (client instanceof Redis) {
      // Test Upstash Redis
      await client.set(testKey, 'test', { ex: 10 });
      const result = await client.get(testKey);
      await client.del(testKey);
      
      return {
        status: result === 'test' ? 'healthy' : 'unhealthy',
        storage: 'upstash-redis'
      };
    } else {
      // Test local Redis
      await (client as RedisClientType).setEx(testKey, 10, 'test');
      const result = await (client as RedisClientType).get(testKey);
      await (client as RedisClientType).del(testKey);
      
      return {
        status: result === 'test' ? 'healthy' : 'unhealthy',
        storage: 'local-redis'
      };
    }
  } catch (error) {
    console.error('Health check failed:', error);
    return {
      status: 'unhealthy',
      storage: 'unknown'
    };
  }
} 