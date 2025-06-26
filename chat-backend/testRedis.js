// testRedis.js
const { createClient } = require('redis');

const redisClient = createClient({
  url: 'redis://default:Ac5yAAIjcDE2NDZmODBjNDU1NWY0YTY2YjVjYTI4NWEyNzM0YTcxZnAxMA@credible-quetzal-52850.upstash.io:6379',
  socket: {
    tls: true,
  },
});

(async () => {
  try {
    await redisClient.connect();
    console.log('✅ Connected to Upstash Redis');

    await redisClient.set('test-key', 'Hello from Node!');
    const value = await redisClient.get('test-key');
    console.log('🔎 Fetched from Redis:', value);

    await redisClient.quit();
  } catch (err) {
    console.error('❌ Redis Test Failed:', err);
  }
})();
