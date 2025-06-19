import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

export const connectRedis = async (): Promise<RedisClientType> => {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  try {
    // Create Redis client
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB || '0'),
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Too many Redis reconnection attempts, giving up');
            return new Error('Too many retries');
          }
          console.log(`🔄 Redis reconnection attempt ${retries + 1}`);
          return Math.min(retries * 100, 3000);
        },
        connectTimeout: 10000,
      },
    });

    // Event handlers
    redisClient.on('connect', () => {
      console.log('🔗 Redis client connected');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis client ready');
    });

    redisClient.on('error', (error) => {
      console.error('❌ Redis client error:', error);
    });

    redisClient.on('end', () => {
      console.log('🔌 Redis client disconnected');
    });

    // Connect to Redis
    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    console.log('🏓 Redis ping successful');

    return redisClient;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    throw error;
  }
};

export const getRedisClient = async (): Promise<RedisClientType> => {
  if (!redisClient || !redisClient.isOpen) {
    return await connectRedis();
  }
  return redisClient;
};

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

// Session management functions
export const setSession = async (jti: string, data: SessionData, expirySeconds: number = 300): Promise<boolean> => {
  try {
    const client = await getRedisClient();
    const key = `session:${jti}`;
    
    // Use SETNX to ensure single-use
    const result = await client.setNX(key, JSON.stringify(data));
    
    if (result) {
      // Set expiry
      await client.expire(key, expirySeconds);
      return true;
    }
    
    return false; // Session already exists
  } catch (error) {
    console.error('Error setting session in Redis:', error);
    throw error;
  }
};

export const getSession = async (jti: string): Promise<SessionData | null> => {
  try {
    const client = await getRedisClient();
    const key = `session:${jti}`;
    
    const data = await client.get(key);
    
    if (data) {
      return JSON.parse(data) as SessionData;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting session from Redis:', error);
    throw error;
  }
};

export const useSession = async (jti: string): Promise<SessionData | null> => {
  try {
    const client = await getRedisClient();
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
    
    const result = await client.set(key, JSON.stringify(usedData), { XX: true });
    
    if (result === 'OK') {
      return sessionData; // Return original session data
    }
    
    return null;
  } catch (error) {
    console.error('Error using session in Redis:', error);
    throw error;
  }
};

export const getSessionTTL = async (jti: string): Promise<number> => {
  try {
    const client = await getRedisClient();
    const key = `session:${jti}`;
    
    return await client.ttl(key);
  } catch (error) {
    console.error('Error getting session TTL from Redis:', error);
    throw error;
  }
};

export const deleteSession = async (jti: string): Promise<boolean> => {
  try {
    const client = await getRedisClient();
    const key = `session:${jti}`;
    
    const result = await client.del(key);
    return result > 0;
  } catch (error) {
    console.error('Error deleting session from Redis:', error);
    throw error;
  }
}; 