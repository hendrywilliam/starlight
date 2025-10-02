import { createClient } from "redis";
import type {
  AddDocumentOptions,
  CacheClient,
  CacheOptions,
} from "../modules/cache";

import type { VectorStore } from "@langchain/core/vectorstores";
import type { DocumentInterface } from "@langchain/core/documents";

export const redisClient = createClient({
  socket: {
    connectTimeout: parseInt(process.env.REDIS_TIMEOUT!, 10) || 1000,
  },
  url: process.env.REDIS_URL as string,
  password: process.env.REDIS_PASSWORD as string,
});

// Adapter for Cache module
export class CacheRedisAdapter implements CacheClient {
  private client: typeof redisClient;
  private vectorStore: VectorStore;

  constructor(client: typeof redisClient, vectorStore: VectorStore) {
    this.client = client;
    this.vectorStore = vectorStore;
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

  public async del(key: string) {
    return await this.client.del(key);
  }

  public async exists(key: string, duration: number) {
    return await this.client.expire(key, duration);
  }

  public async addDocuments(
    docs: DocumentInterface[],
    options?: AddDocumentOptions
  ): Promise<any> {
    return await this.vectorStore.addDocuments(docs, options);
  }

  public async similaritySearch(query: string): Promise<any> {
    const queryVector = await this.vectorStore.embeddings.embedQuery(query);
    return await this.vectorStore.similaritySearchVectorWithScore(
      queryVector,
      4
    );
  }
}
