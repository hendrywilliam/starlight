import type { Module } from "../discord/types/discord";

import type { Document } from "@langchain/core/documents";

export const GUILD_DATA_PREFIX = "guild:";
export const CHAT_DATA_PREFIX = "chat:";
export const VECTOR_QUERY_PREFIX = "vector_query:";
export const VECTOR_RESULT_PREFIX = "vector_result:";

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
  del: (key: string) => Promise<number>;
  addDocuments: (docs: Document[]) => Promise<any>;
  similaritySearch: (query: string) => Promise<any>;
}

export class CacheModule implements Module {
  public client: CacheClient;

  constructor(client: CacheClient) {
    this.client = client;
  }

  public async set(key: string, value: string, options?: CacheOptions) {
    return await this.client.set(key, value, options);
  }

  public async get(key: string) {
    return await this.client.get(key);
  }

  public async del(key: string) {
    return await this.client.del(key);
  }

  public async addDocuments(docs: Document[]) {
    return await this.client.addDocuments(docs);
  }

  public async similaritySearch(query: string) {
    return await this.client.similaritySearch(query);
  }

  public execute(data: unknown, ...args: any[]) {
    return;
  }
}
