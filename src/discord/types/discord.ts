import { Client, Collection } from "discord.js";
import type { Command } from "./command";

export type ExtendedClient = Client & { commands: Collection<string, Command> };

export interface Module {
  execute(data: unknown, ...args: any[]): any;
}

export type DocumentChunkMetadata = {
  id: string | number;
  parent_id: string;
  channel_id: string;
  is_attachment?: boolean;
  attachment_id?: string;
  attachment_name?: string;
};
