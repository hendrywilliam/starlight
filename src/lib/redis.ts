import { createClient } from "redis";

export const redisClient = createClient({
  socket: {
    connectTimeout: parseInt(process.env.REDIS_ENV!, 10) || 1000,
  },
  url: process.env.REDIS_URL as string,
});
