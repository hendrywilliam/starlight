import type { Embeddings } from "@langchain/core/embeddings";
import type { Module } from "../discord/types/discord";

export const GUILD_DATA_PREFIX = "guild:";
export const CHAT_DATA_PREFIX = "chat:";
export const VECTOR_QUERY_PREFIX = "vector_query:";
export const VECTOR_RESULT_PREFIX = "";

export type CacheOptions = {
  EX?: number; // TTL in seconds.
  PX?: number; // TTL in milliseconds.
  NX?: boolean; // Only set if key does not exist.
  XX?: boolean; // Only set if key exists.
};

export interface CacheClient {
  get: (key: string) => Promise<string | null>;
  set: (
    key: string,
    value: string,
    options?: CacheOptions
  ) => Promise<string | null>;
  hSet: (key: string, data: Record<string, any>) => Promise<any>;
  del: (key: string) => Promise<number>;
  similaritySearch: (query: number[]) => Promise<any>;
}

export class CacheModule implements Module {
  public client: CacheClient;
  public embedding: Embeddings;

  constructor(client: CacheClient, embedding: Embeddings) {
    this.client = client;
    this.embedding = embedding;
  }

  public async set(key: string, value: string, options?: CacheOptions) {
    return await this.client.set(key, value, options);
  }

  public async get(key: string) {
    return await this.client.get(key);
  }

  public async hSet(key: string, data: Record<string, any>) {
    return await this.client.hSet(key, data);
  }

  public async del(key: string) {
    return await this.client.del(key);
  }

  public async similaritySearch(query: string) {
    const queryEmbedding = await this.embedding.embedQuery(query);
    return await this.client.similaritySearch(queryEmbedding);
  }

  public execute(data: unknown, ...args: any[]) {
    return;
  }
}
