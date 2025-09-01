import type { CacheType, Interaction, SlashCommandBuilder } from "discord.js";
import type { Module } from "./discord";

export interface Command {
  data: SlashCommandBuilder;
  execute: (
    interaction: Interaction<CacheType>,
    module: Map<string, Module>,
    ...args: unknown[]
  ) => Promise<void>;
}
