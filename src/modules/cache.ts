import type { Module } from "../discord/types/discord";

export const GUILD_DATA_PREFIX = "guild_";
export const CHAT_DATA_PREFIX = "chat_";

interface CacheClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options: any) => Promise<string | null>;
}

export class CacheModule implements Module {
  public client: CacheClient;

  constructor(client: CacheClient) {
    this.client = client;
  }

  public async set(key: string, value: string, options?: any) {
    return await this.client.set(key, value, options);
  }

  public async get(key: string) {
    return await this.client.get(key);
  }

  public execute(data: unknown, ...args: any[]) {
    return;
  }
}
