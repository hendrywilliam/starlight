import { Client, Collection } from "discord.js";
import type { Command } from "./command";

export type ExtendedClient = Client & { commands: Collection<string, Command> };

export interface Module {
  execute(data: unknown, ...args: any[]): any;
}
