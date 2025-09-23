import { createClient, type RedisClientType } from "redis";
import type { CacheClient, CacheOptions } from "../modules/cache";

export const redisClient = createClient({
  socket: {
    connectTimeout: parseInt(process.env.REDIS_TIMEOUT!, 10) || 1000,
  },
  url: process.env.REDIS_URL as string,
});

// Adapter for Cache module
export class CacheRedisAdapter implements CacheClient {
  private client: typeof redisClient;

  constructor(client: typeof redisClient) {
    this.client = client;
  }

  public async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  public async set(
    key: string,
    value: string,
    options?: CacheOptions
  ): Promise<string | null> {
    return await this.client.set(key, value, options);
  }

  public async hSet(key: string, data: Record<string, any>) {
    return await this.client.hSet(key, data);
  }

  public async del(key: string) {
    return await this.client.del(key);
  }

  public async exists(key: string, duration: number) {
    return await this.client.expire(key, duration);
  }

  public async similaritySearch(query: number[]): Promise<any> {
    return await this.client.ft.search(
      "vector_idx",
      "*=>[KNN 3 @embedding $B AS score]",
      {
        PARAMS: {
          B: Buffer.from(Float32Array.from(query).buffer),
        },
        RETURN: ["content", "embedding"],
        DIALECT: 2,
      }
    );
  }
}
