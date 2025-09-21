import { Client, Collection } from "discord.js";
import type { Command } from "./command";

type Snowflake = string;

export type ExtendedClient = Client & {
  commands: Collection<string, Command>;
};

export interface Module {
  execute(data: unknown, ...args: any[]): any;
}

export type DocumentChunkMetadata = {
  id: string | number;
  parent_id: Snowflake;
  channel_id: Snowflake;
  is_attachment?: boolean;
  attachment_id?: string;
  attachment_name?: string;
};

export type GuildData = {
  id: number;
  category_id: Snowflake;
  guild_id: Snowflake;
};

export type ChatData = {
  id: number;
  guild_id: Snowflake;
  member_id: Snowflake;
  channel_id: Snowflake;
};
