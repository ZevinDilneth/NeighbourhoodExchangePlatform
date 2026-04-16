import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
  socket: {
    // Stop retrying after 3 attempts — Redis is optional in production
    reconnectStrategy: (retries) => (retries >= 3 ? false : Math.min(retries * 500, 3000)),
  },
});

redisClient.on('error', (err) => {
  // Only log once, not on every retry
  if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') return;
  console.error('❌ Redis error:', err);
});
redisClient.on('connect', () => console.log('✅ Redis connected'));

export const connectRedis = async (): Promise<void> => {
  await redisClient.connect();
};
