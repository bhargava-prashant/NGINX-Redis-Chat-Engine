const { createClient } = require('redis');
require('dotenv').config();

const redisClient = createClient({
  url: process.env.REDIS_URL, // MUST start with rediss://
  socket: {
    tls: true, // required for Upstash
  },
});

redisClient.on('error', (err) => console.error('❌ Redis Client Error:', err));

(async () => {
  try {
    await redisClient.connect();
    console.log('✅ Redis connected to Upstash');
  } catch (err) {
    console.error('❌ Redis connection failed:', err);
  }
})();

module.exports = redisClient;
