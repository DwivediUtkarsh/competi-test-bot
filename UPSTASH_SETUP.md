# Upstash Redis Setup Guide

This guide will help you migrate from local Redis to Upstash Redis for your Polymarket Discord Bot.

## Prerequisites

- Node.js 18+ installed
- Upstash account (free tier available)
- Access to your project environment variables

## Step 1: Create Upstash Database

1. **Sign Up**: Go to [https://upstash.com/](https://upstash.com/) and create an account
2. **Create Database**:
   - Click "Create Database"
   - Choose a region close to your users
   - Name: `polymarket-bot-redis`
   - Select appropriate plan (free tier: 10K commands/day)
3. **Get Credentials**:
   - Copy `UPSTASH_REDIS_REST_URL`
   - Copy `UPSTASH_REDIS_REST_TOKEN`

## Step 2: Update Environment Variables

Add these variables to your `betting-ui/.env.local`:

```bash
# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# Keep existing variables
SESSION_SECRET=your-super-secret-jwt-signing-key-at-least-256-bits
NEXT_PUBLIC_API_URL=http://localhost:3001
# ... other existing variables
```

## Step 3: Install Dependencies

The Upstash Redis SDK is already installed. If you need to install it manually:

```bash
cd betting-ui
npm install @upstash/redis
```

## Step 4: Test Configuration

Run the migration test script to validate your setup:

```bash
cd betting-ui
npm run test:redis
```

This will test:
- ✅ Connection to Upstash
- ✅ Basic Redis operations (SET, GET, DEL)
- ✅ Advanced operations (NX, XX, TTL)
- ✅ Performance metrics

## Step 5: Start Your Application

```bash
cd betting-ui
npm run dev
```

## Step 6: Verify Health Check

Once your app is running, check the health endpoint:

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-10T12:00:00.000Z",
  "redis": {
    "status": "healthy",
    "storage": "upstash-redis",
    "latency": 45
  },
  "uptime": 123.456,
  "memory": { ... }
}
```

## Migration Benefits

### Before (Local Redis)
- ❌ Requires Redis server setup
- ❌ Manual scaling
- ❌ No built-in persistence
- ❌ Single point of failure
- ❌ Manual backups

### After (Upstash Redis)
- ✅ Serverless, no setup required
- ✅ Auto-scaling
- ✅ Built-in persistence
- ✅ High availability
- ✅ Automatic backups
- ✅ Global distribution
- ✅ Pay-per-use pricing

## Features Supported

All existing Redis functionality is preserved:

- **Session Management**: JWT token storage with expiration
- **Single-Use Tokens**: Prevents replay attacks
- **TTL Support**: Automatic session cleanup
- **Atomic Operations**: SET NX/XX for race condition prevention
- **Performance**: Sub-100ms latency globally

## Configuration Options

### Basic Configuration
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

### Advanced Configuration
```typescript
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  retry: {
    retries: 3,
    backoff: (retryIndex) => Math.exp(retryIndex) * 50,
  },
  agent: new https.Agent({ keepAlive: true }),
});
```

## API Changes

No breaking changes! All existing session API endpoints work exactly the same:

- `POST /api/session/create` - Create new session
- `GET /api/session/status/[token]` - Check session status
- `GET /api/session/validate/[token]` - Validate and consume session
- `GET /api/health` - Health check

## Monitoring

### Upstash Console
- Monitor command usage
- View performance metrics
- Set up alerts
- Manage database settings

### Application Logs
```bash
# Successful operations
✅ Session created successfully
✅ Session validated and marked as used

# Error handling
❌ Error setting session in Upstash Redis: [error details]
```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   ```
   Error: Invalid URL or token
   ```
   - Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   - Check if credentials are from the correct database

2. **High Latency**
   ```
   ⚠️ High latency detected - check your region configuration
   ```
   - Choose a region closer to your application
   - Consider global database for worldwide users

3. **Rate Limiting**
   ```
   Error: Rate limit exceeded
   ```
   - Upgrade to higher tier
   - Implement request batching
   - Add client-side caching

### Debug Commands

```bash
# Test connection
npm run test:redis

# Check health
curl http://localhost:3000/api/health

# View logs
tail -f logs/session-api.log
```

## Security Best Practices

1. **Environment Variables**: Never commit credentials to version control
2. **Token Rotation**: Regularly rotate Upstash tokens
3. **Network Security**: Use HTTPS for all requests
4. **Access Control**: Limit token permissions in Upstash console

## Cost Optimization

### Free Tier Limits
- 10,000 commands per day
- 256 MB storage
- 1 global database

### Optimization Tips
- Use appropriate TTL values
- Batch operations when possible
- Monitor usage in Upstash console
- Clean up expired sessions

## Rollback Plan

If you need to rollback to local Redis:

1. Update imports:
   ```typescript
   // Change from:
   import { setSession } from '../../../lib/upstash-redis';
   
   // Back to:
   import { setSession } from '../../../lib/kv';
   ```

2. Start local Redis:
   ```bash
   docker-compose -f docker-compose.redis.yml up -d
   ```

3. Update environment variables to use `REDIS_URL`

## Support

- **Upstash Documentation**: [https://docs.upstash.com/](https://docs.upstash.com/)
- **Discord Community**: [Upstash Discord](https://discord.gg/w9SenAtbme)
- **GitHub Issues**: Report bugs in your project repository

## Next Steps

1. ✅ Test all session operations
2. ✅ Monitor performance for 24 hours
3. ✅ Set up alerts in Upstash console
4. ✅ Remove local Redis dependencies (optional)
5. ✅ Update deployment configurations

---

**Ready to go serverless with Redis? Your application is now powered by Upstash! 🚀** 