import type { CacheType, Interaction, SlashCommandBuilder } from "discord.js";
import type { Module } from "./discord";

export interface CommandLogger {
  info: (message: string, meta?: any) => any;
  warn: (message: string, meta?: any) => any;
  debug: (message: string, meta?: any) => any;
  error: (message: string, meta?: any) => any;
}

export interface Command {
  data: SlashCommandBuilder;
  execute: (
    interaction: Interaction<CacheType>,
    module: Map<string, Module>,
    logger: CommandLogger,
    ...args: unknown[]
  ) => Promise<void>;
}
